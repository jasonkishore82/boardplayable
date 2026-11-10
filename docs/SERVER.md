# Host the API on your own server (Docker)

This runs the Python API with WebSockets (live games and in-game chat) and automatic HTTPS on any server that has
Docker. A small Linux VPS is enough. Vercel can't do this part, because it can't keep WebSocket connections open.

```
internet --> Caddy (HTTPS, ports 80/443) --> API container (port 8000, WebSockets)
```

## What you need

- A Linux server with Docker and the Docker Compose plugin (Ubuntu 22.04 or later is fine).
- A domain name for the API, for example `api.boardplayable.site`.
- Ports **80** and **443** open to the internet. Port 8000 stays closed.
- Your Supabase project and a Resend key (see `deploy/.env.example`).

## Steps

1. **Point the domain at the server.** At your registrar (GoDaddy) add an `A` record: name `api`, value = the server's
   public IP address. Wait a few minutes.
2. **Get the code onto the server.**
   ```
   git clone https://github.com/jasonkishore82/boardplayable.git
   cd boardplayable/deploy
   ```
3. **Fill in the settings.**
   ```
   cp .env.example .env
   nano .env
   ```
   Set `API_DOMAIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CORS_ORIGINS`.
4. **Start it.**
   ```
   docker compose up -d --build
   ```
   The first start takes a few minutes. Caddy gets the HTTPS certificate on its own.
5. **Check it.** Open `https://api.boardplayable.site/health`. It should show `{"status":"ok"}`.
6. **Point the website at it.** In the Vercel front-end project set `VITE_API_URL=https://api.boardplayable.site`
   and redeploy. The browser then connects to games with `wss://` automatically.

## Everyday commands

```
docker compose ps                  # is it running, is it healthy
docker compose logs -f api         # watch the API log
git pull && docker compose up -d --build    # update to the newest code
docker compose restart api         # restart the API (this ends any games in progress)
docker compose down                # stop everything
```

## Good to know

- **One copy only.** Game rooms live in the API's memory, so there must be exactly one API container. Do not scale
  it up. Restarting it ends games in progress.
- **Firewall.** Allow 80 and 443 only. On Ubuntu: `sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp`
  (and allow SSH first if you use `ufw`).
- **Secrets.** `deploy/.env` holds your keys. It is ignored by Git. Never commit it.
- **Other hosts.** The same `backend/Dockerfile` works on Render, Railway or Fly.io. They provide HTTPS themselves, so
  skip Caddy and set the same variables in their dashboard.
- **No domain yet?** Run `docker compose up -d --build api`, then `curl http://127.0.0.1:8000/health` on the server
  to prove the API starts. The API is only reachable from the server itself until you add a domain.
