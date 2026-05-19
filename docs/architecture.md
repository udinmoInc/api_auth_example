# System Architecture & Design Patterns

This document details the architectural guidelines, layout workflows, and technical design patterns implemented inside this authentication backend.

---

## 🏛️ Clean Architecture & CSR Pattern

The project enforces the **Controller-Service-Repository (CSR)** architecture to ensure clear boundaries between transportation protocols, business decisions, and database layers.

```
                      ┌───────────────────────┐
                      │    Express Router     │  (auth.routes.ts)
                      └──────────┬────────────┘
                                 │
                                 ▼
                      ┌───────────────────────┐
                      │    Controller Layer   │  (auth.controller.ts)
                      └──────────┬────────────┘
                                 │
                                 ▼
                      ┌───────────────────────┐
                      │     Service Layer     │  (auth.service.ts)
                      └─────┬───────────┬─────┘
                            │           │
                 ┌──────────┘           └──────────┐
                 ▼                                 ▼
      ┌─────────────────────┐           ┌─────────────────────┐
      │  Repository Layer   │           │    Email Service    │
      │ (auth.repository.ts)│           │ (email.service.ts)  │
      └──────────┬──────────┘           └─────────────────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │   Prisma v7 ORM     │
      └─────────────────────┘
```

### 1. Transportation & Controllers
* **Role**: Parses standard network payloads, parses incoming cookies, handles CORS and HTTP header mutations, and returns unified JSON responses.
* **Rule**: Controllers **must not** implement core business decisions (e.g. hashing passwords or managing token signatures) or interact with database query clients directly. They delegate all tasks to dedicated services.

### 2. Business Services
* **Role**: Orchestrates core business rules (e.g. validates user credentials, handles cryptographic structures, schedules transactional emails, and signs JWT tokens).
* **Rule**: Services must remain completely agnostic of HTTP transportation. They do not read Express `req` or write `res` parameters directly, making them 100% testable in headless contexts.

### 3. Data Repositories
* **Role**: Isolates database queries. Creates transactions, handles constraints, and manages table joins.
* **Rule**: Repositories are the **only** domain layer permitted to call `prisma` client functions.

---

## 🔒 Advanced Token Rotation Security (RTR)

Traditional stateless JWT access tokens cannot be revoked until their expiration time is reached, opening a security vulnerability. This system resolves this using **Token Rotation with Replay Attack Detection**:

```text
               [Login Request]
                      │
                      ▼
        Generate Token Family (UUID)
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   Access Token (15m)       Refresh Token (7d)
   (Stateless JWT)          (HTTP-Only Cookie)
                                   │
                                   ▼
                      [Refresh Rotation Attempt]
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        Is Token Valid?                      Is Token Replayed?
     (Matches session DB)                (Family matches but revoked)
                 │                                   │
       ┌─────────┴─────────┐                         ▼
       ▼                   ▼               [Replay Attack Detected]
     [YES]                [NO]                       │
       │                   │                         ▼
  Blacklist Old       Block Access           Invalidate Entire
  in Redis & Issue                           Family Session Tree.
  New Token Pair                             Force Global Logout.
```

### Stateful Session Check
Every incoming Bearer JWT Access Token carries a `sessionId` property. The authentication guard (`authenticate`) intercepts requests, verifies the token's cryptographic integrity, and cross-checks the `Session` table in PostgreSQL. If the session has been marked `isValid = false` (due to password reset or remote logout), the request is rejected immediately.

---

## 🔌 Graceful Server Shutdown

To guarantee uninterrupted service in containerized environments (Kubernetes, AWS ECS, Docker):
1. The Express server catches system termination signals (`SIGTERM` and `SIGINT`).
2. It stops accepting new HTTP connections immediately.
3. It closes all ongoing database transactions and pools inside `PrismaClient` and disconnects Redis connection sockets safely.
4. Once active connections drain, the process exits cleanly.
