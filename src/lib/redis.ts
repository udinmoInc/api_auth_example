import { Redis } from '@upstash/redis';
import config from '@/config';
import logger from '@/utils/logger';

// Initialize the Upstash HTTP client
const upstashRedis = new Redis({
  url: config.redis.upstashUrl,
  token: config.redis.upstashToken,
});

class UpstashRedisAdaptor {
  public isOpen = true;

  public async connect(): Promise<void> {
    logger.info('🚀 Upstash Redis (HTTP) initialized and ready.');
  }

  public async quit(): Promise<void> {
    logger.info('🔌 Upstash Redis (HTTP) connection interface closed.');
  }

  public async get(key: string): Promise<string | null> {
    try {
      const val = await upstashRedis.get<any>(key);
      if (val === null || val === undefined) return null;
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    } catch (err) {
      logger.error(`Upstash get error for key ${key}:`, err);
      return null;
    }
  }

  public async set(
    key: string,
    value: string,
    options?: { PX?: number; EX?: number }
  ): Promise<'OK' | null> {
    try {
      const upstashOpts: any = {};
      if (options?.PX !== undefined) {
        upstashOpts.px = options.PX;
      }
      if (options?.EX !== undefined) {
        upstashOpts.ex = options.EX;
      }

      let parsedValue: any = value;
      try {
        if (value.startsWith('{') || value.startsWith('[')) {
          parsedValue = JSON.parse(value);
        }
      } catch (e) {
        // Keep raw string if parsing fails
      }

      await upstashRedis.set(key, parsedValue, upstashOpts);
      return 'OK';
    } catch (err) {
      logger.error(`Upstash set error for key ${key}:`, err);
      return null;
    }
  }

  public async del(key: string): Promise<number> {
    try {
      return await upstashRedis.del(key);
    } catch (err) {
      logger.error(`Upstash del error for key ${key}:`, err);
      return 0;
    }
  }

  public multi() {
    const pipeline = upstashRedis.pipeline();
    const wrapper = {
      zRemRangeByScore: (key: string, min: number, max: number) => {
        pipeline.zremrangebyscore(key, min, max);
        return wrapper;
      },
      zAdd: (key: string, member: { score: number; value: string }) => {
        pipeline.zadd(key, { score: member.score, member: member.value });
        return wrapper;
      },
      zCard: (key: string) => {
        pipeline.zcard(key);
        return wrapper;
      },
      expire: (key: string, seconds: number) => {
        pipeline.expire(key, seconds);
        return wrapper;
      },
      exec: async (): Promise<any[]> => {
        try {
          return await pipeline.exec();
        } catch (err) {
          logger.error('Upstash pipeline transaction exec failed:', err);
          throw err;
        }
      },
    };
    return wrapper;
  }
}

export const redisClient = new UpstashRedisAdaptor();
export default redisClient;
