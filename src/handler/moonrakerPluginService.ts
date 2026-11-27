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
}
