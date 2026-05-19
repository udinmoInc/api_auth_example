import { TokenPayload, DeviceMetadata } from '@/modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      deviceMetadata?: DeviceMetadata;
    }
  }
}
