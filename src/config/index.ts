import env from './env';

const parseExpiryToMs = (expiry: string): number => {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
};

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  apiVersion: env.API_VERSION,
  frontendUrl: env.FRONTEND_URL,
  db: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    upstashUrl: env.UPSTASH_REDIS_REST_URL,
    upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
    refreshExpiryMs: parseExpiryToMs(env.JWT_REFRESH_EXPIRY),
  },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },
  security: {
    corsOrigin: env.CORS_ORIGIN,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    cookiesSecure: env.COOKIES_SECURE,
  },
  logging: {
    enableLogger: env.ENABLE_LOGGER,
    enableTracing: env.ENABLE_TRACING,
  },
  features: {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS,
    enableTracing: env.ENABLE_TRACING,
    enableCache: env.ENABLE_CACHE,
  },
};

export type Config = typeof config;
export default config;
