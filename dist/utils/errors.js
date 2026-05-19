"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    errors;
    isOperational;
    constructor(statusCode, message, errors = [], isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.ApiError = ApiError;
class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', errors = []) {
        super(400, message, errors);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(403, message);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ApiError {
    constructor(message = 'Resource Not Found') {
        super(404, message);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ApiError {
    constructor(message = 'Conflict') {
        super(409, message);
    }
}
exports.ConflictError = ConflictError;
class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error') {
        super(500, message, [], false);
    }
}
exports.InternalServerError = InternalServerError;
// Correcting the HTTP status codes:
// Unauthorized: 401
// Forbidden: 403
class AppError extends ApiError {
    static badRequest(msg, errs = []) {
        return new ApiError(400, msg, errs);
    }
    static unauthorized(msg = 'Unauthorized') {
        return new ApiError(401, msg);
    }
    static forbidden(msg = 'Forbidden') {
        return new ApiError(403, msg);
    }
    static notFound(msg = 'Not Found') {
        return new ApiError(404, msg);
    }
    static conflict(msg = 'Conflict') {
        return new ApiError(409, msg);
    }
    static internal(msg = 'Internal Server Error') {
        return new ApiError(500, msg, [], false);
    }
}
exports.AppError = AppError;
