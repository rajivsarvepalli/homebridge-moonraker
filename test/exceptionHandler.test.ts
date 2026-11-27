import type { Logger } from 'homebridge';
import { handleError } from '../src/util/exceptionHandler';

describe('handleError', () => {
  const log = {
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs the moonraker url and the underlying error', () => {
    const error = new Error('connection refused');
    const handler = handleError(log, 'http://printer.local', 42);

    expect(handler(error)).toBe(42);
    expect(log.error).toHaveBeenCalledWith(
      'The printer with url: %s is not currently connected',
      'http://printer.local',
    );
    expect(log.debug).toHaveBeenCalledWith(
      'The printer with url: %s is not currently connected due to error: %O',
      'http://printer.local',
      error,
    );
  });

  it('returns the configured fallback value', () => {
    expect(handleError(log, 'http://printer.local', false)(new Error('boom'))).toBe(false);
    expect(handleError(log, 'http://printer.local', undefined)(new Error('boom'))).toBeUndefined();
  });
});
