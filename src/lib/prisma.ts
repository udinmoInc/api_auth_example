import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import config from '@/config';
import logger from '@/utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// node-pg connection pooling driver setup
const connectionString = config.db.url;
const pool = new Pool({
  connectionString,
  max: config.env === 'production' ? 20 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500, // Prevent socket leakage by recycling connections
});
const adapter = new PrismaPg(pool);

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    log:
      config.env === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

if (config.env === 'development') {
  global.prisma = prisma;
  
  // Latency metrics logging in development
  (prisma as any).$on('query', (e: any) => {
    logger.debug(`Prisma Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
  });
}

export default prisma;
