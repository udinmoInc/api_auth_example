"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    static success(res, statusCode = 200, message = 'Success', data) {
        const payload = {
            success: true,
            statusCode,
            message,
            data,
            timestamp: new Date().toISOString(),
        };
        return res.status(statusCode).json(payload);
    }
    static error(res, statusCode = 500, message = 'Internal Server Error', errors) {
        const payload = {
            success: false,
            statusCode,
            message,
            errors,
            timestamp: new Date().toISOString(),
        };
        return res.status(statusCode).json(payload);
    }
}
exports.ApiResponse = ApiResponse;
exports.default = ApiResponse;
