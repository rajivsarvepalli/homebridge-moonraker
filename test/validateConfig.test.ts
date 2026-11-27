import { isUniquePrinterNames } from '../src/validator/validateConfig';
import { PrinterConfig } from '../src/model/config/printerConfig';

function printer(name: string): PrinterConfig {
  return {
    moonrakerUrl: 'http://printer.local',
    name,
    temperatureSensors: [],
    maxBedHeaterTemp: 120,
    maxExtruderHeaterTemp: 300,
  };
}

describe('isUniquePrinterNames', () => {
  it('returns true when all printer names are unique', () => {
    expect(isUniquePrinterNames([printer('Printer A'), printer('Printer B')])).toBe(true);
  });

  it('returns false when printer names are duplicated', () => {
    expect(isUniquePrinterNames([printer('Printer A'), printer('Printer A')])).toBe(false);
  });

  it('returns true for a single printer', () => {
    expect(isUniquePrinterNames([printer('Printer A')])).toBe(true);
  });

  it('returns true for an empty list', () => {
    expect(isUniquePrinterNames([])).toBe(true);
  });
});
