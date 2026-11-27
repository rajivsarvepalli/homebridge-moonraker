import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HomebridgeMoonrakerConfig, HomebridgeMoonrakerConfigSchema } from './model/config/config';
import { MoonrakerPrinterAccessory } from './accessories/printerAccessory';
import { MoonrakerClient } from 'moonraker-client';
import { verifyDeviceConnection } from './util/verifyDevice';
import { isUniquePrinterNames } from './validator/validateConfig';
import { ZodError } from 'zod';

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
  private readonly homebridgeMoonrakerConfig: HomebridgeMoonrakerConfig | undefined;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // only load if configured
    if (!config) {
      return;
    }

    try {
      this.homebridgeMoonrakerConfig = HomebridgeMoonrakerConfigSchema.parse(config);
    } catch (e) {
      if (e instanceof ZodError) {
        this.log.error(`Config is invalid. ${e.message}`);
      } else if (e instanceof Error) {
        this.log.error(`Unexpected error occured. See error message: ${e.message}`);
      } else {
        this.log.error(`Unexpected error occured. See error: ${JSON.stringify(e)}`);
      }

      this.log.debug('Config error occured. Error: %O', e);
      return;
    }

    this.log.debug('Finished initializing platform:', this.config.name);

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
   * Discover printers from the plugin config and register one accessory per printer.
   *
   * Accessories are registered even if a printer is not reachable at Homebridge startup.
   * Moonraker's websocket reconnects automatically, and every service tolerates failed
   * requests, so the accessory will start working as soon as the printer comes online.
   */
  private async discoverDevices() {
    try {
      const pluginConfig = this.homebridgeMoonrakerConfig;
      if (!pluginConfig) {
        return;
      }

      const { printers, features } = pluginConfig;

      if (!isUniquePrinterNames(printers)) {
        const printerNames = printers.map(printerConfig => {
          return printerConfig.name;
        });
        this.log.error('Printer names are not unique in provided input see names: %O.\n' +
        ' This plugin will not add any printers until the config is corrected', printerNames);
        return;
      }

      const configuredUuids = new Set<string>();

      for (const printer of printers) {
        const uuid = this.api.hap.uuid.generate(printer.name);
        configuredUuids.add(uuid);

        const device = new MoonrakerClient(
          {
            moonrakerUrl: printer.moonrakerUrl,
            httpTimeout: 5000,
          },
          {
            timeout: 5000,
          },
        );

        // Probe connectivity in the background so a temporarily offline printer
        // does not delay Homebridge startup. Accessories are registered
        // regardless and will recover once the printer comes online.
        verifyDeviceConnection(this.log, device)
          .then(isPrinterUp => {
            if (isPrinterUp) {
              this.log.info('Successfully connected to printer with url: %s', device.config.moonrakerUrl);
            } else {
              this.log.warn('Printer with url: %s is not reachable yet; ' +
              'the accessory will continue to retry in the background', device.config.moonrakerUrl);
            }
          })
          .catch(e => {
            this.log.debug('Unexpected error while checking printer connectivity: %O', e);
          });

        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache: %s', existingAccessory.displayName);
          new MoonrakerPrinterAccessory(
            this, existingAccessory, this.log, printer, features, device);
        } else {
          // register the accessory
          this.log.info('Adding new accessory: %s', printer.name);
          const accessory = new this.api.platformAccessory(printer.name, uuid);

          new MoonrakerPrinterAccessory(this, accessory, this.log, printer, features, device);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // Remove cached accessories for printers that are no longer configured.
      const staleAccessories = this.accessories.filter(accessory => !configuredUuids.has(accessory.UUID));
      if (staleAccessories.length > 0) {
        this.log.info('Removing %d stale accessory/accessories from cache', staleAccessories.length);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
      }
    } catch (e) {
      if (e instanceof Error) {
        this.log.error(`Unexpected error occured. See error message: ${e.message}`);
      } else {
        this.log.error(`Unexpected error occured. See error: ${JSON.stringify(e)}`);
      }

      this.log.debug('Unexpected error occured. Error: %O', e);
    }
  }
}
