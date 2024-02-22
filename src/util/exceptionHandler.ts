import { Logger } from 'homebridge';

export function handleError(log: Logger, moonrakerUrl: string, returnValue) {
  return (e: unknown) => {
    log.error('The printer with url: %s is not currently connected', moonrakerUrl);
    log.debug('The printer with url: %s is not currently connected due to error: %O', e);

    return returnValue;
  };
}