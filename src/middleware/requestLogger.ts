import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { contextStore } from '@/lib/context';
import config from '@/config';
import logger from '@/utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  const onFinish = () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms | IP: ${ip}`;

    if (statusCode >= 500) {
      logger.error(logMessage);
    } else if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
  };

  // Perform context wrapping and Correlation ID assignment only if telemetry tracing is active
  if (config.logging.enableTracing) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    res.setHeader('X-Request-Id', requestId);

    contextStore.run({ requestId }, () => {
      res.on('finish', onFinish);
      next();
    });
  } else {
    res.on('finish', onFinish);
    next();
  }
};

export default requestLogger;
