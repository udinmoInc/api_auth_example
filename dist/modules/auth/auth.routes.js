"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validate_1 = require("@/middleware/validate");
const auth_1 = require("@/middleware/auth");
const device_1 = require("@/middleware/device");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const auth_validator_1 = require("./auth.validator");
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
/**
 * Public Authentication Routes
 * Protected by dedicated rate-limiters and schema validators
 */
// Register a new user
router.post('/register', rateLimiter_1.authRateLimiter, (0, validate_1.validate)({ body: auth_validator_1.signUpSchema }), controller.register);
// Sign in with credentials
router.post('/login', rateLimiter_1.authRateLimiter, device_1.deviceExtractor, (0, validate_1.validate)({ body: auth_validator_1.loginSchema }), controller.login);
// Rotate Access & Refresh Tokens (Silent Renew)
router.post('/refresh', device_1.deviceExtractor, controller.refresh);
// Terminate current session
router.post('/logout', controller.logout);
// Email address verification
router.get('/verify-email', controller.verifyEmail);
// Trigger password reset email link
router.post('/forgot-password', rateLimiter_1.authRateLimiter, (0, validate_1.validate)({ body: auth_validator_1.forgotPasswordSchema }), controller.forgotPassword);
// Perform password update using reset token
router.post('/reset-password', rateLimiter_1.authRateLimiter, (0, validate_1.validate)({ body: auth_validator_1.resetPasswordSchema }), controller.resetPassword);
/**
 * Private Session Management Routes
 * Protected by authentication guard
 */
// Fetch all active device sessions
router.get('/sessions', auth_1.authenticate, controller.getSessions);
// Terminate a specific device session
router.delete('/sessions/:sessionId', auth_1.authenticate, controller.revokeSession);
exports.default = router;
