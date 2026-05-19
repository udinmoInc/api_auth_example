import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '@/middleware/validate';
import { authenticate } from '@/middleware/auth';
import { deviceExtractor } from '@/middleware/device';
import { authRateLimiter } from '@/middleware/rateLimiter';
import {
  signUpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validator';

const router = Router();
const controller = new AuthController();

/**
 * Public Authentication Routes
 * Protected by dedicated rate-limiters and schema validators
 */

// Register a new user
router.post(
  '/register',
  authRateLimiter,
  validate({ body: signUpSchema }),
  controller.register
);

// Sign in with credentials
router.post(
  '/login',
  authRateLimiter,
  deviceExtractor,
  validate({ body: loginSchema }),
  controller.login
);

// Rotate Access & Refresh Tokens (Silent Renew)
router.post(
  '/refresh',
  deviceExtractor,
  controller.refresh
);

// Terminate current session
router.post(
  '/logout',
  controller.logout
);

// Email address verification
router.get(
  '/verify-email',
  controller.verifyEmail
);

// Trigger password reset email link
router.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
);

// Perform password update using reset token
router.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword
);

/**
 * Private Session Management Routes
 * Protected by authentication guard
 */

// Fetch all active device sessions
router.get(
  '/sessions',
  authenticate,
  controller.getSessions
);

// Terminate a specific device session
router.delete(
  '/sessions/:sessionId',
  authenticate,
  controller.revokeSession
);

export default router;
