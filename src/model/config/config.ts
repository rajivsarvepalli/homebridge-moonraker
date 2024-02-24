import { PrinterConfig } from './printerConfig';

export enum Feature {
  Camera = 'Camera(s)',
  BedThermostat = 'Bed Thermostat',
  ExtruderThermostat = 'Extruder Thermostat',
  PrintProgress = 'Print Progress',
  PrintingControls = 'Print Controls',
  Notifications = 'Notifications',
  TemperatureSensors = 'Temperature Sensor(s)',
}

export interface HomebridgeMoonrakerConfig {
  features: Feature[];
  printers: PrinterConfig[];
}
