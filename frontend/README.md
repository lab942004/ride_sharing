# RideShare Frontend

A React + Vite + Tailwind CSS frontend for the RideShare multi-organization ride-sharing platform.

## Tech Stack
- **React 18** + **Vite**
- **Tailwind CSS** (custom design system)
- **React Router v6**
- **Axios** (with JWT interceptor + refresh token)
- **Zustand** (optional, Context API used)
- **Socket.io-client** (real-time chat)
- **date-fns** (date formatting)
- **Google Fonts**: Playfair Display + DM Sans

## Pages
| Route | Page | Auth |
|---|---|---|
| `/` | Home (ride search + listings) | Public / Protected |
| `/about` | About Us | Public |
| `/login` | Login | Public |
| `/register` | Sign Up + OTP | Public |
| `/forgot-password` | Reset Password | Public |
| `/create-ride` | Create Ride | Protected |
| `/request` | Ride Requests (Incoming/Outgoing) | Protected |
| `/chat` | Real-time Chat | Protected |
| `/profile` | User Profile + My Rides | Protected |

## Setup

```bash
# Install dependencies
npm install

# Development server (proxies /api to localhost:3000)
npm run dev

# Production build
npm run build
```

## Environment / Proxy

The Vite dev server proxies:
- `/api/*` → `http://localhost:3000`
- `/socket.io` → `http://localhost:3000` (WebSocket)

For production, configure your web server (nginx/etc.) accordingly.

## Design System

- **Primary color**: `#F59E0B` (amber/orange)
- **Background**: `#FFF8E7` (warm cream)
- **Font display**: Playfair Display (headings)
- **Font body**: DM Sans (body text)

## Key Features
- College email validation (`@yourcollege.edu` only)
- JWT access + refresh token management
- Real-time chat via Socket.io
- Responsive design (mobile-first)
- Ride search with filters (to/from/date)
- Request accept/reject flow
- Profile editing + my rides management
