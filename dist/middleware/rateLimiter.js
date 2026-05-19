"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.apiRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importDefault(require("@/config"));
const response_1 = __importDefault(require("@/utils/response"));
// Standard rate limiter for all standard API endpoints
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.security.rateLimitWindowMs,
    max: config_1.default.security.rateLimitMax,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (_req, res) => {
        response_1.default.error(res, 429, 'Too many requests from this IP. Please try again later.');
    },
});
// Strict rate limiter for high-value targets (login, register, forgot-password, reset-password)
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 authentication requests per 15-minute window
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        response_1.default.error(res, 429, 'Too many authentication attempts from this IP. Please try again after 15 minutes.');
    },
});
