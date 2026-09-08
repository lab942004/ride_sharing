# 🚗 RideShare Backend

A production-ready, multi-organization ride-sharing REST API for colleges and companies, built with **Node.js + Express + PostgreSQL + Prisma + Socket.io**.

---

## 📋 Table of Contents
1. [Tech Stack](#tech-stack)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [API Reference](#api-reference)
5. [Socket.io Events](#socketio-events)
6. [Key Design Decisions](#key-design-decisions)
7. [Environment Variables](#environment-variables)

---

## Tech Stack

| Layer          | Technology                              |
|----------------|-----------------------------------------|
| Runtime        | Node.js ≥ 18                            |
| Framework      | Express.js                              |
| Database       | PostgreSQL                              |
| ORM            | Prisma                                  |
| Auth           | JWT (access + refresh) + bcrypt         |
| Validation     | **Zod**                                 |
| Real-time      | Socket.io                               |
| Email (primary)| Resend API                              |
| Email (fallback)| Nodemailer (SMTP)                      |
| Rate limiting  | express-rate-limit                      |
| Cleanup jobs   | node-cron                               |

---

## Architecture

```
src/
├── config/
│   ├── constants.js       # App-wide constants
│   └── db.js              # Prisma singleton
├── controllers/           # Thin HTTP handlers
├── jobs/
│   └── cleanup.job.js     # Cron: expire rides, purge OTPs/tokens
├── middleware/
│   ├── auth.middleware.js  # JWT protect
│   ├── error.middleware.js # Central error handler
│   ├── rateLimit.middleware.js
│   └── validate.middleware.js # Zod validation
├── routes/
├── services/              # Business logic
├── sockets/
│   └── chat.socket.js     # Socket.io handler
├── utils/
│   ├── domain.utils.js    # Email domain whitelist
│   ├── jwt.utils.js       # Token helpers
│   ├── otp.utils.js       # OTP generation
│   ├── response.utils.js  # Standardized responses
│   └── rideTime.utils.js  # Date+time departure helpers
├── validations/           # Zod schemas
└── server.js
```

---

## Setup

### Prerequisites
- Node.js ≥ 18
- PostgreSQL (local or cloud)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run database migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. (Optional) Seed the database
```bash
npm run seed
# Creates: test1@yourcollege.edu / Student@123
#          test2@yourcollege.edu / Student@123
```

### 5. Start the server
```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

Server runs on: `http://localhost:5000`

---

## API Reference

### Authentication — `/api/auth`

| Method | Endpoint            | Auth | Description                                         |
|--------|---------------------|------|-----------------------------------------------------|
| POST   | `/send-otp`         | ✗    | Send OTP to college email (rate-limited: 5/15 min)  |
| POST   | `/verify-otp`       | ✗    | Verify OTP → creates VerifiedEmail proof record      |
| POST   | `/register`         | ✗    | Create account (requires verified email proof)       |
| POST   | `/login`            | ✗    | Returns access + refresh tokens                      |
| POST   | `/refresh`          | ✗    | Rotate refresh token, returns new pair               |
| POST   | `/logout`           | ✗    | Revoke refresh token server-side                     |
| POST   | `/forgot-password`  | ✗    | Send reset OTP (accepts email or phone)              |
| POST   | `/reset-password`   | ✗    | Reset password using OTP, revokes all sessions       |
| GET    | `/me`               | ✓    | Returns current user profile                         |

### Rides — `/api/rides`

| Method | Endpoint    | Auth | Description                                               |
|--------|-------------|------|-----------------------------------------------------------|
| POST   | `/`         | ✓    | Create a ride (validates date+time not past, ≤7 days)     |
| GET    | `/`         | ✓    | List rides (same-domain, not expired, supports filters)   |
| GET    | `/my`       | ✓    | My created rides                                          |
| GET    | `/:id`      | ✓    | Single ride details                                       |
| DELETE | `/:id`      | ✓    | Delete own ride (cascades requests/chats)                 |

**Query filters for `GET /rides`:**
- `from`, `to` — partial, case-insensitive
- `date` — ISO date string (YYYY-MM-DD)
- `vehicleType` — Car | Bike | Auto | Bus | Other
- `page`, `limit`

### Requests — `/api/requests`

| Method | Endpoint              | Auth | Description                                           |
|--------|-----------------------|------|-------------------------------------------------------|
| POST   | `/`                   | ✓    | Send ride request (guards: expired, full, own ride)   |
| GET    | `/`                   | ✓    | Returns `{ sent, received }` arrays                   |
| PATCH  | `/:id`                | ✓    | Accept/Reject (creator only, PENDING only)            |
| PATCH  | `/:id/share-phone`    | ✓    | Mutual phone sharing consent                          |

### Chats — `/api/chats`

| Method | Endpoint                  | Auth | Description                     |
|--------|---------------------------|------|---------------------------------|
| GET    | `/:requestId`             | ✓    | Chat metadata (participants)     |
| GET    | `/:requestId/messages`    | ✓    | Paginated messages (`?page&limit`)|
| POST   | `/:requestId/messages`    | ✓    | Send message (REST fallback)     |

### Profile — `/api/profile`

| Method | Endpoint            | Auth | Description              |
|--------|---------------------|------|--------------------------|
| GET    | `/`                 | ✓    | Full profile + stats     |
| PATCH  | `/`                 | ✓    | Update name / phone      |
| PATCH  | `/change-password`  | ✓    | Change password (Zod-validated, revokes all sessions) |

---

## Socket.io Events

Connect with: `{ auth: { token: "<accessToken>" } }`

Each user automatically joins `user_<userId>` for push notifications.

### Client → Server

| Event          | Payload                       | Description                  |
|----------------|-------------------------------|------------------------------|
| `join_chat`    | `{ requestId }`               | Join a chat room             |
| `leave_chat`   | `{ requestId }`               | Leave a chat room            |
| `send_message` | `{ requestId, text }`         | Send a message               |
| `typing`       | `{ requestId }`               | Start typing indicator       |
| `stop_typing`  | `{ requestId }`               | Stop typing indicator        |

### Server → Client

| Event              | Description                              |
|--------------------|------------------------------------------|
| `joined_chat`      | Confirmation with `{ requestId, chatId, room }` |
| `new_message`      | Message object (all participants)        |
| `user_typing`      | `{ user: { id, name } }`                |
| `user_stop_typing` | `{ userId }`                             |
| `new_request`      | Push to ride owner when someone requests |
| `request_status`   | Push to requester when accepted/rejected |
| `error`            | `{ message }`                            |

---

## Key Design Decisions

### 🔒 OTP Proof of Verification
The original code had a **critical bug**: `/register` could be called without ever verifying OTP. The fix uses a `VerifiedEmail` table — `verifyOTP` creates a row there, and `register` checks for it before creating the account. The row is deleted after successful registration.

### ⏰ Ride Expiry (Date + Time)
The original code only compared the **date** field (which stored midnight UTC), so a ride at 08:30 would appear as "future" until the next day. The fix uses `getRideDepartureDate(date, time)` to combine both fields for an exact comparison.

The `cleanup.job.js` cron runs every 5 minutes to:
1. Mark expired rides `isExpired = true`
2. Auto-reject all `PENDING` requests on those rides

### 🔄 Refresh Token Rotation
Refresh tokens are stored in the DB. On `/refresh`, the old token is **revoked** and a new pair is issued. This prevents token reuse after logout and supports multi-device session management.

### 📧 Email with Fallback
Email is sent via **Resend API** first. If that fails (or isn't configured), it falls back to **Nodemailer SMTP** (e.g., Gmail). This ensures reliability in all environments.

### 🛡️ Rate Limiting
- OTP endpoints: **5 requests / 15 min** per IP
- Auth endpoints: **10 requests / 15 min** per IP
- Global: **100 requests / 15 min** per IP

---

## Environment Variables

See `.env.example` for all variables with descriptions.

**Required for production:**
- `DATABASE_URL`
- `JWT_SECRET` (≥ 32 chars)
- `JWT_REFRESH_SECRET` (≥ 32 chars)
- Either `RESEND_API_KEY` **or** `SMTP_USER` + `SMTP_PASS`
- `ALLOWED_DOMAINS` (e.g., `yourcollege.edu`)
- `FRONTEND_URL`
