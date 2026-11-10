# Deployment

Three pieces, deployed separately:

| Piece      | Host                        | Address (suggested)          |
| ---------- | --------------------------- | ---------------------------- |
| Front end  | Vercel                      | `https://boardplayable.site` |
| API        | Any Docker host             | `https://api.boardplayable.site` |
| Database   | Supabase                    | `https://<ref>.supabase.co`  |

No code changes are needed. Everything is set through environment variables.

## 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor**: run `supabase/migrations/20261110000000_init.sql`.
   (CLI alternative: `supabase link --project-ref <ref>` then `supabase db push`.)
3. **Authentication > URL Configuration**
   - Site URL: `https://boardplayable.site`
   - Redirect URLs: `https://boardplayable.site/**` (keep `http://localhost:5173/**` for local work)
4. **Authentication > Sign In / Providers > Email**: leave "Confirm email" on for production.
   The sign-up form handles both cases.
5. Optional, recommended before launch: **Authentication > Emails > SMTP Settings**. Supabase's
   built-in sender is rate-limited and meant for testing.
6. Note these from **Project Settings > API** (or **API Keys**):
   - Project URL
   - Public key (`anon` or `sb_publishable_...`), for the front end
   - If the project still uses the legacy JWT secret (**JWT Keys** page says "Legacy JWT secret"),
     copy that secret for the API. Projects on the newer signing keys don't need it.

Never put the service role / secret key in the front end.

## 2. API (Docker)

The image in `backend/` runs on any host that builds a Dockerfile: Render, Railway, Fly.io,
Google Cloud Run, a VPS. It listens on `$PORT` (default 8000).

Set these variables on the host:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_JWT_SECRET=            # only for legacy-secret projects
CORS_ORIGINS=https://boardplayable.site,https://www.boardplayable.site
```

Example on Render: **New > Web Service**, connect the repo, Root Directory `backend`,
Runtime **Docker**, add the variables, health check path `/health`.

Once it's up, open `https://<host>/health`; it should return `{"status":"ok"}`.

To serve it at `api.boardplayable.site`, add the custom domain in your host's dashboard and create
the DNS record it shows you (usually a CNAME for `api`).

WebSockets: rooms live at `wss://<api>/v1/rooms/<id>`. Pick a host that supports WebSockets
(all of the above do). Room state is in memory, so run a single instance until a shared broker is added.

## 3. Front end (Vercel)

1. **Add New > Project**, import the repo.
2. **Root Directory**: `frontend`. Vercel detects Vite; the defaults are right
   (build `npm run build`, output `dist`).
3. **Environment Variables** (Production, and Preview if you use it):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<public key>
   VITE_API_URL=https://api.boardplayable.site
   ```
4. Deploy. `frontend/vercel.json` already routes every path to the app, so deep links like
   `/games/chess` work on refresh.

`VITE_*` values are baked in at build time. After changing one, redeploy.

## 4. Point the domain at Vercel

1. In the Vercel project: **Settings > Domains**, add `boardplayable.site` and `www.boardplayable.site`.
   Choose one as primary; Vercel redirects the other.
2. At your domain registrar, add the records Vercel shows. Typically:

   | Type  | Name  | Value                  |
   | ----- | ----- | ---------------------- |
   | A     | `@`   | `76.76.21.21`          |
   | CNAME | `www` | `cname.vercel-dns.com` |

   If Vercel shows different values for your project, use those.
   Or move nameservers to Vercel and it manages the records for you.
3. Add the API record too (from step 2), e.g. CNAME `api` → your API host.
4. Wait for DNS (minutes, sometimes hours). Vercel issues HTTPS automatically.

## Checklist after deploying

- `https://boardplayable.site` shows the sign-in page.
- Create an account. The confirmation email links back to `boardplayable.site`, not localhost.
  (If it doesn't, fix the Site URL in Supabase.)
- After signing in you land on Games.
- Forgot password sends an email; the link opens `/reset-password`.
- `https://api.boardplayable.site/health` returns ok.
- In the browser console on the live site, there are no CORS errors calling the API.
  (If there are, check `CORS_ORIGINS` matches the site's origin exactly, with no trailing slash.)
