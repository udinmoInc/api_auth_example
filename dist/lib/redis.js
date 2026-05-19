"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
const redisClient = (0, redis_1.createClient)({
    url: config_1.default.redis.url,
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
// Connect to Redis in a non-blocking way
(async () => {
    try {
        await redisClient.connect();
    }
    catch (error) {
        logger_1.default.error('❌ Failed to connect to Redis during startup:', error);
    }
})();
exports.default = redisClient;
