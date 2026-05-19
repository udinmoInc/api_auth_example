"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKIE_NAMES = exports.ROLES = exports.TOKEN_EXPIRY = void 0;
exports.TOKEN_EXPIRY = {
    ACCESS_MS: 15 * 60 * 1000, // 15 minutes
    REFRESH_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
    EMAIL_VERIFY_MS: 24 * 60 * 60 * 1000, // 24 hours
    PASSWORD_RESET_MS: 60 * 60 * 1000, // 1 hour
};
exports.ROLES = {
    USER: 'USER',
    ADMIN: 'ADMIN',
};
exports.COOKIE_NAMES = {
    REFRESH_TOKEN: 'refreshToken',
};
