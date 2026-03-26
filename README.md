# AI Based Cross Platform Clipboard System

AI Based Cross Platform Clipboard System — MCA Final Year Project.

## Phase 1: Foundation & Project Setup

This repository is set up with:

- **Backend:** Node.js, Express, MySQL connection pool, health routes, upload directory, database schema and migration.
- **Frontend:** React (Vite), React Router, basic layout with Student and Teacher portal placeholders.

### Prerequisites

- Node.js 18+
- MySQL 8+ (or compatible)
- npm or yarn

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: set DB_USER, DB_PASSWORD, and optionally DB_NAME, PORT.
npm install
npm run db:migrate   # Creates database and tables
npm run dev          # Start server (nodemon) on http://localhost:5000
```

**Endpoints (Phase 1):**

- `GET /` — API info
- `GET /api/health` — Server health
- `GET /api/health/db` — Database connection check

**Upload directory:** `backend/uploads` — used in Phase 4 for clipboard submission images. Created automatically on server start.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev          # Start Vite dev server on http://localhost:3000
```

The dev server proxies `/api` to `http://localhost:5000`, so API calls from the frontend can use relative URLs.

### Database

- **Name:** `smart_question_system` (or value of `DB_NAME` in `.env`).
- **Tables:** `batches`, `users`, `question_sets`, `questions`, `assignments`, `submissions`, `otp_verifications`.
- **Migration:** `backend/src/database/schema.sql` applied via `npm run db:migrate`.

### Project Structure (Phase 1)

```
backend/
  src/
    config/database.js    # MySQL pool + testConnection
    database/
      schema.sql         # Full schema
      migrate.js         # Run schema (creates DB if missing)
    routes/health.js     # /api/health, /api/health/db
    index.js             # Express app, CORS, upload dir creation
  uploads/               # Clipboard images (Phase 4)
  .env.example
  package.json

frontend/
  src/
    components/Layout.jsx
    pages/
      HomePage.jsx
      student/StudentLayout.jsx
      teacher/TeacherLayout.jsx
    App.jsx
    main.jsx
    index.css
  index.html
  vite.config.js
  package.json
```

---

## Phase 2: Authentication, Domain Restriction & OTP

Implemented:

- **Domain restriction:** Only `@saintgits.org` emails can register or log in (validated on frontend and backend).
- **Student registration:** Full name, email, password, batch name, roll number. Batch is created if it doesn’t exist.
- **Teacher registration:** Full name, email, password.
- **OTP verification:** 6-digit OTP sent via Nodemailer; account is inactive until verified.
- **Login:** JWT issued after email + password; token required for protected routes.
- **RBAC:** `ProtectedRoute` and backend middleware restrict Student vs Teacher areas.

### Backend (Phase 2)

Add to `.env` (see `.env.example`):

- `JWT_SECRET` — secret for signing JWTs
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` — for OTP emails (e.g. Gmail app password)

**Auth endpoints:**

- `POST /api/auth/register/student` — body: `fullName`, `email`, `password`, `batchName`, `rollNumber`
- `POST /api/auth/register/teacher` — body: `fullName`, `email`, `password`
- `POST /api/auth/verify-otp` — body: `email`, `otp`
- `POST /api/auth/login` — body: `email`, `password` → returns `token` and `user`
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`

### Frontend (Phase 2)

- **Routes:** `/login`, `/verify-otp`, `/student/register`, `/teacher/register`. `/student/*` and `/teacher/*` are protected by role.
- **Auth context:** Stores user and token (localStorage); provides `login`, `logout`, `user`, `loading`.
- **API client:** `api()`, `authApi`; sends `Authorization: Bearer` when token exists.

---

## Phase 3: Batches, Question Sets, Distribution & Student View

Implemented:

- **Teacher:** List all batches → select batch → view students, create question sets (dynamic N), add/delete questions per set, run distribution (roll range, odd/even, random, manual).
- **Student:** “My Questions” page shows only the assigned question set and questions for the student’s batch.

### Backend (Phase 3)

- `GET /api/batches` — list batches (teacher).
- `GET /api/batches/:batchId/students` — list students in batch (teacher).
- `GET /api/batches/:batchId/question-sets`, `POST /api/batches/:batchId/question-sets` — list/create question sets (teacher).
- `PUT /api/question-sets/:setId`, `DELETE /api/question-sets/:setId` — update/delete set (teacher).
- `GET /api/question-sets/:setId/questions`, `POST /api/question-sets/:setId/questions` — list/add questions (teacher).
- `PUT /api/questions/:id`, `DELETE /api/questions/:id` — update/delete question (teacher).
- `POST /api/batches/:batchId/distribute` — body: `{ strategy: 'rollRange'|'oddEven'|'random'|'manual', ... }` (teacher).
- `GET /api/student/assigned-set` — returns assigned set and questions for current student (student).

### Frontend (Phase 3)

- **Teacher:** `/teacher` → batch list; `/teacher/batch/:batchId` → students table, question sets (expand to add questions), distribution form with strategy select and “Run distribution”.
- **Student:** `/student` → “My Questions” with assigned set name and ordered list of questions.

---

## Phase 4: Clipboard Capture, Upload & Submission Storage

Implemented:

- **Frontend:** On the student “My Questions” page, a paste zone listens for Ctrl+V/Cmd+V. When the clipboard contains an image, it is validated (type: PNG/JPEG/GIF/WebP, max 5 MB), sent immediately as `FormData` to the backend (no separate upload button), and a short “Screenshot captured” or error message is shown.
- **Backend:** `POST /api/submissions/clipboard` (student only) accepts a single `image` file (multipart). File is validated (MIME and size), saved under `uploads/` with a random filename, and a row is inserted in `submissions` (`student_id`, `image_path`, `extracted_text` = null, optional `question_set_id` from the student’s assignment). Returns 201 with submission id and message.

---

## Phase 5: OCR, Real-Time Monitoring (Socket.io)

Implemented:

- **OCR:** After saving a clipboard image, the backend runs Tesseract.js (English) in the background, updates `submissions.extracted_text`, then emits a Socket.io event to the teachers’ room.
- **Socket.io server:** Attached to the same HTTP server as Express. JWT auth on connection (handshake `auth.token` or `query.token`). Teachers join room `teachers` and receive `new_submission` events.
- **Payload:** `submissionId`, `studentName`, `rollNumber`, `batchName`, `timestamp`, `extractedText`. Teachers load the image via `GET /api/submissions/:id/image?token=...`.
- **Teacher dashboard:** “Live submissions” page (`/teacher/live`): Socket.io client connects with JWT, listens for `new_submission`, and appends to a live feed (student name, roll, batch, time, thumbnail, extracted text). A “Recent submissions” list loads from `GET /api/submissions` (optional `?batchId=`).

### Backend (Phase 5)

- **Dependencies:** `socket.io`, `tesseract.js`.
- **Server:** `http.createServer(app)` + `new Server(server)`; `setIO(io)` in `services/socketService.js`.
- **Submissions:** After `INSERT`, `setImmediate` runs OCR, `UPDATE extracted_text`, then `emitNewSubmission(payload)`.
- **GET /api/submissions** — teacher, list with optional `batchId`, `limit`, `offset`.
- **GET /api/submissions/:id/image** — teacher, serve file; token in query for `<img src>`.

### Frontend (Phase 5)

- **Dependency:** `socket.io-client`. Vite proxy: `/socket.io` → backend with `ws: true`.
- **Live submissions page:** Connects to Socket.io with `auth: { token }`, listens `new_submission`, displays live feed and recent list; images use `submissionsApi.imageUrl(id, token)`.

---

## Phase 6: Security Hardening, Testing & Deployment

Implemented:

- **Security:** Rate limiting on `/api/auth` (30 requests per 15 min per IP) to reduce brute force and abuse. Helmet middleware for secure headers (CSP disabled to avoid breaking Socket.io). All DB access uses parameterized queries; JWT and RBAC protect routes and Socket.io.
- **Testing:** Manual test checklist in `docs/TESTING.md` (auth, domain, OTP, batches, distribution, student view, clipboard, live feed, security, health).
- **Deployment:** PM2 config in `backend/ecosystem.config.cjs`. Example Nginx config in `deploy/nginx.conf.example` (static frontend + proxy `/api` and `/socket.io` to Node). Full steps and env vars in `docs/DEPLOYMENT.md`.

### Security measures (summary)

| Threat / concern      | Mitigation |
|-----------------------|------------|
| Brute force (login/OTP) | Rate limit on auth routes. |
| SQL injection         | Parameterized queries only (mysql2). |
| Unauthorized access   | JWT on all protected routes and Socket.io; RBAC (student vs teacher). |
| XSS                   | React escapes output; avoid `dangerouslySetInnerHTML` for user/OCR text. |
| File upload           | Allowed MIME and max size (5 MB); random filenames; images served only to teachers with token. |
| Transport             | Use HTTPS and WSS in production (Nginx SSL). |

### Deploy (single server)

1. Backend: set `.env`, run `npm run db:migrate`, start with `pm2 start backend/ecosystem.config.cjs --env production`.
2. Frontend: `npm run build` in `frontend/`, copy `dist/` to server.
3. Nginx: use `deploy/nginx.conf.example`; set `root` to `dist/` path and proxy to Node port; enable SSL as needed.

### Docs

- **`docs/TESTING.md`** — manual test checklist for all phases.
- **`docs/DEPLOYMENT.md`** — env vars, PM2, Nginx, backup, limitations.
- **`SYSTEM_DESIGN_DOCUMENT.md`** — full system design and future enhancements.
