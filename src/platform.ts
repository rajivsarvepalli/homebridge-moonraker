import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HomebridgeMoonrakerConfig } from './model/config/config';
import { MoonrakerPrinterAccessory } from './accessories/printerAccessory';
import { MoonrakerClient } from 'moonraker-client';
import { verifyDeviceConnection } from './util/verifyDevice';
import { isUniquePrinterNames } from './validator/validateConfig';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMoonrakerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  private homebridgeMoonrakerConfig: HomebridgeMoonrakerConfig;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.homebridgeMoonrakerConfig = config as any;

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  private async discoverDevices() {

    const printers = this.config.printers;
    // loop over the discovered devices and register each one if it has not already been registered

    if (!isUniquePrinterNames(printers)) {
      const printerNames = printers.map(printerConfig => {
        return printerConfig.name;
      });
      this.log.error('Printer names are not unique in provided input see names: %O.\n' +
      ' This plugin will not add any printers until the config is corrected', printerNames);
      return;
    }

    for (const printer of printers) {

      const device = new MoonrakerClient({
        moonrakerUrl: printer.moonrakerUrl,
        httpTimeout: 5000,
      });
      const isPrinterUp = await verifyDeviceConnection(this.log, device);

      if(isPrinterUp) {
        this.log.info('Succesfully connected to printer with url: %s', device.config.moonrakerUrl);

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(printer.name);

        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache: %s', existingAccessory.displayName);
          new MoonrakerPrinterAccessory(this, existingAccessory, this.log, printer, this.homebridgeMoonrakerConfig.features, device);
        } else {
          // register the accessory
          this.log.info('Adding new accessory: %s', printer.name);
          const accessory = new this.api.platformAccessory(printer.name, uuid);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

          new MoonrakerPrinterAccessory(this, accessory, this.log, printer, this.homebridgeMoonrakerConfig.features, device);
        }
      } else {
        this.log.error('Failed to connect to printer with url: %s; skipped registering this printer', device.config.moonrakerUrl);
      }
    }
  }
}
