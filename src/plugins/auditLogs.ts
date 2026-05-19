import { Express } from 'express';
import { pluginRegistry, AppPlugin } from '@/lib/plugins';
import { authEvents } from '@/lib/events';
import logger from '@/utils/logger';

// Concrete, production-ready audit logging extension
export const auditLogsPlugin: AppPlugin = {
  name: 'AuditLogsExtension',
  init: (app: Express) => {
    // 1. Audit Signups
    authEvents.on('signup', (user) => {
      logger.info(`📝 [AUDIT] User Registered: ${user.email} (UID: ${user.userId})`);
    });

    // 2. Audit Logins
    authEvents.on('login', (data) => {
      logger.info(`🔐 [AUDIT] Successful Sign-In: ${data.email} from IP: ${data.ipAddress || 'Unknown'} (Device: ${data.device || 'Unknown'})`);
    });

    // 3. Audit Logouts
    authEvents.on('logout', (session) => {
      logger.info(`🛑 [AUDIT] Session Logged Out: User ID ${session.userId} terminated Session ID ${session.sessionId}`);
    });

    // 4. Audit Password Changes
    authEvents.on('passwordReset', (data) => {
      logger.info(`🔑 [AUDIT] Password Reset Successful for User ID: ${data.userId}`);
    });

    // 5. Audit Session Revocation
    authEvents.on('sessionRevoked', (data) => {
      logger.info(`⚠️ [AUDIT] Remote Session Revoked: User ID ${data.userId} closed Session ID ${data.sessionId}`);
    });

    // Register a mock dashboard route to demonstrate dynamic routing extensions
    app.get('/api/v1/plugins/audit-logs/health', (_req, res) => {
      res.status(200).json({
        status: 'active',
        listeners: {
          signup: authEvents.listenerCount('signup'),
          login: authEvents.listenerCount('login'),
          logout: authEvents.listenerCount('logout'),
          passwordReset: authEvents.listenerCount('passwordReset'),
          sessionRevoked: authEvents.listenerCount('sessionRevoked'),
        },
      });
    });
  },
};

// Register plugin dynamically with core registry
pluginRegistry.register(auditLogsPlugin);
export default auditLogsPlugin;
