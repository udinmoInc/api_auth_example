import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from environment file
dotenv.config();

export const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().url(),
  
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'Access token secret must be at least 32 characters long'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Refresh token secret must be at least 32 characters long'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform((val) => parseInt(val, 10)),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string(),

  CORS_ORIGIN: z.string(),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z.string().default('100').transform((val) => parseInt(val, 10)),
  COOKIES_SECURE: z.string().default('false').transform((val) => val === 'true'),

  ENABLE_LOGGER: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_AUDIT_LOGS: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_TRACING: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_CACHE: z.string().default('true').transform((val) => val === 'true'),
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

export const env = parseEnv();
export default env;
