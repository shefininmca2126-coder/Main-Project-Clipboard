# Deployment Guide — AI Based Cross Platform Clipboard System

Single-server production deployment (Node + Nginx).

---

## Prerequisites

- Node.js 18+
- MySQL 8+
- Nginx (or Caddy)
- PM2 (`npm install -g pm2`)

---

## 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set all variables (DB_*, JWT_SECRET, MAIL_*, etc.)
npm ci --omit=dev
npm run db:migrate
```

**Start with PM2:**

```bash
# From repo root
pm2 start backend/ecosystem.config.cjs --env production

# Or from backend/
pm2 start ecosystem.config.cjs --env production
```

**Useful PM2 commands:**

- `pm2 list` — status
- `pm2 logs smart-question-api` — logs
- `pm2 restart smart-question-api` — restart
- `pm2 save` and `pm2 startup` — persist across reboot

Backend runs on `PORT` (default 5000). Ensure firewall allows local access (Nginx will proxy).

---

## 2. Frontend build

```bash
cd frontend
npm ci
npm run build
```

Output is in `frontend/dist/`. Copy this directory to the server path used by Nginx (e.g. `/var/www/smart-question-distribution/frontend/dist`).

**Build with API base URL (if frontend is on a different host):**

If the frontend is served from a different origin than the API, set `VITE_API_BASE` at build time and use it in the frontend for API and Socket.io (see `frontend/src/api/client.js`). By default the app uses relative URLs (`/api`, `/socket.io`), which work when Nginx proxies to the same origin.

---

## 3. Nginx

- Copy `deploy/nginx.conf.example` to your Nginx config (e.g. `/etc/nginx/sites-available/smart-question`).
- Replace `YOUR_DOMAIN` with your domain or IP.
- Set `root` to the path where you copied `frontend/dist` (e.g. `/var/www/smart-question-distribution/frontend/dist`).
- Ensure `proxy_pass http://127.0.0.1:5000` matches the backend port.
- Enable site and reload Nginx:

  ```bash
  sudo ln -s /etc/nginx/sites-available/smart-question /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  ```

**SSL (HTTPS):** Use Certbot or your provider’s SSL. Uncomment the SSL lines in the config and the HTTP→HTTPS redirect block.

---

## 4. Environment variables (backend)

| Variable       | Description |
|----------------|-------------|
| `NODE_ENV`     | `production` in production. |
| `PORT`         | Port for the Node server (e.g. 5000). |
| `DB_HOST`      | MySQL host. |
| `DB_PORT`      | MySQL port (default 3306). |
| `DB_USER`      | MySQL user. |
| `DB_PASSWORD`  | MySQL password. |
| `DB_NAME`      | Database name (e.g. `smart_question_system`). |
| `JWT_SECRET`    | Strong random secret for JWT signing. |
| `JWT_EXPIRY`    | Optional (e.g. `24h`). |
| `UPLOAD_DIR`    | Directory for uploaded images (default `uploads`). |
| `MAIL_HOST`    | SMTP host for OTP emails. |
| `MAIL_PORT`    | SMTP port (e.g. 587). |
| `MAIL_USER`    | SMTP user. |
| `MAIL_PASS`    | SMTP password. |
| `MAIL_FROM`    | From address for emails. |

---

## 5. Backup and restart

- **Database:** Use `mysqldump` or your backup tool for the MySQL database.
- **Uploads:** Back up the `backend/uploads/` directory (clipboard images).
- **Restart:** `pm2 restart smart-question-api` after code or env changes. Run `npm run db:migrate` if schema changed.

---

## 6. Limitations (browser)

- Clipboard is captured **only on paste (Ctrl+V)** inside the question area; no background monitoring.
- Paste must occur in the focused app tab; same-origin and user gesture apply.
- See system design document for full limitations and optional Electron upgrade.
