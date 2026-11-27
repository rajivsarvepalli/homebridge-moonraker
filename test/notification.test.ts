import axios from 'axios';
import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { MoonrakerPluginServiceContext } from '../src/model/serviceContext';
import { MoonrakerNotificationService } from '../src/handler/moonrakerNotificationService';
import type { PrinterObjectNotification } from '../src/model/printerObjectNotification';
import {
  Characteristic,
  Service,
  createLogger,
  createMockAccessory,
  characteristicValue,
  printerObjectListener as getPrinterObjectListener,
} from './mocks';

const printerConfig: PrinterConfig = {
  moonrakerUrl: 'http://printer.local',
  name: 'Test Printer',
  temperatureSensors: [],
  maxBedHeaterTemp: 120,
  maxExtruderHeaterTemp: 300,
  notifyCameraToRecordUrl: 'http://camera.local/motion',
};

function createTestContext(): {
  context: MoonrakerPluginServiceContext;
  device: { subscribeToPrinterObjectStatusWithListener: jest.Mock };
  services: ReturnType<typeof createMockAccessory>['services'];
  printerObjectListener: () => (event: PrinterObjectNotification) => void;
} {
  const { accessory, services } = createMockAccessory();

  const device = {
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
  };

  const context = {
    log: createLogger(),
    config: printerConfig,
    accessory,
    features: [],
    device: device as unknown as MoonrakerClient,
    platform: { Service, Characteristic },
  } as unknown as MoonrakerPluginServiceContext;

  return {
    context,
    device,
    services,
    printerObjectListener: () => getPrinterObjectListener(device),
  };
}

describe('MoonrakerNotificationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('subscribes to print_stats state', () => {
    const { context, device } = createTestContext();
    new MoonrakerNotificationService('Notifications', context);

    expect(device.subscribeToPrinterObjectStatusWithListener).toHaveBeenCalledWith(
      { print_stats: ['state'] },
      expect.any(Function),
    );
  });

  it('marks the cancel sensor when a print is canceled and notifies the camera', () => {
    const { context, services, printerObjectListener } = createTestContext();
    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({ data: {} });
    new MoonrakerNotificationService('Notifications', context);

    printerObjectListener()({
      eventTime: 1,
      objectNotification: { print_stats: { state: 'canceled' } },
    });

    expect(characteristicValue(services[0], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_DETECTED);
    expect(characteristicValue(services[1], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://camera.local/motion',
    });
  });

  it('never notifies the camera twice for the same canceled state', () => {
    const { context, printerObjectListener } = createTestContext();
    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({ data: {} });
    new MoonrakerNotificationService('Notifications', context);
    const listener = printerObjectListener();

    listener({ eventTime: 1, objectNotification: { print_stats: { state: 'canceled' } } });
    listener({ eventTime: 2, objectNotification: { print_stats: { state: 'canceled' } } });

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('marks the error sensor when a print errors and notifies the camera', () => {
    const { context, services, printerObjectListener } = createTestContext();
    const requestSpy = jest.spyOn(axios, 'request').mockResolvedValue({ data: {} });
    new MoonrakerNotificationService('Notifications', context);

    printerObjectListener()({
      eventTime: 1,
      objectNotification: { print_stats: { state: 'error' } },
    });

    expect(characteristicValue(services[0], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    expect(characteristicValue(services[1], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_DETECTED);
    expect(requestSpy).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://camera.local/motion',
    });
  });

  it('does not notify the camera for normal print states', () => {
    const { context, printerObjectListener } = createTestContext();
    const requestSpy = jest.spyOn(axios, 'request');
    new MoonrakerNotificationService('Notifications', context);

    printerObjectListener()({
      eventTime: 1,
      objectNotification: { print_stats: { state: 'printing' } },
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('clears both sensors when the printer returns to a normal state', () => {
    const { context, services, printerObjectListener } = createTestContext();
    new MoonrakerNotificationService('Notifications', context);
    const listener = printerObjectListener();

    listener({ eventTime: 1, objectNotification: { print_stats: { state: 'canceled' } } });
    listener({ eventTime: 2, objectNotification: { print_stats: { state: 'printing' } } });

    expect(characteristicValue(services[0], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    expect(characteristicValue(services[1], Characteristic.ContactSensorState))
      .toBe(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
  });
});
