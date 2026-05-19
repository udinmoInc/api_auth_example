import { Router } from 'express';
import config from '@/config';
import authRouter from '@/modules/auth/auth.routes';

const router = Router();

// Mount modules
router.use('/auth', authRouter);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.env,
  });
});

export default router;
