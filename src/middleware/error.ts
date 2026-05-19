import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import config from '@/config';
import logger from '@/utils/logger';
import { ApiError } from '@/utils/errors';
import ApiResponse from '@/utils/response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // Prefix with underscore to satisfy noUnusedParameters, but keep for Express error middleware signature match
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any[] = [];

  // Log error
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Handle custom ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  }
  // Handle Zod Validation Error
  else if (err instanceof z.ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.issues.map((e: z.ZodIssue) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }
  // Handle Prisma Database Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const target = (err.meta?.target as string[]) || [];
        message = `Conflict: Field '${target.join(', ')}' already exists.`;
        break;
      }
      case 'P2025': {
        statusCode = 404;
        message = (err.meta?.cause as string) || 'Record not found.';
        break;
      }
      default: {
        statusCode = 400;
        message = `Database Error: ${err.message}`;
        break;
      }
    }
  }

  // Hide stack trace in production for safety
  const responseData: any = {};
  if (config.env === 'development') {
    responseData.stack = err.stack;
  }

  ApiResponse.error(
    res,
    statusCode,
    message,
    errors.length > 0 ? errors : (Object.keys(responseData).length > 0 ? [responseData] : undefined)
  );
};

export default errorHandler;
