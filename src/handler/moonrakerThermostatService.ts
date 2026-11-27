import { Characteristic, Service } from 'homebridge';
import type { CharacteristicValue } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { getPrinterObjectStatus, PrinterObjectNotification } from '../model/printerObjectNotification';

interface ThermostatState {
    targetTemperature: number;
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

  private heatingMode: number;
  private lastRequestedTemperature = 0;
  private readonly printerObjectName: string;
  private readonly maxTemperature: number;

  constructor(type: ThermostatType, private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { device, accessory, platform } = context;

    this.Characteristic = platform.Characteristic;
    this.state = {
      targetTemperature: 0,
    };
    this.heatingMode = this.Characteristic.CurrentHeatingCoolingState.OFF;
    this.type = type;
    this.printerObjectName = type === ThermostatType.Extruder ? 'extruder' : 'heater_bed';
    this.maxTemperature = type === ThermostatType.BedHeater
      ? context.config.maxBedHeaterTemp
      : context.config.maxExtruderHeaterTemp;

    const stepSize: number = this.type === ThermostatType.BedHeater ? 5 : 10;

    // Subscribe to both the target and the measured temperature so HomeKit is
    // updated in real time rather than only on a poll.
    device.subscribeToPrinterObjectStatusWithListener(
      {
        [this.printerObjectName]: ['target', 'temperature'],
      }, this.handlePrinterObjectUpdate.bind(this),
    );

    const service = accessory.getService(name)
      || accessory.addService(platform.Service.Thermostat, name, name);

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .setProps({
        minValue: 0,
        maxValue: this.maxTemperature,
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
        minValue: 0,
        maxValue: this.maxTemperature,
        minStep: stepSize,
      })
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this));

    // HomeKit temperature characteristics are always expressed in Celsius.
    // HomeKit itself converts the value for display based on the user's locale,
    // so this characteristic is reported as CELSIUS and should not be used to
    // alter the values above.
    service.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this));

    this.service = service;

    // Seed HomeKit with known values so the accessory renders correctly even
    // before the first websocket notification arrives.
    this.updateThermostatCharacteristics();
  }

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  async handleCurrentHeatingCoolingStateGet(): Promise<CharacteristicValue> {
    const targetTemperature = await this.getTargetTemperatureCelsius();

    return this.getHeatingCoolingState(targetTemperature);
  }

  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateGet(): Promise<CharacteristicValue> {
    const targetTemperature = await this.getTargetTemperatureCelsius();
    this.heatingMode = this.getHeatingCoolingState(targetTemperature);

    return this.heatingMode;
  }

  async handleNameGet() {
    return this.name;
  }

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
  async handleTargetHeatingCoolingStateSet(value: CharacteristicValue) {
    this.context.log.debug('Triggered SET TargetHeatingCoolingState:', value);

    if (value === this.Characteristic.CurrentHeatingCoolingState.OFF) {
      this.heatingMode = this.Characteristic.CurrentHeatingCoolingState.OFF;
      this.state.targetTemperature = 0;
      await this.applyHeaterTarget(0);
      this.updateThermostatCharacteristics();

      return this.Characteristic.CurrentHeatingCoolingState.OFF;
    }

    if (value === this.Characteristic.CurrentHeatingCoolingState.HEAT) {
      this.heatingMode = this.Characteristic.CurrentHeatingCoolingState.HEAT;
      // Restore the most recent non-zero target, if there is one. Turning the
      // heater off zeroes the visible target, but the desired temperature should
      // not be lost for the next time heating is enabled.
      if (this.lastRequestedTemperature > 0) {
        this.state.targetTemperature = this.lastRequestedTemperature;
        await this.applyHeaterTarget(this.lastRequestedTemperature);
      }
      this.updateThermostatCharacteristics();

      return this.Characteristic.CurrentHeatingCoolingState.HEAT;
    }

    this.context.log.warn('Unsupported value for TargetHeatingCoolingState: %s', value);

    return this.heatingMode;
  }

  async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
    this.context.log.debug('Triggered GET CurrentTemperature');

    const data = await this.context.device.getOctoprintPrinterData()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));

    const actualTemperature = this.type === ThermostatType.BedHeater
      ? data?.temperature?.bed?.actual
      : data?.temperature?.tool0?.actual;

    return actualTemperature ?? 0;
  }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  async handleTargetTemperatureGet(): Promise<CharacteristicValue> {
    return this.getTargetTemperatureCelsius();
  }

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
  async handleTargetTemperatureSet(value: CharacteristicValue) {
    const celsius = Number(value);

    this.state.targetTemperature = celsius;
    if (celsius > 0) {
      this.lastRequestedTemperature = celsius;
    }
    this.heatingMode = this.getHeatingCoolingState(celsius);

    await this.applyHeaterTarget(celsius);
    this.updateThermostatCharacteristics();

    return celsius;
  }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet() {
    this.context.log.debug('Triggered GET TemperatureDisplayUnits');

    return this.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  private handlePrinterObjectUpdate(event: PrinterObjectNotification) {
    this.context.log.debug('Handle printer object update event: %O', event);

    const printerObject = getPrinterObjectStatus(event)?.[this.printerObjectName];
    if (!printerObject) {
      return;
    }

    if (typeof printerObject.target === 'number') {
      this.state.targetTemperature = printerObject.target;
      if (printerObject.target > 0) {
        this.lastRequestedTemperature = printerObject.target;
      }
      this.heatingMode = this.getHeatingCoolingState(printerObject.target);

      this.service.updateCharacteristic(
        this.Characteristic.TargetHeatingCoolingState, this.heatingMode);
      this.service.updateCharacteristic(
        this.Characteristic.TargetTemperature, printerObject.target);
      this.service.updateCharacteristic(
        this.Characteristic.CurrentHeatingCoolingState, this.getHeatingCoolingState(printerObject.target));
    }

    if (typeof printerObject.temperature === 'number') {
      this.service.updateCharacteristic(
        this.Characteristic.CurrentTemperature, printerObject.temperature);
    }
  }

  private async getTargetTemperatureCelsius(): Promise<number> {
    const data = await this.context.device.getOctoprintPrinterData()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));

    const targetTemperature = this.type === ThermostatType.BedHeater
      ? data?.temperature?.bed?.target
      : data?.temperature?.tool0?.target;

    if (targetTemperature === undefined) {
      return this.state.targetTemperature;
    }

    this.state.targetTemperature = targetTemperature;
    if (targetTemperature > 0) {
      this.lastRequestedTemperature = targetTemperature;
    }

    return targetTemperature;
  }

  private async applyHeaterTarget(celsius: number): Promise<void> {
    const request = this.type === ThermostatType.BedHeater
      ? this.context.device.setBedTemperature(celsius)
      : this.context.device.setExtruderTemperature(celsius);

    await request.catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
  }

  private updateThermostatCharacteristics() {
    this.service.updateCharacteristic(
      this.Characteristic.TargetTemperature, this.state.targetTemperature);
    this.service.updateCharacteristic(
      this.Characteristic.CurrentHeatingCoolingState, this.getHeatingCoolingState(this.state.targetTemperature));
    this.service.updateCharacteristic(
      this.Characteristic.TargetHeatingCoolingState, this.heatingMode);
  }

  private getHeatingCoolingState(targetTemperature: number): number {
    return targetTemperature > 0
      ? this.Characteristic.CurrentHeatingCoolingState.HEAT
      : this.Characteristic.CurrentHeatingCoolingState.OFF;
  }
}
