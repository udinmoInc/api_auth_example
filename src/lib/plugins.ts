import { Express } from 'express';
import logger from '@/utils/logger';

export interface AppPlugin {
  name: string;
  init?: (app: Express) => void | Promise<void>;
}

// Global registry for initializing extensions on server boot
class PluginRegistry {
  private plugins: AppPlugin[] = [];

  public register(plugin: AppPlugin): void {
    this.plugins.push(plugin);
    logger.info(`Extension registered: ${plugin.name}`);
  }

  public async initializeAll(app: Express): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        if (plugin.init) {
          await plugin.init(app);
          logger.info(`Extension initialized: ${plugin.name}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize extension "${plugin.name}":`, error);
      }
    }
  }

  public getPlugins(): AppPlugin[] {
    return [...this.plugins];
  }
}

export const pluginRegistry = new PluginRegistry();
export default pluginRegistry;
