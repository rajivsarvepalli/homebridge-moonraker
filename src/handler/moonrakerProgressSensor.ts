import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { clamp } from '../util/math';

// Use a lightbulb - 0% is to abort, turn off is to pause, and turn on is to resume
export class MoonrakerProgressService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    const service = accessory.getService(name)
          || accessory.addService(platform.Service.Battery, name, name);

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    service.getCharacteristic(this.Characteristic.BatteryLevel)
      .onGet(this.handleCurrentPrintProgressGet.bind(this))
      .onSet(this.handleCurrentPrintProgressGet.bind(this));

    // create handlers for required characteristics
    service.getCharacteristic(this.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    this.service = service;

    const humidityProgressName = name + ' Humidity Sensor';
    const humidityService = accessory.getService(humidityProgressName)
          || accessory.addService(platform.Service.Battery, humidityProgressName, humidityProgressName);

    // create handlers for required characteristics
    humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentPrintProgressGet.bind(this));
  }

  async handleNameGet() {
    return this.name;
  }

  /**
   * Handle requests to get the current value of the "Battery Level" characteristic
   */
  async handleCurrentPrintProgressGet() {
    this.context.log.debug('Triggered GET CurrentPrintProgress');

    // set this to a valid value for CurrentRelativeHumidity
    return this.context.device.getPrintProgress()
      .then(data => {
        const percent = data ? data * 100
          : 0;

        return clamp(percent, 0, 100);
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, 0));
  }

  /**
   * Handle requests to get the "status low battery" characteristic
   */
  handleStatusLowBatteryGet() {
    this.context.log.debug('Triggered GET StatusLowBattery: %s');

    return this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }
}