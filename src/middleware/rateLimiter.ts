import rateLimit from 'express-rate-limit';
import config from '@/config';
import ApiResponse from '@/utils/response';

// Standard rate limiter for all standard API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req, res) => {
    ApiResponse.error(res, 429, 'Too many requests from this IP. Please try again later.');
  },
});

// Strict rate limiter for high-value targets (login, register, forgot-password, reset-password)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    ApiResponse.error(
      res,
      429,
      'Too many authentication attempts from this IP. Please try again after 15 minutes.'
    );
  },
});
