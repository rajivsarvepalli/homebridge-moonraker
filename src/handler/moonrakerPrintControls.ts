import { Service, Characteristic } from 'homebridge';
import type { CharacteristicValue } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';
import { clamp } from '../util/math';
import { getPrinterObjectStatus, PrinterObjectNotification } from '../model/printerObjectNotification';

/**
 * A lightbulb used to control the printer:
 * - Brightness reflects print progress.
 * - Turning the light off pauses the print.
 * - Turning it on resumes the print.
 * - Setting the brightness to 100 cancels the print (force completion).
 */
export class MoonrakerPrintControlsService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform, device } = context;
    this.Characteristic = platform.Characteristic;
    const service = accessory.getService(name)
          || accessory.addService(platform.Service.Lightbulb, name, name);

    service.getCharacteristic(this.Characteristic.Name)
      .onGet(this.handleNameGet.bind(this));
    service.getCharacteristic(this.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    service.getCharacteristic(this.Characteristic.Brightness)
      .onGet(this.handleBrightnessGet.bind(this))
      .onSet(this.handleBrightnessSet.bind(this));

    this.service = service;

    device.subscribeToPrinterObjectStatusWithListener(
      {
        print_stats: ['state'],
        display_status: ['progress'],
      }, this.handlePrinterObjectUpdate.bind(this),
    );
  }

  async handleNameGet() {
    return this.name;
  }

  async handleBrightnessGet(): Promise<CharacteristicValue> {
    const progress = await this.context.device.getPrintProgress()
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));

    return this.toBrightness(progress);
  }

  async handleBrightnessSet(value: CharacteristicValue) {
    const brightness = clamp(Number(value), 0, 100);

    if (brightness >= 100) {
      await this.context.device.cancelPrint()
        .catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
    }

    // The light brightness always represents actual print progress, not the
    // arbitrary value that was written by the Home app.
    this.service.updateCharacteristic(
      this.Characteristic.Brightness, await this.handleBrightnessGet());
  }

  /**
   * Handle requests to get the current value of the "On" characteristic
   */
  async handleOnGet(): Promise<CharacteristicValue> {
    this.context.log.debug('Triggered GET On');

    return this.isPrinting();
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value: CharacteristicValue) {
    this.context.log.debug('Triggered SET On: %s', value);

    const request = value
      ? this.context.device.resumePrint()
      : this.context.device.pausePrint();

    await request.catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));
  }

  private handlePrinterObjectUpdate(event: PrinterObjectNotification) {
    const status = getPrinterObjectStatus(event);
    if (!status) {
      return;
    }

    if (status.print_stats?.state !== undefined) {
      this.service.updateCharacteristic(
        this.Characteristic.On, this.mapMoonrakerStateToPrinting(status.print_stats.state));
    }

    if (status.display_status?.progress !== undefined) {
      this.service.updateCharacteristic(
        this.Characteristic.Brightness, this.toBrightness(status.display_status.progress));
    }
  }

  private async isPrinting(): Promise<boolean> {
    const response = await this.context.device.httpRequest({
      method: 'get',
      url: '/printer/objects/query',
      params: {
        print_stats: '',
      },
    }).catch(handleError(this.context.log, this.context.config.moonrakerUrl, undefined));

    return this.mapMoonrakerStateToPrinting(
      response?.data?.result?.status?.print_stats?.state);
  }

  private toBrightness(progress: number | undefined): number {
    return clamp(Math.round((progress ?? 0) * 100), 0, 100);
  }

  private mapMoonrakerStateToPrinting(moonrakerState: string | undefined) {
    return moonrakerState === 'printing';
  }
}
