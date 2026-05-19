import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from '@/config';
import { logger } from '@/utils/logger';
import { apiRateLimiter } from '@/middleware/rateLimiter';
import requestLogger from '@/middleware/requestLogger';
import errorHandler from '@/middleware/error';
import routes from '@/routes';
import { ApiError } from '@/utils/errors';
import prisma from '@/lib/prisma';
import redisClient from '@/lib/redis';

const app = express();

// Global request pre-processing and security filters
app.use(helmet());
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(apiRateLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Route registrations
app.use(`/api/${config.apiVersion}`, routes);

// Catch 404 routes
app.use((req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`));
});

// Centralized error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`🚀 SaaS Auth Backend running in [${config.env}] mode`);
  logger.info(`🔌 Server listening on port: ${config.port}`);
  logger.info(`🔑 API Root: http://localhost:${config.port}/api/${config.apiVersion}`);
});

// Graceful termination handler
const gracefulShutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
  });

  try {
    await prisma.$disconnect();
    logger.info('Database client disconnected.');

    await redisClient.quit();
    logger.info('Redis client disconnected.');

    logger.info('Graceful shutdown completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app };
export default app;
