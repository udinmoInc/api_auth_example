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
const events_1 = require("@/lib/events");
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
        // Fire hook for external plugins (e.g. notifications, billing, workspaces)
        events_1.authEvents.emit('signup', { userId: user.id, email: user.email, firstName: input.firstName, lastName: input.lastName });
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
        // Fire login hook for audit trails and telemetry extensions
        events_1.authEvents.emit('login', { userId: user.id, email: user.email, ipAddress: device.ipAddress, device: device.device });
        return {
            user,
            ...tokens,
        };
    }
    // Refresh token rotation with replay protection and concurrent request grace period
    async rotateTokens(oldRefreshToken, device) {
        const redisValue = config_1.default.features.enableCache
            ? await redis_1.redisClient.get(`blacklist:${oldRefreshToken}`)
            : null;
        if (redisValue) {
            // If within 15s grace period, it contains the JSON string of the newly generated token pair.
            // We return these cached tokens to handle concurrent refreshes seamlessly.
            try {
                const graceTokens = JSON.parse(redisValue);
                if (graceTokens && graceTokens.accessToken && graceTokens.refreshToken) {
                    logger_1.default.info('🔄 Grace period hit for concurrent refresh. Returning cached tokens.');
                    return graceTokens;
                }
            }
            catch (e) {
                // Not a JSON payload, meaning grace period expired and it's a hard blacklist
            }
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
        // it was already rotated. Immediately revoke the entire family.
        if (!session) {
            logger_1.default.warn(`🚨 REPLAY ATTACK DETECTED for user ${userId}. Revoking family: ${tokenFamily}`);
            await this.repository.invalidateTokenFamily(tokenFamily);
            throw new errors_1.ApiError(401, 'Session revoked.');
        }
        if (!session.isValid || new Date() > session.expiresAt) {
            throw new errors_1.ApiError(401, 'Session is invalid or expired.');
        }
        const user = await this.repository.findById(userId);
        if (!user) {
            throw new errors_1.ApiError(401, 'User not found.');
        }
        const newTokens = this.generateTokens({ userId: user.id, email: user.email, role: user.role, sessionId }, tokenFamily);
        const refreshExpiryMs = this.parseExpiryToMs(config_1.default.jwt.refreshExpiry);
        const expiresAt = new Date(Date.now() + refreshExpiryMs);
        // Persist new refresh token on active database session
        await this.repository.updateSession(session.id, {
            refreshToken: newTokens.refreshToken,
            expiresAt,
            ipAddress: device.ipAddress || session.ipAddress,
            userAgent: device.userAgent || session.userAgent,
            device: device.device || session.device,
            os: device.os || session.os,
            browser: device.browser || session.browser,
        });
        const remainingTtlMs = session.expiresAt.getTime() - Date.now();
        const GRACE_PERIOD_MS = 15000; // 15 seconds grace period
        if (remainingTtlMs > 0 && config_1.default.features.enableCache) {
            // Ensure the grace period cache never extends the lifespan of an expiring refresh token
            const pxExpiry = Math.min(GRACE_PERIOD_MS, remainingTtlMs);
            // Keep the new tokens in Redis for the first 15s so concurrent requests get the same tokens
            await redis_1.redisClient.set(`blacklist:${oldRefreshToken}`, JSON.stringify(newTokens), {
                PX: pxExpiry,
            });
        }
        return newTokens;
    }
    async logout(refreshToken) {
        const session = await this.repository.findSessionByRefreshToken(refreshToken);
        if (!session)
            return;
        const remainingTtlMs = session.expiresAt.getTime() - Date.now();
        if (remainingTtlMs > 0 && config_1.default.features.enableCache) {
            await redis_1.redisClient.set(`blacklist:${refreshToken}`, 'true', {
                PX: remainingTtlMs,
            });
        }
        await this.repository.invalidateSession(session.id);
        // Fire logout hook
        events_1.authEvents.emit('logout', { userId: session.userId, sessionId: session.id });
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
        const updatedUser = await this.repository.updateUser(user.id, {
            passwordHash,
            passwordResetToken: null,
            passwordResetTokenExpiresAt: null,
        });
        // Fire password reset hook
        events_1.authEvents.emit('passwordReset', { userId: user.id });
        return updatedUser;
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
        if (remainingTtlMs > 0 && session.refreshToken && config_1.default.features.enableCache) {
            await redis_1.redisClient.set(`blacklist:${session.refreshToken}`, 'true', {
                PX: remainingTtlMs,
            });
        }
        await this.repository.invalidateSession(sessionId);
        // Fire session revocation hook
        events_1.authEvents.emit('sessionRevoked', { userId, sessionId });
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
