export const TOKEN_EXPIRY = {
  ACCESS_MS: 15 * 60 * 1000,      // 15 minutes
  REFRESH_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  EMAIL_VERIFY_MS: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET_MS: 60 * 60 * 1000, // 1 hour
};

export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const COOKIE_NAMES = {
  REFRESH_TOKEN: 'refreshToken',
} as const;
