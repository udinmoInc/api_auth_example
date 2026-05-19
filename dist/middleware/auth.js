"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("@/config"));
const errors_1 = require("@/utils/errors");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const asyncHandler_1 = __importDefault(require("@/utils/asyncHandler"));
/**
 * Middleware to authenticate requests via Bearer JWT Access Token
 */
exports.authenticate = (0, asyncHandler_1.default)(async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new errors_1.ApiError(401, 'Authentication failed. Please provide a valid Bearer token.');
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt.accessSecret);
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new errors_1.ApiError(401, 'Access token has expired. Please refresh your session.');
        }
        throw new errors_1.ApiError(401, 'Authentication failed. Token signature is invalid.');
    }
    // Session Revocation Check (Stateful JWT Hardening):
    // Check if session has been invalidated or revoked in PostgreSQL
    const session = await prisma_1.default.session.findUnique({
        where: { id: decoded.sessionId },
    });
    if (!session || !session.isValid) {
        throw new errors_1.ApiError(401, 'Your session has been terminated. Please log in again.');
    }
    // Attach decoded token details to req.user for down-stream access
    req.user = decoded;
    next();
});
/**
 * Middleware for Role-Based Access Control (RBAC)
 */
const authorize = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new errors_1.ApiError(401, 'User is not authenticated.'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new errors_1.ApiError(403, 'Forbidden. You do not have the required permissions to access this resource.'));
        }
        next();
    };
};
exports.authorize = authorize;
exports.default = { authenticate: exports.authenticate, authorize: exports.authorize };
