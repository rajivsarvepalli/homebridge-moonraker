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

// https://github.com/phenotypic/homebridge-web-thermostat/blob/master/index.js

export class MoonrakerThermostatService extends MoonrakerPluginService {
  public service: Service;
  protected state: ThermostatState;
  Characteristic: typeof Characteristic;
  type: ThermostatType;

  constructor(type: ThermostatType, private readonly name: string, context: MoonrakerPluginServiceContext) {
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
    const minValue: number = this.type === ThermostatType.BedHeater ? 60 : 150;
    const stepSize: number = this.type === ThermostatType.BedHeater ? 5 : 10;
    const maxValue: number = this.type === ThermostatType.BedHeater ? 120 : 350;

    if(this.type === ThermostatType.Extruder) {
      device.subscribeToPrinterObjectStatusWithListener(
        {
          extruder: ['target'],
        }, this.handleUpdateTargetTemperature.bind(this),
      );
    } else {
      device.subscribeToPrinterObjectStatusWithListener(
        {
          heater_bed: ['target'],
        }, this.handleUpdateTargetTemperature.bind(this),
      );
    }

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .setProps({
        minValue: minValue,
        maxValue: maxValue,
      })
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentHeatingCoolingState)
      .setProps({
        validValues: [this.Characteristic.CurrentHeatingCoolingState.OFF,
          this.Characteristic.CurrentHeatingCoolingState.HEAT],
      })
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

    service.getCharacteristic(this.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [this.Characteristic.CurrentHeatingCoolingState.OFF,
          this.Characteristic.CurrentHeatingCoolingState.HEAT],
      })
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    service
      .getCharacteristic(this.Characteristic.TargetTemperature)
      .setProps({
        minValue: minValue,
        maxValue: maxValue,
        minStep: stepSize,
      })
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

  async handleNameGet() {
    return this.name;
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
            .then(() => this.Characteristic.CurrentHeatingCoolingState.OFF)
            .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
              this.Characteristic.CurrentHeatingCoolingState.OFF));
        }

        return this.context.device.setBedTemperature(0)
          .then(() => this.Characteristic.CurrentHeatingCoolingState.OFF)
          .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
            this.Characteristic.CurrentHeatingCoolingState.OFF));
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
      .then(data => {

        let heaterTemp = data?.temperature?.tool0.target;

        if (this.type === ThermostatType.BedHeater) {
          heaterTemp = data?.temperature?.bed.target;
        }

        const isHeaterOn = heaterTemp ?? 0 > 0;

        return isHeaterOn ? this.Characteristic.CurrentHeatingCoolingState.HEAT
          : this.Characteristic.CurrentHeatingCoolingState.OFF;
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
        this.Characteristic.CurrentHeatingCoolingState.OFF));

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