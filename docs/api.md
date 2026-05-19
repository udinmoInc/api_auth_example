# REST API Reference & Payload Specs

This reference outlines the available endpoints, required payload structures, authorization rules, and error envelopes.

---

## Base Context
* **Base Path**: `/api/v1`
* **Default Port**: `5000`
* **Content-Type**: `application/json`

---

## Endpoint Specifications

### 1. Register User
Registers a new user and provisions their associated profile records. Sends an out-of-band email verification link.

* **Endpoint**: `POST /auth/register`
* **Auth**: None
* **Rate Limit**: Auth Window (10 attempts / 15 minutes)
* **Payload**:
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

* **Response (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. Verification email sent.",
  "data": {
    "user": {
      "id": "c1a01103-61a0-43e6-bfbd-61a99a8de4a0",
      "email": "developer@saas.com",
      "role": "USER",
      "isEmailVerified": false,
      "createdAt": "2026-05-19T03:30:00.000Z",
      "updatedAt": "2026-05-19T03:30:00.000Z",
      "profile": {
        "id": "p8a02c9a-c944-482a-a92c-d9bcf90c0ef6",
        "firstName": "John",
        "lastName": "Doe",
        "avatarUrl": null,
        "phoneNumber": "+1234567890"
      }
    }
  },
  "timestamp": "2026-05-19T03:30:00.123Z"
}
```

---

### 2. User Authentication (Login)
Validates credentials, spawns a unique active session, warms the Redis session validity cache, and returns cookie tokens.

* **Endpoint**: `POST /auth/login`
* **Auth**: None
* **Rate Limit**: Auth Window (10 attempts / 15 minutes)
* **Payload**:
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!"
}
```

* **Response (200 OK)**:
*(Sets the HTTP-Only cookie `refreshToken`)*
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1a01103-61a0-43e6-bfbd-61a99a8de4a0",
      "email": "developer@saas.com",
      "role": "USER",
      "isEmailVerified": true,
      "createdAt": "2026-05-19T03:30:00.000Z",
      "updatedAt": "2026-05-19T03:30:00.000Z"
    }
  },
  "timestamp": "2026-05-19T03:31:00.456Z"
}
```

> **Cookie Configuration**:
> `Set-Cookie: refreshToken=eyJhbGci...; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure`

---

### 3. Rotate Tokens (Refresh)
Invokes Refresh Token Rotation (RTR). Invalidates the old token, caches it briefly in the Redis blacklist for a concurrent 15-second grace window, and issues a fresh pair.

* **Endpoint**: `POST /auth/refresh`
* **Auth**: Refresh Token (Loaded from `refreshToken` cookie or JSON payload)
* **Payload**: None
* **Response (200 OK)**:
*(Updates the HTTP-Only cookie `refreshToken`)*
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5c..."
  },
  "timestamp": "2026-05-19T03:32:00.123Z"
}
```

---

### 4. Fetch Active Sessions
Queries all active login devices and sessions associated with the user account.

* **Endpoint**: `GET /auth/sessions`
* **Auth**: `Bearer <accessToken>`
* **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Active sessions fetched.",
  "data": {
    "sessions": [
      {
        "id": "s5a2c89a-c944-482a-a92c-d9bcf90c0ef6",
        "userId": "c1a01103-61a0-43e6-bfbd-61a99a8de4a0",
        "device": "Desktop",
        "os": "Windows 11",
        "browser": "Chrome",
        "ipAddress": "127.0.0.1",
        "isValid": true,
        "createdAt": "2026-05-19T03:31:00.000Z",
        "expiresAt": "2026-05-26T03:31:00.000Z",
        "isCurrent": true
      }
    ]
  },
  "timestamp": "2026-05-19T03:33:00.123Z"
}
```

---

### 5. Revoke Session
Terminates an active session remotely and removes it from the validity cache.

* **Endpoint**: `DELETE /auth/sessions/:sessionId`
* **Auth**: `Bearer <accessToken>`
* **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Session revoked successfully."
}
```

---

### 6. Dynamic Extension Health (Plugin Endpoint Example)
An endpoint mounted dynamically by the `AuditLogsExtension` if enabled.

* **Endpoint**: `GET /plugins/audit-logs/health`
* **Auth**: None
* **Response (200 OK)**:
```json
{
  "status": "active",
  "listeners": {
    "signup": 1,
    "login": 1,
    "logout": 1,
    "passwordReset": 1,
    "sessionRevoked": 1
  }
}
```

---

## Error Envelope Standards

All runtime, database constraint, and validator validation failures conform to a unified format.

### Validation Exception (400 Bad Request)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long"
    }
  ],
  "timestamp": "2026-05-19T03:34:00.123Z"
}
```
