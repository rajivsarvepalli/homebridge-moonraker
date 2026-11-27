import { Logger } from 'homebridge';

export function handleError<T>(log: Logger, moonrakerUrl: string, returnValue: T) {
  return (e: unknown): T => {
    log.error('The printer with url: %s is not currently connected', moonrakerUrl);
    log.debug('The printer with url: %s is not currently connected due to error: %O', moonrakerUrl, e);

    return returnValue;
  };
}