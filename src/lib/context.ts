import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
}

// Request-scoped tracing context across asynchronous chains
export const contextStore = new AsyncLocalStorage<RequestStore>();

export default contextStore;
