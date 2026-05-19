"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("@/config"));
const errors_1 = require("@/utils/errors");
const redis_1 = require("@/lib/redis");
const auth_repository_1 = require("./auth.repository");
const email_service_1 = __importDefault(require("@/services/email.service"));
const logger_1 = __importDefault(require("@/utils/logger"));
class AuthService {
    repository = new auth_repository_1.AuthRepository();
    async hashPassword(password) {
        const saltRounds = 10;
        return bcrypt_1.default.hash(password, saltRounds);
    }
    async verifyPassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    generateTokens(payload, tokenFamily) {
        const accessToken = jsonwebtoken_1.default.sign(payload, config_1.default.jwt.accessSecret, {
            expiresIn: config_1.default.jwt.accessExpiry,
        });
        const refreshPayload = {
            userId: payload.userId,
            sessionId: payload.sessionId,
            tokenFamily,
        };
        const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, config_1.default.jwt.refreshSecret, {
            expiresIn: config_1.default.jwt.refreshExpiry,
        });
        return { accessToken, refreshToken };
    }
    // Parse token expiry config (e.g. "15m", "7d") into ms
    parseExpiryToMs(expiry) {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1), 10);
        switch (unit) {
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 7 * 24 * 60 * 60 * 1000;
        }
    }
    async register(input) {
        const existingUser = await this.repository.findByEmail(input.email);
        if (existingUser) {
            throw new errors_1.ApiError(409, 'User with this email already exists.');
        }
        const passwordHash = await this.hashPassword(input.password);
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await this.repository.createUser(input, passwordHash, verificationToken, expiresAt);
        email_service_1.default.sendVerificationEmail(user.email, verificationToken).catch((err) => {
            logger_1.default.error('Background verification email failed:', err);
        });
        return user;
    }
    async login(input, device) {
        const user = await this.repository.findByEmail(input.email);
        if (!user) {
            throw new errors_1.ApiError(401, 'Invalid email or password.');
        }
        const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new errors_1.ApiError(401, 'Invalid email or password.');
        }
        const tokenFamily = crypto_1.default.randomUUID();
        const sessionId = crypto_1.default.randomUUID();
        const refreshExpiryMs = this.parseExpiryToMs(config_1.default.jwt.refreshExpiry);
        const expiresAt = new Date(Date.now() + refreshExpiryMs);
        const tokens = this.generateTokens({ userId: user.id, email: user.email, role: user.role, sessionId }, tokenFamily);
        await this.repository.createSession(user.id, tokenFamily, tokens.refreshToken, expiresAt, device);
        return {
            user,
            ...tokens,
        };
    }
    // Refresh token rotation with replay protection
    async rotateTokens(oldRefreshToken, device) {
        const isBlacklisted = await redis_1.redisClient.get(`blacklist:${oldRefreshToken}`);
        if (isBlacklisted) {
            logger_1.default.warn('Blocked reuse attempt on blacklisted refresh token.');
            throw new errors_1.ApiError(401, 'Session has expired.');
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(oldRefreshToken, config_1.default.jwt.refreshSecret);
        }
        catch (error) {
            throw new errors_1.ApiError(401, 'Invalid or expired refresh token.');
        }
        const { userId, sessionId, tokenFamily } = decoded;
        const session = await this.repository.findSessionByRefreshToken(oldRefreshToken);
        // Replay detection: If token belongs to a known family but session does not match,
        // it was already rotated. Immediately invalidate the entire family to block attacks.
        if (!session) {
            logger_1.default.warn(`REPLAY ATTACK DETECTED for user ${userId}. Revoking family: ${tokenFamily}`);
            await this.repository.invalidateTokenFamily(tokenFamily);
            throw new errors_1.ApiError(401, 'Session revoked.');
        }
        if (!session.isValid || new Date() > session.expiresAt) {
            throw new errors_1.ApiError(401, 'Session is invalid or expired.');
        }
        // Blacklist rotated token in Redis for its remaining lifetime
        const remainingTtlMs = session.expiresAt.getTime() - Date.now();
        if (remainingTtlMs > 0) {
            await redis_1.redisClient.set(`blacklist:${oldRefreshToken}`, 'true', {
                PX: remainingTtlMs,
            });
        }
        const user = await this.repository.findById(userId);
        if (!user) {
            throw new errors_1.ApiError(401, 'User not found.');
        }
        const newTokens = this.generateTokens({ userId: user.id, email: user.email, role: user.role, sessionId }, tokenFamily);
        const refreshExpiryMs = this.parseExpiryToMs(config_1.default.jwt.refreshExpiry);
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
    async logout(refreshToken) {
        const session = await this.repository.findSessionByRefreshToken(refreshToken);
        if (!session)
            return;
        const remainingTtlMs = session.expiresAt.getTime() - Date.now();
        if (remainingTtlMs > 0) {
            await redis_1.redisClient.set(`blacklist:${refreshToken}`, 'true', {
                PX: remainingTtlMs,
            });
        }
        await this.repository.invalidateSession(session.id);
    }
    async verifyEmail(token) {
        const user = await this.repository.findByVerificationToken(token);
        if (!user) {
            throw new errors_1.ApiError(400, 'Invalid verification token.');
        }
        if (user.isEmailVerified) {
            return user;
        }
        if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
            throw new errors_1.ApiError(400, 'Verification token has expired.');
        }
        return this.repository.updateUser(user.id, {
            isEmailVerified: true,
            verificationToken: null,
            verificationTokenExpiresAt: null,
        });
    }
    async forgotPassword(email) {
        const user = await this.repository.findByEmail(email);
        if (!user)
            return; // Silent return for security
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await this.repository.updateUser(user.id, {
            passwordResetToken: resetToken,
            passwordResetTokenExpiresAt: expiresAt,
        });
        email_service_1.default.sendPasswordResetEmail(user.email, resetToken).catch((err) => {
            logger_1.default.error('Background password reset email failed:', err);
        });
    }
    async resetPassword(input) {
        const user = await this.repository.findByPasswordResetToken(input.token);
        if (!user) {
            throw new errors_1.ApiError(400, 'Invalid reset token.');
        }
        if (user.passwordResetTokenExpiresAt && new Date() > user.passwordResetTokenExpiresAt) {
            throw new errors_1.ApiError(400, 'Reset token has expired.');
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
    async getActiveSessions(userId, currentSessionId) {
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
    async revokeSession(userId, sessionId) {
        const session = await this.repository.findSessionById(sessionId);
        if (!session || session.userId !== userId) {
            throw new errors_1.ApiError(404, 'Session not found.');
        }
        const remainingTtlMs = session.expiresAt.getTime() - Date.now();
        if (remainingTtlMs > 0 && session.refreshToken) {
            await redis_1.redisClient.set(`blacklist:${session.refreshToken}`, 'true', {
                PX: remainingTtlMs,
            });
        }
        await this.repository.invalidateSession(sessionId);
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
