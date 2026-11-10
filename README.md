# Board Playable

Classic board and card games in 3D, played with friends. Live at boardplayable.site.

This round ships the sign-in flow and the app shell (Games, Friends, Profile). Game engines and live rooms plug in later.

```
frontend/   React + React Three Fiber (Vite). Deploys to Vercel.
backend/    Python FastAPI, with WebSockets for live play. Ships as a Docker image.
supabase/   Database schema (profiles, friendships, invites, stats).
docs/       Deployment guide.
```

The front end and API are separate apps. They only talk through `VITE_API_URL`.
Every URL and key comes from environment variables; nothing is hard-coded.

## Run it locally

You need Node 20+, Python 3.11+ and a Supabase project (the free tier is fine).

### 1. Database

In the Supabase dashboard, open **SQL Editor**, paste in
`supabase/migrations/20261110000000_init.sql` and run it.
(Or, with the Supabase CLI: `supabase link` then `supabase db push`.)

Under **Authentication > URL Configuration**, add `http://localhost:5173/**` to the redirect URLs.

### 2. API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then fill in SUPABASE_URL
uvicorn app.main:app --reload --port 8000
```

Check it at http://localhost:8000/health. Interactive docs are at `/docs`.

Or with Docker:

```bash
docker build -t boardplayable-api backend
docker run --env-file backend/.env -p 8000:8000 boardplayable-api
```

### 3. Front end

```bash
cd frontend
npm install
cp .env.example .env.local         # then fill in the Supabase URL and public key
npm run dev
```

Open http://localhost:5173. If a required variable is missing, the app says which one.

### Tests

```bash
cd frontend && npm test && npm run typecheck
cd backend && pytest
```

## Environment variables

| Where    | Variable                 | What it is                                                     |
| -------- | ------------------------ | -------------------------------------------------------------- |
| frontend | `VITE_SUPABASE_URL`      | Supabase project URL                                           |
| frontend | `VITE_SUPABASE_ANON_KEY` | Supabase public key (anon or publishable). Never the service key |
| frontend | `VITE_API_URL`           | Base URL of the Python API                                     |
| backend  | `SUPABASE_URL`           | Supabase project URL, used to fetch token signing keys         |
| backend  | `SUPABASE_JWT_SECRET`    | Optional. Only for projects on the legacy JWT secret           |
| backend  | `SUPABASE_JWT_AUDIENCE`  | Optional. Defaults to `authenticated`                          |
| backend  | `CORS_ORIGINS`           | Comma-separated front-end origins allowed to call the API      |

## How the code is laid out

```
frontend/src/
  auth/           session provider, route guards, form validation
  pages/auth/     sign-in, create account, reset password
  shell/          app shell and tab bar (top on desktop, bottom on mobile)
  features/       one folder per tab: games, friends, profile
  games/
    catalog.ts    the game list. Add a game here and it appears everywhere
    registry.ts   maps game ids to their engines (loaded on demand)
    engines/      one folder per game engine (see engines/README.md)
  three/          shared 3D canvas and scenes
  components/     buttons, fields and other small pieces
  lib/            env, Supabase client, API client
  styles/         design tokens and global styles

backend/app/
  config.py       settings from the environment
  auth.py         verifies Supabase access tokens
  routes/         HTTP and WebSocket endpoints
  realtime/       room manager for live play
```

### Adding a game

1. Add an entry to `frontend/src/games/catalog.ts`. It shows up on the Games page as "Coming soon".
2. When the engine is ready, build it in `frontend/src/games/engines/<id>/`, register it in
   `registry.ts`, and set the game's `status` to `'available'`. The route `/games/<id>` loads it.

## Deploying

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
