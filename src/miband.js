'use strict';

const EventEmitter = require('events');
const crypto = require('browserify-aes');
const debug = require('debug')('MiBand');

const UUID_BASE = (x) => `0000${x}-0000-3512-2118-0009af100700`

// TODO: eliminate UUID_SHORT when this is fixed:
// https://github.com/thegecko/webbluetooth/issues/5
const UUID_SHORT = (x) => `0000${x}-0000-1000-8000-00805f9b34fb`

const UUID_SERVICE_GENERIC_ACCESS =     UUID_SHORT('1800')
const UUID_SERVICE_GENERIC_ATTRIBUTE =  UUID_SHORT('1801')
const UUID_SERVICE_DEVICE_INFORMATION = UUID_SHORT('180a')
const UUID_SERVICE_FIRMWARE =           UUID_BASE('1530')
const UUID_SERVICE_ALERT_NOTIFICATION = UUID_SHORT('1811')
const UUID_SERVICE_IMMEDIATE_ALERT =    UUID_SHORT('1802')
const UUID_SERVICE_HEART_RATE =         UUID_SHORT('180d')
const UUID_SERVICE_MIBAND_1 =           UUID_SHORT('fee0')
const UUID_SERVICE_MIBAND_2 =           UUID_SHORT('fee1')

// This is a helper function that constructs an ArrayBuffer based on arguments
const AB = function() {
  let args = [...arguments];

  // Convert all arrays to buffers
  args = args.map(function(i) {
    if (i instanceof Array) {
      return Buffer.from(i);
    }
    return i;
  })

  // Merge into a single buffer
  let buf = Buffer.concat(args);

  // Convert into ArrayBuffer
  let ab = new ArrayBuffer(buf.length);
  let view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

function parseDate(buff) {
  let year = buff.readUInt16LE(0),
    mon = buff[2],
    day = buff[3],
    hrs = buff[4],
    min = buff[5],
    sec = buff[6];
    //msec = buff[8] * 1000 / 256;
  return new Date([year, mon, day, hrs, min, sec])
}

class MiBand extends EventEmitter {

  static get advertisementService() { return 0xFEE0; }

  static get optionalServices() { return [
    UUID_SERVICE_GENERIC_ACCESS,
    UUID_SERVICE_GENERIC_ATTRIBUTE,
    UUID_SERVICE_DEVICE_INFORMATION,
    UUID_SERVICE_FIRMWARE,
    UUID_SERVICE_ALERT_NOTIFICATION,
    UUID_SERVICE_IMMEDIATE_ALERT,
    UUID_SERVICE_HEART_RATE,
    UUID_SERVICE_MIBAND_1,
    UUID_SERVICE_MIBAND_2,
  ] }

  constructor(peripheral) {
    super();

    this.device = peripheral;
    this.char = {}

    // TODO: this is constant for now, but should random and managed per-device
    this.key = new Buffer('30313233343536373839404142434445', 'hex');
    this.textDec = new TextDecoder();
  }

  async startNotificationsFor(c) {
    let char = this.char[c]
    await char.startNotifications()
    char.addEventListener('characteristicvaluechanged', this._handleNotify.bind(this));
  }

  async init() {
    let miband2 = await this.device.getPrimaryService(UUID_SERVICE_MIBAND_2)
    this.char.auth = await miband2.getCharacteristic(UUID_BASE('0009'))

    let miband1 = await this.device.getPrimaryService(UUID_SERVICE_MIBAND_1)
    this.char.sensor = await miband1.getCharacteristic(UUID_BASE('0001'))
    this.char.time =   await miband1.getCharacteristic(UUID_SHORT('2a2b'))
    this.char.config = await miband1.getCharacteristic(UUID_BASE('0003'))
    this.char.activ =  await miband1.getCharacteristic(UUID_BASE('0005'))
    this.char.batt =   await miband1.getCharacteristic(UUID_BASE('0006'))
    this.char.steps =  await miband1.getCharacteristic(UUID_BASE('0007'))
    this.char.user =   await miband1.getCharacteristic(UUID_BASE('0008'))
    this.char.event =  await miband1.getCharacteristic(UUID_BASE('0010'))

    let hrm = await this.device.getPrimaryService(UUID_SERVICE_HEART_RATE)
    this.char.hrm_ctrl = await hrm.getCharacteristic(UUID_SHORT('2a39'))
    this.char.hrm_data = await hrm.getCharacteristic(UUID_SHORT('2a37'))

    let imm_alert = await this.device.getPrimaryService(UUID_SERVICE_IMMEDIATE_ALERT)
    this.char.alert = await imm_alert.getCharacteristic(UUID_SHORT('2a06'))

    let devinfo = await this.device.getPrimaryService(UUID_SERVICE_DEVICE_INFORMATION)
    this.char.info_hwrev = await devinfo.getCharacteristic(UUID_SHORT('2a27'))
    this.char.info_swrev = await devinfo.getCharacteristic(UUID_SHORT('2a28'))
    try { // Serial Number is in blocklist of WebBluetooth spec
      this.char.info_serial = await devinfo.getCharacteristic(UUID_SHORT('2a25'))
    } catch(error) {
      // do nothing
    }

    let fw = await this.device.getPrimaryService(UUID_SERVICE_FIRMWARE)
    this.char.fw_ctrl = await fw.getCharacteristic(UUID_BASE('1531'))
    this.char.fw_data = await fw.getCharacteristic(UUID_BASE('1532'))

    await this.startNotificationsFor('auth')

    await this.authenticate()

    // Notifications should be enabled after auth
    await this.startNotificationsFor('hrm_data')
    await this.startNotificationsFor('event')
  }

  /*
   * Authentication
   */

  async authenticate() {
    await this.authReqRandomKey()

    return new Promise((resolve, reject) => {
      setTimeout(() => reject('Timeout'), 10000);
      this.once('authenticated', resolve);
    });
  }

  authSendNewKey(key)       { return this.char.auth.writeValue(AB([0x01, 0x08], key)) }
  authReqRandomKey()        { return this.char.auth.writeValue(AB([0x02, 0x08])) }
  authSendEncKey(encrypted) { return this.char.auth.writeValue(AB([0x03, 0x08], encrypted)) }

  /*
   * Button
   */

  waitButton(timeout = 10000) {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject('Timeout'), timeout);
      this.once('button', resolve);
    });
  }

  /*
   * Notifications
   */

  async showNotification(type = 'message') {
    debug('Notification:', type);
    switch(type) {
    case 'message': this.char.alert.writeValue(AB([0x01]));   break;
    case 'phone':   this.char.alert.writeValue(AB([0x02]));   break;
    case 'vibrate': this.char.alert.writeValue(AB([0x03]));   break;
    case 'off':     this.char.alert.writeValue(AB([0x00]));   break;
    default:        throw new Error('Unrecognized notification type');
    }
  }

  /*
   * Heart Rate Monitor
   */

  async hrmRead() {
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]))
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x00]))
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x01]))
    return new Promise((resolve, reject) => {
      setTimeout(() => reject('Timeout'), 15000);
      this.once('heart_rate', resolve);
    });
  }

  async hrmStart() {
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x00]))
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]))
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x01]))

    // Start pinging HRM
    this.hrmTimer = this.hrmTimer || setInterval(() => {
      debug('Pinging HRM')
      this.char.hrm_ctrl.writeValue(AB([0x16]))
    },12000);
  }

  async hrmStop() {
    clearInterval(this.hrmTimer);
    this.hrmTimer = undefined;
    await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]))
  }

  /*
   * General functions
   */

  async getBatteryInfo() {
    let data = await this.char.batt.readValue()
    data = Buffer.from(data.buffer)
    if (data.length <= 2) return 'unknown';

    let result = {}
    result.level = data[1]
    result.charging = !!data[2]
    result.off_date = parseDate(data.slice(3, 11))
    result.charge_date = parseDate(data.slice(11, 19))
    //result.charge_num = data[10]
    result.charge_level = data[19]
    return result;
  }

  async getTime() {
    let data = await this.char.time.readValue()
    data = Buffer.from(data.buffer)
    return parseDate(data)
  }

  async getSerial() {
    if (!this.char.info_serial) return 'unknown';
    let data = await this.char.info_serial.readValue()
    return this.textDec.decode(data)
  }

  async getHwRevision() {
    let data = await this.char.info_hwrev.readValue()
    return this.textDec.decode(data)
  }

  async getSwRevision() {
    let data = await this.char.info_swrev.readValue()
    return this.textDec.decode(data)
  }

  //async reboot() {
  //  await this.char.fw_ctrl.writeValue(AB([0x05]))
  //}

  /*
   * RAW data
   */

  /*
   * Internals
   */

  _handleNotify(event) {
    const value = Buffer.from(event.target.value.buffer);

    if (event.target.uuid === this.char.auth.uuid) {
      const cmd = value.slice(0,3).toString('hex');
      if (cmd === '100101') {         // Set New Key OK
        this.authReqRandomKey()
      } else if (cmd === '100201') {  // Req Random Number OK
        let rdn = value.slice(3)
        let cipher = crypto.createCipheriv('aes-128-ecb', this.key, '').setAutoPadding(false)
        let encrypted = Buffer.concat([cipher.update(rdn), cipher.final()])
        this.authSendEncKey(encrypted)
      } else if (cmd === '100301') {
        debug('Authenticated')
        this.emit('authenticated')

      } else if (cmd === '100104') {  // Set New Key FAIL
        this.emit('error', 'Key Sending failed')
      } else if (cmd === '100204') {  // Req Random Number FAIL
        this.emit('error', 'Key Sending failed')
      } else if (cmd === '100304') {
        debug('Encryption Key Auth Fail, sending new key...')
        this.authSendNewKey(this.key)
      } else {
        debug('Unhandled auth rsp:', value);
      }

    } else if (event.target.uuid === this.char.hrm_data.uuid) {
      let rate = value.readUInt16BE(0)
      this.emit('heart_rate', rate)

    } else if (event.target.uuid === this.char.event.uuid) {
      const cmd = value.toString('hex');
      if (cmd === '04') {
        this.emit('button')
      } else {
        debug('Unhandled event:', value);
      }
    } else {
      debug(event.target.uuid, '=>', value)
    }
  }
}

module.exports = MiBand;
