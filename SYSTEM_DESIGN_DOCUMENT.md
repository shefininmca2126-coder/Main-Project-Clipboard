# System Design Document

## AI Based Cross Platform Clipboard System

**Document Type:** Technical System Design  
**Purpose:** Final-Year MCA Project — Documentation, Viva, and Technical Report  
**Technology Stack:** React.js | Node.js + Express.js | MySQL | Socket.io | JWT | Nodemailer | OCR/Image Processing API

---

## Table of Contents

1. [Overall System Architecture](#1-overall-system-architecture)
2. [Component Interaction Flow](#2-component-interaction-flow)
3. [Database Schema Design](#3-database-schema-design)
4. [ER Diagram Conceptual Explanation](#4-er-diagram-conceptual-explanation)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Clipboard Event Handling Flow](#6-clipboard-event-handling-flow)
7. [WebSocket Real-Time Communication Flow](#7-websocket-real-time-communication-flow)
8. [AI Image Processing Workflow](#8-ai-image-processing-workflow)
9. [Security Architecture](#9-security-architecture)
10. [Scalability & Performance Considerations](#10-scalability--performance-considerations)
11. [Limitations of Browser Clipboard Access](#11-limitations-of-browser-clipboard-access)
12. [Possible Upgrade to Desktop App (Electron)](#12-possible-upgrade-to-desktop-app-electron)
13. [Deployment Strategy](#13-deployment-strategy)
14. [Future Enhancements](#14-future-enhancements)

---

## 1. Overall System Architecture

### 1.1 High-Level Architecture

The system follows a **three-tier architecture** with a clear separation between presentation, business logic, and data layers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Presentation)                         │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  React.js SPA                                                          │   │
│  │  • Student Portal (Registration, Login, Question View, Paste Capture)   │   │
│  │  • Teacher Portal (Dashboard, Batch Management, Distribution, Monitor) │   │
│  │  • Socket.io Client (Real-time updates)                                │   │
│  │  • JWT stored in memory / httpOnly cookie (configurable)                │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    HTTPS / WSS (WebSocket Secure)
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER LAYER (Business Logic)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Express.js     │  │  Socket.io       │  │  External AI / OCR Service   │  │
│  │  REST API       │  │  Server          │  │  (Image → Text Extraction)   │  │
│  │  • Auth         │  │  • Rooms per     │  │  • Tesseract / Cloud Vision  │  │
│  │  • CRUD         │  │    batch/session │  │  • Async processing          │  │
│  │  • File upload  │  │  • Emit to       │  │  • Store image + text         │  │
│  │  • Validation   │  │    teachers      │  │                              │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐                                    │
│  │  Nodemailer     │  │  Middleware      │                                    │
│  │  OTP Email      │  │  JWT, RBAC,     │                                    │
│  │  Service        │  │  Domain Check   │                                    │
│  └─────────────────┘  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                              MySQL Driver / Connection Pool
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  MySQL Database                                                        │   │
│  │  • Users (Students, Teachers), Batches, Question Sets, Assignments,   │   │
│  │    Questions, Submissions (clipboard images + extracted text)          │   │
│  │  • File storage: images on disk or object storage (path in DB)         │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Architectural Patterns

- **REST** for CRUD and auth; **WebSocket (Socket.io)** for real-time clipboard submission alerts.
- **Role-based access:** Routes and Socket events are guarded by role (Student vs Teacher).
- **Domain restriction** is enforced at registration and optionally at login via middleware.
- **Stateless API:** JWT carries identity and role; server does not store sessions.
- **Event-driven real-time:** Backend emits to teacher clients when a student submission is processed.

### 1.3 External Integrations

| Component        | Purpose                          | Integration Point        |
|------------------|----------------------------------|--------------------------|
| Nodemailer       | Send OTP emails                  | SMTP (e.g., Gmail, SendGrid) |
| OCR / Image API  | Extract text from pasted image   | HTTP call from backend   |
| Socket.io        | Real-time teacher notifications  | Same origin or CORS/WSS  |

---

## 2. Component Interaction Flow

### 2.1 Student Registration Flow

1. Student submits registration form (name, email, password, batch name, roll number).
2. **Frontend** validates email domain (must end with `@saintgits.org`); if invalid, show error and do not call API.
3. **Backend** receives request → validates domain again → checks if email already exists.
4. **Batch resolution:** Backend looks up batch by name (case-insensitive or normalized). If not found, inserts new row in `batches` table; if found, uses existing `batch_id`.
5. Password is hashed with bcrypt; student record is created with status **unverified** (e.g. `email_verified: false`).
6. OTP is generated (e.g. 6-digit), stored against user with short expiry (e.g. 10 minutes), and sent via Nodemailer.
7. Response returns success message; frontend shows “Check your email for OTP”.
8. Student enters OTP → backend verifies OTP and expiry → sets `email_verified: true` → student can log in.

### 2.2 Teacher Registration Flow

Same domain check and OTP flow; role is set as **Teacher**. No batch or roll number; account is marked verified after OTP.

### 2.3 Login Flow

1. User submits email and password.
2. Backend validates domain (optional at login but recommended for consistency).
3. Backend loads user by email; checks `email_verified`; if not verified, returns error.
4. Password compared with bcrypt; if valid, JWT is issued (payload: user id, email, role) and returned to client.
5. Client stores JWT and uses it in `Authorization` header (or cookie) for subsequent API and Socket.io authentication.

### 2.4 Question Distribution Flow (Teacher)

1. Teacher selects a batch → backend returns list of students in that batch.
2. Teacher creates N question sets (N is dynamic) and adds questions to each set.
3. Teacher chooses distribution strategy:
   - **Roll range:** Input ranges (e.g. 1–5 → Set A, 6–10 → Set B). Backend maps each student’s roll to a set and writes/updates **assignments** (student_id, question_set_id).
   - **Odd/Even:** Backend filters students by roll odd/even and assigns sets accordingly.
   - **Random:** Backend shuffles students and distributes sets in round-robin or random order.
   - **Manual:** Teacher sends list of (student_id, set_id); backend updates assignments.
4. Backend persists assignments; students see only their assigned set when they open the question page.

### 2.5 Student Question View and Clipboard Submit Flow

1. Student opens “My Questions” (or exam) page; frontend requests assigned set (with JWT).
2. Backend verifies JWT, resolves student, returns only their assigned question set and questions.
3. Page renders questions; **paste event listener** is attached to a specific container (e.g. exam area or a designated div).
4. On **Ctrl+V** (or Cmd+V):
   - Handler reads `clipboardData`; if item is image, gets blob.
   - Converts to base64 or FormData and **immediately** sends to backend (no separate “upload” button).
5. Backend receives image → validates type/size → stores image (file system or object storage) → calls OCR/Image API → stores image path and extracted text in **submissions** table → emits event via Socket.io to relevant teacher room.
6. Teacher dashboard (Socket.io client) receives event and updates UI in real time (student name, roll, batch, timestamp, thumbnail, extracted text).

---

## 3. Database Schema Design

### 3.1 Table Overview

All entities use a **relational schema** with foreign keys. There are **no per-batch tables**; batches are rows in a single `batches` table.

| Table           | Purpose |
|-----------------|--------|
| `users`         | Single table for both Students and Teachers; distinguished by `role` enum. |
| `batches`       | Batch names; one row per batch. |
| `question_sets` | Sets created by teacher; linked to batch/session. |
| `questions`     | Questions belonging to a question set. |
| `assignments`   | Which student has which question set (student_id, question_set_id). |
| `submissions`   | Clipboard paste events: reference to student, image path, extracted text, timestamp. |
| `otp_verifications` | OTP code, user_id, expiry for email verification. |

### 3.2 Detailed Schema (Conceptual)

**users**

- `id` (PK, auto-increment)
- `email` (unique, indexed) — must be @saintgits.org
- `password_hash` — bcrypt
- `full_name`
- `role` — enum: `student` | `teacher`
- `email_verified` — boolean, default false
- `batch_id` (FK → batches, nullable) — only for students
- `roll_number` (nullable) — only for students; unique per batch or globally as per business rule
- `created_at`, `updated_at`

**batches**

- `id` (PK)
- `name` (unique or unique per institution) — e.g. “MCA 2024”
- `created_at`

**question_sets**

- `id` (PK)
- `name` or `label` — e.g. “Set A”, “Set 1”
- `batch_id` (FK) — which batch this set belongs to (or a “session”/exam event id if you introduce one)
- `created_by` (FK → users, teacher)
- `created_at`

**questions**

- `id` (PK)
- `question_set_id` (FK)
- `question_text` or `content`
- `order_index` — for ordering within set
- `created_at`

**assignments**

- `id` (PK)
- `student_id` (FK → users)
- `question_set_id` (FK)
- `assigned_at`
- Unique constraint on `student_id` per “exam” or per batch (one active assignment per student per context, as per business rule)

**submissions**

- `id` (PK)
- `student_id` (FK → users)
- `image_path` or `image_url` — path to stored file
- `extracted_text` — text from OCR/Image API (nullable if OCR fails)
- `submitted_at` (timestamp)
- Optional: `question_set_id` or `session_id` to associate with a specific exam/set

**otp_verifications**

- `id` (PK)
- `user_id` (FK → users)
- `otp_code` (hashed or plain per policy)
- `expires_at`
- `created_at`

### 3.3 File Storage

Images from clipboard are stored on **disk** or **object storage** (e.g. S3-compatible). Database stores only the path or URL in `submissions.image_path`. This keeps the schema relational and avoids storing binary in MySQL.

---

## 4. ER Diagram Conceptual Explanation

### 4.1 Entities and Relationships

- **User** (1) — has role Student or Teacher. **Student** (N) → belongs to **Batch** (1). So: User `batch_id` → Batch.
- **Batch** (1) — has many **QuestionSet** (N). QuestionSet `batch_id` → Batch.
- **QuestionSet** (1) — has many **Question** (N). Question `question_set_id` → QuestionSet.
- **Assignment** is the many-to-many link: **Student** (N) ←→ (N) **QuestionSet**. One row per (student, question_set) for a given exam/context.
- **Submission** (N) → **Student** (1). Each submission is one paste event by one student; holds image path and extracted text.
- **OtpVerification** (N) → **User** (1); one active OTP per user at a time (or per request).

### 4.2 Cardinality Summary

| From        | To           | Relationship | Cardinality |
|------------|--------------|--------------|-------------|
| User        | Batch        | belongs to   | N:1 (students only) |
| Batch       | QuestionSet  | has          | 1:N         |
| QuestionSet | Question     | has          | 1:N         |
| User (student) | QuestionSet | assigned via | N:M (via Assignment) |
| User (student) | Submission | creates      | 1:N         |
| User        | OtpVerification | has       | 1:N         |

No separate “Students” and “Teachers” tables; one **User** table with **role** and optional **batch_id** and **roll_number** for students keeps the ER simple and avoids duplication of auth logic.

---

## 5. Authentication & Authorization Flow

### 5.1 Authentication (Identity)

- **Registration:** Domain check (@saintgits.org) on frontend and backend; password hashed with bcrypt; user created unverified.
- **OTP:** Stored with expiry; verified once; then `email_verified` set true. No login until verified.
- **Login:** Email + password → bcrypt compare → JWT issued. JWT payload: `userId`, `email`, `role`, optional `batchId` for students.
- **Token storage:** Prefer **httpOnly cookie** for XSS protection; alternatively in memory (e.g. React state) with HTTPS. Refresh strategy (short-lived access + refresh token) can be added later.

### 5.2 Authorization (Access Control)

- **Middleware:** Every protected route checks JWT; decodes and attaches `user` (id, role) to request.
- **Role checks:**
  - **Student:** Can access own profile, own batch, own assigned question set, and submit clipboard images for that context.
  - **Teacher:** Can access batch list, students in batch, create/edit question sets, run distribution, view all submissions and real-time feed.
- **Resource-level:** Students can only read their own assignment and their own submissions; teachers can read by batch/set. Implement by comparing `request.user.id` and `request.user.role` with resource owner or batch membership.
- **Socket.io:** Same JWT (or token sent in handshake) is validated on connection; teacher-only rooms/events are joined only if role is teacher; student can only emit submission events for themselves.

### 5.3 Flow Diagram (Conceptual)

- **Request** → CORS → JWT middleware (extract/verify) → RBAC middleware (check role for route) → Controller → Response.
- **Socket connection** → Handshake with token → Server verifies JWT → Joins user to role-based room (e.g. “teachers”, “student:{id}”) → Server accepts only allowed events (e.g. student can emit “clipboard_submit”, teacher only receives).

---

## 6. Clipboard Event Handling Flow

### 6.1 Where It Applies

Clipboard capture runs **only in the exam/question view** of the student app, inside a designated container (e.g. main content area or a “paste zone” div). It is **not** global; it does not run in background tabs or when the app is not in focus.

### 6.2 Sequence (Frontend)

1. **Attach listener:** On load of question page, register `paste` on the container element (or `document` scoped to that page).
2. **On paste event:**
   - Read `event.clipboardData`.
   - Iterate `clipboardData.items`; find item with `type` starting with `image/`.
   - Call `item.getAsFile()` to get blob.
3. **Validate:** Check file type (e.g. image/png, image/jpeg) and size (e.g. max 5 MB).
4. **Send immediately:** Build `FormData` (append blob and optionally student/session identifiers) or base64 in JSON; POST to backend endpoint (e.g. `/api/submissions/clipboard`) with JWT.
5. **Optional UX:** Show small “Captured” or “Submitted” feedback; do not block the page.

### 6.3 Backend Handling

- Receive multipart or JSON (base64).
- Validate JWT and ensure requester is student.
- Validate MIME type and size again.
- Save file to disk or object storage; get path/URL.
- Enqueue or call OCR/Image API; on response, save `image_path` and `extracted_text` in `submissions` table.
- Emit Socket.io event to teacher room with: student name, roll, batch, timestamp, image URL or path, extracted text.
- Return success to student (e.g. 201).

### 6.4 Important Constraint

The paste is **only** captured when it occurs inside the application’s paste listener. The system does **not** read clipboard when the user is not pasting in that context, avoiding any “background spying” and aligning with browser security model.

---

## 7. WebSocket Real-Time Communication Flow

### 7.1 Role of Socket.io

- **Primary use:** Notify teacher dashboard **instantly** when a student submits a clipboard image (after backend has stored and processed it).
- **Optional:** Teacher dashboard could also use Socket for live “who is viewing” or minor events; the core requirement is submission alerts.

### 7.2 Connection and Rooms

- **Server:** Socket.io server attached to same HTTP server as Express (or behind same reverse proxy).
- **Authentication:** Client sends JWT in handshake (query or auth object). Server verifies JWT and attaches `user` to socket.
- **Rooms:**
  - Teachers: e.g. join room `teachers` or `batch:{batchId}` when they open a batch’s monitoring view.
  - Students: e.g. join `student:{studentId}` for optional future use; they do not need to listen for teacher events.
- **Emit from server:** When a submission is saved, server does `io.to('teachers').emit('new_submission', payload)` or `io.to('batch:' + batchId).emit(...)` so only teachers see it.

### 7.3 Payload and Teacher UI

- **Payload:** `studentName`, `rollNumber`, `batchName`, `timestamp`, `imageUrl` or path for preview, `extractedText`.
- **Teacher client:** Listens for `new_submission`; appends or updates a list/table in the UI without page refresh. Optionally show thumbnail and “View full image” link.

### 7.4 Flow Summary

Student pastes → Frontend sends image to API → API stores image, runs OCR, saves submission → API emits Socket event → Teacher clients in room receive event → UI updates in real time.

---

## 8. AI Image Processing Workflow

### 8.1 Purpose

Convert pasted **screenshot image** into **text** for storage and for display on the teacher dashboard (and optional analysis).

### 8.2 Options for OCR / Image API

- **Tesseract.js (server-side):** Open-source OCR; run in Node worker or separate process to avoid blocking.
- **Cloud APIs:** Google Cloud Vision, AWS Textract, Azure Computer Vision — better accuracy, cost per request.
- **Hybrid:** Prefer cloud for production; Tesseract for development or low-cost scenario.

### 8.3 Processing Pipeline

1. **Input:** Image file (from clipboard upload) on disk or in memory.
2. **Validation:** Already done before this stage (type, size).
3. **Call OCR/API:** Backend sends image to chosen service; receives text (and optionally confidence/bounding boxes).
4. **Persistence:** Save `extracted_text` (and raw response if needed) in `submissions` table; image already stored.
5. **Real-time:** After save, emit Socket event to teachers with same extracted text so teacher sees it immediately.
6. **Error handling:** If OCR fails (rate limit, timeout), still save image and optionally `extracted_text: null`; teacher can still see the screenshot.

### 8.4 Async Consideration

OCR can take 1–5 seconds. Two approaches:

- **Synchronous:** Block the request until OCR completes, then respond and emit. Simpler but longer request.
- **Asynchronous:** Respond 202 quickly after saving image; run OCR in background job/queue; when done, update `submissions` and then emit Socket event. Teacher sees “New paste” first, then “Text extracted” when ready (or single event when both are done, depending on product choice).

---

## 9. Security Architecture

### 9.1 Defensive Layers

| Layer        | Measure |
|-------------|---------|
| **Registration** | Email domain allowlist (@saintgits.org); reject others at validation. |
| **Passwords**    | bcrypt hashing; no plain text storage. |
| **Verification** | OTP with short expiry; account inactive until verified. |
| **Authentication** | JWT with secret; expiry (e.g. 1–24 hours); issued only after verified login. |
| **Authorization** | RBAC on every API route and Socket event; students cannot access other students’ data or teacher actions. |
| **API**       | Validate content-type and size for uploads; sanitize inputs; use parameterized queries for DB. |
| **Transport** | HTTPS and WSS only in production. |
| **WebSocket** | Verify JWT on connect; allow only role-appropriate joins and emits. |

### 9.2 File Upload Security

- Restrict to image MIME types (e.g. image/png, image/jpeg).
- Limit file size (e.g. 2–5 MB).
- Save with random/safe filenames; do not use user-controlled names for path.
- Serve stored images via authenticated route or signed URL so only teachers (or intended roles) can view.

### 9.3 Threat Mitigation

- **Brute force:** Rate limit login and OTP endpoints.
- **Injection:** Parameterized queries; no raw concatenation for SQL.
- **XSS:** React’s default escaping; avoid `dangerouslySetInnerHTML` for user/OCR text; CSP headers.
- **CSRF:** If using cookies, use same-site and CSRF token for state-changing operations; JWT in header is less prone.
- **Unauthorized access:** Every protected route and Socket handler must validate JWT and role.

---

## 10. Scalability & Performance Considerations

### 10.1 Database

- Indexes: `users(email)`, `users(batch_id)`, `assignments(student_id, question_set_id)`, `submissions(student_id, submitted_at)`, `batches(name)`.
- Connection pooling (e.g. default in MySQL driver) to limit connections.
- For very large batches, paginate student lists and submission lists.

### 10.2 API

- Stateless design allows horizontal scaling: multiple Express instances behind a load balancer.
- Rate limiting per IP or per user to protect OCR and login endpoints.
- Image upload: consider streaming to disk or storage to avoid loading full body in memory.

### 10.3 Socket.io

- Use **Redis adapter** when running multiple Node instances so all servers share the same Socket.io room state; otherwise only the server that received the submission would emit, and teachers on other servers would not see it.
- Limit payload size (e.g. send image URL only, not base64) for emission.

### 10.4 OCR

- Offload to worker process or queue (e.g. Bull with Redis) so Express stays responsive; emit Socket event from worker when OCR completes.
- Consider caching or deduplication if the same image could be submitted repeatedly (e.g. hash-based).

---

## 11. Limitations of Browser Clipboard Access

### 11.1 Security and Privacy

- **User gesture required:** Paste is only available in response to a user action (e.g. Ctrl+V). The script cannot arbitrarily read clipboard in the background.
- **Same origin:** Clipboard data is available only in the context of the page the user is interacting with.
- **No history:** The browser does not expose a “clipboard history”; only the current paste event’s data.
- **Permissions:** Some browsers may prompt for clipboard read permission in certain contexts; the project should handle permission denial gracefully.

### 11.2 Functional Limits

- **Only on paste:** If the user copies but never pastes in the app, the system never sees the content. There is no “continuous monitoring” of clipboard in the browser.
- **Image only:** The design focuses on image paste; text paste can be captured similarly but is not required for the described feature.
- **Tab focus:** Paste events fire only when the page has focus; if the student pastes in another tab, this app does not capture it.

These limitations are documented so the scope is clear for the viva: the system is “paste-triggered, in-app only” and does not monitor clipboard outside the application.

---

## 12. Possible Upgrade to Desktop App (Electron)

### 12.1 Why Electron

- **Full clipboard access:** Electron (or similar desktop frameworks) can use OS-level clipboard APIs and optionally observe clipboard changes without requiring a paste inside the app window.
- **Always-on monitoring:** A desktop app could (with user consent and clear disclosure) watch for clipboard changes and send screenshots to the backend when the app is running, even when the window is minimised.

### 12.2 Design Approach for Upgrade

- **Same backend:** Reuse existing REST API and Socket.io; only the client changes from browser to Electron.
- **Electron main process:** Use `clipboard` module to read image when a “paste” or “clipboard changed” event occurs (per OS support).
- **Security and ethics:** Must be opt-in, documented, and compliant with exam/institution policy; avoid any perception of hidden monitoring.
- **Deployment:** Distribute Electron app as downloadable binary; updates via auto-updater. Teachers could still use the web dashboard.

### 12.3 Trade-offs

- **Pros:** Closer to “real-time clipboard monitoring” without relying on paste inside the browser.
- **Cons:** Installation and updates; OS-specific behavior; higher support and security responsibility (desktop app has more privileges).

This can be stated as a “future work” or “possible extension” in the report.

---

## 13. Deployment Strategy

### 13.1 Environment Separation

- **Development:** Local Node server; React dev server; local MySQL; optional local SMTP (e.g. Mailtrap) and OCR (Tesseract).
- **Staging:** Mirror of production with test data; used for UAT and integration tests.
- **Production:** Single server or multi-server setup (see below).

### 13.2 Single-Server (Small Scale)

- One VM or VPS.
- Node (Express + Socket.io) behind **Nginx** (or Caddy): reverse proxy, SSL termination, static file serving for React build.
- MySQL on same machine or managed DB.
- React built to static files; Nginx serves them; API and WSS proxied to Node (e.g. `proxy_pass` for `/api` and `/socket.io`).
- Process manager: **PM2** for Node (restart on crash, logs).

### 13.3 Multi-Server (Scale-Out)

- **Load balancer** in front of multiple Node instances.
- **Sticky sessions** for Socket.io if not using Redis adapter; or **Redis adapter** for Socket.io so any instance can emit to any teacher.
- **MySQL** as primary data store; backups and replication as per DBA policy.
- **File/object storage** for images (e.g. S3 or MinIO) so all servers see the same files.
- **Secrets:** Env variables or secret manager (e.g. AWS Secrets Manager) for DB password, JWT secret, SMTP credentials, OCR API keys.

### 13.4 CI/CD (Conceptual)

- **Build:** On commit/merge, run tests and build React and Node.
- **Deploy:** Push image to registry or copy artifacts to server; run migrations if any; restart Node with zero-downtime strategy (e.g. rolling restart behind LB).
- **Database:** Schema changes via migration scripts; run in controlled order in staging first.

---

## 14. Future Enhancements

- **Refresh tokens:** Long-lived refresh token and short-lived access JWT to reduce exposure.
- **Exam sessions:** Introduce an “exam” or “session” entity with start/end time; assignments and submissions tied to session; auto-disable access after end time.
- **Proctoring:** Optional integration with webcam snapshots or screen-share (with consent and policy); separate from clipboard feature.
- **Analytics:** Dashboard for teachers: count of pastes per student, per batch, time distribution; flag anomalies.
- **Mobile-responsive:** Ensure teacher and student UIs work on tablets for lab environments.
- **Offline support:** Service worker to cache question set for student; queue paste submissions when back online (complexity: conflict handling and ordering).
- **Multi-institution:** Support multiple colleges with different allowed domains; tenant_id or institution_id in schema and middleware.
- **Audit log:** Table for sensitive actions (login, distribution, bulk assign) for accountability.

---

## Document Control

- **Version:** 1.0  
- **Last Updated:** February 2025  
- **Audience:** Academic evaluation, viva, and technical report submission.  
- **No code included;** implementation shall follow this design.

---

*End of System Design Document*
