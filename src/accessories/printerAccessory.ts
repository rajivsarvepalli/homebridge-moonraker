import { Logger, PlatformAccessory } from 'homebridge';
import { MoonrakerClient } from 'moonraker-client';
import { PrinterConfig } from '../model/config/printerConfig';
import { Feature } from '../model/config/config';
import { MoonrakerThermostatService, ThermostatType } from '../handler/moonrakerThermostatService';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from '../handler/moonrakerPluginService';
import { HomebridgeMoonrakerPlatform } from '../platform';

export class MoonrakerPrinterAccessory {
  services: MoonrakerPluginService[] = [];

  constructor(
    private readonly platform: HomebridgeMoonrakerPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly log: Logger,
    private readonly config: PrinterConfig,
    private readonly features: Feature[],
    private readonly device: MoonrakerClient) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Unknown-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Unknown-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Unknown-Serial');

    this.log = log;
    this.features = features;

    const context: MoonrakerPluginServiceContext = {
      log: this.log,
      accessory: accessory,
      config: this.config,
      features: this.features,
      device: this.device,
      platform: platform,
    };

    if (this.hasFeature(Feature.BedThermostat)) {
      this.services.push(new MoonrakerThermostatService(ThermostatType.BedHeater, Feature.BedThermostat, context));
    }

    if (this.hasFeature(Feature.ExtruderThermostat)) {
      this.services.push(new MoonrakerThermostatService(ThermostatType.Extruder, Feature.ExtruderThermostat, context));
    }
  }

  private hasFeature(feature: Feature) {
    return this.features.includes(feature);
  }
}