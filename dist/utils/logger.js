"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = __importDefault(require("@/config"));
const { combine, timestamp, json, colorize, printf, errors } = winston_1.default.format;
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
const developmentFormats = combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), consoleFormat);
const productionFormats = combine(timestamp(), errors({ stack: true }), json());
exports.logger = winston_1.default.createLogger({
    level: config_1.default.env === 'production' ? 'info' : 'debug',
    format: config_1.default.env === 'production' ? productionFormats : developmentFormats,
    transports: [
        new winston_1.default.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
});
exports.default = exports.logger;
