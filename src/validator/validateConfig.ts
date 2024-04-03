import { PrinterConfig } from '../model/config/printerConfig';

export function isUniquePrinterNames(printerConfigs: PrinterConfig[]) {
  const printerNames = printerConfigs.map(printerConfig => {
    return printerConfig.name;
  });

  return new Set(printerNames).size === printerConfigs.length;
}