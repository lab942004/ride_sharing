# RideShare

A **multi-organization ride-sharing platform** for colleges and companies. Users can create rides, send/accept requests, and coordinate via real-time chat — gated behind verified organization email domains (or general accounts for gmail.com users).

---

## Repository Structure

```
ride_share/
├── backend/                  # Node.js + Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.js           # Seed data
│   ├── src/
│   │   ├── config/           # DB connection, constants
│   │   ├── controllers/      # Route handlers
│   │   ├── jobs/             # Cron jobs (ride cleanup)
│   │   ├── middleware/       # Auth, validation, rate limiting, error handling
│   │   ├── routes/           # Express routers
│   │   ├── services/         # Business logic
│   │   ├── sockets/          # Socket.io event handlers
│   │   ├── utils/            # JWT, OTP, response, domain helpers
│   │   ├── validations/      # Zod schemas
│   │   └── server.js         # Entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/                 # React 18 + Vite + Tailwind CSS SPA
│   ├── public/
│   ├── src/
│   │   ├── components/       # Navbar, Footer, RideCard, ProtectedRoute
│   │   ├── context/          # AuthContext, ToastContext
│   │   ├── layouts/          # MainLayout
│   │   ├── pages/            # Home, Login, Register, CreateRide, Request, Chat, Profile, …
│   │   ├── services/         # Axios API client, Socket.io client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── docs/
│   └── api.md                # Full REST API reference
│
├── .gitignore
├── package.json              # Monorepo root (optional scripts)
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Axios, Socket.io-client, Zustand, date-fns |
| Backend | Node.js ≥ 18, Express 4, Socket.io 4, Prisma 5 (ORM) |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens), bcryptjs, OTP via email |
| Email | Resend API (primary), Nodemailer / SMTP (fallback) |
| Validation | Zod (backend), Axios interceptors (frontend) |
| Jobs | node-cron (expired ride cleanup) |

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** running locally or a hosted instance (e.g. Supabase, Railway)
- A **Resend** account _or_ Gmail App Password for email delivery
- `npm` or `yarn`

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/ride_share.git
cd ride_share

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT secrets, email keys, etc.
```

See [Environment Variables](#environment-variables) for a full description of every key.

### 3. Set up the database

```bash
cd backend

# Run migrations (creates tables)
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# (Optional) Seed sample data
npm run seed
```

### 4. Start development servers

```bash
# Terminal 1 – backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 – frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

All variables live in `backend/.env`. Copy `backend/.env.example` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (default `7d`) |
| `RESEND_API_KEY` | ✅ | API key from [resend.com](https://resend.com) |
| `EMAIL_FROM` | ✅ | Sender address shown in emails |
| `SMTP_HOST` | optional | Fallback SMTP host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | optional | Fallback SMTP port (e.g. `587`) |
| `SMTP_USER` | optional | Fallback SMTP user |
| `SMTP_PASS` | optional | Fallback SMTP password / App Password |
| `PORT` | optional | Backend port (default `5000`) |
| `NODE_ENV` | optional | `development` \| `production` |
| `ALLOWED_DOMAINS` | ✅ | Comma-separated allowed email domains (e.g. `yourcollege.edu`) |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `RATE_LIMIT_WINDOW_MS` | optional | Rate limit window in ms (default `900000` = 15 min) |
| `RATE_LIMIT_MAX` | optional | Max requests per window (default `100`) |
| `OTP_RATE_LIMIT_MAX` | optional | Max OTP requests per window (default `5`) |

---

## Available Scripts

### Backend (`/backend`)

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start in production mode |
| `npm run prisma:migrate` | Run dev migrations |
| `npm run prisma:migrate:prod` | Deploy migrations to production |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:reset` | Reset DB and re-run all migrations |
| `npm run seed` | Seed the database with sample data |

### Frontend (`/frontend`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (output to `dist/`) |
| `npm run preview` | Preview the production build locally |

---

## Key Features

- **Email-gated access** — only `@yourcollege.edu` addresses can register
- **OTP verification** — email OTP required before account creation and password reset
- **JWT auth** — short-lived access tokens (15 min) with rotating refresh tokens (7 days); server-side revocation via DB
- **Ride management** — create rides with date/time/vehicle/seats, auto-expire past rides via cron
- **Request flow** — riders request to join; owner accepts/rejects; phone number optionally shared on acceptance
- **Real-time chat** — Socket.io room per accepted request; REST fallback also available
- **Domain isolation** — rides are scoped to the user's email domain so multi-institution deployments stay separated
- **Rate limiting** — global limiter + dedicated OTP limiter to prevent abuse

---

## Architecture Overview

```
Browser (React SPA)
      │  REST (Axios)          WebSocket (Socket.io-client)
      ▼                                  ▼
Express API  ──────────────────  Socket.io Server
      │
      ├─ Auth middleware (JWT verify)
      ├─ Zod validation middleware
      ├─ Rate limit middleware
      │
      ├─ /api/auth       ← send-otp, verify-otp, register, login, refresh, logout, forgot/reset-password
      ├─ /api/rides      ← CRUD rides (auth required)
      ├─ /api/requests   ← create, list, accept/reject, share-phone (auth required)
      ├─ /api/chats      ← chat info, message history, send message (auth required)
      └─ /api/profile    ← get/update profile, change password (auth required)
            │
            ▼
       Prisma ORM
            │
            ▼
       PostgreSQL
```

---

## API Reference

See [`docs/api.md`](docs/api.md) for the complete REST API documentation with request/response examples.

---

## Deployment

### Backend (e.g. Railway / Render / EC2)

1. Set all environment variables in the platform dashboard
2. Run `npm run prisma:migrate:prod` to deploy schema changes
3. Start with `npm start`

### Frontend (e.g. Vercel / Netlify)

1. Set `VITE_API_URL` if your backend is on a different origin and update `api.js` accordingly
2. Run `npm run build` — the `dist/` folder is the deployable artifact
3. Configure the hosting platform to serve `index.html` for all routes (SPA fallback)

---

## Contributing

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Commit your changes with a clear message
3. Open a Pull Request — describe what changes you made and why

---

## License

MIT © NIT yourcity RideShare Project
