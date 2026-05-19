export const APP_DEFAULTS = {
  PORT: 5000,
  DEFAULT_ENV: 'development',
  GRACE_PERIOD_MS: 15000,
} as const;

export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

export const COOKIE_NAMES = {
  REFRESH_TOKEN: 'refreshToken',
} as const;

export const TOKEN_EXPIRY = {
  ACCESS_MS: 15 * 60 * 1000,
  REFRESH_MS: 7 * 24 * 60 * 60 * 1000,
  EMAIL_VERIFY_MS: 24 * 60 * 60 * 1000,
  PASSWORD_RESET_MS: 60 * 60 * 1000,
} as const;

export const API_HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'X-Request-Id',
  AUTHORIZATION: 'Authorization',
  BEARER_PREFIX: 'Bearer ',
} as const;

export const REDIS_KEYS = {
  SESSION_PREFIX: 'session:',
  BLACKLIST_PREFIX: 'blacklist:',
  RATE_LIMIT_PREFIX: 'ratelimit:',
} as const;

export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication failed. Please provide a valid Bearer token.',
  EXPIRED: 'Access token has expired. Please refresh your session.',
  INVALID_SIGNATURE: 'Authentication failed. Token signature is invalid.',
  SESSION_REVOKED: 'Your session has been terminated. Please log in again.',
  FORBIDDEN: 'Forbidden. You do not have the required permissions to access this resource.',
  NOT_FOUND: 'Resource not found.',
} as const;

export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROUTES = {
  AUTH: '/auth',
  HEALTH: '/health',
  PLUGINS: '/plugins',
} as const;
