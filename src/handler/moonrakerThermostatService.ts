import { Characteristic, Formats, Perms, Service, Units } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import type { CharacteristicValue } from 'homebridge';
import { handleError } from '../util/exceptionHandler';

interface ThermostatState {
    targetTemperature: number;
    displayUnits: number;
}

export enum ThermostatType {
    BedHeater,
    Extruder,
}

export class MoonrakerThermostatService extends MoonrakerPluginService {
  public service: Service;
  protected state: ThermostatState;
  Characteristic: typeof Characteristic;
  type: ThermostatType;

  constructor(type: ThermostatType, name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { device, accessory, platform } = context;

    this.Characteristic = platform.Characteristic;
    this.state = {
      targetTemperature: 0,
      displayUnits:  this.Characteristic.TemperatureDisplayUnits.CELSIUS,
    };
    this.type = type;


    const service = accessory.getService(name)
        || accessory.addService(platform.Service.Thermostat, name, name);

    // Use custom target and currrent temperature characteristics due to the min and max limitations on the default characteristics
    const maxValue: number = this.type === ThermostatType.BedHeater ? 150 : 400;
    const targetTemperature = new platform.Characteristic('Target Temperature', '00000035-0000-1000-8000-0026BB765291', {
      format: Formats.FLOAT,
      perms: [Perms.NOTIFY, Perms.PAIRED_READ, Perms.PAIRED_WRITE],
      unit: Units.CELSIUS,
      minValue: 0,
      maxValue: maxValue,
      minStep: 0.1,
    });

    const currentTemperature = new platform.Characteristic('Current Temperature', '00000011-0000-1000-8000-0026BB765291', {
      format: Formats.FLOAT,
      perms: [Perms.NOTIFY, Perms.PAIRED_READ],
      unit: Units.CELSIUS,
      minValue: 0,
      maxValue: maxValue,
      minStep: 0.1,
    });
    service.getCharacteristic('Target Temperature') || service.addCharacteristic(targetTemperature);
    service.getCharacteristic('Current Temperature') || service.addCharacteristic(currentTemperature);

    if(this.type === ThermostatType.Extruder) {
      device.subscribeToPrinterObjectStatusWithListener(
        {
          extruder: ['target'],
        }, this.handleUpdateTargetTemperature,
      );
    } else {
      device.subscribeToPrinterObjectStatusWithListener(
        {
          heater_bed: ['target'],
        }, this.handleUpdateTargetTemperature,
      );
    }

    service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

    service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    service
      .getCharacteristic('Target Temperature')!
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this));

    service.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    this.service = service;
  }

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  async handleCurrentHeatingCoolingStateGet() {
    return this.isHeaterOn();
  }

  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateGet() {
    return this.isHeaterOn();
  }

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateSet(value) {
    this.context.log.debug('Triggered SET TargetHeatingCoolingState:', value);

    switch(value) {
      case this.Characteristic.CurrentHeatingCoolingState.OFF: {
        if(this.type === ThermostatType.Extruder) {
          return this.context.device.setExtruderTemperature(0)
            .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined))
            .then(() => this.Characteristic.CurrentHeatingCoolingState.OFF);
        }

        return this.context.device.setBedTemperature(0)
          .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined))
          .then(() => this.Characteristic.CurrentHeatingCoolingState.OFF);
      }

      case this.Characteristic.CurrentHeatingCoolingState.HEAT: {
        return this.Characteristic.CurrentHeatingCoolingState.HEAT;
      }

      default: {
        return;
      }
    }
  }

  async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
    this.context.log.debug('Triggered GET CurrentTemperature');

    const data = await this.context.device.getOctoprintPrinterData()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
    let heaterTemp = data?.temperature?.tool0.actual;
    if (this.type === ThermostatType.BedHeater) {
      heaterTemp = data?.temperature?.bed.actual;
    }

    if (heaterTemp && this.isFahrenheit()) {
      heaterTemp = this.celsiusToFahrenheit(heaterTemp);
    }

    return heaterTemp ?? 0;
  }

  private async isHeaterOn(): Promise<CharacteristicValue> {
    const currentValue = this.context.device.getOctoprintPrinterData()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined))
      .then(data => {

        let heaterTemp = data?.temperature?.tool0.target;

        if (this.type === ThermostatType.BedHeater) {
          heaterTemp = data?.temperature?.bed.target;
        }

        const isHeaterOn = heaterTemp ?? 0 > 0;

        return isHeaterOn ? this.Characteristic.CurrentHeatingCoolingState.HEAT
          : this.Characteristic.CurrentHeatingCoolingState.OFF;
      });

    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  async handleTargetTemperatureGet() {
    let temp = this.state.targetTemperature;

    if (this.isFahrenheit()) {
      temp = this.celsiusToFahrenheit(temp);
    }

    return temp;
  }

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
  async handleTargetTemperatureSet(value) {
    if(this.isFahrenheit()) {
      value = this.fahrenheitToCelsius(value);
    }

    if( this.type === ThermostatType.BedHeater) {
      await this.context.device.setBedTemperature(value)
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
    } else {
      await this.context.device.setExtruderTemperature(value)
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
    }
  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet() {
    this.context.log.debug('Triggered GET TemperatureDisplayUnits');

    return this.state.displayUnits;
  }

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsSet(value) {
    this.context.log.debug('Triggered SET TemperatureDisplayUnits:', value);

    this.state.displayUnits = value;
  }

  handleUpdateTargetTemperature(event) {
    this.context.log.debug('Handle target temperature update event:', event);
    if (this.type === ThermostatType.Extruder) {
      this.state.targetTemperature = event.objectNotification?.extruder?.target ?? 0;

    } else {
      this.state.targetTemperature = event.objectNotification?.heater_bed?.target ?? 0;
    }
  }

  private fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5/9;
  }

  private celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
  }

  private isFahrenheit() {
    return this.state.displayUnits === this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
  }
}