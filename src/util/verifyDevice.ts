import { Logger } from 'homebridge';
import { MoonrakerClient } from 'moonraker-client';

export async function verifyDeviceConnection(log: Logger, device: MoonrakerClient): Promise<boolean> {
  return device.getPrintProgress()
    .catch((e: unknown) => {
      log.error('Device was unable to connect with url: %s with error: %O', device.config.moonrakerUrl, e);
      return false;
    }).then((num) => {
      return num !== undefined && num !== null;
    });
}