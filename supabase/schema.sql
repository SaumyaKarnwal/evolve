-- ============================================================================
-- Evolve registry schema (Supabase / Postgres)
--
-- Identity model: Design B — Evolve owns its own `app_user` row, linked to
-- Supabase `auth.users` via `auth_user_id`, with an EMAIL BRIDGE so a person
-- who signs in later (or via a different method) is matched to their existing
-- row by email instead of forking a duplicate identity.
--
-- Provenance model: a `publication` is the stable anchor (one per owner+kind+
-- name); `publication_revision` is an APPEND-ONLY history — revisions are never
-- overwritten, so every published version is recoverable. (Mirrors the
-- anchor+history pattern used for memory.)
--
-- D4: private items never reach the registry. The client only ever inserts
-- items the user has made public; `visibility` is kept for the future 'team'
-- scope but defaults to 'public' because that's the only thing we send.
--
-- Apply this in the Supabase SQL editor (see SETUP.md). Idempotent-ish: drops
-- are intentionally omitted; run on a fresh project.
-- ============================================================================

-- ---- enums ------------------------------------------------------------------
create type item_kind as enum ('skill', 'rule', 'memory', 'command', 'agent');
create type visibility as enum ('private', 'public');

-- ---- identity (Design B) ----------------------------------------------------
create table app_user (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  email         text not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- ---- publications (anchor) --------------------------------------------------
create table publication (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references app_user (id) on delete cascade,
  kind            item_kind not null,
  name            text not null,
  visibility      visibility not null default 'public',
  latest_revision int not null default 0,
  current_hash    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, kind, name)
);

-- ---- revisions (append-only history) ----------------------------------------
create table publication_revision (
  id             uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publication (id) on delete cascade,
  revision       int not null,
  content_hash   text not null,
  body           text not null,
  source_anchor  text,
  created_at     timestamptz not null default now(),
  unique (publication_id, revision)
);

create index publication_owner_idx on publication (owner_id);
create index publication_public_idx on publication (visibility) where visibility = 'public';
create index revision_pub_idx on publication_revision (publication_id);

-- ---- new-user trigger: create or BRIDGE the app_user row --------------------
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- email bridge: adopt a pre-existing row with this email instead of duplicating.
  update app_user set auth_user_id = new.id
    where email = new.email and auth_user_id is null;
  if not found then
    insert into app_user (auth_user_id, email, display_name)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data ->> 'name', new.email))
    on conflict (auth_user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---- row-level security -----------------------------------------------------
alter table app_user enable row level security;
alter table publication enable row level security;
alter table publication_revision enable row level security;

-- app_user: read anyone (for attribution); write only your own row.
create policy app_user_read_all on app_user
  for select using (true);
create policy app_user_write_self on app_user
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- publication: public rows readable by all; full control to the owner.
create policy publication_public_read on publication
  for select using (visibility = 'public');
create policy publication_owner_all on publication
  for all
  using (owner_id in (select id from app_user where auth_user_id = auth.uid()))
  with check (owner_id in (select id from app_user where auth_user_id = auth.uid()));

-- revisions: follow the parent publication's visibility / ownership.
create policy revision_public_read on publication_revision
  for select using (
    publication_id in (select id from publication where visibility = 'public')
  );
create policy revision_owner_all on publication_revision
  for all
  using (publication_id in (
    select p.id from publication p
    join app_user u on p.owner_id = u.id
    where u.auth_user_id = auth.uid()))
  with check (publication_id in (
    select p.id from publication p
    join app_user u on p.owner_id = u.id
    where u.auth_user_id = auth.uid()));

-- ---- atomic write RPCs ------------------------------------------------------
-- Publishing is one transaction: create the publication on first publish, or
-- append a new revision only when the content hash changed (idempotent re-publish
-- of the same content is a no-op). security definer + an explicit auth.uid()
-- check keeps it safe while bypassing the per-statement RLS dance.
create function publish_item(
  p_kind   item_kind,
  p_name   text,
  p_hash   text,
  p_body   text,
  p_anchor text
) returns publication
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_pub   publication;
  v_next  int;
begin
  select id into v_owner from app_user where auth_user_id = auth.uid();
  if v_owner is null then
    raise exception 'no app_user row for the current session';
  end if;

  select * into v_pub from publication
    where owner_id = v_owner and kind = p_kind and name = p_name;

  if v_pub.id is null then
    insert into publication (owner_id, kind, name, visibility, latest_revision, current_hash)
      values (v_owner, p_kind, p_name, 'public', 1, p_hash)
      returning * into v_pub;
    insert into publication_revision (publication_id, revision, content_hash, body, source_anchor)
      values (v_pub.id, 1, p_hash, p_body, p_anchor);
  elsif v_pub.current_hash is distinct from p_hash then
    v_next := v_pub.latest_revision + 1;
    update publication
      set latest_revision = v_next, current_hash = p_hash,
          visibility = 'public', updated_at = now()
      where id = v_pub.id
      returning * into v_pub;
    insert into publication_revision (publication_id, revision, content_hash, body, source_anchor)
      values (v_pub.id, v_next, p_hash, p_body, p_anchor);
  end if; -- unchanged content → no-op

  return v_pub;
end;
$$;

-- Unpublish = remove from the registry entirely (D4: private items don't live here).
create function unpublish_item(p_kind item_kind, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select id into v_owner from app_user where auth_user_id = auth.uid();
  if v_owner is null then
    raise exception 'no app_user row for the current session';
  end if;
  delete from publication
    where owner_id = v_owner and kind = p_kind and name = p_name;
end;
$$;

-- My own publications (for showing "published" status + drift against local content).
create function my_publications() returns setof publication
language sql security definer set search_path = public stable as $$
  select p.* from publication p
  join app_user u on p.owner_id = u.id
  where u.auth_user_id = auth.uid();
$$;

-- ---- lock the surface: signed-in users, RPCs only -------------------------
-- The three functions above are the ENTIRE client API. Postgres grants EXECUTE to PUBLIC by default
-- (which includes the anonymous role), so we revoke that first, then grant only to authenticated
-- (Google-signed-in) users. And we revoke ALL direct table access from both client roles — no raw
-- CRUD reaches the tables; everything goes through the auth-checked RPCs. Net: nothing but a
-- signed-in Evolve session, doing exactly these operations on its own rows, can touch the data.
-- handle_new_user is a TRIGGER function — it must never be callable from the API. Strip the default
-- PUBLIC execute (the trigger still fires on sign-up regardless of these grants).
revoke execute on function handle_new_user() from public, anon, authenticated;

revoke execute on function publish_item(item_kind, text, text, text, text) from public;
revoke execute on function unpublish_item(item_kind, text) from public;
revoke execute on function my_publications() from public;

grant execute on function publish_item(item_kind, text, text, text, text) to authenticated;
grant execute on function unpublish_item(item_kind, text) to authenticated;
grant execute on function my_publications() to authenticated;

revoke all on table app_user, publication, publication_revision from anon, authenticated;
