# Reusable SaaS Auth Starter

A production-ready, configurable authentication template built with **Express.js**, **TypeScript**, **Prisma ORM**, **PostgreSQL**, and **Redis**. 

Rather than wrapping auth inside hardcoded e-commerce or blogging business structures, this repository is designed as a standalone, modular auth starter. It handles modern user registration, secure session tracing, token rotation, and dynamic event hooks so you can drop it directly into any client, SaaS, or multi-tenant system.

---

## 🛠️ The Tech Stack

* **Runtime & Language**: Node.js (Express), TypeScript
* **Database & Caching**: PostgreSQL, Redis (connection timeout, exponential backoffs)
* **ORM**: Prisma v7 (Native PG driver connection pooling)
* **Validation & Security**: Zod, Winston (structured logger), Helmet, CORS, custom rate limiters
* **Authentication**: Double-layer stateful JWTs (stateless signature validation, database session checks), Secure HTTP-Only cookie storage, Refresh Token Rotation (RTR) with a 15-second grace period

---

## 🔌 Decoupled Hook & Extension Registry

Instead of coupling core business logic (Stripe subscriptions, user workspaces, automated onboarding, Discord webhooks) directly inside authentication routing pathways, the template exposes two lightweight, zero-dependency modules:

1. **Lifecycle Event Hooks (`src/lib/events.ts`)**: A custom `SafeEventEmitter` that fires non-blocking lifecycle hooks (`signup`, `login`, `logout`, `passwordReset`, `sessionRevoked`). Listeners execute safely inside `process.nextTick` to ensure a buggy extension never holds up critical HTTP client responses.
2. **Dynamic Extension Registry (`src/lib/plugins.ts`)**: An Express boot registry allowing developers to add plugins that dynamically hook routes, middlewares, or third-party integrations into the main pipeline at runtime.

---

## ⚙️ Config-Driven Architecture Toggles

Every advanced system is fully configurable and optional. Developers can run a lightweight dev environment without Docker or Redis dependencies, then flip toggles in staging/production.

| Config Variable | Type | Description |
| :--- | :--- | :--- |
| `ENABLE_LOGGER` | Boolean | Toggles Winston system console printing. |
| `ENABLE_TRACING` | Boolean | Wraps request threads in `AsyncLocalStorage` to append correlation IDs to logs. |
| `ENABLE_CACHE` | Boolean | Integrates Redis token blacklist caches. When disabled, auth flows fall back cleanly to PG database checks. |
| `ENABLE_AUDIT_LOGS`| Boolean | Dynamically registers security audit listener callbacks during Express boot. |

---

## 📁 Repository Structure

```text
src/
├── config/           # Safe environmental parsing and validation (Zod)
├── constants/        # Centralized JWT lifespans and auth rates
├── lib/              # Client SDK connectors (Prisma, Redis socket handlers)
│   ├── context.ts    # AsyncLocalStorage telemetry context store
│   ├── events.ts     # SafeEventEmitter async event hooks
│   └── plugins.ts    # Express application plugin registrar
├── middleware/       # Global filters (Auth guards, tracing contexts, rate limiters)
├── modules/          # Domain slices
│   └── auth/         # Complete CSR (Controller-Service-Repository) authentication slice
├── plugins/          # Dynamically loaded SaaS extension plug-ins
├── routes/           # Main routing entrypoint (/api/v1)
├── services/         # Mailer and global helper wrappers
└── utils/            # Shared primitives (Custom errors, Winston logger, responses)
```

---

## 🚀 Quick Start Guide

### 1. Configure the Environment
Copy the environment template and customize database, Redis, and SMTP parameters:
```bash
cp .env.example .env
```

### 2. Boot Local Infrastructure
Deploy preconfigured PostgreSQL and Redis servers locally via Docker Compose:
```bash
docker-compose up -d postgres_db redis_cache
```

### 3. Initialize Prisma & Dependencies
Install workspace modules, sync migrations, and generate the Prisma Client v7 driver:
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Launch the Dev Server
Run the hot-reloading development server:
```bash
npm run dev
```
The server will start listening at **`http://localhost:5000/api/v1`**.

---

## 📡 Endpoints Sandbox

A REST client config is available at [api.http](./api.http) for direct VS Code sandbox testing.

### Auth Methods Checklist

* `POST /auth/register` - Create user profile and send email verification.
* `POST /auth/login` - Authenticate, set secure HTTP-only refresh cookie, and return access token.
* `POST /auth/refresh` - Rotate refresh token and update session. Uses a 15-second grace period to allow concurrent tab refreshes.
* `POST /auth/logout` - Invalidate active session and blacklist current refresh token.
* `GET /auth/verify-email` - Confirm email validation.
* `POST /auth/forgot-password` - Request a secure reset token mailer.
* `POST /auth/reset-password` - Update password and invalidate all other active sessions globally.
* `GET /auth/sessions` - Fetch list of active logged-in device profiles.
* `DELETE /auth/sessions/:sessionId` - Remotely revoke a specific device session.
* `GET /health` - System health check.

---

## 📄 License

This repository is available under the **MIT License**. Feel free to fork, customize, and drop it into any commercial client or personal product.

Copyright (c) 2026 APIOrbit