import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
}

// Global AsyncLocalStorage context thread pool for requests tracing
export const contextStore = new AsyncLocalStorage<RequestStore>();

export default contextStore;
