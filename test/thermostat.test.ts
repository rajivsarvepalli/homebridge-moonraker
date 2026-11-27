import type { MoonrakerClient } from 'moonraker-client';

import { PrinterConfig } from '../src/model/config/printerConfig';
import { MoonrakerPluginServiceContext } from '../src/model/serviceContext';
import { MoonrakerThermostatService, ThermostatType } from '../src/handler/moonrakerThermostatService';
import type { PrinterObjectNotification } from '../src/model/printerObjectNotification';
import {
  Characteristic,
  Service,
  createLogger,
  createMockAccessory,
  characteristicValue,
  printerObjectListener as getPrinterObjectListener,
  MockService,
} from './mocks';

const printerConfig: PrinterConfig = {
  moonrakerUrl: 'http://printer.local',
  name: 'Test Printer',
  temperatureSensors: [],
  maxBedHeaterTemp: 120,
  maxExtruderHeaterTemp: 300,
};

interface ThermostatTestContext {
  context: MoonrakerPluginServiceContext;
  device: {
    subscribeToPrinterObjectStatusWithListener: jest.Mock;
    getOctoprintPrinterData: jest.Mock;
    setBedTemperature: jest.Mock;
    setExtruderTemperature: jest.Mock;
  };
  thermostatService: () => MockService;
  printerObjectListener: () => (event: PrinterObjectNotification) => void;
}

function createTestContext(config: PrinterConfig = printerConfig): ThermostatTestContext {
  const { accessory, services } = createMockAccessory();

  const device = {
    subscribeToPrinterObjectStatusWithListener: jest.fn(),
    getOctoprintPrinterData: jest.fn().mockResolvedValue(undefined),
    setBedTemperature: jest.fn().mockResolvedValue(true),
    setExtruderTemperature: jest.fn().mockResolvedValue(true),
  };

  const platform = {
    Service,
    Characteristic,
  };

  const context = {
    log: createLogger(),
    config,
    accessory,
    features: [],
    device: device as unknown as MoonrakerClient,
    platform,
  } as unknown as MoonrakerPluginServiceContext;

  return {
    context,
    device,
    thermostatService: () => services[0],
    printerObjectListener: () => getPrinterObjectListener(device),
  };
}

describe('MoonrakerThermostatService', () => {
  describe('bed heater', () => {
    it('subscribes to the heater_bed target and temperature', () => {
      const { context, device } = createTestContext();
      new MoonrakerThermostatService(ThermostatType.BedHeater, 'Bed Thermostat', context);

      expect(device.subscribeToPrinterObjectStatusWithListener).toHaveBeenCalledWith(
        { heater_bed: ['target', 'temperature'] },
        expect.any(Function),
      );
    });

    it('reports the current and target temperature from OctoPrint data', async () => {
      const { context, device } = createTestContext();
      device.getOctoprintPrinterData.mockResolvedValue({
        temperature: {
          bed: { actual: 55, target: 60 },
        },
      });

      const service = new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      expect(await service.handleCurrentTemperatureGet()).toBe(55);
      expect(await service.handleTargetTemperatureGet()).toBe(60);
      expect(await service.handleCurrentHeatingCoolingStateGet())
        .toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
    });

    it('applies a new target temperature in celsius', async () => {
      const { context, device, thermostatService } = createTestContext();
      const service = new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      const result = await service.handleTargetTemperatureSet(80);

      expect(result).toBe(80);
      expect(device.setBedTemperature).toHaveBeenCalledWith(80);
      expect(characteristicValue(thermostatService(), Characteristic.TargetTemperature)).toBe(80);
    });

    it('turns the heater off when the target state is OFF', async () => {
      const { context, device, thermostatService } = createTestContext();
      const service = new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      await service.handleTargetHeatingCoolingStateSet(Characteristic.CurrentHeatingCoolingState.OFF);

      expect(device.setBedTemperature).toHaveBeenCalledWith(0);
      expect(characteristicValue(thermostatService(), Characteristic.TargetTemperature)).toBe(0);
    });

    it('restores the previous target when heating is re-enabled', async () => {
      const { context, device, thermostatService } = createTestContext();
      const service = new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      await service.handleTargetTemperatureSet(75);
      device.setBedTemperature.mockClear();
      await service.handleTargetHeatingCoolingStateSet(Characteristic.CurrentHeatingCoolingState.OFF);
      await service.handleTargetHeatingCoolingStateSet(Characteristic.CurrentHeatingCoolingState.HEAT);

      expect(device.setBedTemperature).toHaveBeenNthCalledWith(1, 0);
      expect(device.setBedTemperature).toHaveBeenNthCalledWith(2, 75);
      expect(characteristicValue(thermostatService(), Characteristic.TargetTemperature)).toBe(75);
    });

    it('always reports display units as celsius', () => {
      const { context } = createTestContext();
      const service = new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      expect(service.handleTemperatureDisplayUnitsGet())
        .toBe(Characteristic.TemperatureDisplayUnits.CELSIUS);
    });

    it('updates characteristics when a printer object notification arrives', () => {
      const { context, thermostatService, printerObjectListener } = createTestContext();
      new MoonrakerThermostatService(
        ThermostatType.BedHeater, 'Bed Thermostat', context);

      printerObjectListener()({
        eventTime: 1,
        objectNotification: {
          heater_bed: { target: 85, temperature: 80 },
        },
      });

      expect(characteristicValue(thermostatService(), Characteristic.TargetTemperature)).toBe(85);
      expect(characteristicValue(thermostatService(), Characteristic.CurrentTemperature)).toBe(80);
      expect(characteristicValue(thermostatService(), Characteristic.CurrentHeatingCoolingState))
        .toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
      expect(characteristicValue(thermostatService(), Characteristic.TargetHeatingCoolingState))
        .toBe(Characteristic.TargetHeatingCoolingState.HEAT);
    });
  });

  describe('extruder heater', () => {
    it('subscribes to the extruder target and temperature', () => {
      const { context, device } = createTestContext();
      new MoonrakerThermostatService(ThermostatType.Extruder, 'Extruder Thermostat', context);

      expect(device.subscribeToPrinterObjectStatusWithListener).toHaveBeenCalledWith(
        { extruder: ['target', 'temperature'] },
        expect.any(Function),
      );
    });

    it('reads tool0 temperatures and applies extruder temperature', async () => {
      const { context, device, thermostatService } = createTestContext();
      device.getOctoprintPrinterData.mockResolvedValue({
        temperature: {
          tool0: { actual: 200, target: 210 },
        },
      });

      const service = new MoonrakerThermostatService(
        ThermostatType.Extruder, 'Extruder Thermostat', context);

      expect(await service.handleCurrentTemperatureGet()).toBe(200);
      expect(await service.handleTargetTemperatureGet()).toBe(210);

      await service.handleTargetTemperatureSet(220);
      expect(device.setExtruderTemperature).toHaveBeenCalledWith(220);
      expect(characteristicValue(thermostatService(), Characteristic.TargetTemperature)).toBe(220);
    });
  });
});
