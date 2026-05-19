"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
// Professional Redis client connection configuration for production durability
const redisClient = (0, redis_1.createClient)({
    url: config_1.default.redis.url,
    socket: {
        // Exponential backoff reconnect strategy to prevent infinite reconnect storms
        reconnectStrategy: (retries) => {
            // 100ms, 200ms, 300ms... up to a maximum 3 seconds delay
            const delay = Math.min(retries * 100, 3000);
            logger_1.default.warn(`⚠️ Redis offline. Reconnect attempt #${retries} scheduled in ${delay}ms`);
            return delay;
        },
        connectTimeout: 5000, // Abort and time out connection attempts after 5 seconds
    },
});
exports.redisClient = redisClient;
redisClient.on('connect', () => {
    logger_1.default.info('🔑 Redis client connecting...');
});
redisClient.on('ready', () => {
    logger_1.default.info('🚀 Redis client ready and connected.');
});
redisClient.on('error', (err) => {
    logger_1.default.error('❌ Redis client connection error:', err);
});
redisClient.on('end', () => {
    logger_1.default.warn('⚠️ Redis client connection closed.');
});
// Non-blocking asynchronous socket connection bootstrap
(async () => {
    try {
        await redisClient.connect();
    }
    catch (error) {
        logger_1.default.error('❌ Failed to connect to Redis during startup:', error);
    }
})();
exports.default = redisClient;
