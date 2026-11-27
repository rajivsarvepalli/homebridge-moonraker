import { PrinterObjectSchema } from '../src/model/config/printerConfig';
import { HomebridgeMoonrakerConfigSchema, Feature } from '../src/model/config/config';

describe('PrinterObjectSchema', () => {
  const minimalPrinter = {
    moonrakerUrl: 'http://printer.local',
    name: 'Test Printer',
  };

  it('applies defaults for feature-specific settings', () => {
    const printer = PrinterObjectSchema.parse(minimalPrinter);

    expect(printer.temperatureSensors).toEqual([]);
    expect(printer.maxBedHeaterTemp).toBe(120);
    expect(printer.maxExtruderHeaterTemp).toBe(300);
  });

  it('accepts valid temperature sensors', () => {
    const printer = PrinterObjectSchema.parse({
      ...minimalPrinter,
      temperatureSensors: [
        {
          name: 'Chamber',
          moonrakerName: 'chamber',
          minTemp: 0,
          maxTemp: 100,
        },
      ],
    });

    expect(printer.temperatureSensors).toHaveLength(1);
  });

  it('rejects a sensor where maxTemp is not greater than minTemp', () => {
    expect(() => PrinterObjectSchema.parse({
      ...minimalPrinter,
      temperatureSensors: [
        {
          name: 'Chamber',
          moonrakerName: 'chamber',
          minTemp: 100,
          maxTemp: 100,
        },
      ],
    })).toThrow(/maxTemp must be greater than minTemp/);
  });

  it('rejects an invalid moonraker url', () => {
    expect(() => PrinterObjectSchema.parse({
      ...minimalPrinter,
      moonrakerUrl: 'not-a-url',
    })).toThrow();
  });
});

describe('HomebridgeMoonrakerConfigSchema', () => {
  it('parses a valid config and applies printer defaults', () => {
    const config = HomebridgeMoonrakerConfigSchema.parse({
      features: [Feature.BedThermostat],
      printers: [
        {
          moonrakerUrl: 'http://printer.local',
          name: 'Test Printer',
        },
      ],
    });

    expect(config.features).toEqual([Feature.BedThermostat]);
    expect(config.printers[0].maxBedHeaterTemp).toBe(120);
  });

  it('requires at least one feature', () => {
    expect(() => HomebridgeMoonrakerConfigSchema.parse({
      features: [],
      printers: [],
    })).toThrow();
  });

  it('requires at least one printer', () => {
    expect(() => HomebridgeMoonrakerConfigSchema.parse({
      features: [Feature.BedThermostat],
      printers: [],
    })).toThrow();
  });
});
