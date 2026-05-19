"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogsPlugin = void 0;
const plugins_1 = require("@/lib/plugins");
const events_1 = require("@/lib/events");
const logger_1 = __importDefault(require("@/utils/logger"));
// Concrete, production-ready audit logging extension
exports.auditLogsPlugin = {
    name: 'AuditLogsExtension',
    init: (app) => {
        // 1. Audit Signups
        events_1.authEvents.on('signup', (user) => {
            logger_1.default.info(`📝 [AUDIT] User Registered: ${user.email} (UID: ${user.userId})`);
        });
        // 2. Audit Logins
        events_1.authEvents.on('login', (data) => {
            logger_1.default.info(`🔐 [AUDIT] Successful Sign-In: ${data.email} from IP: ${data.ipAddress || 'Unknown'} (Device: ${data.device || 'Unknown'})`);
        });
        // 3. Audit Logouts
        events_1.authEvents.on('logout', (session) => {
            logger_1.default.info(`🛑 [AUDIT] Session Logged Out: User ID ${session.userId} terminated Session ID ${session.sessionId}`);
        });
        // 4. Audit Password Changes
        events_1.authEvents.on('passwordReset', (data) => {
            logger_1.default.info(`🔑 [AUDIT] Password Reset Successful for User ID: ${data.userId}`);
        });
        // 5. Audit Session Revocation
        events_1.authEvents.on('sessionRevoked', (data) => {
            logger_1.default.info(`⚠️ [AUDIT] Remote Session Revoked: User ID ${data.userId} closed Session ID ${data.sessionId}`);
        });
        // Register a mock dashboard route to demonstrate dynamic routing extensions
        app.get('/api/v1/plugins/audit-logs/health', (_req, res) => {
            res.status(200).json({
                status: 'active',
                listeners: {
                    signup: events_1.authEvents.listenerCount('signup'),
                    login: events_1.authEvents.listenerCount('login'),
                    logout: events_1.authEvents.listenerCount('logout'),
                    passwordReset: events_1.authEvents.listenerCount('passwordReset'),
                    sessionRevoked: events_1.authEvents.listenerCount('sessionRevoked'),
                },
            });
        });
    },
};
// Register plugin dynamically with core registry
plugins_1.pluginRegistry.register(exports.auditLogsPlugin);
exports.default = exports.auditLogsPlugin;
