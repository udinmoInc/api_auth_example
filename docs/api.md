# REST API Documentation & Payload Reference

This reference details the entry endpoints, required headers, schemas, response structures, and error schema maps.

---

## 📡 Base Endpoint Context
* **Base URL**: `http://localhost:5000/api/v1`
* **Content-Type**: `application/json`

---

## 📁 Endpoints Reference

### 1. Register User
* **Endpoint**: `POST /auth/register`
* **Authentication**: None
* **Rate Limiting**: Strict (Auth)
* **Request Payload**:
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```
* **Response Payload (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. We have sent an email verification link to your registered email address.",
  "data": {
    "user": {
      "id": "8b08269e-bf33-47a3-b6d8-f80e9cdb05e6",
      "email": "developer@saas.com",
      "role": "USER",
      "isEmailVerified": false,
      "createdAt": "2026-05-19T07:44:00.000Z",
      "updatedAt": "2026-05-19T07:44:00.000Z",
      "profile": {
        "id": "f8a02c9a-c944-482a-a92c-d9bcf90c0ef6",
        "firstName": "John",
        "lastName": "Doe",
        "avatarUrl": null,
        "phoneNumber": "+1234567890"
      }
    }
  },
  "timestamp": "2026-05-19T07:44:02.123Z"
}
```

---

### 2. Login User
* **Endpoint**: `POST /auth/login`
* **Authentication**: None
* **Rate Limiting**: Strict (Auth)
* **Request Payload**:
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!"
}
```
* **Response Payload (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "8b08269e-bf33-47a3-b6d8-f80e9cdb05e6",
      "email": "developer@saas.com",
      "role": "USER",
      "isEmailVerified": true,
      "createdAt": "2026-05-19T07:44:00.000Z",
      "updatedAt": "2026-05-19T07:44:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4YjA4MjY5ZS1iZjMzLTQ3YTMtYjZkOC1mODBlOWNkYjA1ZTYiLCJlbWFpbCI6ImRldmVsb3BlckBzYWFzLmNvbSIsInJvbGUiOiJVU0VSIiwic2Vzc2lvbklkIjoiYzVhMmM4OWEtYzk0NC00ODJhLWE5MmMtZDliY2Y5MGMwZWY2In0..."
  },
  "timestamp": "2026-05-19T07:45:00.123Z"
}
```
> 🍪 **Secure Cookie Footprint**: The response includes a secure HTTP-Only, SameSite cookie:
> `Set-Cookie: refreshToken=eyJhbGci...; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure`

---

### 3. Rotate Tokens (Refresh)
* **Endpoint**: `POST /auth/refresh`
* **Authentication**: Refresh Token (Parsed from cookie or JSON body)
* **Rate Limiting**: General
* **Response Payload (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5c..."
  },
  "timestamp": "2026-05-19T07:46:12.123Z"
}
```

---

### 4. Fetch Active Devices / Sessions
* **Endpoint**: `GET /auth/sessions`
* **Authentication**: Authorization header Bearer Access Token
* **Headers**: `Authorization: Bearer <accessToken>`
* **Response Payload (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Active login sessions fetched successfully.",
  "data": {
    "sessions": [
      {
        "id": "c5a2c89a-c944-482a-a92c-d9bcf90c0ef6",
        "userId": "8b08269e-bf33-47a3-b6d8-f80e9cdb05e6",
        "device": "Desktop",
        "os": "Windows 11",
        "browser": "Chrome",
        "ipAddress": "192.168.1.5",
        "isValid": true,
        "createdAt": "2026-05-19T07:45:00.000Z",
        "expiresAt": "2026-05-26T07:45:00.000Z",
        "isCurrent": true
      }
    ]
  },
  "timestamp": "2026-05-19T07:47:30.123Z"
}
```

---

### 5. Dynamic Extension Health (Plugin Endpoint Example)
* **Endpoint**: `GET /plugins/audit-logs/health`
* **Authentication**: None (Dynamic route loaded by registered plugins)
* **Description**: Verifies the health and listener bindings for registered event extensions (e.g. Audit Ledger, Webhooks).
* **Response Payload (200 OK)**:
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

## 🚫 Standard Unified Error Format

When an operational failure, relational constraint violation, or Zod validation error occurs, the server yields a consistent, client-friendly structured JSON payload.

### Example: Validation Error (400 Bad Request)
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
  "timestamp": "2026-05-19T07:48:15.123Z"
}
```
