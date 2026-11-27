import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { MoonrakerPluginServiceContext } from '../src/model/serviceContext';
import { MoonrakerProgressService } from '../src/handler/moonrakerProgressSensor';
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
};

function createTestContext(): {
  context: MoonrakerPluginServiceContext;
  device: {
    subscribeToPrinterObjectStatusWithListener: jest.Mock;
    getPrintProgress: jest.Mock;
  };
  services: ReturnType<typeof createMockAccessory>['services'];
  printerObjectListener: () => (event: PrinterObjectNotification) => void;
} {
  const { accessory, services } = createMockAccessory();

  const device = {
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
    getPrintProgress: jest.fn().mockResolvedValue(0.5),
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

describe('MoonrakerProgressService', () => {
  it('creates battery and humidity services and subscribes to progress', () => {
    const { context, device, services } = createTestContext();
    new MoonrakerProgressService('Print Progress', context);

    expect(services[0].serviceClass).toBe(Service.Battery);
    expect(services[1].serviceClass).toBe(Service.HumiditySensor);
    expect(services[1].name).toBe('Print Progress Humidity Sensor');
    expect(device.subscribeToPrinterObjectStatusWithListener).toHaveBeenCalledWith(
      { display_status: ['progress'] },
      expect.any(Function),
    );
  });

  it('reports progress as a percentage', async () => {
    const { context } = createTestContext();
    const service = new MoonrakerProgressService('Print Progress', context);

    expect(await service.handleCurrentPrintProgressGet()).toBe(50);
  });

  it('clamps progress to the 0-100 range', async () => {
    const { context, device } = createTestContext();
    device.getPrintProgress.mockResolvedValue(1.5);
    const service = new MoonrakerProgressService('Print Progress', context);

    expect(await service.handleCurrentPrintProgressGet()).toBe(100);
  });

  it('returns zero when progress is unavailable', async () => {
    const { context, device } = createTestContext();
    device.getPrintProgress.mockResolvedValue(undefined);
    const service = new MoonrakerProgressService('Print Progress', context);

    expect(await service.handleCurrentPrintProgressGet()).toBe(0);
  });

  it('updates both services from progress notifications', () => {
    const { context, services, printerObjectListener } = createTestContext();
    new MoonrakerProgressService('Print Progress', context);

    printerObjectListener()({
      eventTime: 1,
      objectNotification: { display_status: { progress: 0.75 } },
    });

    expect(characteristicValue(services[0], Characteristic.BatteryLevel)).toBe(75);
    expect(characteristicValue(services[1], Characteristic.CurrentRelativeHumidity)).toBe(75);
  });
});
