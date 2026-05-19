import { createClient } from 'redis';
import config from '@/config';
import logger from '@/utils/logger';

// Professional Redis client connection configuration for production durability
const redisClient = createClient({
  url: config.redis.url,
  socket: {
    // Exponential backoff reconnect strategy to prevent infinite reconnect storms
    reconnectStrategy: (retries) => {
      // 100ms, 200ms, 300ms... up to a maximum 3 seconds delay
      const delay = Math.min(retries * 100, 3000);
      logger.warn(`⚠️ Redis offline. Reconnect attempt #${retries} scheduled in ${delay}ms`);
      return delay;
    },
    connectTimeout: 5000, // Abort and time out connection attempts after 5 seconds
  },
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

// Non-blocking asynchronous socket connection bootstrap
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Failed to connect to Redis during startup:', error);
  }
})();

export { redisClient };
export default redisClient;
