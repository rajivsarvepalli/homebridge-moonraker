class MoonrakerDeviceBaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoonrakerDeviceBaseException';
  }
}

export class MoonrakerDeviceOffline extends MoonrakerDeviceBaseException {
  constructor(message: string) {
    super(message);
    this.name = 'MoonrakerDeviceOffline';
  }
}