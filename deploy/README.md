# Deploying Orbit Study (Vultr + Caddy)

Not automated on purpose; deploys need team sign-off.

1. Server: Ubuntu on Vultr Cloud Compute, Node.js 22+ and Caddy installed; ports 80/443 open.
2. DNS: point the GoDaddy Registry domain's A record at the server IP.
3. App: `git clone`, create `.env.local` from `.env.example` with production values
   (Clerk production instance, `NEXT_PUBLIC_APP_URL=https://<domain>`), then `npm ci && npm run build`.
4. Run: `npm start` (port 3000) under a process manager, e.g. a systemd unit with `Restart=always`.
5. HTTPS: copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile` with your domain and reload Caddy.
   Then allow browser uploads from the domain: `npm run storage:cors https://<domain>`
   (it keeps `http://localhost:3000` for local dev; re-running replaces the bucket's CORS rule).
6. Database: run `npm run db:migrate` only after the team agrees the migration is safe for the shared database.
