import { Service, Characteristic } from 'homebridge';
import { MoonrakerPluginServiceContext } from '../model/serviceContext';
import { MoonrakerPluginService } from './moonrakerPluginService';
import { handleError } from '../util/exceptionHandler';

export class MoonrakerPrintControlsService extends MoonrakerPluginService {
  public service: Service;
  Characteristic: typeof Characteristic;

  constructor(private readonly name: string, context: MoonrakerPluginServiceContext) {
    super(context);

    const { accessory, platform } = context;
    this.Characteristic = platform.Characteristic;
    const service = accessory.getService(name)
          || accessory.addService(platform.Service.SmartSpeaker, name, name);

    service.getCharacteristic(this.Characteristic.ConfiguredName)
      .onGet(this.handleNameGet.bind(this));

    service.getCharacteristic(this.Characteristic.CurrentMediaState)
      .onGet(this.handleCurrentMediaStateGet.bind(this));

    service.getCharacteristic(this.Characteristic.TargetMediaState)
      .onGet(this.handleTargetMediaStateGet.bind(this))
      .onSet(this.handleTargetMediaStateSet.bind(this));

    this.service = service;
  }

  async handleNameGet() {
    return this.name;
  }

  /**
   * Handle requests to get the current value of the "Current Media State" characteristic
   */
  async handleCurrentMediaStateGet() {
    this.context.log.debug('Triggered GET CurrentMediaState');

    return this.getCurrentMediaState();
  }


  /**
   * Handle requests to get the current value of the "Target Media State" characteristic
   */
  handleTargetMediaStateGet() {
    this.context.log.debug('Triggered GET TargetMediaState');

    return this.getTargetMediaState();
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  handleTargetMediaStateSet(value) {
    this.context.log.debug('Triggered SET TargetMediaState: %s', value);

    switch(value) {
      case this.Characteristic.TargetMediaState.PLAY: {
        this.context.device.resumePrint()
          .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
            undefined));
        return;
      }
      case this.Characteristic.TargetMediaState.PAUSE: {
        this.context.device.pausePrint()
          .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
            undefined));
        return;
      }
      case this.Characteristic.TargetMediaState.STOP: {
        this.context.device.cancelPrint()
          .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
            undefined));
        return;
      }
    }
  }

  private getCurrentMediaState() {
    this.context.log.debug('Triggered GET CurrentMediaState');

    // set this to a valid value for CurrentMediaState
    const currentMediaState = this.context.device.httpRequest({
      method: 'get',
      url: '/printer/objects/query',
      params: {
        print_stats: '',
      },
    })
      .then(response => {
        const moonrakerState = response?.data?.result?.status?.print_stats?.state;
        return this.mapMoonrakerStateToCurrentMediaState(moonrakerState);
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
        this.Characteristic.CurrentMediaState.LOADING));

    return currentMediaState;
  }

  private getTargetMediaState() {
    this.context.log.debug('Triggered GET CurrentMediaState');

    // set this to a valid value for CurrentMediaState
    const currentMediaState = this.context.device.httpRequest({
      method: 'get',
      url: '/printer/objects/query',
      params: {
        print_stats: '',
      },
    })
      .then(response => {
        const moonrakerState = response?.data?.result?.status?.print_stats?.state;
        return this.mapMoonrakerStateToTargetMediaState(moonrakerState);
      })
      .catch(handleError(this.context.log, this.context.config.moonrakerUrl,
        this.Characteristic.CurrentMediaState.LOADING));

    return currentMediaState;
  }


  private mapMoonrakerStateToCurrentMediaState(moonrakerState: string | undefined) {
    switch(moonrakerState) {
      case 'standby': {
        return this.Characteristic.CurrentMediaState.STOP;
      }
      case 'printing': {
        return this.Characteristic.CurrentMediaState.PLAY;
      }
      case 'paused': {
        return this.Characteristic.CurrentMediaState.PAUSE;
      }
      case 'complete': {
        return this.Characteristic.CurrentMediaState.STOP;
      }
      case 'cancelled': {
        return this.Characteristic.CurrentMediaState.INTERRUPTED;
      }
      default: {
        return this.Characteristic.CurrentMediaState.STOP;
      }
    }
  }

  private mapMoonrakerStateToTargetMediaState(moonrakerState: string | undefined) {
    switch(moonrakerState) {
      case 'standby': {
        return this.Characteristic.TargetMediaState.STOP;
      }
      case 'printing': {
        return this.Characteristic.TargetMediaState.PLAY;
      }
      case 'paused': {
        return this.Characteristic.TargetMediaState.PAUSE;
      }
      case 'complete': {
        return this.Characteristic.TargetMediaState.STOP;
      }
      default: {
        return this.Characteristic.TargetMediaState.STOP;
      }
    }
  }
}