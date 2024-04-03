import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { clamp } from '../util/math';

export class MoonrakerPrintControlsService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    const service = accessory.getService(name)
          || accessory.addService(platform.Service.Lightbulb, name, name);

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));
    service.getCharacteristic(this.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    service.getCharacteristic(this.Characteristic.Brightness)
      .onGet(this.handleBrightnessGet.bind(this))
      .onSet(this.handleBrightnessSet.bind(this));

    this.service = service;
  }

  async handleNameGet() {
    return this.name;
  }

  handleBrightnessGet() {
    return this.context.device.getPrintProgress()
      .then(data => {
        return clamp(data ? data * 100
          : 0, 0, 100);
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, 0));
  }

  handleBrightnessSet(value) {
    if(value === 100) {
      this.context.device.cancelPrint()
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
          undefined));
      return;
    }
  }

  /**
   * Handle requests to get the current value of the "Current Media State" characteristic
   */
  async handleOnGet() {
    this.context.log.debug('Triggered GET CurrentMediaState');

    return this.getCurrentMediaState();
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  handleOnSet(value) {
    this.context.log.debug('Triggered SET On: %s', value);

    if (value) {
      this.context.device.resumePrint()
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
          undefined));
      return;
    } else {
      this.context.device.pausePrint()
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
          undefined));
      return;
    }
  }

  private getCurrentMediaState() {
    this.context.log.debug('Triggered GET CurrentMediaState');

    // set this to a valid value for CurrentMediaState
    const currentMediaState = this.context.device.httpRequest({
      method: 'get',
      url: '/printer/objects/query',
      params: {
        print_stats: '',
      },
    })
      .then(response => {
        const moonrakerState = response?.data?.result?.status?.print_stats?.state;
        return this.mapMoonrakerStateToCurrentMediaState(moonrakerState);
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
        false));

    return currentMediaState;
  }



  private mapMoonrakerStateToCurrentMediaState(moonrakerState: string | undefined) {
    switch(moonrakerState) {
      case 'printing': {
        return true;
      }
      default: {
        return false;
      }
    }
  }
}
