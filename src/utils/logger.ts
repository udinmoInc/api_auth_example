import winston from 'winston';
import config from '@/config';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Custom console format for local development
const consoleFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  if (Object.keys(metadata).length > 0 && level.indexOf('error') === -1) {
    log += ` | meta: ${JSON.stringify(metadata)}`;
  }
  return log;
});

const developmentFormats = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  consoleFormat
);

const productionFormats = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: config.env === 'production' ? productionFormats : developmentFormats,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

export default logger;
