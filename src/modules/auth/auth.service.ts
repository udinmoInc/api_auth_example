import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '@/config';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '@/utils/errors';
import { redisClient } from '@/lib/redis';
import prisma from '@/lib/prisma';
import { AuthRepository } from './auth.repository';
import { REDIS_KEYS, TOKEN_EXPIRY } from '@/constants';
import { SignUpInput, LoginInput, ResetPasswordInput } from './auth.validator';
import { TokenPayload, RefreshTokenPayload, DeviceMetadata, SessionInfo } from './auth.types';
import EmailService from '@/services/email.service';
import logger from '@/utils/logger';
import { authEvents } from '@/lib/events';

export class AuthService {
  private repository = new AuthRepository();

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateTokens(payload: TokenPayload, tokenFamily: string): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry as any,
    });

    const refreshPayload: RefreshTokenPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      tokenFamily,
    };

    const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry as any,
    });

    return { accessToken, refreshToken };
  }

  public async register(input: SignUpInput) {
    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists.');
    }

    const passwordHash = await this.hashPassword(input.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFY_MS);

    const user = await this.repository.createUser(input, passwordHash, verificationToken, expiresAt);

    // Send verification email out-of-band
    EmailService.sendVerificationEmail(user.email, verificationToken).catch((err) => {
      logger.error('Background verification email failed:', err);
    });

    authEvents.emit('signup', { userId: user.id, email: user.email, firstName: input.firstName, lastName: input.lastName });

    return user;
  }

  public async login(input: LoginInput, device: DeviceMetadata) {
    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const tokenFamily = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const refreshExpiryMs = config.jwt.refreshExpiryMs;
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    const tokens = this.generateTokens(
      { userId: user.id, email: user.email, role: user.role, sessionId },
      tokenFamily
    );

    await this.repository.createSession(user.id, tokenFamily, tokens.refreshToken, expiresAt, device);

    // Warm cache to bypass db query on subsequent authentications
    if (config.features.enableCache && redisClient.isOpen) {
      await redisClient
        .set(`${REDIS_KEYS.SESSION_PREFIX}${sessionId}`, 'true', {
          PX: refreshExpiryMs,
        })
        .catch(() => null);
    }

    authEvents.emit('login', { userId: user.id, email: user.email, ipAddress: device.ipAddress, device: device.device });

    return {
      user,
      ...tokens,
    };
  }

  public async rotateTokens(oldRefreshToken: string, device: DeviceMetadata) {
    const redisValue = config.features.enableCache
      ? await redisClient.get(`${REDIS_KEYS.BLACKLIST_PREFIX}${oldRefreshToken}`)
      : null;
    
    if (redisValue) {
      // Handle concurrent requests from multi-tab reloads during the grace period
      try {
        const graceTokens = JSON.parse(redisValue);
        if (graceTokens && graceTokens.accessToken && graceTokens.refreshToken) {
          logger.info('Grace-period cache hit for concurrent refresh request.');
          return graceTokens;
        }
      } catch (e) {
        // Plain blacklist string implies expired grace period
      }

      logger.warn('Blocked reuse of blacklisted refresh token.');
      throw new UnauthorizedError('Session has expired.');
    }

    let decoded: RefreshTokenPayload;
    try {
      decoded = jwt.verify(oldRefreshToken, config.jwt.refreshSecret) as RefreshTokenPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    const { userId, sessionId, tokenFamily } = decoded;
    const session = await this.repository.findSessionByRefreshToken(oldRefreshToken);

    // Replay attack prevention: invalidate whole family if the token isn't in db
    if (!session) {
      logger.warn(`Potential replay attack on user ${userId}. Revoking family: ${tokenFamily}`);
      
      const familySessions = await prisma.session.findMany({
        where: { tokenFamily },
        select: { id: true },
      });
      await this.repository.invalidateTokenFamily(tokenFamily);
      
      if (config.features.enableCache && redisClient.isOpen) {
        await Promise.all(
          familySessions.map((s) => redisClient.del(`${REDIS_KEYS.SESSION_PREFIX}${s.id}`).catch(() => null))
        );
      }
      
      throw new UnauthorizedError('Session revoked.');
    }

    if (!session.isValid || new Date() > session.expiresAt) {
      throw new UnauthorizedError('Session is invalid or expired.');
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found.');
    }

    const newTokens = this.generateTokens(
      { userId: user.id, email: user.email, role: user.role, sessionId },
      tokenFamily
    );

    const refreshExpiryMs = config.jwt.refreshExpiryMs;
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    await this.repository.updateSession(session.id, {
      refreshToken: newTokens.refreshToken,
      expiresAt,
      ipAddress: device.ipAddress || session.ipAddress,
      userAgent: device.userAgent || session.userAgent,
      device: device.device || session.device,
      os: device.os || session.os,
      browser: device.browser || session.browser,
    });

    if (config.features.enableCache && redisClient.isOpen) {
      await redisClient
        .set(`${REDIS_KEYS.SESSION_PREFIX}${session.id}`, 'true', {
          PX: refreshExpiryMs,
        })
        .catch(() => null);
    }

    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    const GRACE_PERIOD_MS = 15000;
    
    if (remainingTtlMs > 0 && config.features.enableCache) {
      const pxExpiry = Math.min(GRACE_PERIOD_MS, remainingTtlMs);

      // Cache rotated token briefly to prevent race conditions on concurrent connections
      await redisClient.set(`${REDIS_KEYS.BLACKLIST_PREFIX}${oldRefreshToken}`, JSON.stringify(newTokens), {
        PX: pxExpiry,
      });
    }

    return newTokens;
  }

  public async logout(refreshToken: string) {
    const session = await this.repository.findSessionByRefreshToken(refreshToken);
    if (!session) return;

    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    if (remainingTtlMs > 0 && config.features.enableCache) {
      await redisClient.set(`${REDIS_KEYS.BLACKLIST_PREFIX}${refreshToken}`, 'true', {
        PX: remainingTtlMs,
      });
    }

    await this.repository.invalidateSession(session.id);
    if (config.features.enableCache && redisClient.isOpen) {
      await redisClient.del(`${REDIS_KEYS.SESSION_PREFIX}${session.id}`).catch(() => null);
    }

    authEvents.emit('logout', { userId: session.userId, sessionId: session.id });
  }

  public async verifyEmail(token: string) {
    const user = await this.repository.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestError('Invalid verification token.');
    }

    if (user.isEmailVerified) {
      return user;
    }

    if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
      throw new BadRequestError('Verification token has expired.');
    }

    return this.repository.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });
  }

  public async forgotPassword(email: string) {
    const user = await this.repository.findByEmail(email);
    if (!user) return; // Silent response to mitigate user enumeration

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET_MS);

    await this.repository.updateUser(user.id, {
      passwordResetToken: resetToken,
      passwordResetTokenExpiresAt: expiresAt,
    });

    EmailService.sendPasswordResetEmail(user.email, resetToken).catch((err) => {
      logger.error('Background password reset email failed:', err);
    });
  }

  public async resetPassword(input: ResetPasswordInput) {
    const user = await this.repository.findByPasswordResetToken(input.token);

    if (!user) {
      throw new BadRequestError('Invalid reset token.');
    }

    if (user.passwordResetTokenExpiresAt && new Date() > user.passwordResetTokenExpiresAt) {
      throw new BadRequestError('Reset token has expired.');
    }

    const passwordHash = await this.hashPassword(input.password);
    const activeSessions = await this.repository.findActiveSessionsByUserId(user.id);

    // Invalidate all existing sessions on password reset
    await this.repository.invalidateAllSessionsForUser(user.id);

    if (config.features.enableCache && redisClient.isOpen) {
      await Promise.all(
        activeSessions.map((s) => redisClient.del(`${REDIS_KEYS.SESSION_PREFIX}${s.id}`).catch(() => null))
      );
    }

    const updatedUser = await this.repository.updateUser(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    });

    authEvents.emit('passwordReset', { userId: user.id });

    return updatedUser;
  }

  public async getActiveSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const sessions = await this.repository.findActiveSessionsByUserId(userId);
    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      device: s.device,
      os: s.os,
      browser: s.browser,
      ipAddress: s.ipAddress,
      isValid: s.isValid,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  public async revokeSession(userId: string, sessionId: string) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundError('Session not found.');
    }

    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    if (remainingTtlMs > 0 && session.refreshToken && config.features.enableCache) {
      await redisClient.set(`${REDIS_KEYS.BLACKLIST_PREFIX}${session.refreshToken}`, 'true', {
        PX: remainingTtlMs,
      });
    }

    await this.repository.invalidateSession(sessionId);
    if (config.features.enableCache && redisClient.isOpen) {
      await redisClient.del(`${REDIS_KEYS.SESSION_PREFIX}${sessionId}`).catch(() => null);
    }

    authEvents.emit('sessionRevoked', { userId, sessionId });
  }
}

export default AuthService;
