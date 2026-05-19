import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import config from '@/config';
import { ApiError } from '@/utils/errors';
import prisma from '@/lib/prisma';
import { TokenPayload } from '@/modules/auth/auth.types';
import asyncHandler from '@/utils/asyncHandler';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication failed. Please provide a valid Bearer token.');
  }

  const token = authHeader.split(' ')[1];

  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Access token has expired. Please refresh your session.');
    }
    throw new ApiError(401, 'Authentication failed. Token signature is invalid.');
  }

  // Cross-check session validity in DB
  const session = await prisma.session.findUnique({
    where: { id: decoded.sessionId },
  });

  if (!session || !session.isValid) {
    throw new ApiError(401, 'Your session has been terminated. Please log in again.');
  }

  req.user = decoded;
  next();
});

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'User is not authenticated.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'Forbidden. You do not have the required permissions to access this resource.')
      );
    }

    next();
  };
};

export default { authenticate, authorize };
