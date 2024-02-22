import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';

export class MoonrakerProgressService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    const service = accessory.getService(name)
          || accessory.addService(platform.Service.HumiditySensor, name, name);

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentPrintProgressGet.bind(this));

    this.service = service;
  }

  async handleNameGet() {
    return this.name;
  }

  /**
   * Handle requests to get the current value of the "Current Relative Humidity" characteristic
   */
  async handleCurrentPrintProgressGet() {
    this.context.log.debug('Triggered GET CurrentRelativeHumidity');

    // set this to a valid value for CurrentRelativeHumidity
    return this.context.device.getPrintProgress()
      .then(data => {
        return data ? data * 100
          : 0;
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, 0));
  }
}