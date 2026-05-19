import { createClient } from 'redis';
import config from '@/config';
import logger from '@/utils/logger';

const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('connect', () => {
  logger.info('🔑 Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('🚀 Redis client ready and connected.');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis client connection error:', err);
});

redisClient.on('end', () => {
  logger.warn('⚠️ Redis client connection closed.');
});

// Connect to Redis in a non-blocking way
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Failed to connect to Redis during startup:', error);
  }
})();

export { redisClient };
export default redisClient;
