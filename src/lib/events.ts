import { EventEmitter } from 'events';
import logger from '@/utils/logger';

// Standard event emitter that catches handler exceptions to avoid breaking request cycle
class SafeEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  override emit(event: string | symbol, ...args: any[]): boolean {
    process.nextTick(() => {
      try {
        super.emit(event, ...args);
      } catch (error) {
        logger.error(`[EventBus] Handler crashed for "${String(event)}":`, error);
      }
    });
    return true;
  }
}

export const authEvents = new SafeEventEmitter();

export interface AuthEventsMap {
  signup: (payload: { userId: string; email: string; firstName?: string; lastName?: string }) => void;
  login: (payload: { userId: string; email: string; ipAddress?: string; device?: string }) => void;
  logout: (payload: { userId: string; sessionId: string }) => void;
  passwordReset: (payload: { userId: string }) => void;
  sessionRevoked: (payload: { userId: string; sessionId: string }) => void;
}

export default authEvents;
