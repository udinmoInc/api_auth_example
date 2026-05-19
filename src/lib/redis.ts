import { createClient } from 'redis';
import config from '@/config';
import logger from '@/utils/logger';

const redisClient = createClient({
  url: config.redis.url,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 100, 3000);
      logger.warn(`⚠️ Redis offline. Reconnect attempt #${retries} scheduled in ${delay}ms`);
      return delay;
    },
    connectTimeout: 5000,
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

(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Failed to connect to Redis during startup:', error);
  }
})();

export { redisClient };
export default redisClient;
