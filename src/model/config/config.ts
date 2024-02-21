import { PrinterConfig } from './printerConfig';

export enum Feature {
  Camera = 'Camera(s)',
  BedThermostat = 'Bed Thermostat',
  ExtruderThermostat = 'Extruder Thermostat',
  PrintProgress = 'Print Progress',
  PrintingControls = 'Print Controls',
  Notifications = 'Notifications',
}

export interface HomebridgeMoonrakerConfig {
  features: Feature[];
  printers: PrinterConfig[];
}
