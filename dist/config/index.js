"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables from .env file
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('5000').transform((val) => parseInt(val, 10)),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    API_VERSION: zod_1.z.string().default('v1'),
    FRONTEND_URL: zod_1.z.string().url(),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32, 'Access token secret must be at least 32 characters long'),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default('15m'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32, 'Refresh token secret must be at least 32 characters long'),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default('7d'),
    SMTP_HOST: zod_1.z.string(),
    SMTP_PORT: zod_1.z.string().transform((val) => parseInt(val, 10)),
    SMTP_USER: zod_1.z.string(),
    SMTP_PASS: zod_1.z.string(),
    SMTP_FROM: zod_1.z.string(),
    CORS_ORIGIN: zod_1.z.string(),
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().default('900000').transform((val) => parseInt(val, 10)),
    RATE_LIMIT_MAX: zod_1.z.string().default('100').transform((val) => parseInt(val, 10)),
    COOKIES_SECURE: zod_1.z.string().default('false').transform((val) => val === 'true'),
    // Config-driven dynamic production / development architecture flags
    ENABLE_LOGGER: zod_1.z.string().default('true').transform((val) => val === 'true'),
    ENABLE_AUDIT_LOGS: zod_1.z.string().default('true').transform((val) => val === 'true'),
    ENABLE_TRACING: zod_1.z.string().default('true').transform((val) => val === 'true'),
    ENABLE_CACHE: zod_1.z.string().default('true').transform((val) => val === 'true'),
});
const parseEnv = () => {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Environment validation failed:');
        console.error(JSON.stringify(result.error.format(), null, 2));
        process.exit(1);
    }
    return result.data;
};
const env = parseEnv();
exports.config = {
    env: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    frontendUrl: env.FRONTEND_URL,
    db: {
        url: env.DATABASE_URL,
    },
    redis: {
        url: env.REDIS_URL,
    },
    jwt: {
        accessSecret: env.JWT_ACCESS_SECRET,
        accessExpiry: env.JWT_ACCESS_EXPIRY,
        refreshSecret: env.JWT_REFRESH_SECRET,
        refreshExpiry: env.JWT_REFRESH_EXPIRY,
    },
    smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM,
    },
    security: {
        corsOrigin: env.CORS_ORIGIN,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
        rateLimitMax: env.RATE_LIMIT_MAX,
        cookiesSecure: env.COOKIES_SECURE,
    },
    logging: {
        enableLogger: env.ENABLE_LOGGER,
        enableTracing: env.ENABLE_TRACING,
    },
    features: {
        enableAuditLogs: env.ENABLE_AUDIT_LOGS,
        enableCache: env.ENABLE_CACHE,
    },
};
exports.default = exports.config;
