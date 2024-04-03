import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { clamp } from '../util/math';

export class MoonrakerTemperatureService extends MoonrakerPluginService {
  public service: Service | undefined;
  Characteristic: typeof Characteristic;

  constructor(context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform } = context;
    this.Characteristic = platform.Characteristic;

    for (const {name, minTemp, maxTemp, moonrakerName} of context.config.temperatureSensors) {
      const service = accessory.getService(name)
      || accessory.addService(platform.Service.TemperatureSensor, name, name);

      service.getCharacteristic(this.Characteristic.Name)
        .onGet(this.handleNameGet.bind(this, name));

      service.getCharacteristic(this.Characteristic.CurrentTemperature)
        .setProps({
          minValue: minTemp,
          maxValue: maxTemp,
        })
        .onGet(this.handleCurrentTemperatureGet.bind(this, moonrakerName, minTemp, maxTemp));
    }

    this.service = undefined;
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(sensorName: string, minTemp: number, maxTemp: number) {
    this.context.log.debug('Triggered GET CurrentTemperature');


    return clamp(this.context.device.getTemperatureForSensor(sensorName)
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
        0)), minTemp, maxTemp);
  }

  async handleNameGet(sensorName) {
    return sensorName;
  }
}