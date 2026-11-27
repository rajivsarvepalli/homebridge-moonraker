import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { MoonrakerPluginServiceContext } from '../src/model/serviceContext';
import { MoonrakerPrintControlsService } from '../src/handler/moonrakerPrintControls';
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
    cancelPrint: jest.Mock;
    pausePrint: jest.Mock;
    resumePrint: jest.Mock;
    httpRequest: jest.Mock;
  };
  lightbulbService: () => ReturnType<typeof createMockAccessory>['services'][number];
  printerObjectListener: () => (event: PrinterObjectNotification) => void;
} {
  const { accessory, services } = createMockAccessory();

  const device = {
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
    getPrintProgress: jest.fn().mockResolvedValue(0.5),
    cancelPrint: jest.fn().mockResolvedValue(true),
    pausePrint: jest.fn().mockResolvedValue(true),
    resumePrint: jest.fn().mockResolvedValue(true),
    httpRequest: jest.fn().mockResolvedValue({
      data: { result: { status: { print_stats: { state: 'printing' } } } },
    }),
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
    lightbulbService: () => services[0],
    printerObjectListener: () => getPrinterObjectListener(device),
  };
}

describe('MoonrakerPrintControlsService', () => {
  it('creates the lightbulb and subscribes to state and progress', () => {
    const { context, device, lightbulbService } = createTestContext();
    new MoonrakerPrintControlsService('Print Controls', context);

    expect(lightbulbService().serviceClass).toBe(Service.Lightbulb);
    expect(device.subscribeToPrinterObjectStatusWithListener).toHaveBeenCalledWith(
      { print_stats: ['state'], display_status: ['progress'] },
      expect.any(Function),
    );
  });

  it('reports brightness as a percentage of print progress', async () => {
    const { context } = createTestContext();
    const service = new MoonrakerPrintControlsService('Print Controls', context);

    expect(await service.handleBrightnessGet()).toBe(50);
  });

  it('cancels the print when brightness is set to 100', async () => {
    const { context, device, lightbulbService } = createTestContext();
    const service = new MoonrakerPrintControlsService('Print Controls', context);

    await service.handleBrightnessSet(100);

    expect(device.cancelPrint).toHaveBeenCalled();
    expect(characteristicValue(lightbulbService(), Characteristic.Brightness)).toBe(50);
  });

  it('does not cancel the print when brightness is below 100', async () => {
    const { context, device } = createTestContext();
    const service = new MoonrakerPrintControlsService('Print Controls', context);

    await service.handleBrightnessSet(50);

    expect(device.cancelPrint).not.toHaveBeenCalled();
  });

  it('pauses and resumes the print based on the On characteristic', async () => {
    const { context, device } = createTestContext();
    const service = new MoonrakerPrintControlsService('Print Controls', context);

    await service.handleOnSet(false);
    await service.handleOnSet(true);

    expect(device.pausePrint).toHaveBeenCalled();
    expect(device.resumePrint).toHaveBeenCalled();
  });

  it('reports the On characteristic from the printer state', async () => {
    const { context } = createTestContext();
    const service = new MoonrakerPrintControlsService('Print Controls', context);

    expect(await service.handleOnGet()).toBe(true);
  });

  it('updates On and Brightness from notifications', () => {
    const { context, lightbulbService, printerObjectListener } = createTestContext();
    new MoonrakerPrintControlsService('Print Controls', context);

    printerObjectListener()({
      eventTime: 1,
      objectNotification: {
        print_stats: { state: 'paused' },
        display_status: { progress: 0.25 },
      },
    });

    expect(characteristicValue(lightbulbService(), Characteristic.On)).toBe(false);
    expect(characteristicValue(lightbulbService(), Characteristic.Brightness)).toBe(25);
  });
});
