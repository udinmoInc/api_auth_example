# Developer Setup & Deployment Guide

This guide walks you through the developer environment configuration, database seeding, migration pathways, and containerized deployments using Docker.

---

## 📋 Environment Configuration Checklist

Create a `.env` file at the root of the project. Here is an index of all required variables:

| Variable | Description | Recommended Value (Dev) |
| :--- | :--- | :--- |
| `PORT` | Local server port | `5000` |
| `NODE_ENV` | Run context | `development` or `production` |
| `API_VERSION` | Endpoint mount | `v1` |
| `DATABASE_URL` | PostgreSQL connection pool | `postgresql://postgres:postgres@localhost:5432/api_auth?schema=public` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | 32-byte secret key | Secure hex signature |
| `JWT_ACCESS_EXPIRY` | Access token TTL | `15m` (15 minutes) |
| `JWT_REFRESH_SECRET` | 32-byte secret key | Secure hex signature |
| `JWT_REFRESH_EXPIRY`| Refresh token TTL | `7d` (7 days) |
| `SMTP_HOST` | Email SMTP host | E.g. `smtp.mailtrap.io` |
| `SMTP_PORT` | Email SMTP port | `2525` or `465` (secure) |
| `SMTP_USER` | Email SMTP username | Username credential |
| `SMTP_PASS` | Email SMTP password | Password credential |
| `SMTP_FROM` | Sender footprint envelope | `"SaaS Platform" <noreply@saas.com>` |
| `CORS_ORIGIN` | Allowed web origin | `http://localhost:3000` |
| `COOKIES_SECURE` | HTTP-Only secure cookies | `false` (Dev) / `true` (Prod) |

> 💻 **Pro-Tip (Security keys)**: Generate highly secure hex secrets using Node's cryptographic module:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 🛠️ Step-by-Step Local Deployment

### 1. Provision Services via Docker Compose
To avoid installing Postgres and Redis locally, run the orchestrated docker-compose stacks:
```bash
# Deploys only PostgreSQL database and Redis caching engines
docker-compose up -d postgres_db redis_cache
```

### 2. Prepare Database Schema and Client
In Prisma v7, you compile the schema and create database tables via:
```bash
# Generate Prisma runtime client classes
npm run prisma:generate

# Execute structural migrations to setup tables and constraints
npm run prisma:migrate
```

### 3. Launch Development Server
Starts the application engine using Nodemon for automated hot-reloads:
```bash
npm run dev
```

---

## 🐳 Containerized Production Build (Docker)

To run the complete application inside isolated containers (app server, db pool, redis cache):

```bash
# Build production images and start all services in detached mode
docker-compose up --build -d
```

The multi-stage `Dockerfile` is optimized to:
1. Compile TypeScript to raw JavaScript inside a build container.
2. Throw away compile-time dependencies, compiler binaries, and TypeScript tools.
3. Export only compiled build bundles (`/dist`) and required dependencies, resulting in a minimal and highly secure **50MB runtime image**.
