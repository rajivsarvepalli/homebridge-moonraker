import type { API, Logger, PlatformConfig } from 'homebridge';

import { HomebridgeMoonrakerPlatform } from '../src/platform';
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings';
import { Feature } from '../src/model/config/config';
import { verifyDeviceConnection } from '../src/util/verifyDevice';
import {
  Characteristic,
  Service,
  createLogger,
  createMockAccessory,
  type MockAccessory,
} from './mocks';

jest.mock('moonraker-client', () => ({
  MoonrakerClient: jest.fn((config: { moonrakerUrl: string }) => ({
    config,
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
  })),
}));

jest.mock('../src/util/verifyDevice', () => ({
  verifyDeviceConnection: jest.fn().mockResolvedValue(true),
}));

const mockVerifyDeviceConnection = verifyDeviceConnection as jest.Mock;

interface TestPlatform {
  api: {
    hap: {
      Service: typeof Service;
      Characteristic: typeof Characteristic;
      uuid: { generate: jest.Mock };
    };
    platformAccessory: jest.Mock;
    registerPlatformAccessories: jest.Mock;
    unregisterPlatformAccessories: jest.Mock;
    on: jest.Mock;
  };
  log: Logger;
  createdAccessories: MockAccessory[];
}

function createTestApi(): TestPlatform {
  const createdAccessories: MockAccessory[] = [];
  const api: TestPlatform['api'] = {
    hap: {
      Service,
      Characteristic,
      uuid: {
        generate: jest.fn((name: string) => `uuid-${name}`),
      },
    },
    platformAccessory: jest.fn((displayName: string, uuid: string) => {
      const created = createMockAccessory(displayName, uuid);
      createdAccessories.push(created);
      return created.accessory;
    }),
    registerPlatformAccessories: jest.fn(),
    unregisterPlatformAccessories: jest.fn(),
    on: jest.fn(),
  };

  return {
    api,
    log: createLogger(),
    createdAccessories,
  };
}

function createConfig(printers: PrinterConfigInput[]): PlatformConfig {
  return {
    platform: 'homebridge-moonraker',
    features: [Feature.TemperatureSensors],
    printers,
  } as unknown as PlatformConfig;
}

interface PrinterConfigInput {
  moonrakerUrl: string;
  name: string;
}

function didFinishLaunching(api: TestPlatform['api']): () => void {
  const handler = api.on.mock.calls.find(([event]) => event === 'didFinishLaunching')?.[1];
  if (!handler) {
    throw new Error('didFinishLaunching handler was not registered');
  }
  return handler;
}

async function flush(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

describe('HomebridgeMoonrakerPlatform', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockVerifyDeviceConnection.mockResolvedValue(true);
  });

  it('registers configured printers even when they are offline', async () => {
    const testApi = createTestApi();
    const platform = new HomebridgeMoonrakerPlatform(
      testApi.log,
      createConfig([{ moonrakerUrl: 'http://printer.local', name: 'Test Printer' }]),
      testApi.api as unknown as API,
    );

    mockVerifyDeviceConnection.mockResolvedValue(false);
    didFinishLaunching(testApi.api)();

    expect(testApi.createdAccessories).toHaveLength(1);
    expect(testApi.createdAccessories[0].accessory.displayName).toBe('Test Printer');
    expect(testApi.api.registerPlatformAccessories).toHaveBeenCalledWith(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [testApi.createdAccessories[0].accessory],
    );

    await flush();
    expect(testApi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('is not reachable yet'),
      'http://printer.local',
    );
  });

  it('logs when a printer is reachable', async () => {
    const testApi = createTestApi();
    new HomebridgeMoonrakerPlatform(
      testApi.log,
      createConfig([{ moonrakerUrl: 'http://printer.local', name: 'Test Printer' }]),
      testApi.api as unknown as API,
    );

    didFinishLaunching(testApi.api)();
    await flush();

    expect(testApi.log.info).toHaveBeenCalledWith(
      'Successfully connected to printer with url: %s',
      'http://printer.local',
    );
  });

  it('reuses a cached accessory instead of registering it again', () => {
    const testApi = createTestApi();
    const cached = createMockAccessory('Test Printer', 'uuid-Test Printer');
    const platform = new HomebridgeMoonrakerPlatform(
      testApi.log,
      createConfig([{ moonrakerUrl: 'http://printer.local', name: 'Test Printer' }]),
      testApi.api as unknown as API,
    );
    platform.configureAccessory(cached.accessory);

    didFinishLaunching(testApi.api)();

    expect(testApi.api.platformAccessory).not.toHaveBeenCalled();
    expect(testApi.api.registerPlatformAccessories).not.toHaveBeenCalled();
    expect(testApi.log.info).toHaveBeenCalledWith(
      'Restoring existing accessory from cache: %s',
      'Test Printer',
    );
  });

  it('removes cached accessories for printers no longer in the config', () => {
    const testApi = createTestApi();
    const current = createMockAccessory('Test Printer', 'uuid-Test Printer');
    const stale = createMockAccessory('Old Printer', 'uuid-Old Printer');
    const platform = new HomebridgeMoonrakerPlatform(
      testApi.log,
      createConfig([{ moonrakerUrl: 'http://printer.local', name: 'Test Printer' }]),
      testApi.api as unknown as API,
    );
    platform.configureAccessory(current.accessory);
    platform.configureAccessory(stale.accessory);

    didFinishLaunching(testApi.api)();

    expect(testApi.api.unregisterPlatformAccessories).toHaveBeenCalledWith(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [stale.accessory],
    );
  });

  it('does not register printers when names are not unique', () => {
    const testApi = createTestApi();
    new HomebridgeMoonrakerPlatform(
      testApi.log,
      createConfig([
        { moonrakerUrl: 'http://printer.local', name: 'Printer' },
        { moonrakerUrl: 'http://other.local', name: 'Printer' },
      ]),
      testApi.api as unknown as API,
    );

    didFinishLaunching(testApi.api)();

    expect(testApi.api.registerPlatformAccessories).not.toHaveBeenCalled();
    expect(testApi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Printer names are not unique'),
      ['Printer', 'Printer'],
    );
  });

  it('rejects an invalid config and never registers the launch handler', () => {
    const testApi = createTestApi();
    new HomebridgeMoonrakerPlatform(
      testApi.log,
      {
        platform: 'homebridge-moonraker',
        features: [],
        printers: [],
      } as unknown as PlatformConfig,
      testApi.api as unknown as API,
    );

    expect(testApi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Config is invalid'),
    );
    expect(testApi.api.on).not.toHaveBeenCalled();
  });
});
