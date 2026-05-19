import { Response } from 'express';

export interface ApiResponsePayload<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  errors?: any[];
  timestamp: string;
}

export class ApiResponse {
  static success<T>(res: Response, statusCode = 200, message = 'Success', data?: T): Response {
    const payload: ApiResponsePayload<T> = {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(payload);
  }

  static error(res: Response, statusCode = 500, message = 'Internal Server Error', errors?: any[]): Response {
    const payload: ApiResponsePayload = {
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
