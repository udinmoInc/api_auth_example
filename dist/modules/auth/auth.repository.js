"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
class AuthRepository {
    /**
     * Find a user by their email, including their profile details
     */
    async findByEmail(email) {
        return prisma_1.default.user.findUnique({
            where: { email },
            include: { profile: true },
        });
    }
    /**
     * Find a user by their ID, including their profile details
     */
    async findById(id) {
        return prisma_1.default.user.findUnique({
            where: { id },
            include: { profile: true },
        });
    }
    /**
     * Atomically create a user, their profile, a default workspace, and owner membership in a transaction
     */
    async createUser(input, passwordHash, verificationToken, expiresAt) {
        return prisma_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    passwordHash,
                    verificationToken,
                    verificationTokenExpiresAt: expiresAt,
                },
            });
            const profile = await tx.profile.create({
                data: {
                    userId: user.id,
                    firstName: input.firstName || null,
                    lastName: input.lastName || null,
                    phoneNumber: input.phoneNumber || null,
                },
            });
            // Generate an extensible personal B2B workspace context
            const workspaceName = input.firstName ? `${input.firstName}'s Workspace` : 'My Workspace';
            const slugSuffix = Math.random().toString(36).substring(2, 7);
            const cleanSlug = `${input.email.split('@')[0]}-workspace-${slugSuffix}`;
            const workspace = await tx.workspace.create({
                data: {
                    name: workspaceName,
                    slug: cleanSlug,
                },
            });
            await tx.workspaceMember.create({
                data: {
                    workspaceId: workspace.id,
                    userId: user.id,
                    role: 'OWNER',
                },
            });
            return { ...user, profile };
        });
    }
    /**
     * Update generic user fields
     */
    async updateUser(id, data) {
        return prisma_1.default.user.update({
            where: { id },
            data,
            include: { profile: true },
        });
    }
    /**
     * Find a user by verification token
     */
    async findByVerificationToken(token) {
        return prisma_1.default.user.findUnique({
            where: { verificationToken: token },
        });
    }
    /**
     * Find a user by password reset token
     */
    async findByPasswordResetToken(token) {
        return prisma_1.default.user.findUnique({
            where: { passwordResetToken: token },
        });
    }
    // ==========================================
    // SESSION REPOSITORY OPERATIONS
    // ==========================================
    /**
     * Create a new tracking session
     */
    async createSession(userId, tokenFamily, refreshToken, expiresAt, device) {
        return prisma_1.default.session.create({
            data: {
                userId,
                tokenFamily,
                refreshToken,
                expiresAt,
                ipAddress: device.ipAddress || null,
                userAgent: device.userAgent || null,
                device: device.device || null,
                os: device.os || null,
                browser: device.browser || null,
            },
        });
    }
    /**
     * Find a session by its unique ID
     */
    async findSessionById(id) {
        return prisma_1.default.session.findUnique({
            where: { id },
        });
    }
    /**
     * Find an active session by refresh token
     */
    async findSessionByRefreshToken(token) {
        return prisma_1.default.session.findUnique({
            where: { refreshToken: token },
        });
    }
    /**
     * Update a session
     */
    async updateSession(id, data) {
        return prisma_1.default.session.update({
            where: { id },
            data,
        });
    }
    /**
     * Invalidate a session (Revocation / Logout)
     */
    async invalidateSession(id) {
        return prisma_1.default.session.update({
            where: { id },
            data: { isValid: false, refreshToken: '' },
        });
    }
    /**
     * Invalidate all sessions sharing the same token family (Token Replay Attack Recovery)
     */
    async invalidateTokenFamily(tokenFamily) {
        return prisma_1.default.session.updateMany({
            where: { tokenFamily },
            data: { isValid: false, refreshToken: '' },
        });
    }
    /**
     * Invalidate all active sessions for a user (Global Logout / Force Password Change Protection)
     */
    async invalidateAllSessionsForUser(userId) {
        return prisma_1.default.session.updateMany({
            where: { userId, isValid: true },
            data: { isValid: false, refreshToken: '' },
        });
    }
    /**
     * List all active sessions for a user
     */
    async findActiveSessionsByUserId(userId) {
        return prisma_1.default.session.findMany({
            where: {
                userId,
                isValid: true,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
exports.AuthRepository = AuthRepository;
exports.default = AuthRepository;
