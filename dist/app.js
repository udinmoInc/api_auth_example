"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const config_1 = __importDefault(require("@/config"));
const logger_1 = require("@/utils/logger");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const requestLogger_1 = __importDefault(require("@/middleware/requestLogger"));
const error_1 = __importDefault(require("@/middleware/error"));
const routes_1 = __importDefault(require("@/routes"));
const errors_1 = require("@/utils/errors");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const redis_1 = __importDefault(require("@/lib/redis"));
const plugins_1 = __importDefault(require("@/lib/plugins"));
// Load and auto-register extensions/plugins
require("@/plugins/auditLogs");
const app = (0, express_1.default)();
exports.app = app;
// Global request pre-processing and security filters
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.default.security.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(rateLimiter_1.apiRateLimiter);
app.use(requestLogger_1.default);
app.use(express_1.default.json({ limit: '10kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
app.use((0, cookie_parser_1.default)());
// Initialize registered plugins and extensions dynamically
plugins_1.default.initializeAll(app).catch((err) => {
    logger_1.logger.error('Failed to initialize plugins:', err);
});
// Route registrations
app.use(`/api/${config_1.default.apiVersion}`, routes_1.default);
// Catch 404 routes
app.use((req, _res, next) => {
    next(new errors_1.ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`));
});
// Centralized error handler
app.use(error_1.default);
const server = app.listen(config_1.default.port, () => {
    logger_1.logger.info(`🚀 SaaS Auth Backend running in [${config_1.default.env}] mode`);
    logger_1.logger.info(`🔌 Server listening on port: ${config_1.default.port}`);
    logger_1.logger.info(`🔑 API Root: http://localhost:${config_1.default.port}/api/${config_1.default.apiVersion}`);
});
// Graceful termination handler
const gracefulShutdown = async (signal) => {
    logger_1.logger.warn(`Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed.');
    });
    try {
        await prisma_1.default.$disconnect();
        logger_1.logger.info('Database client disconnected.');
        await redis_1.default.quit();
        logger_1.logger.info('Redis client disconnected.');
        logger_1.logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
    }
    catch (err) {
        logger_1.logger.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
exports.default = app;
