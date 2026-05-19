"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthDto = void 0;
class AuthDto {
    static toUserDto(user) {
        const dto = {
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
exports.AuthDto = AuthDto;
