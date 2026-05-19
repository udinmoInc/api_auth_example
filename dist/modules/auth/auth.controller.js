"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = __importDefault(require("./auth.service"));
const auth_dto_1 = require("./auth.dto");
const response_1 = __importDefault(require("@/utils/response"));
const config_1 = __importDefault(require("@/config"));
const errors_1 = require("@/utils/errors");
class AuthController {
    service = new auth_service_1.default();
    // Set HTTP-Only, SameSite cookie for the refresh token
    setRefreshTokenCookie(res, token) {
        const isProd = config_1.default.env === 'production';
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days (matches refresh token expiry)
        res.cookie('refreshToken', token, {
            httpOnly: true,
            secure: config_1.default.security.cookiesSecure || isProd,
            sameSite: 'strict',
            maxAge,
            path: '/',
        });
    }
    // Clear HTTP-Only cookie during logout
    clearRefreshTokenCookie(res) {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: config_1.default.security.cookiesSecure || config_1.default.env === 'production',
            sameSite: 'strict',
            path: '/',
        });
    }
    register = async (req, res) => {
        const user = await this.service.register(req.body);
        const userDto = auth_dto_1.AuthDto.toUserDto(user);
        return response_1.default.success(res, 201, 'Registration successful. Verification email sent.', { user: userDto });
    };
    login = async (req, res) => {
        const device = req.deviceMetadata || {};
        const result = await this.service.login(req.body, device);
        this.setRefreshTokenCookie(res, result.refreshToken);
        const userDto = auth_dto_1.AuthDto.toUserDto(result.user);
        return response_1.default.success(res, 200, 'Login successful.', {
            user: userDto,
            accessToken: result.accessToken,
        });
    };
    refresh = async (req, res) => {
        const oldRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!oldRefreshToken) {
            throw new errors_1.ApiError(401, 'Refresh token is missing.');
        }
        const device = req.deviceMetadata || {};
        const result = await this.service.rotateTokens(oldRefreshToken, device);
        this.setRefreshTokenCookie(res, result.refreshToken);
        return response_1.default.success(res, 200, 'Token refreshed successfully.', {
            accessToken: result.accessToken,
        });
    };
    logout = async (req, res) => {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (refreshToken) {
            await this.service.logout(refreshToken);
        }
        this.clearRefreshTokenCookie(res);
        return response_1.default.success(res, 200, 'Logged out successfully.');
    };
    verifyEmail = async (req, res) => {
        const token = req.query.token;
        if (typeof token !== 'string') {
            throw new errors_1.ApiError(400, 'Verification token must be a string.');
        }
        const user = await this.service.verifyEmail(token);
        const userDto = auth_dto_1.AuthDto.toUserDto(user);
        return response_1.default.success(res, 200, 'Email verified successfully.', {
            user: userDto,
        });
    };
    forgotPassword = async (req, res) => {
        const { email } = req.body;
        await this.service.forgotPassword(email);
        // Standard security: respond identically whether email exists or not
        return response_1.default.success(res, 200, 'If the email is registered, a password reset link has been sent.');
    };
    resetPassword = async (req, res) => {
        await this.service.resetPassword(req.body);
        return response_1.default.success(res, 200, 'Password updated successfully. All other active sessions have been logged out.');
    };
    getSessions = async (req, res) => {
        const userId = req.user.userId;
        const currentSessionId = req.user.sessionId;
        const sessions = await this.service.getActiveSessions(userId, currentSessionId);
        return response_1.default.success(res, 200, 'Active sessions fetched.', { sessions });
    };
    revokeSession = async (req, res) => {
        const userId = req.user.userId;
        const { sessionId } = req.params;
        if (!sessionId) {
            throw new errors_1.ApiError(400, 'Session ID is required.');
        }
        await this.service.revokeSession(userId, sessionId);
        return response_1.default.success(res, 200, 'Session revoked successfully.');
    };
}
exports.AuthController = AuthController;
exports.default = AuthController;
