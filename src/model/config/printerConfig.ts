import { z } from 'zod';

const TemperatureSensorSchema = z.object({
  name: z.string().min(1).max(255),
  moonrakerName: z.string().min(1).max(255),
  minTemp: z.number().gt(-1000).lt(1000).int(),
  maxTemp: z.number().gt(-1000).lt(1000).int(),
});

export const PrinterObjectSchema = z.object({
  moonrakerUrl: z.string().url(),
  name: z.string().min(1).max(255),
  notifyCameraToRecordUrl:  z.string().url().optional(),
  temperatureSensors: z.array(TemperatureSensorSchema),
  manufacturer: z.string().min(1).max(255).optional(),
  model: z.string().min(1).max(255).optional(),
  serialNumber: z.string().min(1).max(255).optional(),
  maxBedHeaterTemp: z.number().gt(1).lt(500).int(),
  maxExtruderHeaterTemp: z.number().gt(1).lt(1000).int(),
});

export type PrinterConfig = z.infer<typeof PrinterObjectSchema>;
export type TemperatureSensor = z.infer<typeof TemperatureSensorSchema>;