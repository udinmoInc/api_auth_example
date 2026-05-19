import { Express } from 'express';
import logger from '@/utils/logger';

export interface AppPlugin {
  name: string;
  init?: (app: Express) => void | Promise<void>;
}

class PluginRegistry {
  private plugins: AppPlugin[] = [];

  public register(plugin: AppPlugin) {
    this.plugins.push(plugin);
    logger.info(`🔌 Extension Registered: [${plugin.name}]`);
  }

  public async initializeAll(app: Express) {
    for (const plugin of this.plugins) {
      try {
        if (plugin.init) {
          await plugin.init(app);
          logger.info(`✨ Extension Initialized: [${plugin.name}]`);
        }
      } catch (error) {
        logger.error(`❌ Failed to initialize extension [${plugin.name}]:`, error);
      }
    }
  }

  public getPlugins(): AppPlugin[] {
    return [...this.plugins];
  }
}

export const pluginRegistry = new PluginRegistry();
export default pluginRegistry;
