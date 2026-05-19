import { User, Profile, Role } from '@prisma/client';

export interface UserProfileDto {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: UserProfileDto;
}

export class AuthDto {
  public static toUserDto(user: User & { profile?: Profile | null }): UserDto {
    const dto: UserDto = {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    if (user.profile) {
      dto.profile = {
        id: user.profile.id,
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        avatarUrl: user.profile.avatarUrl,
        phoneNumber: user.profile.phoneNumber,
      };
    }

    return dto;
  }
}
