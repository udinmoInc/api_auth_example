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

router.post(
  '/register',
  authRateLimiter,
  validate({ body: signUpSchema }),
  controller.register
);

router.post(
  '/login',
  authRateLimiter,
  deviceExtractor,
  validate({ body: loginSchema }),
  controller.login
);

router.post(
  '/refresh',
  deviceExtractor,
  controller.refresh
);

router.post(
  '/logout',
  controller.logout
);

router.get(
  '/verify-email',
  controller.verifyEmail
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword
);

router.get(
  '/sessions',
  authenticate,
  controller.getSessions
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  controller.revokeSession
);

export default router;
