import { Logger } from 'homebridge';
import { MoonrakerClient } from 'moonraker-client';

export async function verifyDeviceConnection(log: Logger, device: MoonrakerClient): Promise<boolean> {
  return device.getOctoprintPrinterData()
    .then((data) => {
      return data !== undefined && data !== null;
    }).catch((e: unknown) => {
      log.error('Device was unable to connect with url: %s with error: %O', device.config.moonrakerUrl);
      log.debug('Device connection failed with error: %O', e);
      return false;
    });
}