# UniFind

UniFind is the private Lost & Found network for **United International University (UIU)**.
Students, faculty and staff sign in with their UIU email, report lost or found items,
search existing reports, and get **Smart Match** suggestions when a lost item and a found
item look alike. They can message each other privately, submit ownership claims, and
close a case once the item is back with its owner.

## 1. Tech stack

| Layer | What we use |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, React Hook Form + Zod (forms), TanStack Table + Recharts (admin), GSAP / Motion (animation) |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic 2 |
| Database | SQLite (one file: `backend/unifind.db`) |
| Security | bcrypt password hashing, JWT in an httpOnly cookie |

Data flow: **React page → service file → FastAPI router → SQLAlchemy model → SQLite**, and back.

## 2. How to run it

You need **Python 3.10–3.13** (3.12 recommended) and **Node.js 18+**. Use two terminals.

### Windows

Terminal 1, backend (run from the project folder):

```bash
cd backend
py -3.12 -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe seed.py
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Terminal 2, frontend (run from the project folder):

```bash
npm install
npm run dev
```

### macOS / Linux

```bash
cd backend
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
venv/bin/python seed.py
venv/bin/python -m uvicorn main:app --reload --port 8000
```

Then, in a second terminal from the project folder: `npm install` and `npm run dev`.

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`). API docs are at
http://127.0.0.1:8000/docs. Vite forwards `/api` and `/uploads` to the backend, so the
browser only talks to one address.

Every time after the first: start the backend with the last command above, and `npm run dev`.

**Other commands:** `npm run check` (TypeScript), `npm run build` (production build into `dist/`),
`powershell -File backend/smoke_test.ps1` (API test, needs the backend running; it adds test
rows to the database).

**Start from clean demo data:** stop the backend, delete `backend/unifind.db`, run `seed.py` again.

Settings are optional environment variables; copy `backend/.env.example` to `backend/.env`
to change them. Email confirmation is **off by default** (registering signs you straight in).

## 3. Demo accounts

`seed.py` creates these. The password for all of them is **`UniFind2026`**.

| Email | Role |
| --- | --- |
| `ayesha@bscse.uiu.ac.bd` | member |
| `tanvir@eee.uiu.ac.bd` | member |
| `nusrat@bba.uiu.ac.bd` | member |
| `admin@uiu.ac.bd` | administrator |

It also creates six items, including a lost/found pair that produces a high-confidence Smart Match.

## 4. Folder structure

```
unifind/
├── backend/                     FastAPI + SQLite
│   ├── main.py                  App entry point: routers, CORS, /uploads, /api/health
│   ├── database.py              SQLite engine, session, get_db
│   ├── models.py                All 13 database tables
│   ├── schemas.py               Request/response validation, UIU email rule
│   ├── auth.py                  bcrypt, JWT cookie, route guards, confirmation codes
│   ├── mailer.py                Sends the confirmation code (optional)
│   ├── matching.py              Smart Match scoring
│   ├── helpers.py               serialize_item, create_notification
│   ├── seed.py                  Demo accounts and items
│   ├── smoke_test.ps1           End-to-end API test
│   └── routers/                 auth, items, comments, claims, matches, messages,
│                                notifications, dashboard, admin
├── client/
│   ├── index.html
│   ├── public/                  Placeholder image, category icons
│   └── src/
│       ├── main.tsx, App.tsx    Entry point and route table (RoleRoutes)
│       ├── pages/               One file per screen (+ pages/admin/)
│       ├── components/          common/, items/, claims/, matches/, messages/,
│       │                        reactbits/ (vendored animation components)
│       ├── layouts/Layouts.tsx  PublicLayout, MainLayout, AdminLayout
│       ├── services/            One file per backend area; api.ts does the fetch
│       ├── context/AuthContext.tsx   Who is signed in
│       ├── hooks/               useApi (load data), useDebounced (search delay)
│       ├── lib/schemas.ts       Zod form rules
│       ├── types.ts, constants.ts    API shapes, categories/locations
│       └── index.css            The whole design system (30 numbered sections)
├── package.json, vite.config.ts, tsconfig*.json
├── Dockerfile, render.yaml      Optional deployment to Render
└── dist/                        Created by `npm run build` (not committed)
```

## 5. Features: where each one lives

All paths are relative to `client/src/` (page, service) or `backend/` (backend).

| Feature | Page | Service | Backend | Table(s) |
| --- | --- | --- | --- | --- |
| Sign up / sign in | `pages/Login.tsx`, `Register.tsx`, `Verify.tsx` | `authService.ts` | `routers/auth.py`, `auth.py` | `users`, `email_verifications` |
| Report item | `pages/ReportItem.tsx` (+ `components/items/ItemForm.tsx`) | `itemService.ts` | `routers/items.py` (`create_item`, `upload_photo`) | `items` |
| Browse / search | `pages/Browse.tsx` | `itemService.ts` | `routers/items.py` (`list_items`) | `items` |
| My Posts | `pages/MyPosts.tsx` | `itemService.ts` | `routers/items.py` (edit, status, withdraw) | `items` |
| Item details + comments | `pages/ItemDetails.tsx` | `itemService.ts`, `commentService.ts`, `reportService.ts` | `routers/items.py`, `comments.py`, `dashboard.py` (`flag_content`) | `items`, `comments`, `content_reports` |
| Smart Match | `pages/Matches.tsx` (+ `components/matches/MatchCard.tsx`) | `matchService.ts` | `routers/matches.py`, `matching.py` | `item_matches` |
| Claims | `pages/Claims.tsx` (+ `ClaimModal.tsx`, `QuestionManager.tsx`) | `claimService.ts` | `routers/claims.py` | `claims`, `claim_questions`, `claim_answers`, `claim_decisions` |
| Messages | `pages/Messages.tsx` | `messageService.ts` | `routers/messages.py` | `conversations`, `messages` |
| Notifications | `pages/Notifications.tsx` (+ bell in `components/common/Navbar.tsx`) | `notificationService.ts` | `routers/notifications.py` | `notifications` |
| Resolved gallery | `pages/Resolved.tsx` | `itemService.ts` | `routers/items.py` (`list_items`, status = resolved) | `items` |
| Dashboard | `pages/Dashboard.tsx` | `dashboardService.ts` | `routers/dashboard.py` (`dashboard`) | reads `items`, `claims`, `item_matches`, `notifications` |
| Admin | `pages/admin/AdminDashboard.tsx`, `pages/admin/ManagePosts.tsx`, `pages/admin/ModerationReports.tsx`, `pages/admin/AdminUsers.tsx` | `adminService.ts` | `routers/admin.py` | `items`, `content_reports`, `users` |

**Claim rules (in `routers/claims.py`):** the poster can set a short multiple-choice quiz on an
item; a claimant answers it and the poster sees the score. A decision (approved / rejected) is
**final**. Approving one claim automatically rejects the others on that item, and every
decision is saved in `claim_decisions`. An item that is `resolved` cannot be reopened.

## 6. API endpoints

Interactive docs: http://127.0.0.1:8000/docs. "Signed in" means a valid session cookie;
"Admin" means the `admin` role, checked on the server.

| Method | Endpoint | Purpose | Who |
| --- | --- | --- | --- |
| GET | `/api/health` | Status check (also says if email confirmation is on) | Public |
| POST | `/api/auth/register` | Create an account (UIU email required) | Public |
| POST | `/api/auth/login` | Sign in | Public |
| POST | `/api/auth/logout` | Sign out | Public |
| GET | `/api/auth/me` | Current member | Signed in |
| POST | `/api/auth/change-password` | Change own password | Signed in |
| GET | `/api/auth/pending` | Who the confirmation screen is waiting for | Confirmation on only |
| POST | `/api/auth/verify` | Confirm the emailed code (also signs in) | Confirmation on only |
| POST | `/api/auth/resend` | Send a fresh code (once a minute) | Confirmation on only |
| GET | `/api/stats` | Anonymous counters for the Home page | Public |
| GET | `/api/items` | Browse; filters `search`, `type`, `category`, `location`, `status`, `mine`, `sort` | Signed in |
| GET | `/api/items/{id}` | Item details | Signed in |
| POST | `/api/items` | Report an item | Signed in |
| PUT | `/api/items/{id}` | Edit own item | Owner / admin |
| PATCH | `/api/items/{id}/status` | Change case status (open / pending / resolved) | Owner / admin |
| DELETE | `/api/items/{id}` | Withdraw own item (soft delete) | Owner / admin |
| POST | `/api/items/upload` | Upload one photo, returns its URL | Signed in |
| GET, POST | `/api/items/{id}/comments` | Read / add comments | Signed in |
| GET | `/api/items/{id}/claim-questions` | The quiz a claimant answers (no correct answers) | Signed in |
| GET, PUT | `/api/items/{id}/claim-questions/manage` | Poster's quiz editor (with correct answers) / save | Owner / admin |
| POST | `/api/items/{id}/claims` | Submit an ownership claim with quiz answers | Signed in |
| GET | `/api/claims` | Claims received and claims submitted | Signed in |
| PATCH | `/api/claims/{id}` | Approve or reject a claim (final) | Owner / admin |
| GET | `/api/matches` | Smart Match suggestions for my reports | Signed in |
| GET, POST | `/api/conversations` | Inbox / start a conversation about an item | Signed in |
| POST | `/api/conversations/direct` | Start a direct conversation with a member | Signed in |
| GET | `/api/conversations/{id}` | One thread (participants only) | Participant |
| POST | `/api/conversations/{id}/messages` | Send a message | Participant |
| GET | `/api/notifications` | My notifications | Signed in |
| PATCH | `/api/notifications/{id}/read` | Mark one read | Signed in |
| PATCH | `/api/notifications/read-all` | Mark all read | Signed in |
| GET | `/api/dashboard` | Dashboard summary | Signed in |
| POST | `/api/reports` | Flag a post, comment or member | Signed in |
| GET | `/api/admin/stats` | Admin overview numbers | Admin |
| GET | `/api/admin/posts` | All posts, including removed | Admin |
| PATCH | `/api/admin/posts/{id}/remove` and `/restore` | Moderate a post | Admin |
| GET | `/api/admin/reports` | Moderation queue | Admin |
| PATCH | `/api/admin/reports/{id}` | Mark reviewed or dismissed | Admin |
| GET | `/api/admin/users` | All members | Admin |
| PATCH | `/api/admin/users/{id}` | Suspend / reinstate, change email or password | Admin |

## 7. How Smart Match scoring works

Code: `backend/matching.py`. When an item is created, edited or has its status changed, it is
compared with every open or pending item of the **opposite type** (lost vs found).

| Signal | Points |
| --- | --- |
| Same category | +30 |
| Shared title word (3+ letters) | +25 |
| Same location | +20 |
| Same color | +15 |
| Dates within 3 days | +10 |
| Same brand | +10 |
| Shared description word | +5 |

A pair scoring **40 or more** is saved in `item_matches` and shown on the Matches page. The score
is capped at **99**, so the app never claims certainty. It always says "possible match" and never
decides who owns an item. Removed and resolved items drop out of matching.

## 8. Security

- Passwords are hashed with **bcrypt**; the hash is never sent to the browser.
- The session is a **JWT in an httpOnly cookie**, so page JavaScript cannot read it.
- The **UIU email rule** (`*.uiu.ac.bd`) is enforced by the backend (`schemas.py`), not just the form.
- Roles are checked on the **server**; the React route guard is only for convenience.
- A member can change only **their own** posts; only the poster (or an admin) can decide a claim.
- `identifying_details` (private proof for claims) is hidden from everyone except the poster.
- Messages can be read only by the two people in the conversation.
- Database access uses SQLAlchemy bound parameters, so search text cannot inject SQL.
- Uploads: only JPG/PNG/WEBP up to 5 MB, saved under a server-generated filename.
- Login gives the same error for a wrong email and a wrong password.
- In production the backend refuses to start with the default development secret key.

## 9. Team contribution

*Placeholder, to be filled in by the team.*

| Team member | Student ID | What they built / explain in the viva |
| --- | --- | --- |
| _name 1_ | _id_ | _e.g. files, features_ |
| _name 2_ | _id_ | _…_ |
| _name 3_ | _id_ | _…_ |
