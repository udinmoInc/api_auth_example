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
import { SHUTDOWN_SIGNALS } from '@/constants';
import prisma from '@/lib/prisma';
import redisClient from '@/lib/redis';
import pluginRegistry from '@/lib/plugins';

// Self-registering plugins
import '@/plugins/auditLogs';

import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';

const app = express();

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

app.use(`/api/${config.apiVersion}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(`/api/${config.apiVersion}`, routes);

app.use((req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`));
});

app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    // Attempt Redis connection
    if (config.features.enableCache) {
      try {
        await redisClient.connect();
      } catch (err) {
        logger.error('⚠️ Redis connection failed at startup. Running with cache disabled.', err);
        config.features.enableCache = false;
      }
    }

    // Connect database
    await prisma.$connect();
    logger.info('🐘 Database connected successfully.');

    // Initialize boot extensions
    await pluginRegistry.initializeAll(app);

    // Start HTTP listener
    const server = app.listen(config.port, () => {
      logger.info(`🚀 SaaS Auth Backend running in [${config.env}] mode`);
      logger.info(`🔌 Server listening on port: ${config.port}`);
      logger.info(`🔑 API Root: http://localhost:${config.port}/api/${config.apiVersion}`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.warn(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed.');
      });

      try {
        await prisma.$disconnect();
        logger.info('Database client disconnected.');

        if (redisClient.isOpen) {
          await redisClient.quit();
          logger.info('Redis client disconnected.');
        }

        logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    SHUTDOWN_SIGNALS.forEach((signal) => {
      process.on(signal, () => gracefulShutdown(signal));
    });
  } catch (error) {
    logger.error('❌ Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();

export { app };
export default app;
