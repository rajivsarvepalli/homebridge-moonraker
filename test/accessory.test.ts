import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { Feature } from '../src/model/config/config';
import { MoonrakerPrinterAccessory } from '../src/accessories/printerAccessory';
import { HomebridgeMoonrakerPlatform } from '../src/platform';
import type { MockService } from './mocks';
import {
  Characteristic,
  Service,
  createLogger,
  createMockAccessory,
  characteristicValue,
} from './mocks';

function createPrinterConfig(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    moonrakerUrl: 'http://printer.local',
    name: 'Test Printer',
    temperatureSensors: [],
    maxBedHeaterTemp: 120,
    maxExtruderHeaterTemp: 300,
    ...overrides,
  };
}

function createDevice(): MoonrakerClient {
  return {
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
    getPrintProgress: jest.fn().mockResolvedValue(0),
    cancelPrint: jest.fn().mockResolvedValue(true),
    pausePrint: jest.fn().mockResolvedValue(true),
    resumePrint: jest.fn().mockResolvedValue(true),
    httpRequest: jest.fn().mockResolvedValue({ data: {} }),
  } as unknown as MoonrakerClient;
}

function createPlatform(accessory: ReturnType<typeof createMockAccessory>['accessory']): HomebridgeMoonrakerPlatform {
  return {
    Service,
    Characteristic,
    accessories: [],
    config: {},
    log: createLogger(),
    api: {
      hap: { Service, Characteristic },
      platformAccessory: jest.fn(() => accessory),
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
    },
  } as unknown as HomebridgeMoonrakerPlatform;
}

describe('MoonrakerPrinterAccessory', () => {
  it('sets default accessory information characteristics', () => {
    const { accessory, services } = createMockAccessory();
    new MoonrakerPrinterAccessory(
      createPlatform(accessory),
      accessory,
      createLogger(),
      createPrinterConfig(),
      [],
      createDevice(),
    );

    expect(services[0].serviceClass).toBe(Service.AccessoryInformation);
    expect(characteristicValue(services[0], Characteristic.Manufacturer)).toBe('Moonraker');
    expect(characteristicValue(services[0], Characteristic.Model)).toBe('3d Printer');
    expect(characteristicValue(services[0], Characteristic.SerialNumber)).toBe('Unknown');
  });

  it('uses configured accessory information characteristics', () => {
    const { accessory, services } = createMockAccessory();
    new MoonrakerPrinterAccessory(
      createPlatform(accessory),
      accessory,
      createLogger(),
      createPrinterConfig({
        manufacturer: 'Voron',
        model: '2.4',
        serialNumber: 'V2.4-1234',
      }),
      [],
      createDevice(),
    );

    expect(characteristicValue(services[0], Characteristic.Manufacturer)).toBe('Voron');
    expect(characteristicValue(services[0], Characteristic.Model)).toBe('2.4');
    expect(characteristicValue(services[0], Characteristic.SerialNumber)).toBe('V2.4-1234');
  });

  it('creates a service for every enabled feature', () => {
    const { accessory, services } = createMockAccessory();
    new MoonrakerPrinterAccessory(
      createPlatform(accessory),
      accessory,
      createLogger(),
      createPrinterConfig({
        temperatureSensors: [
          { name: 'Chamber', moonrakerName: 'chamber', minTemp: 0, maxTemp: 100 },
        ],
      }),
      [
        Feature.BedThermostat,
        Feature.ExtruderThermostat,
        Feature.PrintProgress,
        Feature.PrintingControls,
        Feature.Notifications,
        Feature.TemperatureSensors,
      ],
      createDevice(),
    );

    expect(services.map(service => service.serviceClass)).toEqual([
      Service.AccessoryInformation,
      Service.Thermostat,
      Service.Thermostat,
      Service.Battery,
      Service.HumiditySensor,
      Service.Lightbulb,
      Service.ContactSensor,
      Service.ContactSensor,
      Service.TemperatureSensor,
    ]);
  });

  it('does not create feature services when no features are enabled', () => {
    const { accessory, services } = createMockAccessory();
    new MoonrakerPrinterAccessory(
      createPlatform(accessory),
      accessory,
      createLogger(),
      createPrinterConfig(),
      [],
      createDevice(),
    );

    expect(services.map(service => service.serviceClass)).toEqual([
      Service.AccessoryInformation,
    ]);
  });

  it('enables only the services for explicitly requested features', () => {
    const { accessory, services } = createMockAccessory();
    new MoonrakerPrinterAccessory(
      createPlatform(accessory),
      accessory,
      createLogger(),
      createPrinterConfig(),
      [Feature.PrintProgress],
      createDevice(),
    );

    expect(services.map(service => service.serviceClass)).toEqual([
      Service.AccessoryInformation,
      Service.Battery,
      Service.HumiditySensor,
    ]);

    const progressService = services[1] as unknown as MockService;
    expect(progressService.name).toBe(Feature.PrintProgress);
  });
});
