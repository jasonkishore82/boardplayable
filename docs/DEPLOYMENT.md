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
   Sign-up is email first: the user enters their email, confirms it with a 6-digit code, then picks a
   username and password. So open **Authentication > Emails**, and in both the **Confirm sign up** and
   **Magic link** templates make the message body show the code instead of a link, for example:

   ```html
   <h2>Confirm your Board Playable account</h2>
   <p>Your code is:</p>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't sign up, ignore this email.</p>
   ```

   Under **Sign In / Providers > Email**, "Email OTP Length" must be 6 (the default).
5. Before launch, switch auth emails to Resend (see **Email (Resend)** below). Supabase's
   built-in sender is capped at a few messages an hour and is meant for testing only.
6. Note these from **Project Settings > API** (or **API Keys**):
   - Project URL
   - Public key (`anon` or `sb_publishable_...`), for the front end
   - If the project still uses the legacy JWT secret (**JWT Keys** page says "Legacy JWT secret"),
     copy that secret for the API. Projects on the newer signing keys don't need it.

Never put the service role / secret key in the front end.

## 1b. Email (Resend)

Supabase sends sign-up confirmations and password resets by email. Its built-in sender is
rate-limited, so production uses [Resend](https://resend.com) over SMTP. The free tier
(3,000 emails a month) is plenty to start.

1. Create an account at resend.com, then **Domains > Add Domain**. Enter `boardplayable.site`.
   Pick the region closest to your Supabase project.
2. Resend shows DNS records to add at the registrar. Add them (see the GoDaddy table in step 4):
   - a TXT record for DKIM at `resend._domainkey`
   - an MX and a TXT (SPF) record on the `send` subdomain
   - optionally a TXT at `_dmarc` with `v=DMARC1; p=none;`
   Click **Verify**. It usually passes within a few minutes of the records propagating.
3. **API Keys > Create API Key**. Name it `supabase-auth`, permission **Sending access**,
   domain `boardplayable.site`. Copy the key; it is shown once.
4. In Supabase, **Authentication > Emails > SMTP Settings**, turn on **Enable Custom SMTP**:

   | Field          | Value                           |
   | -------------- | ------------------------------- |
   | Sender email   | `noreply@boardplayable.site`    |
   | Sender name    | `Board Playable`                |
   | Host           | `smtp.resend.com`               |
   | Port           | `465`                           |
   | Username       | `resend`                        |
   | Password       | the API key from step 3         |

   Save. The sender address must be on the verified domain; the mailbox does not need to exist.
5. Still under **Authentication**, open **Rate Limits** and raise the email limit from the default
   (a few per hour) to something sensible, e.g. 100 per hour. Supabase only allows this once
   custom SMTP is on.
6. Test: use **Forgot password** on the live site. The email should arrive within seconds from
   `noreply@boardplayable.site`, and the Resend dashboard (**Emails**) lists it as delivered.

The API never sends email itself, so nothing changes in `backend/`.

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

## 2b. API on Vercel (sign-up codes)

The 6-digit sign-up code is made and emailed by the Python API, not by Supabase. Vercel can host it as a
second project next to the front end. `backend/index.py` is the entry point it looks for.

1. In Supabase, run `supabase/migrations/20261110030000_email_otps.sql`. It creates the table that holds the
   hashed codes, locked so only the API can use it.
2. In Vercel: **Add New > Project**, import the same repo, set **Root Directory** to `backend`.
3. **Environment Variables** (Production):
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # Project Settings > API Keys. Secret: server only.
   RESEND_API_KEY=<Resend key>
   RESEND_FROM_EMAIL=Board Playable <noreply@boardplayable.site>
   CORS_ORIGINS=https://boardplayable.site,https://www.boardplayable.site
   ```
4. Deploy, then **Settings > Domains** and add `api.boardplayable.site`. Add the CNAME that Vercel shows at
   your registrar.
5. Open `https://api.boardplayable.site/health`. It should return `{"status":"ok"}`.

The service role key can create and delete any user. Keep it in Vercel's environment variables only. Never put
it in the front end, in Git, or in a `VITE_` variable.

Vercel does not support WebSockets, so live game rooms (`/v1/rooms`) need another host later. Sign-up codes
need only plain HTTP and work fine here.

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
   And the Resend records (from step 1b). Resend shows the exact values; they look like:

   | Type | Name                | Value                                          |
   | ---- | ------------------- | ---------------------------------------------- |
   | TXT  | `resend._domainkey` | `p=MIGf...` (DKIM public key)                  |
   | MX   | `send`              | `feedback-smtp.<region>.amazonses.com`, priority 10 |
   | TXT  | `send`              | `v=spf1 include:amazonses.com ~all`            |
   | TXT  | `_dmarc`            | `v=DMARC1; p=none;`                            |

   GoDaddy wants the **Name** without the domain (type `send`, not `send.boardplayable.site`).
4. Wait for DNS (minutes, sometimes hours). Vercel issues HTTPS automatically.

## Checklist after deploying

- `https://boardplayable.site` shows the sign-in page.
- Create an account. The confirmation email links back to `boardplayable.site`, not localhost.
  (If it doesn't, fix the Site URL in Supabase.)
- After signing in you land on Games.
- Forgot password sends an email; the link opens `/reset-password`.
- `https://api.boardplayable.site/health` returns ok.
- Auth emails arrive from `noreply@boardplayable.site` and show as delivered in Resend.
- In the browser console on the live site, there are no CORS errors calling the API.
  (If there are, check `CORS_ORIGINS` matches the site's origin exactly, with no trailing slash.)
