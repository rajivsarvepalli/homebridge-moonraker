import { z } from 'zod';

const TemperatureSensorSchema = z.object({
  name: z.string().min(1).max(512),
  moonrakerName: z.string().min(1).max(512),
  minTemp: z.number().gt(-200).lt(750).int(),
  maxTemp: z.number().gt(-200).lt(750).int(),
});

export const PrinterObjectSchema = z.object({
  moonrakerUrl: z.string().url(),
  name:  z.string().min(1).max(512),
  notifyCameraToRecordUrl:  z.string().url().optional(),
  temperatureSensors: z.array(TemperatureSensorSchema),
  manufacturer: z.string().min(1).max(512).optional(),
  model: z.string().min(1).max(512).optional(),
  serialNumber: z.string().min(1).max(512).optional(),
  maxBedHeaterTemp: z.number().gt(1).lt(750).int(),
  maxExtruderHeaterTemp: z.number().gt(1).lt(500).int(),
});

export type PrinterConfig = z.infer<typeof PrinterObjectSchema>;
export type TemperatureSensor = z.infer<typeof TemperatureSensorSchema>;