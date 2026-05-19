import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '@/config';
import { ApiError } from '@/utils/errors';
import { redisClient } from '@/lib/redis';
import { AuthRepository } from './auth.repository';
import { SignUpInput, LoginInput, ResetPasswordInput } from './auth.validator';
import { TokenPayload, RefreshTokenPayload, DeviceMetadata, SessionInfo } from './auth.types';
import EmailService from '@/services/email.service';
import logger from '@/utils/logger';

export class AuthService {
  private repository = new AuthRepository();

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
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

  // Parse token expiry config (e.g. "15m", "7d") into ms
  private parseExpiryToMs(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  public async register(input: SignUpInput) {
    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists.');
    }

    const passwordHash = await this.hashPassword(input.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.repository.createUser(input, passwordHash, verificationToken, expiresAt);

    EmailService.sendVerificationEmail(user.email, verificationToken).catch((err) => {
      logger.error('Background verification email failed:', err);
    });

    return user;
  }

  public async login(input: LoginInput, device: DeviceMetadata) {
    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const tokenFamily = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const refreshExpiryMs = this.parseExpiryToMs(config.jwt.refreshExpiry);
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    const tokens = this.generateTokens(
      { userId: user.id, email: user.email, role: user.role, sessionId },
      tokenFamily
    );

    await this.repository.createSession(user.id, tokenFamily, tokens.refreshToken, expiresAt, device);

    return {
      user,
      ...tokens,
    };
  }

  // Refresh token rotation with replay protection
  public async rotateTokens(oldRefreshToken: string, device: DeviceMetadata) {
    const isBlacklisted = await redisClient.get(`blacklist:${oldRefreshToken}`);
    if (isBlacklisted) {
      logger.warn('Blocked reuse attempt on blacklisted refresh token.');
      throw new ApiError(401, 'Session has expired.');
    }

    let decoded: RefreshTokenPayload;
    try {
      decoded = jwt.verify(oldRefreshToken, config.jwt.refreshSecret) as RefreshTokenPayload;
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired refresh token.');
    }

    const { userId, sessionId, tokenFamily } = decoded;
    const session = await this.repository.findSessionByRefreshToken(oldRefreshToken);

    // Replay detection: If token belongs to a known family but session does not match,
    // it was already rotated. Immediately invalidate the entire family to block attacks.
    if (!session) {
      logger.warn(`REPLAY ATTACK DETECTED for user ${userId}. Revoking family: ${tokenFamily}`);
      await this.repository.invalidateTokenFamily(tokenFamily);
      throw new ApiError(401, 'Session revoked.');
    }

    if (!session.isValid || new Date() > session.expiresAt) {
      throw new ApiError(401, 'Session is invalid or expired.');
    }

    // Blacklist rotated token in Redis for its remaining lifetime
    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    if (remainingTtlMs > 0) {
      await redisClient.set(`blacklist:${oldRefreshToken}`, 'true', {
        PX: remainingTtlMs,
      });
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new ApiError(401, 'User not found.');
    }

    const newTokens = this.generateTokens(
      { userId: user.id, email: user.email, role: user.role, sessionId },
      tokenFamily
    );

    const refreshExpiryMs = this.parseExpiryToMs(config.jwt.refreshExpiry);
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

    return newTokens;
  }

  public async logout(refreshToken: string) {
    const session = await this.repository.findSessionByRefreshToken(refreshToken);
    if (!session) return;

    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    if (remainingTtlMs > 0) {
      await redisClient.set(`blacklist:${refreshToken}`, 'true', {
        PX: remainingTtlMs,
      });
    }

    await this.repository.invalidateSession(session.id);
  }

  public async verifyEmail(token: string) {
    const user = await this.repository.findByVerificationToken(token);

    if (!user) {
      throw new ApiError(400, 'Invalid verification token.');
    }

    if (user.isEmailVerified) {
      return user;
    }

    if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
      throw new ApiError(400, 'Verification token has expired.');
    }

    return this.repository.updateUser(user.id, {
      isEmailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });
  }

  public async forgotPassword(email: string) {
    const user = await this.repository.findByEmail(email);
    if (!user) return; // Silent return for security

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

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
      throw new ApiError(400, 'Invalid reset token.');
    }

    if (user.passwordResetTokenExpiresAt && new Date() > user.passwordResetTokenExpiresAt) {
      throw new ApiError(400, 'Reset token has expired.');
    }

    const passwordHash = await this.hashPassword(input.password);

    // Invalidate all login sessions on password change
    await this.repository.invalidateAllSessionsForUser(user.id);

    return this.repository.updateUser(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    });
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
      throw new ApiError(404, 'Session not found.');
    }

    const remainingTtlMs = session.expiresAt.getTime() - Date.now();
    if (remainingTtlMs > 0 && session.refreshToken) {
      await redisClient.set(`blacklist:${session.refreshToken}`, 'true', {
        PX: remainingTtlMs,
      });
    }

    await this.repository.invalidateSession(sessionId);
  }
}

export default AuthService;
