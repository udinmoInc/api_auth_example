"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = __importDefault(require("@/utils/logger"));
const requestLogger = (req, res, next) => {
    const start = Date.now();
    // Attach execution tracker to finish event
    res.on('finish', () => {
        const duration = Date.now() - start;
        const { method, originalUrl, ip } = req;
        const { statusCode } = res;
        const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms | IP: ${ip}`;
        if (statusCode >= 500) {
            logger_1.default.error(logMessage);
        }
        else if (statusCode >= 400) {
            logger_1.default.warn(logMessage);
        }
        else {
            logger_1.default.info(logMessage);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
exports.default = exports.requestLogger;
