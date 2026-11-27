import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import axios from 'axios';
import { getPrinterObjectStatus, PrinterObjectNotification } from '../model/printerObjectNotification';

interface NotificationState {
    canceled: boolean;
    error: boolean;
}

/**
 * Service to create notifications for moonraker 3d printer.
 * Currently just uses contact sensors to send notifications for when a print was canceled or errored.
 */
export class MoonrakerNotificationService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;
  state: NotificationState;

  private readonly cancelService: Service;
  private readonly errorService: Service;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { device, accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    // Cancel notifications
    const cancelName = 'Print Canceled';
    const cancelService = accessory.getService(cancelName)
          || accessory.addService(platform.Service.ContactSensor, cancelName, cancelName);

    const errorName = 'Print Error';
    const errorService = accessory.getService(errorName)
          || accessory.addService(platform.Service.ContactSensor, errorName, errorName);

    cancelService.getCharacteristic(this.Characteristic.Name)
      .onGet(() => {
        return cancelName;
      });
    errorService.getCharacteristic(this.Characteristic.Name)
      .onGet(() => {
        return errorName;
      });

    cancelService.getCharacteristic(this.Characteristic.ContactSensorState)
      .onGet(this.handleCancelContactSensorStateGet.bind(this));
    errorService.getCharacteristic(this.Characteristic.ContactSensorState)
      .onGet(this.handleErrorContactSensorStateGet.bind(this));

    this.service = cancelService;
    this.cancelService = cancelService;
    this.errorService = errorService;
    this.state = {
      canceled: false,
      error: false,
    };

    device.subscribeToPrinterObjectStatusWithListener(
      {
        print_stats: ['state'],
      }, this.handleUpdateStateNotification.bind(this),
    );
  }

  /**
   * Handle requests to get the current value of the "Contact Sensor State" characteristic
   */
  handleCancelContactSensorStateGet() {
    this.context.log.debug('Triggered GET ContactSensorState');

    return this.contactSensorState(this.state.canceled);
  }

  handleErrorContactSensorStateGet() {
    this.context.log.debug('Triggered GET ContactSensorState');

    return this.contactSensorState(this.state.error);
  }

  handleUpdateStateNotification(event: PrinterObjectNotification) {
    this.context.log.debug('Handle state update event: %O', event);

    const printState = getPrinterObjectStatus(event)?.print_stats?.state;
    const canceled = printState === 'canceled';
    const error = printState === 'error';

    if (canceled === this.state.canceled && error === this.state.error) {
      return;
    }

    this.state = {
      error,
      canceled,
    };

    this.cancelService.updateCharacteristic(
      this.Characteristic.ContactSensorState, this.contactSensorState(this.state.canceled));
    this.errorService.updateCharacteristic(
      this.Characteristic.ContactSensorState, this.contactSensorState(this.state.error));

    if (this.state.canceled || this.state.error) {
      const notifyCameraUrl = this.context.config.notifyCameraToRecordUrl;
      if (notifyCameraUrl) {
        axios.request({
          method: 'GET',
          url: notifyCameraUrl,
        }).catch((e: unknown) => {
          this.context.log.debug('Unable to notify camera recording url: %s due to error: %O',
            notifyCameraUrl, e);
          return;
        });
      }
    }
  }

  private contactSensorState(active: boolean) {
    return active
      ? this.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }
}
