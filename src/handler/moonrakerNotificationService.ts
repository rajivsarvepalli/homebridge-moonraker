import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import axios from 'axios';

interface NotificationState {
    canceled: boolean;
    error: boolean;
}

/**
 * Service to create notifications for moonraker 3d printer.
 * Currently just uses contact sensors to send notifications for when a print was canceled.
 */
export class MoonrakerNotificationService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;
  state: NotificationState;

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

    return this.state.canceled ? this.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }

  handleErrorContactSensorStateGet() {
    this.context.log.debug('Triggered GET ContactSensorState');

    return this.state.error ? this.Characteristic.ContactSensorState.CONTACT_DETECTED
      : this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }

  handleUpdateStateNotification(event) {
    this.context.log.debug('Handle state update event: %O', event);
    if (event?.objectNotification?.print_stats?.state === 'canceled') {
      this.state.canceled = true;
      const notifyCameraUrl = this.context.config.notifyCameraToRecordUrl;
      if (notifyCameraUrl) {
        axios.request({
          method: 'GET',
          url: notifyCameraUrl,
        }).catch(() => {
          return;
        });
      }

    } else if(event?.objectNotification?.print_stats?.state === 'error') {
      this.state.error = true;
    } else {
      this.state = {
        error: false,
        canceled: false,
      };
    }
  }
}