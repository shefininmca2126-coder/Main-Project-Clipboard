# Testing Checklist — AI Based Cross Platform Clipboard System

Use this checklist to verify critical flows before demo or submission.

---

## 1. Authentication & domain restriction

- [ ] **Student registration (valid domain)**  
  Register with email ending `@saintgits.org`. Expect success and “Check your email for OTP”.
- [ ] **Student registration (invalid domain)**  
  Use e.g. `user@gmail.com`. Expect error: “Only @saintgits.org email addresses are allowed”.
- [ ] **Teacher registration**  
  Same domain check; no batch/roll. Expect OTP email (if mail configured).
- [ ] **OTP verification**  
  Enter valid OTP for a new user. Expect “Email verified successfully. You can now log in.”
- [ ] **OTP invalid/expired**  
  Wrong or expired OTP. Expect “Invalid or expired OTP”.
- [ ] **Login (verified user)**  
  After OTP verify, log in with email + password. Expect token and user in response; redirect to role home.
- [ ] **Login (unverified user)**  
  Log in before verifying OTP. Expect “Please verify your email with the OTP…”.
- [ ] **Login (wrong password)**  
  Expect “Invalid email or password”.
- [ ] **Rate limiting**  
  Send many login/register requests from same IP. Expect 429 “Too many attempts” after limit.

---

## 2. Batches & question sets (teacher)

- [ ] **List batches**  
  As teacher, open Dashboard → Batches. Expect list (or “No batches yet”).
- [ ] **Select batch**  
  Click a batch. Expect students table and question sets section.
- [ ] **Create question set**  
  Add set name (e.g. “Set A”), submit. Expect set in list.
- [ ] **Add questions**  
  Expand set, add question text. Expect question in list; add multiple.
- [ ] **Delete question**  
  Delete one question. Expect it removed.
- [ ] **Distribution – Random**  
  Create 2+ sets with questions. Run distribution with “Random”. Expect success message.
- [ ] **Distribution – Odd/Even**  
  Run “Odd / Even roll”; expect success.
- [ ] **Distribution – Manual**  
  Assign sets per student via dropdowns, run. Expect success.
- [ ] **Distribution – Roll range**  
  Use “Roll number range” with valid ranges; run. Expect success.

---

## 3. Student assigned view

- [ ] **My Questions (assigned)**  
  As student with assignment, open Student → My Questions. Expect assigned set name and questions only.
- [ ] **My Questions (not assigned)**  
  As student with no assignment. Expect “You have not been assigned a question set yet”.

---

## 4. Clipboard submission (Phase 4)

- [ ] **Paste image**  
  On My Questions (student), focus the question area, copy a screenshot, Ctrl+V. Expect “Screenshot captured.” and no error.
- [ ] **Paste non-image**  
  Paste plain text. Expect no upload (or graceful handling).
- [ ] **Oversized image**  
  Paste image > 5 MB if possible. Expect size error.

---

## 5. OCR & real-time monitoring (Phase 5)

- [ ] **Live feed**  
  As teacher, open “Live submissions”. As student, paste screenshot. Expect new row in teacher’s live feed (student name, roll, batch, time).
- [ ] **Thumbnail & text**  
  In live feed, expect screenshot thumbnail and extracted text (if OCR succeeded).
- [ ] **Recent submissions**  
  On Live submissions page, expect “Recent submissions” list with same data and images loading (with auth).

---

## 6. Security & access control

- [ ] **Student cannot access teacher routes**  
  Logged in as student, call e.g. `GET /api/batches` or open `/teacher`. Expect 403 or redirect.
- [ ] **Teacher cannot access student-only API**  
  As teacher, call `GET /api/student/assigned-set`. Expect 403.
- [ ] **Protected routes without token**  
  Call protected API without `Authorization: Bearer <token>`. Expect 401.
- [ ] **Image URL without token**  
  Open submission image URL without token. Expect 401.

---

## 7. Health & deployment

- [ ] **Health**  
  `GET /api/health` returns 200 and `status: 'ok'`.
- [ ] **DB health**  
  `GET /api/health/db` returns 200 when MySQL is up, 503 when down.
- [ ] **Production build**  
  Run `npm run build` in frontend; serve `dist/` (e.g. via Nginx); backend runs with PM2; full flow works.

---

## Notes

- Use a real or test `@saintgits.org` email for registration; configure SMTP (e.g. Mailtrap) for OTP in dev.
- For OCR, Tesseract runs in background; first submission may take a few seconds before text appears in the feed.
- Rate limit: 30 requests per 15 minutes per IP on `/api/auth` (adjust in `middleware/rateLimit.js` if needed).
