"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = __importDefault(require("@/config"));
const context_1 = require("@/lib/context");
const { combine, timestamp, json, colorize, printf, errors } = winston_1.default.format;
// Format that injects correlation requestId from AsyncLocalStorage context thread
const contextFormat = winston_1.default.format((info) => {
    const store = context_1.contextStore.getStore();
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
const developmentFormats = combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), contextFormat(), errors({ stack: true }), consoleFormat);
const productionFormats = combine(timestamp(), contextFormat(), errors({ stack: true }), json());
exports.logger = winston_1.default.createLogger({
    level: config_1.default.env === 'production' ? 'info' : 'debug',
    format: config_1.default.env === 'production' ? productionFormats : developmentFormats,
    transports: [
        new winston_1.default.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    silent: !config_1.default.logging.enableLogger, // Dynamically mute the logger based on configuration
    exitOnError: false,
});
exports.default = exports.logger;
