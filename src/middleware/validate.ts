import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import asyncHandler from '@/utils/asyncHandler';

export interface ValidationSchema {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export const validate = (schema: ValidationSchema) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (schema.body) {
      req.body = await schema.body.parseAsync(req.body);
    }
    if (schema.query) {
      req.query = (await schema.query.parseAsync(req.query)) as any;
    }
    if (schema.params) {
      req.params = (await schema.params.parseAsync(req.params)) as any;
    }
    next();
  });
};

export default validate;
