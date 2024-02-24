import { Logger, PlatformAccessory } from 'homebridge';
import { MoonrakerClient } from 'moonraker-client';
import { PrinterConfig } from '../model/config/printerConfig';
import { Feature } from '../model/config/config';
import { MoonrakerThermostatService, ThermostatType } from '../handler/moonrakerThermostatService';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from '../handler/moonrakerPluginService';
import { HomebridgeMoonrakerPlatform } from '../platform';
import { MoonrakerProgressService } from '../handler/moonrakerProgressSensor';
import { MoonrakerPrintControlsService } from '../handler/moonrakerPrintControls';
import { MoonrakerNotificationService } from '../handler/moonrakerNotificationService';
import { MoonrakerTemperatureService } from '../handler/moonrakerTemperatureService';

export class MoonrakerPrinterAccessory {
  services: MoonrakerPluginService[] = [];

  constructor(
    private readonly platform: HomebridgeMoonrakerPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly log: Logger,
    private readonly config: PrinterConfig,
    private readonly features: Feature[],
    private readonly device: MoonrakerClient) {

    const accessoryInfoService = this.accessory.getService(this.platform.Service.AccessoryInformation)
    || this.accessory.addService(this.platform.Service.AccessoryInformation);

    accessoryInfoService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, config.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, config.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, config.serialNumber);

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

    if (this.hasFeature(Feature.PrintProgress)) {
      this.services.push(new MoonrakerProgressService(Feature.PrintProgress, context));
    }

    if (this.hasFeature(Feature.PrintingControls)) {
      this.services.push(new MoonrakerPrintControlsService(Feature.PrintingControls, context));
    }

    if (this.hasFeature(Feature.Notifications)) {
      this.services.push(new MoonrakerNotificationService(Feature.Notifications, context));
    }

    if (this.hasFeature(Feature.TemperatureSensors)) {
      this.services.push(new MoonrakerTemperatureService(context));
    }
  }

  private hasFeature(feature: Feature) {
    return this.features.includes(feature);
  }
}