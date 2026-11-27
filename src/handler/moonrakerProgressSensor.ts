import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { clamp } from '../util/math';
import { getPrinterObjectStatus, PrinterObjectNotification } from '../model/printerObjectNotification';

/**
 * Exposes print progress to HomeKit.
 *
 * A Battery service is used because it supports a 0-100 percentage, and a
 * Humidity sensor mirrors the same progress. HomeKit will poll on demand but
 * progress notifications are pushed over the websocket for real-time updates.
 */
export class MoonrakerProgressService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  private readonly humidityService: Service;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { device, accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    const batteryService = accessory.getService(name)
          || accessory.addService(platform.Service.Battery, name, name);

    batteryService.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));

    batteryService.getCharacteristic(this.Characteristic.BatteryLevel)
      .onGet(this.handleCurrentPrintProgressGet.bind(this));

    batteryService.getCharacteristic(this.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    this.service = batteryService;

    const humidityProgressName = name + ' Humidity Sensor';
    const humidityService = accessory.getService(humidityProgressName)
          || accessory.addService(platform.Service.HumiditySensor, humidityProgressName, humidityProgressName);
    humidityService.getCharacteristic(this.Characteristic.Name)
      .onGet(() => humidityProgressName);
    humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentPrintProgressGet.bind(this));

    this.humidityService = humidityService;

    device.subscribeToPrinterObjectStatusWithListener(
      {
        display_status: ['progress'],
      }, this.handleProgressNotification.bind(this),
    );
  }

  async handleNameGet() {
    return this.name;
  }

  /**
   * Handle requests to get the current value of the "Battery Level" characteristic
   */
  async handleCurrentPrintProgressGet() {
    this.context.log.debug('Triggered GET CurrentPrintProgress');

    const progress = await this.context.device.getPrintProgress()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));

    return this.toPercentage(progress);
  }

  /**
   * Handle requests to get the "status low battery" characteristic
   */
  handleStatusLowBatteryGet() {
    return this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  private handleProgressNotification(event: PrinterObjectNotification) {
    this.context.log.debug('Handle progress update event: %O', event);

    const progress = getPrinterObjectStatus(event)?.display_status?.progress;
    if (progress === undefined) {
      return;
    }

    this.updateProgress(this.toPercentage(progress));
  }

  private updateProgress(percentage: number) {
    this.service.updateCharacteristic(this.Characteristic.BatteryLevel, percentage);
    this.humidityService.updateCharacteristic(this.Characteristic.CurrentRelativeHumidity, percentage);
  }

  private toPercentage(progress: number | undefined): number {
    return clamp(Math.round((progress ?? 0) * 100), 0, 100);
  }
}
