import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import config from '@/config';
import { REDIS_KEYS } from '@/constants';
import { UnauthorizedError, ForbiddenError } from '@/utils/errors';
import prisma from '@/lib/prisma';
import redisClient from '@/lib/redis';
import { TokenPayload } from '@/modules/auth/auth.types';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication failed. Please provide a valid Bearer token.');
    }

    const token = authHeader.split(' ')[1];

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired. Please refresh your session.');
      }
      throw new UnauthorizedError('Authentication failed. Token signature is invalid.');
    }

    let isSessionValid = false;

    if (config.features.enableCache && redisClient.isOpen) {
      const cached = await redisClient.get(`${REDIS_KEYS.SESSION_PREFIX}${decoded.sessionId}`).catch(() => null);
      
      if (cached !== null) {
        isSessionValid = cached === 'true';
      } else {
        const session = await prisma.session.findUnique({
          where: { id: decoded.sessionId },
        });
        isSessionValid = !!(session && session.isValid);

        if (session) {
          const remainingTtl = session.expiresAt.getTime() - Date.now();
          if (remainingTtl > 0) {
            await redisClient
              .set(`${REDIS_KEYS.SESSION_PREFIX}${session.id}`, String(session.isValid), {
                PX: remainingTtl,
              })
              .catch(() => null);
          }
        }
      }
    } else {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
      });
      isSessionValid = !!(session && session.isValid);
    }

    if (!isSessionValid) {
      throw new UnauthorizedError('Your session has been terminated. Please log in again.');
    }

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('User is not authenticated.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError('Forbidden. You do not have the required permissions to access this resource.')
      );
    }

    next();
  };
};

export default { authenticate, authorize };
