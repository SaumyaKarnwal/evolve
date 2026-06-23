# Evolve's security model: RLS, the function API, and why the anon key is committable

**Date:** 2026-06-23
**Area:** Supabase / Postgres security · backend access control

This note explains how Evolve's backend access control works, why the public
(`anon`) key is safe to commit, and what the real risks are. It came out of a
walkthrough of `supabase/schema.sql`.

---

## 1. The config file and why it's now committed

`evolve.config.json` holds exactly two values:

```json
{ "url": "https://<project>.supabase.co", "anon_key": "sb_publishable_..." }
```

- `url` — the address of the Supabase backend.
- `anon_key` — a **publishable** API key that ships in every released binary.

It used to be gitignored out of pure caution. But the key is public by design
(`src-tauri/src/config.rs:4`: *"designed to ship in clients (RLS protects the
data)"*), so keeping it out of git only bought one thing: **every fresh build
broke**, because the Tauri bundle requires the file as a resource at build time
(`src-tauri/tauri.conf.json:40`). Committing it makes `git clone && cargo tauri
build` work with no setup, and leaks nothing that wasn't already in the binary.

**The one hard rule:** never put the `service_role` key (or DB password, or
Google client secret) in this file. Those bypass everything below.

## 2. What RLS is

Row-Level Security is a Postgres feature that filters **which rows** each user can
see or change. It's an invisible `WHERE` clause the database staples onto every
query against a table — one the client cannot remove. The point: "who can see
what" is enforced **by the database itself**, not by trusting application code.

How it's applied, always two steps:

1. `alter table X enable row level security;` — flips the table to **deny-all**
   (no rows visible until a policy opens a hole). Secure by default.
2. Add **policies**, each opening one specific hole.

A policy has two clauses:
- `USING (...)` — filters rows that already exist → governs **reads**.
- `WITH CHECK (...)` — filters the new row's values → governs **writes**.

`auth.uid()` is the magic function: Supabase sets it to the signed-in user's id
for the request, so a policy can say "only rows that are *yours*."

## 3. The two gates (the key mental model)

A direct table query must pass **two independent checks**, in order:

1. **GRANT** — is this role allowed to touch the table *at all*? (coarse, table-wide)
2. **RLS policy** — *which rows* may it see/write? (fine, per-row; only checked if gate 1 passes)

Both must say yes.

## 4. The exact RLS we wrote

```sql
alter table app_user             enable row level security;
alter table publication          enable row level security;
alter table publication_revision enable row level security;
alter table pull                 enable row level security;
```

- **app_user** — read any row (`using (true)`, for author names); write only your
  own (`auth_user_id = auth.uid()`).
- **publication** — read only `public` rows; full control only over rows you own.
- **publication_revision** — same, but visibility/ownership is inherited from the
  parent publication via a join.
- **pull** — RLS enabled with **no policy** → fully sealed for direct access. A
  live example of default-deny; only reachable through functions.

## 5. The twist: we went stricter than RLS alone

Two mainstream, legitimate Supabase patterns exist:

| Pattern | How | Trade-off |
|---|---|---|
| **A — RLS-first** (common default) | Expose tables; RLS is the only enforcement | Simple, less code |
| **B — Function API** (what Evolve does) | Revoke direct table access; expose only `SECURITY DEFINER` functions; RLS kept as backup | Tiny attack surface + atomic writes; correctness lives in the function bodies |

Evolve uses **B**. `schema.sql` *revokes* all direct table access from the client
roles and exposes only five functions: `publish_item`, `unpublish_item`,
`my_publications`, `browse_public`, `record_pull` — granted to `authenticated`
only.

### How reads still work if direct table access is revoked

A `SECURITY DEFINER` function runs with the privileges of the **function's owner**
(the table owner), not the caller. The owner **bypasses RLS** by default. So
`browse_public()` runs as the owner, sees all rows, and its *own*
`WHERE visibility = 'public'` clause decides what to return. The client never
touches the table — it calls a function that reads on its behalf.

Because RLS is bypassed inside these functions, **each one re-implements the
identity check itself** — e.g. `publish_item` does
`select id from app_user where auth_user_id = auth.uid()` and raises if null.
The `auth.uid()` check moves from the policy *into the code*.

### Why keep RLS on at all, then?

Defense in depth. If someone ever accidentally re-grants direct table access (a
common Supabase dashboard footgun), RLS is the backstop still standing. You'd have
to remove **both** layers to leak private data.

## 6. Threat model — can it be tampered with?

**Can a misuser change the security *rules*? No.** Policies, grants, and function
definitions are schema — changing them needs the `service_role` key or DB owner
password, neither of which is in the client. The public key can't pick the lock.

**Can a misuser abuse the *API* with the public key? Only within their own data:**

| Attempt | Result |
|---|---|
| Call functions without signing in (anon) | ❌ execute revoked from `anon` |
| Read/write tables directly | ❌ direct access revoked (RLS would filter anyway) |
| Sign in (own Google acct) → call the 5 functions | ✅ but every function re-checks `auth.uid()` → own rows only |
| Read others' **public** items | ✅ intended |
| Read/edit/delete **someone else's** rows | ❌ ownership check + RLS backstop |
| Inflate a pull count | ❌ `record_pull` is idempotent per user |
| Forge another identity | ❌ `auth.uid()` comes from a Supabase-signed JWT |

### The risks that are real (and aren't about RLS)

1. **Content supply-chain — the biggest one.** Users publish skills/rules/agents
   that others **adopt into `~/.claude`**, where Claude *executes* them. A
   malicious item (prompt injection / destructive command) is served faithfully by
   a secure DB. `ai_merge` even pipes adopted content into `claude -p`
   (`src-tauri/src/lib.rs:248`). This is a **content-trust** problem RLS can't touch.
2. **Abuse/spam** — no rate limiting, size caps, or moderation in the schema.
3. **service_role secrecy** — if that key ever leaks, the whole model collapses.
4. **No input validation** on published name/body.

## 7. How production systems handle this

Layers, on the assumption any single one can fail:

- Least privilege + RLS (have it)
- Secrets management + rotation + leak scanning (for service_role-class keys)
- Short-lived JWTs, MFA, session revocation
- Rate limiting / quotas at an API gateway or WAF
- Content moderation: scanning, report/flag, human review, banning
- Supply-chain trust: signing, provenance, review, sandboxing, reputation
- Audit logging + anomaly detection
- Input validation / size limits
- Process: security reviews, dependency scanning, pen testing, disclosure path

## 8. Verdict

For Evolve today (you + teammates), the **data access model is well-designed** —
more careful than most hobby apps, and a misuser with the public key can't read or
wreck anyone else's data or change the rules. The anon key is safe to commit.

The gap that grows with adoption is **not** the database — it's **trusting the
content people publish** plus the missing rate-limiting / moderation / validation.
The moment untrusted strangers can publish things others auto-adopt into a
tool-running agent, #1 in §6 is the thing to design for.

> Verification note: this is reconstructed from reading `supabase/schema.sql` and
> the Rust source — it has not been confirmed by querying the live Supabase project
> or by running attacks against it.
