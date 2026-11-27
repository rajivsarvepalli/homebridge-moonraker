import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { MoonrakerPluginServiceContext } from '../src/model/serviceContext';
import { MoonrakerTemperatureService } from '../src/handler/moonrakerTemperatureService';
import {
  Characteristic,
  Service,
  createLogger,
  createMockAccessory,
} from './mocks';

const printerConfig: PrinterConfig = {
  moonrakerUrl: 'http://printer.local',
  name: 'Test Printer',
  temperatureSensors: [
    {
      name: 'Chamber',
      moonrakerName: 'chamber',
      minTemp: 0,
      maxTemp: 100,
    },
  ],
  maxBedHeaterTemp: 120,
  maxExtruderHeaterTemp: 300,
};

function createTestContext(): {
  context: MoonrakerPluginServiceContext;
  device: { getTemperatureForSensor: jest.Mock };
  services: ReturnType<typeof createMockAccessory>['services'];
} {
  const { accessory, services } = createMockAccessory();

  const device = {
    getTemperatureForSensor: jest.fn().mockResolvedValue(50),
  };

  const context = {
    log: createLogger(),
    config: printerConfig,
    accessory,
    features: [],
    device: device as unknown as MoonrakerClient,
    platform: { Service, Characteristic },
  } as unknown as MoonrakerPluginServiceContext;

  return { context, device, services };
}

describe('MoonrakerTemperatureService', () => {
  it('creates a temperature sensor for each configured sensor', () => {
    const { context, services } = createTestContext();
    new MoonrakerTemperatureService(context);

    expect(services).toHaveLength(1);
    expect(services[0].serviceClass).toBe(Service.TemperatureSensor);
    expect(services[0].name).toBe('Chamber');
  });

  it('applies the configured min and max temperature props', () => {
    const { context, services } = createTestContext();
    new MoonrakerTemperatureService(context);

    const props = services[0].getCharacteristic(Characteristic.CurrentTemperature as never).props;
    expect(props).toEqual({ minValue: 0, maxValue: 100 });
  });

  it('returns the sensor temperature', async () => {
    const { context, device } = createTestContext();
    const service = new MoonrakerTemperatureService(context);

    expect(await service.handleCurrentTemperatureGet('chamber', 0, 100)).toBe(50);
    expect(device.getTemperatureForSensor).toHaveBeenCalledWith('chamber');
  });

  it('clamps temperatures above the configured maximum', async () => {
    const { context, device } = createTestContext();
    device.getTemperatureForSensor.mockResolvedValue(150);
    const service = new MoonrakerTemperatureService(context);

    expect(await service.handleCurrentTemperatureGet('chamber', 0, 100)).toBe(100);
  });

  it('clamps temperatures below the configured minimum', async () => {
    const { context, device } = createTestContext();
    device.getTemperatureForSensor.mockResolvedValue(-20);
    const service = new MoonrakerTemperatureService(context);

    expect(await service.handleCurrentTemperatureGet('chamber', 0, 100)).toBe(0);
  });

  it('returns zero when the sensor value is unavailable', async () => {
    const { context, device } = createTestContext();
    device.getTemperatureForSensor.mockResolvedValue(undefined);
    const service = new MoonrakerTemperatureService(context);

    expect(await service.handleCurrentTemperatureGet('chamber', 0, 100)).toBe(0);
  });
});
