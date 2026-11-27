import type { Logger, PlatformAccessory } from 'homebridge';

export const Characteristic = {
  Name: 'Name',
  CurrentTemperature: 'CurrentTemperature',
  TargetTemperature: 'TargetTemperature',
  CurrentHeatingCoolingState: {
    OFF: 0,
    HEAT: 1,
  },
  TargetHeatingCoolingState: {
    OFF: 0,
    HEAT: 1,
  },
  TemperatureDisplayUnits: {
    CELSIUS: 0,
    FAHRENHEIT: 1,
  },
  ContactSensorState: {
    CONTACT_DETECTED: 1,
    CONTACT_NOT_DETECTED: 0,
  },
  BatteryLevel: 'BatteryLevel',
  StatusLowBattery: {
    BATTERY_LEVEL_LOW: 0,
    BATTERY_LEVEL_NORMAL: 1,
  },
  CurrentRelativeHumidity: 'CurrentRelativeHumidity',
  On: 'On',
  Brightness: 'Brightness',
  Manufacturer: 'Manufacturer',
  Model: 'Model',
  SerialNumber: 'SerialNumber',
};

export const Service = {
  Thermostat: 'Thermostat',
  ContactSensor: 'ContactSensor',
  Battery: 'Battery',
  HumiditySensor: 'HumiditySensor',
  Lightbulb: 'Lightbulb',
  TemperatureSensor: 'TemperatureSensor',
  AccessoryInformation: 'AccessoryInformation',
};

export interface MockCharacteristic {
  value?: unknown;
  props: Record<string, unknown>;
  setProps: jest.Mock;
  onGet: jest.Mock;
  onSet: jest.Mock;
}

export interface MockService {
  name?: string;
  serviceClass?: unknown;
  getCharacteristic: jest.Mock;
  updateCharacteristic: jest.Mock;
  setCharacteristic: jest.Mock;
  characteristics: Map<unknown, MockCharacteristic>;
}

export function createMockService(): MockService {
  const service: MockService = {
    characteristics: new Map(),
    getCharacteristic: jest.fn(),
    updateCharacteristic: jest.fn(),
    setCharacteristic: jest.fn(),
  };

  service.setCharacteristic = jest.fn((characteristic: unknown, value: unknown) => {
    service.getCharacteristic(characteristic).value = value;
    return service;
  });

  service.getCharacteristic = jest.fn((characteristic: unknown) => {
    if (!service.characteristics.has(characteristic)) {
      const instance = {
        value: undefined,
        props: {},
      } as MockCharacteristic;
      instance.setProps = jest.fn((props: Record<string, unknown>) => {
        instance.props = props;
        return instance;
      });
      instance.onGet = jest.fn(() => instance);
      instance.onSet = jest.fn(() => instance);
      service.characteristics.set(characteristic, instance);
    }

    return service.characteristics.get(characteristic);
  });

  service.updateCharacteristic = jest.fn((characteristic: unknown, value: unknown) => {
    service.getCharacteristic(characteristic).value = value;
  });

  return service;
}

export interface MockAccessory {
  accessory: PlatformAccessory;
  services: MockService[];
}

export function createMockAccessory(displayName = 'Mock Accessory', uuid = 'mock-uuid'): MockAccessory {
  const services: MockService[] = [];
  const servicesByName = new Map<string, MockService>();

  const accessory = {
    displayName,
    UUID: uuid,
    getService: jest.fn((name: string) => servicesByName.get(name)),
    addService: jest.fn((serviceClass: unknown, name?: string) => {
      const service = createMockService();
      service.serviceClass = serviceClass;
      service.name = name;
      services.push(service);
      if (name) {
        servicesByName.set(name, service);
      }
      return service;
    }),
  } as unknown as PlatformAccessory;

  return { accessory, services };
}

export function createLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
}

export function characteristicValue(service: MockService, characteristic: unknown): unknown {
  return service.characteristics.get(characteristic)?.value;
}

export function printerObjectListener(device: {
  subscribeToPrinterObjectStatusWithListener: jest.Mock;
}): (event: unknown) => void {
  return device.subscribeToPrinterObjectStatusWithListener.mock.calls[0][1] as (event: unknown) => void;
}
