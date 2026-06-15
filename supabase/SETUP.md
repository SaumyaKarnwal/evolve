# Evolve registry — one-time setup (your ~15 min)

This is the part I can't do for you: it needs an account, a browser, and credentials.
Do these steps, then paste me **two values** (Project URL + anon key). Nothing secret leaves
your machine — see the security note at the bottom.

## 1. Create the Supabase project (~3 min)

1. Go to https://supabase.com → sign in → **New project**.
2. Name it (e.g. `evolve`), pick a region near you, set a DB password (save it somewhere; we won't need it in code).
3. Wait for it to provision.

**Data API settings** (the toggle you asked about): **Enable Data API = ON** (the app needs it), and
**Automatically expose new tables = OFF**. Off is correct for us: the schema below exposes *no* direct
table access — the only client API is three auth-checked functions. (If a setting is locked during
creation, set it afterward under **Project Settings → API → Data API**.)

## 2. Apply the schema (~1 min)

1. In the project: **SQL Editor → New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and **Run**.
3. You should see the tables under **Table editor**: `app_user`, `publication`, `publication_revision`.

## 3. Google sign-in (~10 min)

**3a. Make a Google OAuth client**
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill the minimum (app name, your email) → save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Under **Authorized redirect URIs**, add your Supabase callback:
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   (find `<YOUR-PROJECT-REF>` in Supabase → Project Settings → API → Project URL.)
6. Create → copy the **Client ID** and **Client secret**.

**3b. Wire it into Supabase**
1. Supabase → **Authentication → Providers → Google** → enable.
2. Paste the Google **Client ID** and **Client secret** → save.

**3c. Allow the desktop app to receive the login**
1. Supabase → **Authentication → URL Configuration → Redirect URLs** → add:
   `http://localhost:8788` (the local callback the Evolve app will listen on — I'll wire this side).
   *(If we change the port while building, I'll tell you to update this.)*

## 4. Send me two values

From **Supabase → Project Settings → API**, copy and paste back to me:

- **Project URL** — `https://<project-ref>.supabase.co`
- **anon / public key** — the key labeled `anon` `public`

That's it. I'll wire them into the app.

---

## Security note (important)

- The **anon key is publishable** — it's *designed* to ship in client apps and is safe to share with me;
  it's protected by the row-level security policies in `schema.sql`. I'll store it in a **gitignored**
  config, not committed.
- **Do NOT send**: the **service_role key**, the **Google client secret**, or your **DB password**. None of
  those ever go in the app or the repo. If you accidentally paste one, rotate it in the dashboard.
