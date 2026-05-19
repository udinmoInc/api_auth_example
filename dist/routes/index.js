"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("@/modules/auth/auth.routes"));
const router = (0, express_1.Router)();
// Mount modules
router.use('/auth', auth_routes_1.default);
// Health check endpoint
router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
    });
});
exports.default = router;
