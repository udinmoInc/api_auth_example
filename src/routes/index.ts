import { Router } from 'express';
import config from '@/config';
import authRouter from '@/modules/auth/auth.routes';
import { ROUTES } from '@/constants';

const router = Router();

// Mount modules
router.use(ROUTES.AUTH, authRouter);

// Health check endpoint
router.get(ROUTES.HEALTH, (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.env,
  });
});

export default router;
