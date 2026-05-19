import winston from 'winston';
import config from '@/config';
import { contextStore } from '@/lib/context';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Format that injects correlation requestId from AsyncLocalStorage context thread
const contextFormat = winston.format((info) => {
  const store = contextStore.getStore();
  if (store) {
    info.requestId = store.requestId;
  }
  return info;
});

// Custom console format for local development
const consoleFormat = printf(({ level, message, timestamp, stack, requestId, ...metadata }) => {
  const reqTag = requestId ? ` [${requestId}]` : '';
  let log = `${timestamp}${reqTag} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  if (Object.keys(metadata).length > 0) {
    log += ` | meta: ${JSON.stringify(metadata)}`;
  }
  return log;
});

const developmentFormats = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  contextFormat(),
  errors({ stack: true }),
  consoleFormat
);

const productionFormats = combine(
  timestamp(),
  contextFormat(),
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
  silent: !config.logging.enableLogger, // Dynamically mute the logger based on configuration
  exitOnError: false,
});

export default logger;
