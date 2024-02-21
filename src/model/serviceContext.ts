import { Logger, PlatformAccessory } from 'homebridge';
import { MoonrakerClient } from 'moonraker-client';
import { PrinterConfig } from './config/printerConfig';
import { Feature } from './config/config';
import { HomebridgeMoonrakerPlatform } from '../platform';

export type MoonrakerPluginServiceContext = {
    log: Logger;
    config: PrinterConfig;
    accessory: PlatformAccessory;
    features: Feature[];
    device: MoonrakerClient;
    platform: HomebridgeMoonrakerPlatform;
};