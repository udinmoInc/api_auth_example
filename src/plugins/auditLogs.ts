import { Express } from 'express';
import { pluginRegistry, AppPlugin } from '@/lib/plugins';
import { authEvents } from '@/lib/events';
import config from '@/config';
import { ROUTES } from '@/constants';
import logger from '@/utils/logger';

export const auditLogsPlugin: AppPlugin = {
  name: 'AuditLogsExtension',
  init: (app: Express) => {
    authEvents.on('signup', (user) => {
      logger.info(`[AUDIT] User registered: ${user.email} (UID: ${user.userId})`);
    });

    authEvents.on('login', (data) => {
      logger.info(`[AUDIT] Successful sign-in: ${data.email} from IP: ${data.ipAddress || 'Unknown'} (Device: ${data.device || 'Unknown'})`);
    });

    authEvents.on('logout', (session) => {
      logger.info(`[AUDIT] Session logged out: User ID ${session.userId} terminated Session ID ${session.sessionId}`);
    });

    authEvents.on('passwordReset', (data) => {
      logger.info(`[AUDIT] Password reset successful for User ID: ${data.userId}`);
    });

    authEvents.on('sessionRevoked', (data) => {
      logger.info(`[AUDIT] Remote session revoked: User ID ${data.userId} closed Session ID ${data.sessionId}`);
    });

    // Expose dynamic diagnostic endpoint
    app.get(`/api/${config.apiVersion}${ROUTES.PLUGINS}/audit-logs/health`, (_req, res) => {
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

if (config.features.enableAuditLogs) {
  pluginRegistry.register(auditLogsPlugin);
}

export default auditLogsPlugin;
