# RideShare API Reference

**Base URL:** `http://localhost:5000/api`  
**Auth:** Bearer token in `Authorization: Bearer <accessToken>` header (required on all protected routes)  
**Content-Type:** `application/json`

All responses follow the envelope:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Error responses include a `statusCode` field and an optional `errors` array for validation failures.

---

## Table of Contents

1. [Health](#health)
2. [Auth](#auth)
3. [Rides](#rides)
4. [Requests](#requests)
5. [Chats](#chats)
6. [Profile](#profile)
7. [WebSocket Events](#websocket-events)

---

## Health

### `GET /health`

Public endpoint. Returns server and DB status.

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:00:00.000Z",
  "env": "development",
  "database": "connected"
}
```

The endpoint returns **503** with the same response shape and a `degraded`
status when the database is not connected. Configure an external uptime monitor (for example UptimeRobot,
Better Uptime, or a Render Cron Job) to request the deployed `/health` URL at
least every 10 minutes. A cron job inside this Node process cannot wake a
sleeping Render web service.

---

## Auth

All auth routes are public unless noted. OTP endpoints are rate-limited to **5 requests per 15 minutes** per IP. Login/Register endpoints are rate-limited to **100 per 15 minutes**.

---

### `POST /auth/send-otp`

Send a 6-digit OTP to a college email for email verification.

**Request Body**

```json
{
  "email": "student1@yourcollege.edu"
}
```

| Field   | Type   | Required | Notes                                          |
| ------- | ------ | -------- | ---------------------------------------------- |
| `email` | string | ✅       | Must be an allowed domain (`@yourcollege.edu`) |

**Response 200**

```json
{
  "success": true,
  "message": "OTP sent successfully. Please check your college email."
}
```

**Errors**

- `400` — Email domain not allowed
- `429` — OTP rate limit exceeded

---

### `POST /auth/verify-otp`

Verify the OTP. Creates a 30-minute window to complete registration.

**Request Body**

```json
{
  "email": "student1@yourcollege.edu",
  "otp": "483920"
}
```

| Field   | Type              | Required |
| ------- | ----------------- | -------- |
| `email` | string            | ✅       |
| `otp`   | string (6 digits) | ✅       |

**Response 200**

```json
{
  "success": true,
  "message": "OTP verified successfully. You may now complete registration.",
  "data": { "verified": true }
}
```

**Errors**

- `400` — No OTP found, OTP expired, or invalid OTP

---

### `POST /auth/register`

Create a new account. Requires prior OTP verification (within 30 minutes).

**Request Body**

```json
{
  "name": "Rahul Sharma",
  "rollNo": "21CS001",
  "email": "student1@yourcollege.edu",
  "password": "SecurePass@123",
  "phone": "9876543210"
}
```

| Field      | Type   | Required | Notes                          |
| ---------- | ------ | -------- | ------------------------------ |
| `name`     | string | ✅       | 2–100 characters               |
| `rollNo`   | string | ✅       | University roll number, unique |
| `email`    | string | ✅       | Must be an allowed domain      |
| `password` | string | ✅       | Min 8 characters               |
| `phone`    | string | ❌       | 10-digit Indian mobile number  |

**Response 201**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahul Sharma",
      "email": "student1@yourcollege.edu",
      "rollNo": "21CS001",
      "domain": "yourcollege.edu",
      "phone": "9876543210"
    },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

**Errors**

- `400` — Email not verified, or verification window expired
- `409` — Email or roll number already registered

---

### `POST /auth/login`

Authenticate with email and password.

**Request Body**

```json
{
  "email": "student1@yourcollege.edu",
  "password": "SecurePass@123"
}
```

**Response 200**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahul Sharma",
      "email": "student1@yourcollege.edu",
      "rollNo": "21CS001",
      "domain": "yourcollege.edu",
      "phone": "9876543210"
    },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

**Errors**

- `401` — Invalid email or password
- `403` — Email not verified

---

### `POST /auth/refresh`

Exchange a valid refresh token for a new access token and rotated refresh token.

**Request Body**

```json
{ "refreshToken": "<jwt>" }
```

**Response 200**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "<new-jwt>",
    "refreshToken": "<new-jwt>"
  }
}
```

**Errors**

- `401` — Invalid, expired, or revoked refresh token

---

### `POST /auth/logout`

Revoke the refresh token (server-side). Idempotent.

**Request Body**

```json
{ "refreshToken": "<jwt>" }
```

**Response 200**

```json
{ "success": true, "message": "Logged out successfully" }
```

---

### `POST /auth/forgot-password`

Initiate password reset. Sends an OTP to the registered email. Always returns the same message to prevent user enumeration.

**Request Body**

```json
{ "emailOrPhone": "student1@yourcollege.edu" }
```

**Response 200**

```json
{
  "success": true,
  "message": "If this account exists, a reset OTP has been sent to the registered email."
}
```

---

### `POST /auth/reset-password`

Reset password using the OTP from `forgot-password`.

**Request Body**

```json
{
  "email": "student1@yourcollege.edu",
  "otp": "382910",
  "newPassword": "NewSecurePass@456"
}
```

**Response 200**

```json
{
  "success": true,
  "message": "Password reset successfully. Please login with your new password."
}
```

**Errors**

- `400` — No OTP found, expired, or invalid

---

### `GET /auth/me` 🔒

Return the authenticated user's profile from the JWT.

**Response 200**

```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahul Sharma",
      "email": "student1@yourcollege.edu",
      "rollNo": "21CS001",
      "domain": "yourcollege.edu"
    }
  }
}
```

---

## Rides

All routes require authentication (`🔒`). Rides are **domain-scoped** — users only see rides from their own email domain.

---

### `POST /rides` 🔒

Create a new ride.

**Request Body**

```json
{
  "from": "NIT yourcity Gate 1",
  "to": "yourcity Railway Station",
  "date": "2024-03-20",
  "time": "14:30",
  "vehicleType": "Car",
  "availableSeats": 3
}
```

| Field            | Type                | Required | Notes                                         |
| ---------------- | ------------------- | -------- | --------------------------------------------- |
| `from`           | string              | ✅       | Departure location                            |
| `to`             | string              | ✅       | Destination                                   |
| `date`           | string (YYYY-MM-DD) | ✅       | Max 7 days ahead                              |
| `time`           | string (HH:MM)      | ✅       | 24-hour format                                |
| `vehicleType`    | string              | ✅       | One of: `Car`, `Bike`, `Auto`, `Bus`, `Other` |
| `availableSeats` | integer             | ✅       | 1–10                                          |

**Response 201**

```json
{
  "success": true,
  "message": "Ride created successfully",
  "data": {
    "ride": {
      "id": "uuid",
      "from": "NIT yourcity Gate 1",
      "to": "yourcity Railway Station",
      "date": "2024-03-20T00:00:00.000Z",
      "time": "14:30",
      "vehicleType": "Car",
      "availableSeats": 3,
      "isFull": false,
      "isExpired": false,
      "domain": "yourcollege.edu",
      "createdById": "uuid",
      "createdAt": "2024-03-15T10:00:00.000Z"
    }
  }
}
```

---

### `GET /rides` 🔒

List available rides for the user's domain. Supports filtering.

**Query Parameters**

| Param         | Type                | Notes                                        |
| ------------- | ------------------- | -------------------------------------------- |
| `from`        | string              | Filter by departure location (partial match) |
| `to`          | string              | Filter by destination (partial match)        |
| `date`        | string (YYYY-MM-DD) | Filter by date                               |
| `vehicleType` | string              | Filter by vehicle type                       |
| `page`        | integer             | Page number (default: 1)                     |
| `limit`       | integer             | Items per page (default: 10, max: 50)        |

**Response 200**

```json
{
  "success": true,
  "message": "Rides fetched successfully",
  "data": {
    "rides": [
      /* array of ride objects */
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

---

### `GET /rides/my` 🔒

Return all rides created by the authenticated user.

**Response 200**

```json
{
  "success": true,
  "message": "Your rides fetched",
  "data": {
    "rides": [
      /* array of ride objects with requests included */
    ]
  }
}
```

---

### `GET /rides/:id` 🔒

Fetch a single ride by ID.

**Response 200**

```json
{
  "success": true,
  "message": "Ride details fetched",
  "data": {
    "ride": {
      /* ride object */
    }
  }
}
```

**Errors**

- `404` — Ride not found or belongs to another domain

---

### `DELETE /rides/:id` 🔒

Delete a ride created by the authenticated user. Also cascades to all related requests and chats.

**Response 200**

```json
{ "success": true, "message": "Ride deleted successfully" }
```

**Errors**

- `403` — Not the ride owner
- `404` — Ride not found

---

## Requests

All routes require authentication (`🔒`).

---

### `POST /requests` 🔒

Send a join request for a ride.

**Request Body**

```json
{ "rideId": "uuid" }
```

**Response 201**

```json
{
  "success": true,
  "message": "Ride request sent successfully",
  "data": {
    "request": {
      "id": "uuid",
      "status": "PENDING",
      "rideId": "uuid",
      "requesterId": "uuid",
      "rideCreatorId": "uuid",
      "createdAt": "2024-03-15T10:00:00.000Z"
    }
  }
}
```

A `new_request` Socket.io event is emitted to the ride owner's room.

**Errors**

- `400` — Already requested, ride is full, or user owns the ride
- `404` — Ride not found

---

### `GET /requests` 🔒

Return all incoming and outgoing requests for the authenticated user.

**Response 200**

```json
{
  "success": true,
  "message": "Requests fetched",
  "data": {
    "incoming": [
      /* requests on rides I created */
    ],
    "outgoing": [
      /* requests I sent */
    ]
  }
}
```

---

### `PATCH /requests/:id` 🔒

Accept or reject an incoming request (ride owner only).

**Request Body**

```json
{ "status": "ACCEPTED" }
```

| Field    | Type   | Notes                    |
| -------- | ------ | ------------------------ |
| `status` | string | `ACCEPTED` or `REJECTED` |

**Response 200**

```json
{
  "success": true,
  "message": "Request accepted successfully",
  "data": {
    "request": {
      "id": "uuid",
      "status": "ACCEPTED",
      "chat": { "id": "uuid" }
    }
  }
}
```

Accepting a request automatically creates a `Chat` room and emits a `request_status` Socket.io event to the requester.

**Errors**

- `403` — Not the ride owner or request already processed
- `404` — Request not found

---

### `PATCH /requests/:id/share-phone` 🔒

Toggle phone number sharing for an accepted request. Either participant can call this.

**Response 200**

```json
{
  "success": true,
  "message": "Phone sharing confirmed",
  "data": {
    "phoneShared": true,
    "creatorPhoneConfirmed": true,
    "requesterPhoneConfirmed": false
  }
}
```

**Errors**

- `400` — Request is not in ACCEPTED status
- `403` — Not a participant in this request

---

## Chats

All routes require authentication (`🔒`). Identified by `requestId` (the accepted request's ID).

---

### `GET /chats/:requestId` 🔒

Fetch chat metadata including participant info and ride details.

**Response 200**

```json
{
  "success": true,
  "message": "Chat info fetched",
  "data": {
    "chat": {
      "id": "uuid",
      "requestId": "uuid",
      "participants": [
        { "id": "uuid", "name": "Rahul Sharma", "rollNo": "21CS001" },
        { "id": "uuid", "name": "Priya Patel", "rollNo": "21EC042" }
      ],
      "ride": {
        "from": "NIT Gate 1",
        "to": "Railway Station",
        "date": "2024-03-20T00:00:00.000Z",
        "time": "14:30"
      }
    }
  }
}
```

**Errors**

- `403` — Not a participant in this chat
- `404` — Chat not found

---

### `GET /chats/:requestId/messages` 🔒

Fetch paginated message history (newest first).

**Query Parameters**

| Param   | Type    | Default |
| ------- | ------- | ------- |
| `page`  | integer | `1`     |
| `limit` | integer | `50`    |

**Response 200**

```json
{
  "success": true,
  "message": "Messages fetched",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "text": "Hi, I'll be at Gate 1 at 2:15 PM",
        "createdAt": "2024-03-20T08:12:00.000Z",
        "sender": { "id": "uuid", "name": "Rahul Sharma" }
      }
    ],
    "pagination": {
      "total": 18,
      "page": 1,
      "limit": 50
    }
  }
}
```

---

### `POST /chats/:requestId/messages` 🔒

Send a message via REST (Socket.io `send_message` event is the preferred real-time path).

**Request Body**

```json
{ "text": "I'll be there in 5 minutes!" }
```

**Response 201**

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "message": {
      "id": "uuid",
      "text": "I'll be there in 5 minutes!",
      "createdAt": "2024-03-20T14:05:00.000Z",
      "sender": { "id": "uuid", "name": "Rahul Sharma" }
    }
  }
}
```

---

## Profile

All routes require authentication (`🔒`).

---

### `GET /profile` 🔒

Fetch the authenticated user's profile with ride and request counts.

**Response 200**

```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahul Sharma",
      "rollNo": "21CS001",
      "email": "student1@yourcollege.edu",
      "phone": "9876543210",
      "domain": "yourcollege.edu",
      "isVerified": true,
      "createdAt": "2024-01-10T00:00:00.000Z",
      "_count": {
        "rides": 5,
        "sentRequests": 12
      }
    }
  }
}
```

---

### `PATCH /profile` 🔒

Update name and/or phone number.

**Request Body** (all fields optional)

```json
{
  "name": "Rahul K. Sharma",
  "phone": "9123456789"
}
```

Pass `"phone": null` to remove the phone number.

**Response 200**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahul K. Sharma",
      "rollNo": "21CS001",
      "email": "student1@yourcollege.edu",
      "phone": "9123456789",
      "domain": "yourcollege.edu"
    }
  }
}
```

---

### `PATCH /profile/change-password` 🔒

Change password. Revokes all existing refresh tokens (forces re-login on all devices).

**Request Body**

```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewSecurePass@456"
}
```

**Response 200**

```json
{
  "success": true,
  "message": "Password changed successfully. Please login again."
}
```

**Errors**

- `400` — Current password is incorrect

---

## WebSocket Events

The backend uses **Socket.io**. Connect to the same origin as the HTTP server.

### Authentication

Send the access token as a query parameter on connect:

```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "Bearer <accessToken>" },
});
```

---

### Client → Server

| Event          | Payload                              | Description                                 |
| -------------- | ------------------------------------ | ------------------------------------------- |
| `join_chat`    | `{ requestId: "uuid" }`              | Join a chat room identified by `requestId`  |
| `leave_chat`   | `{ requestId: "uuid" }`              | Leave a chat room                           |
| `send_message` | `{ requestId: "uuid", text: "..." }` | Send a message to a chat room               |
| `typing`       | `{ requestId: "uuid" }`              | Notify other participant you're typing      |
| `stop_typing`  | `{ requestId: "uuid" }`              | Notify other participant you stopped typing |

---

### Server → Client

| Event              | Payload                                                 | Description                                |
| ------------------ | ------------------------------------------------------- | ------------------------------------------ |
| `joined_chat`      | `{ requestId: "uuid" }`                                 | Confirmation that you joined the room      |
| `new_message`      | Message object (see Chat messages)                      | A new message was sent in the chat room    |
| `user_typing`      | `{ userId: "uuid", name: "..." }`                       | Another participant is typing              |
| `user_stop_typing` | `{ userId: "uuid" }`                                    | Another participant stopped typing         |
| `new_request`      | Request object                                          | (Ride owner) Someone requested your ride   |
| `request_status`   | `{ requestId: "uuid", status: "ACCEPTED"\|"REJECTED" }` | (Requester) Your request status changed    |
| `error`            | `{ message: "..." }`                                    | An error occurred (e.g. not a participant) |

---

## Error Codes

| HTTP Status | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `400`       | Bad request / validation error                          |
| `401`       | Unauthenticated — missing or expired access token       |
| `403`       | Forbidden — authenticated but not authorized            |
| `404`       | Resource not found                                      |
| `409`       | Conflict — duplicate resource (e.g. already registered) |
| `429`       | Too Many Requests — rate limit exceeded                 |
| `500`       | Internal server error                                   |
