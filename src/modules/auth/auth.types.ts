import { Role } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
}

export interface DeviceMetadata {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  os?: string;
  browser?: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  device: string | null;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  isValid: boolean;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}
