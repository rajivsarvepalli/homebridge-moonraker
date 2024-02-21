import { Logger } from 'homebridge';

export function handleError(log: Logger, moonrakerUrl: string, returnValue) {
  return (e: unknown) => {
    log.error('The printer with url: %s is not currently connected; error: %O',
      moonrakerUrl, e);

    return returnValue;
  };
}