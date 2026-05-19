# System Architecture & Core Design Patterns

This guide documents the design decisions, component patterns, and security mechanisms that govern this identity codebase.

---

## 🏛️ Clean Architecture & The CSR Pattern

The repository strictly enforces a decoupled **Controller-Service-Repository (CSR)** layer pattern to split concerns across transportation, business logic, and database entities:

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
       │   Prisma v7 Client  │
       └─────────────────────┘
```

### 1. Controllers (Transport Layer)
* **Role**: Parses standard network payloads, reads incoming cookies, writes HTTP headers, and handles HTTP response envelopes.
* **Rules**: Controllers are transport-aware but domain-ignorant. They must never communicate with database clients directly or execute business rules (like password hashing). They delegate entirely to Services.
* **Refactor Note**: We have removed dynamic `asyncHandler` decorators. Since we use Express 5, all uncaught asynchronous rejections in controllers are natively caught and forwarded to the central error middleware.

### 2. Services (Business Layer)
* **Role**: Houses all operational business rules (e.g. manages token sign cycles, validates credentials, schedules transactional emails, and manipulates session rotation states).
* **Rules**: Services are completely decoupled from the transport framework. They must never read from Express `Request` or write to `Response` arguments. This guarantees they are 100% testable in headless contexts.

### 3. Repositories (Data Layer)
* **Role**: Isolates SQL querying, handles database transactions, and manages Prisma connections.
* **Rules**: Repositories are the only files permitted to interact directly with the `prisma` client.

---

## 🔒 Advanced Token Rotation Security (RTR)

Traditional stateless JWT access tokens are hard to invalidate before their expiration. This engine implements **Refresh Token Rotation (RTR)** with stateful caches to guarantee fine-grained security control.

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
Every Bearer JWT Access Token carries a `sessionId`. The authentication middleware (`authenticate`) intercepts requests, verifies the cryptographic signature of the token, and cross-checks the active session state:
1. **Cache Read**: Checks the Redis key `session:<id>`.
2. **Database Fallback**: If there is a cache miss, it queries PostgreSQL and immediately updates Redis to avoid future lookups.
3. **Revocation Execution**: If the session has been flagged as invalid (`isValid = false`), the request is rejected with a `401 Unauthorized` response immediately.

### Replay Attack Prevention
If a client refreshes their credentials, the server invalidates the old refresh token and issues a new pair. If an attacker gains access to a previously used refresh token and attempts to rotate it, the repository flags a replay violation:
* The system invalidates the entire token family (setting `isValid = false` on all related user sessions).
* The user is immediately logged out across all active devices to prevent unauthorized access.

---

## 🧩 Event-Driven Plugin Pipeline

To maintain a clean, reusable core while allowing features like security ledgers, team spaces, or telemetry to be loaded cleanly, the backend introduces a zero-dependency **Plugin Boot Registry**:

```
        ┌─────────────────────────────────────────────────────────┐
        │                 Core Auth Lifecycle                     │
        └──────────────────────────┬──────────────────────────────┘
                                   │
                                   │ (emits events asynchronously)
                                   ▼
        ┌─────────────────────────────────────────────────────────┐
        │             App Events (authEvents emitter)             │
        └────┬─────────────────────┬─────────────────────────┬────┘
             │                     │                         │
             ▼ (signup)            ▼ (login)                 ▼ (passwordReset)
     ┌───────────────┐     ┌───────────────┐         ┌───────────────┐
     │ Billing/Teams │     │ Audit Ledger  │         │ Notifications │
     │   Extension   │     │   Extension   │         │   Extension   │
     └───────────────┘     └───────────────┘         └───────────────┘
```

1. **Async Event Emitter (`src/lib/events.ts`)**: Broadcaster built on `SafeEventEmitter`. Handlers are executed on the next event loop tick (`process.nextTick`) and caught safely, ensuring listener exceptions never interrupt the main HTTP response pipeline.
2. **Registry Mounts (`src/lib/plugins.ts`)**: Custom extensions are gathered at server boot and initialized directly inside Express. This keeps core routing completely decoupled from modular feature plugins.

---

## 🔌 Graceful Shutdown

To run reliably inside orchestrated containers (e.g. Docker Compose, Kubernetes):
1. The server binds listeners to system signals (`SIGTERM` and `SIGINT`).
2. It stops accepting new HTTP requests immediately.
3. It closes open database connections inside the Prisma client and disconnects Redis socket bindings.
4. Active connection pools are allowed to drain before the main process exits cleanly.
