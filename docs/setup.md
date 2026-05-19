# Developer Setup & Deployment Guide

This guide walks you through local environment configuration, service provisioning, database migrations, and containerized production builds.

---

## 📋 Environment Configuration Checklist

Configure a `.env` file at the root of the project. The schema is strictly verified at startup by Zod (`src/config/env.ts`):

| Variable | Description | Recommended (Local Dev) |
| :--- | :--- | :--- |
| `PORT` | Local server port | `5000` |
| `NODE_ENV` | Running runtime context | `development` |
| `API_VERSION` | Endpoint mount version prefix | `v1` |
| `DATABASE_URL` | PostgreSQL connection pool URL | `postgresql://postgres:postgres@localhost:5432/api_auth?schema=public` |
| `REDIS_URL` | Redis cache connection string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | 256-bit access token secret key | 32+ char hex signature |
| `JWT_ACCESS_EXPIRY` | Access token duration | `15m` |
| `JWT_REFRESH_SECRET` | 256-bit refresh token secret key | 32+ char hex signature |
| `JWT_REFRESH_EXPIRY` | Refresh token duration | `7d` |
| `SMTP_HOST` | Outbound SMTP server | E.g., `smtp.mailtrap.io` |
| `SMTP_PORT` | Outbound SMTP port | `2525` or `465` (secure TLS) |
| `SMTP_USER` | SMTP username | Gateway credential |
| `SMTP_PASS` | SMTP password | Gateway credential |
| `SMTP_FROM` | Dispatch sender envelope footprint | `"SaaS Platform" <noreply@saas.com>` |
| `CORS_ORIGIN` | Allowed client origin filter | `http://localhost:3000` |
| `COOKIES_SECURE` | Secure SSL cookie flag | `false` (Dev) / `true` (Prod) |
| `ENABLE_LOGGER` | Output structured winston logs | `true` |
| `ENABLE_TRACING` | Correlation request tracing | `true` |
| `ENABLE_CACHE` | Enable Redis cache logic | `true` |
| `ENABLE_AUDIT_LOGS` | Load security audit logging plugin | `true` |

> **Security Note**: Generate high-entropy hex secrets using Node's native crypto module:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 🛠️ Step-by-Step Local Deployment

### 1. Provision Infrastructure via Docker
Avoid installing databases locally. Boot local PostgreSQL and Redis servers inside orchestrated containers:
```bash
docker-compose up -d postgres_db redis_cache
```

### 2. Generate Prisma Client & Migrate Schema
Prisma compiles client classes and executes structural schema migrations safely on Postgres:
```bash
# Compile types and dependencies
npm run prisma:generate

# Execute structural migrations to create tables
npm run prisma:migrate
```

### 3. Start Development Server
Starts the compiled Express server using Nodemon to track file changes and trigger hot-reloads:
```bash
npm run dev
```
The application will boot and begin listening at **`http://localhost:5000/api/v1`**.

---

## 🐳 Containerized Production Build (Docker)

To run the complete application inside a secured production Docker environment:

```bash
docker-compose up --build -d
```

### Multistage Compilation Optimization
The application uses a optimized multi-stage `Dockerfile`:
1. **Builder Stage**: Installs development dependencies, copies files, and compiles TypeScript into raw JavaScript bundles inside `/dist`.
2. **Runner Stage**: Discards compiler tools, TypeScript utilities, and source files. Installs only production dependencies and copies compiled JavaScript bundles.
3. **Outcome**: The resulting image is lightweight (approx. **50MB**) and secure, containing no shell tools or development bloat.
