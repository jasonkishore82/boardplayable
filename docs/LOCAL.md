# Local mode (SQLite, no Supabase)

Test sign-up and the rest of the app on your own computer, with no Supabase project involved. The Python API
keeps users in a SQLite file (`backend/local.db`) and signs people in itself.

**Never turn this on in production.** It exists for testing only.

## Turn it on

`backend/.env`
```
LOCAL_MODE=true
```

`frontend/.env.local`
```
VITE_API_URL=http://localhost:8001
VITE_AUTH_BACKEND=local
```
(The two `VITE_SUPABASE_*` lines are not needed. Leave them commented out.)

Start both servers as usual (see the main README). On the first start the API creates `backend/local.db` and
applies `backend/local_migrations/*.sql`.

## What it does

| Step | Local mode |
| --- | --- |
| Create account, enter email | The API makes a 6-digit code. It is **printed in the API console and shown on the sign-up screen**, so no inbox is needed. If `RESEND_API_KEY` is set it is also emailed. |
| Enter the code | The email is confirmed and the user is created in SQLite. |
| Choose username and password | Saved in SQLite. The password is hashed with bcrypt. |
| Sign in, sign out, delete account, stats | All run against SQLite. |
| Forgot password email | Not available in local mode. |

Reset everything by stopping the API and deleting `backend/local.db`.

## Move to Supabase later

The local tables use the same names and columns as the Supabase ones (`profiles`, `friendships`,
`game_invites`, `game_stats`, plus `users` for `auth.users`), so data copies across one to one.

1. Create the Supabase tables: run every file in `supabase/migrations/` in the SQL Editor.
2. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.
3. See what would be copied. This sends nothing:
   ```
   cd backend
   .venv\Scripts\python scripts\export_to_supabase.py
   ```
4. When the counts look right, copy it for real:
   ```
   .venv\Scripts\python scripts\export_to_supabase.py --apply
   ```
5. Switch the app back: set `LOCAL_MODE=false` in `backend/.env`, and in `frontend/.env.local` remove
   `VITE_AUTH_BACKEND=local` and uncomment the two Supabase lines.

Notes:
- Users keep their id, email, username and password. The script sends each bcrypt hash to Supabase. If your
  project refuses imported hashes, it creates the user without a password and they use **Forgot password**.
- Rows that already exist in Supabase are updated, not duplicated.
- Sign-up codes are not copied. Signed-in browsers must sign in again, because local tokens are not Supabase tokens.
- This copies data one way, local to Supabase. Run it once when you switch over.

## Tests

```
cd backend && .venv\Scripts\python -m pytest
```
`tests/test_local.py` runs the whole sign-up flow against a temporary SQLite file.
