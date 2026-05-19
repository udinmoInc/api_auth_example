import { Session, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { SignUpInput } from './auth.validator';
import { DeviceMetadata } from './auth.types';

export class AuthRepository {
  public async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  public async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

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

      return { ...user, profile };
    });
  }

  public async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      include: { profile: true },
    });
  }

  public async findByVerificationToken(token: string) {
    return prisma.user.findUnique({
      where: { verificationToken: token },
    });
  }

  public async findByPasswordResetToken(token: string) {
    return prisma.user.findUnique({
      where: { passwordResetToken: token },
    });
  }

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

  public async findSessionById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { id },
    });
  }

  public async findSessionByRefreshToken(token: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { refreshToken: token },
    });
  }

  public async updateSession(id: string, data: Prisma.SessionUpdateInput): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data,
    });
  }

  public async invalidateSession(id: string): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: { isValid: false, refreshToken: '' },
    });
  }

  public async invalidateTokenFamily(tokenFamily: string): Promise<Prisma.BatchPayload> {
    return prisma.session.updateMany({
      where: { tokenFamily },
      data: { isValid: false, refreshToken: '' },
    });
  }

  public async invalidateAllSessionsForUser(userId: string): Promise<Prisma.BatchPayload> {
    return prisma.session.updateMany({
      where: { userId, isValid: true },
      data: { isValid: false, refreshToken: '' },
    });
  }

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
