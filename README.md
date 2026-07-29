# RideShare NIT KKR

A **closed-community ride-sharing platform** exclusively for NIT Kurukshetra students and staff. Users can create rides, send/accept requests, and coordinate via real-time chat — all gated behind a verified college email (`@nitkkr.ac.in`). The platform includes both a **web application** (React SPA) and an **Android mobile app** (Kotlin/Jetpack Compose), sharing a common backend API.

---

## Repository Structure

```
Ride_Sharing/
├── ride_sharing/                  # Web platform (backend + frontend)
│   ├── backend/                  # Node.js + Express + Prisma API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   └── seed.js           # Seed data
│   │   ├── src/
│   │   │   ├── config/           # DB connection, constants
│   │   │   ├── controllers/      # Route handlers
│   │   │   ├── jobs/             # Cron jobs (ride cleanup)
│   │   │   ├── middleware/       # Auth, validation, rate limiting, error handling
│   │   │   ├── routes/           # Express routers
│   │   │   ├── services/         # Business logic
│   │   │   ├── sockets/          # Socket.io event handlers
│   │   │   ├── utils/            # JWT, OTP, response, domain helpers
│   │   │   ├── validations/      # Zod schemas
│   │   │   └── server.js         # Entry point
│   │   ├── .env.example
│   │   └── package.json
│   │
│   ├── frontend/                 # React 18 + Vite + Tailwind CSS SPA
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/       # Navbar, Footer, RideCard, ProtectedRoute
│   │   │   ├── context/          # AuthContext, ToastContext
│   │   │   ├── layouts/          # MainLayout
│   │   │   ├── pages/            # Home, Login, Register, CreateRide, Request, Chat, Profile, …
│   │   │   ├── services/         # Axios API client, Socket.io client
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── index.html
│   │   └── package.json
│   │
│   ├── docs/
│   │   └── api.md                # Full REST API reference
│   │
│   ├── .gitignore
│   ├── package.json              # Monorepo root (optional scripts)
│   └── README.md                 # Web platform details
│
├── ride_sharing_mobile/          # Android native app
│   ├── app/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── java/com/ridesharing/app/
│   │   │   │   │   ├── data/
│   │   │   │   │   │   ├── api/            # Retrofit ApiService, AuthInterceptor
│   │   │   │   │   │   ├── local/          # Room database, DAOs, entities
│   │   │   │   │   │   ├── models/         # API request/response models
│   │   │   │   │   │   └── repository/     # Auth, Ride, Chat, Profile, Request repos
│   │   │   │   │   ├── di/                # Hilt dependency injection modules
│   │   │   │   │   ├── navigation/        # Jetpack Compose Navigation graph
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── notification/  # FCM messaging service
│   │   │   │   │   │   └── socket/        # Socket.IO client manager
│   │   │   │   │   ├── ui/
│   │   │   │   │   │   ├── auth/          # Login, Register, ForgotPassword screens
│   │   │   │   │   │   ├── chat/          # Chat screen
│   │   │   │   │   │   ├── components/    # Common reusable composables
│   │   │   │   │   │   ├── home/          # Home screen
│   │   │   │   │   │   ├── profile/       # Profile screen
│   │   │   │   │   │   ├── requests/      # Ride requests screen
│   │   │   │   │   │   ├── rides/         # Ride list & detail screens
│   │   │   │   │   │   ├── splash/        # Splash screen
│   │   │   │   │   │   ├── theme/         # Color, Theme definitions
│   │   │   │   │   │   ├── viewmodel/     # ViewModels for each screen
│   │   │   │   │   │   └── MainActivity.kt
│   │   │   │   │   ├── utils/            # TokenManager, NetworkUtils, Resource
│   │   │   │   │   └── RideSharingApp.kt  # Application class (Hilt)
│   │   │   │   ├── res/
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── test/
│   │   ├── build.gradle.kts
│   │   └── proguard-rules.pro
│   ├── gradle/
│   │   ├── libs.versions.toml             # Version catalog
│   │   └── wrapper/
│   ├── build.gradle.kts                    # Project-level build file
│   ├── settings.gradle.kts
│   ├── gradle.properties
│   ├── gradlew / gradlew.bat
│   └── .gitignore
│
├── .gitignore
├── package-lock.json
├── TASK_PLAN.md
└── README.md                              # This file
```

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| WebSocket | Socket.io 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens), bcryptjs, OTP via email |
| Email | Resend API (primary), Nodemailer / SMTP (fallback) |
| Validation | Zod |
| Jobs | node-cron (expired ride cleanup) |

### Web Frontend (React SPA)

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| HTTP client | Axios |
| WebSocket | Socket.io-client |
| State management | Zustand |
| Date handling | date-fns |

### Android Mobile App

| Layer | Technology |
|---|---|
| Language | Kotlin |
| UI Framework | Jetpack Compose + Material 3 |
| Async | Kotlin Coroutines & Flow |
| DI | Hilt (Dagger) |
| HTTP client | Retrofit 2 + OkHttp + Gson |
| WebSocket | Socket.IO-client (Java) |
| Local DB | Room |
| Persistence | DataStore Preferences |
| Image loading | Coil |
| Navigation | Jetpack Navigation Compose |
| Background work | WorkManager + Hilt integration |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Security | EncryptedSharedPreferences |
| Min SDK | 26 (Android 8.0) |
| Target SDK | 35 |

### Common

| Technology | Purpose |
|---|---|
| PostgreSQL | Data persistence |
| JWT | Stateless authentication |
| Socket.io | Real-time chat & notifications |

---

## Prerequisites

- **Node.js** ≥ 18 (for backend & web frontend)
- **PostgreSQL** running locally or a hosted instance (e.g. Supabase, Railway)
- A **Resend** account _or_ Gmail App Password for email delivery
- **Android Studio** (Ladybug or later) with **Android SDK** (for the mobile app)
- **Java 17** or later (for building the Android app)
- `npm` or `yarn` (for web platform dependencies)

---

## Quick Start — Web Platform

### 1. Clone & install

```bash
git clone https://github.com/your-org/Ride_Sharing.git
cd Ride_Sharing/ride_sharing

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install

# (Optional) Install root monorepo deps
cd .. && npm install
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
cd ride_sharing/backend && npm run dev

# Terminal 2 – frontend (https://localhost:5173)
cd ride_sharing/frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Quick Start — Android Mobile App

### 1. Open in Android Studio

Open the `ride_sharing_mobile/` directory as a project in Android Studio.

### 2. Configure API URLs

The app is pre-configured to point to the hosted backend at `https://ride-sharing-q8gj.onrender.com`. If you're running the backend locally, update the URLs in `ride_sharing_mobile/app/build.gradle.kts`:

```kotlin
defaultConfig {
    buildConfigField("String", "BASE_URL", "\your API url\api"")
    buildConfigField("String", "SOCKET_URL", "\"your API url"")
}
```

> `10.0.2.2` is the Android emulator's alias for `localhost` on the host machine. Use your machine's local IP if testing on a physical device.

### 3. Build & Run

Select an emulator or connected device and click **Run** (Shift+F10) in Android Studio.

The app will connect to the backend, authenticate with OTP, and provide the full ride-sharing experience natively.

---

## Architecture Overview

```
Web Browser (React SPA)
      │                      Android App (Kotlin/Compose)
      │  REST (Axios)             │  REST (Retrofit)
      │  WebSocket (Socket.io)    │  WebSocket (Socket.io)
      ▼                           ▼
          ┌─────────────────────────────┐
          │    Express API Server        │
          │    + Socket.io Server        │
          │    (ride_sharing/backend)    │
          ├─────────────────────────────┤
          │  ┌─ Auth middleware (JWT)    │
          │  ├─ Zod validation           │
          │  ├─ Rate limit middleware    │
          │  ├─ /api/auth               │
          │  ├─ /api/rides              │
          │  ├─ /api/requests           │
          │  ├─ /api/chats              │
          │  └─ /api/profile            │
          └──────────┬──────────────────┘
                     │
                Prisma ORM
                     │
                     ▼
               PostgreSQL
```

---

## Key Features

- **Email-gated access** — only `@nitkkr.ac.in` addresses can register
- **OTP verification** — email OTP required before account creation and password reset
- **JWT auth** — short-lived access tokens (15 min) with rotating refresh tokens (7 days); server-side revocation via DB
- **Ride management** — create rides with date/time/vehicle/seats, auto-expire past rides via cron
- **Request flow** — riders request to join; owner accepts/rejects; phone number optionally shared on acceptance
- **Real-time chat** — Socket.io room per accepted request; REST fallback also available
- **Domain isolation** — rides are scoped to the user's email domain so multi-institution deployments stay separated
- **Rate limiting** — global limiter + dedicated OTP limiter to prevent abuse
- **Cross-platform** — same backend serves both web SPA and native Android app
- **Push notifications** (Android) — FCM for ride requests, acceptances, and chat messages
- **Offline caching** (Android) — Room DB caches rides, requests, messages, and user profiles

---

## Environment Variables

All variables live in `ride_sharing/backend/.env`. Copy `backend/.env.example` and fill in the values.

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
| `ALLOWED_DOMAINS` | ✅ | Comma-separated allowed email domains (e.g. `nitkkr.ac.in`) |
| `FRONTEND_URL` | ✅ | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `RATE_LIMIT_WINDOW_MS` | optional | Rate limit window in ms (default `900000` = 15 min) |
| `RATE_LIMIT_MAX` | optional | Max requests per window (default `100`) |
| `OTP_RATE_LIMIT_MAX` | optional | Max OTP requests per window (default `5`) |

---

## Available Scripts

### Backend (`ride_sharing/backend`)

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

### Web Frontend (`ride_sharing/frontend`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (output to `dist/`) |
| `npm run preview` | Preview the production build locally |

### Android Mobile (`ride_sharing_mobile`)

| Command | Description |
|---|---|
| `./gradlew assembleDebug` | Build debug APK |
| `./gradlew assembleRelease` | Build release APK (signed) |
| `./gradlew lint` | Run Android lint checks |
| `./gradlew test` | Run unit tests |
| `./gradlew :app:installDebug` | Install debug APK on connected device |

---

## API Reference

See [`ride_sharing/docs/api.md`](ride_sharing/docs/api.md) for the complete REST API documentation with request/response examples.

---

## Deployment

### Backend (e.g. Railway / Render / EC2)

1. Set all environment variables in the platform dashboard
2. Run `npm run prisma:migrate:prod` to deploy schema changes
3. Start with `npm start` (or the platform's start command)

### Web Frontend (e.g. Vercel / Netlify)

1. Set `VITE_API_URL` if your backend is on a different origin and update `api.js` accordingly
2. Run `npm run build` — the `dist/` folder is the deployable artifact
3. Configure the hosting platform to serve `index.html` for all routes (SPA fallback)

### Android Mobile (Play Store / sideload)

1. Generate a signed release APK or App Bundle via Android Studio
2. Build with `./gradlew assembleRelease` in `ride_sharing_mobile/`
3. Distribute via Google Play Console, Firebase App Distribution, or sideload the APK

---

## Contributing

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Commit your changes with a clear message
3. Open a Pull Request — describe what changes you made and why

---

## License

MIT © NIT Kurukshetra RideShare Project
