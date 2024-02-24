import {
  Service,
} from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';

export abstract class MoonrakerPluginService {
  protected context: MoonrakerPluginServiceContext;
    public abstract service: Service | undefined;

    constructor(context: MoonrakerPluginServiceContext) {
      this.context = context;
    }

    protected serviceName(name: string): string {
      const { config } = this.context;

      // Optional prefix to prepend to all accessory names.
      const prefix = (config.name ?? '').trim();

      if (prefix.length > 0) {
        return `${prefix} ${name}`;
      } else {
        return name;
      }
    }
}