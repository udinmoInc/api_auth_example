# production-ready auth engine

A production-grade, highly resilient identity and authentication backend service written in **TypeScript** using **Express.js**, **Prisma ORM**, and **PostgreSQL**, with **Redis** for sub-millisecond session validation and sliding-window rate limiting.

This repository is built as a modular, decoupled identity microservice. It is designed to be easily integrated into any modern architecture, providing robust token rotation (RTR), session monitoring, out-of-band email notifications, and an event-driven plugin system out of the box.

---

## Why this project exists

A lot of backend boilerplate repositories fall into two categories: they are either too simplistic, missing key security essentials like token family invalidation and multi-tab race condition management, or they are heavily bloated with proprietary abstractions, billing integrations, or opinions on front-end frameworks.

This starter delivers a clean and professional foundation focusing on:
* **Decoupled Architecture**: Domain actions (like user registrations) are decoupled from downstream operations (like sending emails or billing setups) using a clean, asynchronous event-driven system.
* **Resilient Infrastructure**: Runs perfectly in Postgres-only mode during local development, and seamlessly scales with Redis for session validation and rate-limiting via simple environment toggles.
* **Handcrafted Code Standards**: Consolidates fragmented configurations and constants, drops bloated abstractions (like unnecessary `asyncHandler` wrappers), and uses standard Express 5 native async error tracking.

---

## Core features

* **Stateful JWT Session Management**: Pair stateless access tokens with database-backed stateful refresh tokens for immediate global session revocation.
* **Refresh Token Rotation (RTR)**: Each refresh cycle invalidates the old token and issues a new pair. A **15-second grace period** handles multi-tab browser concurrency smoothly without triggering false reuse violations.
* **Replay Attack Mitigation**: Automatic invalidation of the entire token family (all nested active sessions) if a previously rotated refresh token is reused, securing the account from token theft.
* **Redis Caching**: Sub-millisecond session authorization checks (`<1ms`) via Redis, falling back gracefully to PostgreSQL if Redis goes offline.
* **Sliding-Window Rate Limiting**: Built-in sliding-window limiter powered by Redis transactions (`multi`), with an automatic self-cleaning in-memory sliding window fallback.
* **AsyncLocalStorage Context Tracing**: Correlates inbound request IDs (`X-Request-Id`) across asynchronous chains for unified log tracing.
* **Zero-Dependency Plugin System**: Event-driven plugin pipeline allows clean extension registration (e.g. security audits, webhook listeners) on server bootstrap without altering the core codebase.
* **Type-Safe Request Payloads**: Unified schema validation using Zod for req.body, req.query, and req.params.

---

## Directory layout

```text
src/
├── config/           # Centralized configuration & environment validation (Zod)
│   ├── env.ts        # Environment schema declaration and validator
│   └── index.ts      # Consolidated application configurations
├── constants/        # Centralized system constants
│   └── index.ts      # Unified application, route, header, and error constants
├── lib/              # Client setups and low-level infrastructure
│   ├── context.ts    # AsyncLocalStorage tracing store
│   ├── events.ts     # Safe, non-blocking Event Emitter
│   ├── plugins.ts    # Dynamic boot plugin registry
│   ├── prisma.ts     # Prisma client with pg connection pooling
│   └── redis.ts      # Redis connection client with auto-reconnect strategy
├── middleware/       # Express route handlers and filters
│   ├── auth.ts       # Access control and session token guards
│   ├── device.ts     # IP parser and useragent detector
│   ├── error.ts      # Global centralized error mapper
│   ├── rateLimiter.ts# Sliding-window rate limiter (Redis/Memory)
│   ├── requestLogger.ts # Structured incoming request logger
│   └── validate.ts   # Unified Zod request schema validator
├── modules/          # Domain slices
│   └── auth/         # Complete authentication package (controllers, services, repositories)
├── plugins/          # Auto-registered server plugins
│   └── auditLogs.ts  # Standard security audit logger
├── routes/           # Global express router hub
│   └── index.ts      # Core API router and health checks
├── services/         # Third-party integration clients
│   └── email.service.ts # NodeMailer SMTP transaction client
└── utils/            # Shared primitives
    ├── errors.ts     # Custom operational ApiError definitions
    ├── logger.ts     # Winston structured logging utility
    └── response.ts   # Uniform API response layout format
```

---

## Architecture overview & flows

### 1. User signup sequence
1. Inbound registration details are parsed and checked against schema.
2. User profile and related entities are saved inside an atomic database transaction.
3. Verification tokens are dispatched out-of-band to Nodemailer, and a non-blocking `signup` event is broadcasted.

### 2. Authentication & caching
On successful password verification, a new session is persisted in the database and cached in Redis with an identical TTL matching the refresh token lifespan.

```text
[Client] ---> POST /auth/login ---> [Database Session created]
                                      |
                                      +--> [Redis Cached state: true (TTL 7d)]
                                      |
[Client] <--- Set-Cookie (Refresh) + JSON (Access)
```

### 3. Request guard lifecycle
Inbound requests carrying `Bearer <AccessToken>` are authorized inside a fast caching cycle:

```text
[Client Request]
       |
       v
[Validate Token Signature]
       |
       v
[Cache Active? Check Redis key: session:<id>]
       |
       +---> YES (Hit) ---> Session Valid? ---> Next() / Authorized
       |
       +---> NO (Miss / Off) ---> Query Postgres DB ---> Cache status ---> Next()
```

### 4. Refresh Token Rotation (RTR) & Grace Window
To prevent parallel tab reloads from flagging an account as compromised (due to multiple simultaneous token rotations), the engine operates a 15-second grace window:
* The rotated refresh token is cached temporarily in Redis with its new counterparts.
* Immediate subsequent requests within 15 seconds will receive the same new token pair instead of a replay error.
* Outside the 15-second window, reuse of that old token is marked as a theft event, triggering database-level revocation of all sessions in the token family.

---

## Local environment setup

### Prerequisites
* Node.js v20+
* Docker & Docker Compose (for local databases)

### 1. Set environment variables
Copy the template file to configure local credentials:
```bash
cp .env.example .env
```

### 2. Spawn infrastructure services
Start the local PostgreSQL and Redis database instances in the background:
```bash
docker-compose up -d postgres_db redis_cache
```

### 3. Initialize database
Install npm packages, compile the Prisma client, and execute migrations:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Launch development server
Run the Express application with nodemon hot-reloading:
```bash
npm run dev
```
The server will bind locally and listen at **`http://localhost:5000/api/v1`**.

---

## Environment variables reference

| Variable | Description | Recommended Default |
| :--- | :--- | :--- |
| `PORT` | Local application port | `5000` |
| `NODE_ENV` | Running node environment | `development` |
| `API_VERSION` | Endpoint mount version prefix | `v1` |
| `DATABASE_URL` | PostgreSQL connection pool URL | `postgresql://postgres:postgres@localhost:5432/api_auth?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | 256-bit secret key for access tokens | High-entropy string |
| `JWT_ACCESS_EXPIRY` | Access token lifespan | `15m` |
| `JWT_REFRESH_SECRET` | 256-bit secret key for refresh tokens | High-entropy string |
| `JWT_REFRESH_EXPIRY` | Refresh token lifespan | `7d` |
| `SMTP_HOST` | Outbound mail gateway host | E.g., `smtp.mailtrap.io` |
| `SMTP_PORT` | Outbound mail gateway port | `2525` |
| `SMTP_USER` | Gateway account username | E.g., mailtrap username |
| `SMTP_PASS` | Gateway account password | E.g., mailtrap password |
| `SMTP_FROM` | Dispatch envelope header sender | `"SaaS Platform" <noreply@saas.com>` |
| `CORS_ORIGIN` | Allowed clients origin filter | `http://localhost:3000` |
| `COOKIES_SECURE` | Secure SSL cookie flag | `false` (dev) / `true` (prod) |
| `ENABLE_LOGGER` | Output standard stdout loggers | `true` |
| `ENABLE_TRACING` | Run correlation request tracing | `true` |
| `ENABLE_CACHE` | Enable Redis cache logic | `true` |
| `ENABLE_AUDIT_LOGS` | Load security audit logging plugin | `true` |

---

## Core API endpoints sandbox

You can run full API client tests using the preconfigured [api.http](./api.http) file via REST client extensions.

### 1. User registration
`POST /api/v1/auth/register`

**Request:**
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Response (201 Created):**
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
      "updatedAt": "2026-05-19T03:30:00.000Z"
    }
  },
  "timestamp": "2026-05-19T03:30:00.123Z"
}
```

### 2. User login
`POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "developer@saas.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
*(Sets HTTP-Only cookie `refreshToken`)*
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
      "isEmailVerified": false,
      "createdAt": "2026-05-19T03:30:00.000Z",
      "updatedAt": "2026-05-19T03:30:00.000Z"
    }
  },
  "timestamp": "2026-05-19T03:31:00.456Z"
}
```

---

## Docker integration

### Local development helper
Spawns preconfigured PostgreSQL and Redis instances using environment configuration variables:
```bash
docker-compose up -d postgres_db redis_cache
```

### Full stack containerization
Runs the Express application server, PostgreSQL database, and Redis cache in complete isolation:
```bash
docker-compose up --build -d
```
The Express service uses a **multi-stage compilation Dockerfile**. This builders phase compiles TypeScript and outputs a highly optimized production runtime environment of only **~50MB** containing only the compiled JS and clean production node dependencies.

---

## Security guidelines

* **Cookie configuration**: In production, ensure `COOKIES_SECURE` is `true`. The refresh token is set with `httpOnly: true`, `sameSite: 'strict'`, and `secure: true` to defend against XSS and CSRF token thefts.
* **Token Rotation (RTR)**: Keep access token expiries short (`10m`-`15m`). Token family validation guarantees that if an attacker intercepts a refresh token, any subsequent attempts by either the legitimate user or the attacker using an older token invalidates all sessions.
* **Mitigate enumeration attacks**: Standardize API auth responses. The forgot-password endpoint returns an identical success message whether the requested email exists or not, mitigating user scraping campaigns.

---

## MIT License

Distributed under the **MIT License**. Feel free to fork, modify, and integrate this auth engine in your personal projects or commercial software.

Copyright (c) 2026 Auth Engine Contributors