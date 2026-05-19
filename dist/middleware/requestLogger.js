"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const uuid_1 = require("uuid");
const context_1 = require("@/lib/context");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const onFinish = () => {
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
    };
    // Perform context wrapping and Correlation ID assignment only if telemetry tracing is active
    if (config_1.default.logging.enableTracing) {
        const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
        res.setHeader('X-Request-Id', requestId);
        context_1.contextStore.run({ requestId }, () => {
            res.on('finish', onFinish);
            next();
        });
    }
    else {
        res.on('finish', onFinish);
        next();
    }
};
exports.requestLogger = requestLogger;
exports.default = exports.requestLogger;
