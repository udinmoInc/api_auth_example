import { Session, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { SignUpInput } from './auth.validator';
import { DeviceMetadata } from './auth.types';

export class AuthRepository {
  /**
   * Find a user by their email, including their profile details
   */
  public async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  /**
   * Find a user by their ID, including their profile details
   */
  public async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  /**
   * Atomically create a user, their profile, a default workspace, and owner membership in a transaction
   */
  public async createUser(input: SignUpInput, passwordHash: string, verificationToken: string, expiresAt: Date) {
    return prisma.$transaction(async (tx) => {
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
  public async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      include: { profile: true },
    });
  }

  /**
   * Find a user by verification token
   */
  public async findByVerificationToken(token: string) {
    return prisma.user.findUnique({
      where: { verificationToken: token },
    });
  }

  /**
   * Find a user by password reset token
   */
  public async findByPasswordResetToken(token: string) {
    return prisma.user.findUnique({
      where: { passwordResetToken: token },
    });
  }

  // ==========================================
  // SESSION REPOSITORY OPERATIONS
  // ==========================================

  /**
   * Create a new tracking session
   */
  public async createSession(
    userId: string,
    tokenFamily: string,
    refreshToken: string,
    expiresAt: Date,
    device: DeviceMetadata
  ): Promise<Session> {
    return prisma.session.create({
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
  public async findSessionById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { id },
    });
  }

  /**
   * Find an active session by refresh token
   */
  public async findSessionByRefreshToken(token: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { refreshToken: token },
    });
  }

  /**
   * Update a session
   */
  public async updateSession(id: string, data: Prisma.SessionUpdateInput): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data,
    });
  }

  /**
   * Invalidate a session (Revocation / Logout)
   */
  public async invalidateSession(id: string): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: { isValid: false, refreshToken: '' },
    });
  }

  /**
   * Invalidate all sessions sharing the same token family (Token Replay Attack Recovery)
   */
  public async invalidateTokenFamily(tokenFamily: string): Promise<Prisma.BatchPayload> {
    return prisma.session.updateMany({
      where: { tokenFamily },
      data: { isValid: false, refreshToken: '' },
    });
  }

  /**
   * Invalidate all active sessions for a user (Global Logout / Force Password Change Protection)
   */
  public async invalidateAllSessionsForUser(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.session.updateMany({
      where: { userId, isValid: true },
      data: { isValid: false, refreshToken: '' },
    });
  }

  /**
   * List all active sessions for a user
   */
  public async findActiveSessionsByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: {
        userId,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default AuthRepository;
