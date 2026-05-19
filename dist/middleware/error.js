"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("@/config"));
const logger_1 = __importDefault(require("@/utils/logger"));
const errors_1 = require("@/utils/errors");
const response_1 = __importDefault(require("@/utils/response"));
const errorHandler = (err, req, res, 
// Prefix with underscore to satisfy noUnusedParameters, but keep for Express error middleware signature match
_next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let errors = [];
    // Log error
    logger_1.default.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });
    // Handle custom ApiError
    if (err instanceof errors_1.ApiError) {
        statusCode = err.statusCode;
        message = err.message;
        errors = err.errors;
    }
    // Handle Zod Validation Error
    else if (err instanceof zod_1.z.ZodError) {
        statusCode = 400;
        message = 'Validation Error';
        errors = err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
    }
    // Handle Prisma Database Errors
    else if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': {
                statusCode = 409;
                const target = err.meta?.target || [];
                message = `Conflict: Field '${target.join(', ')}' already exists.`;
                break;
            }
            case 'P2025': {
                statusCode = 404;
                message = err.meta?.cause || 'Record not found.';
                break;
            }
            default: {
                statusCode = 400;
                message = `Database Error: ${err.message}`;
                break;
            }
        }
    }
    // Hide stack trace in production for safety
    const responseData = {};
    if (config_1.default.env === 'development') {
        responseData.stack = err.stack;
    }
    response_1.default.error(res, statusCode, message, errors.length > 0 ? errors : (Object.keys(responseData).length > 0 ? [responseData] : undefined));
};
exports.errorHandler = errorHandler;
exports.default = exports.errorHandler;
