/**
 * Minimal shape of a Moonraker / Klipper `notify_status_update` event.
 *
 * The moonraker-client library does not re-export this type from its package
 * entrypoint, so the plugin keeps a local copy. `objectNotification` is
 * intentionally typed as `unknown` because its shape depends on the objects
 * that were subscribed to.
 */
export interface PrinterObjectNotification {
  eventTime?: number;
  objectNotification?: unknown;
}

/**
 * A partial view of the printer objects used by this plugin.
 */
export interface PrinterObjectStatus {
  print_stats?: {
    state?: string;
  };
  display_status?: {
    progress?: number;
  };
  extruder?: {
    target?: number;
    temperature?: number;
  };
  heater_bed?: {
    target?: number;
    temperature?: number;
  };
}

export function getPrinterObjectStatus(event: PrinterObjectNotification | undefined): PrinterObjectStatus | undefined {
  return event?.objectNotification as PrinterObjectStatus | undefined;
}
