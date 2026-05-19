import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import redisClient from '@/lib/redis';
import config from '@/config';
import { REDIS_KEYS } from '@/constants';
import ApiResponse from '@/utils/response';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  prefix: string;
}

// In-memory fallback if Redis is unavailable
const memoryStore = new Map<string, number[]>();

const memoryRateLimit = (ip: string, windowMs: number, max: number): boolean => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!memoryStore.has(ip)) {
    memoryStore.set(ip, [now]);
    return true;
  }
  
  const timestamps = memoryStore.get(ip)!.filter((t) => t > windowStart);
  timestamps.push(now);
  memoryStore.set(ip, timestamps);
  
  return timestamps.length <= max;
};

// Periodic GC to prevent memory leaks from stale IP records
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of memoryStore.entries()) {
    const valid = timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (valid.length === 0) {
      memoryStore.delete(ip);
    } else {
      memoryStore.set(ip, valid);
    }
  }
}, 60000).unref();

const createRateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = forwardedFor
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
      : req.socket.remoteAddress || req.ip || '127.0.0.1';

    const { windowMs, max, message, prefix } = options;

    if (config.features.enableCache && redisClient.isOpen) {
      try {
        const key = `${REDIS_KEYS.RATE_LIMIT_PREFIX}${prefix}:${ip}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        const multi = redisClient.multi();
        multi.zRemRangeByScore(key, 0, windowStart);
        multi.zAdd(key, { score: now, value: `${now}:${crypto.randomUUID()}` });
        multi.zCard(key);
        multi.expire(key, Math.ceil(windowMs / 1000));

        const results = await multi.exec();
        const requestCount = results[2] as unknown as number;

        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', Math.max(0, max - requestCount));
        res.setHeader('RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

        if (requestCount > max) {
          ApiResponse.error(res, 429, message);
          return;
        }
        return next();
      } catch (error) {
        // Fallback to memory on Redis errors
      }
    }

    const allowed = memoryRateLimit(`${prefix}:${ip}`, windowMs, max);
    if (!allowed) {
      ApiResponse.error(res, 429, message);
      return;
    }
    next();
  };
};

export const apiRateLimiter = createRateLimiter({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP. Please try again later.',
  prefix: 'api',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  prefix: 'auth',
});
