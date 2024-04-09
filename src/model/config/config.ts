import { PrinterObjectSchema } from './printerConfig';
import { z } from 'zod';

export enum Feature {
  Camera = 'Camera(s)',
  BedThermostat = 'Bed Thermostat',
  ExtruderThermostat = 'Extruder Thermostat',
  PrintProgress = 'Print Progress',
  PrintingControls = 'Print Controls',
  Notifications = 'Notifications',
  TemperatureSensors = 'Temperature Sensor(s)',
}

export const HomebridgeMoonrakerConfigSchema = z.object({
  features: z.array(z.nativeEnum(Feature)).nonempty(),
  printers: z.array(PrinterObjectSchema).nonempty(),
});

export type HomebridgeMoonrakerConfig = z.infer<typeof HomebridgeMoonrakerConfigSchema>;