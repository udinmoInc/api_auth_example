"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = void 0;
const logger_1 = __importDefault(require("@/utils/logger"));
class PluginRegistry {
    plugins = [];
    /**
     * Register a custom app extension/plugin
     */
    register(plugin) {
        this.plugins.push(plugin);
        logger_1.default.info(`🔌 Extension Registered: [${plugin.name}]`);
    }
    /**
     * Execute the initialization scripts for all registered modules
     */
    async initializeAll(app) {
        for (const plugin of this.plugins) {
            try {
                if (plugin.init) {
                    await plugin.init(app);
                    logger_1.default.info(`✨ Extension Initialized: [${plugin.name}]`);
                }
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to initialize extension [${plugin.name}]:`, error);
            }
        }
    }
    getPlugins() {
        return [...this.plugins];
    }
}
exports.pluginRegistry = new PluginRegistry();
exports.default = exports.pluginRegistry;
