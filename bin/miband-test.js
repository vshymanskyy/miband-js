#!/usr/bin/env node
'use strict';

global.TextDecoder = require('util').TextDecoder;

const bluetooth = require('webbluetooth').bluetooth;
const MiBand = require('../src/miband');
const test_all = require('../src/test');

const log = console.log;

async function scan() {
  try {
    log('Requesting Bluetooth Device...');
    const device = await bluetooth.requestDevice({
      filters: [
        { services: [ MiBand.advertisementService ] }
      ],
      optionalServices: MiBand.optionalServices
    });

    device.addEventListener('gattserverdisconnected', () => {
      log('Device disconnected');
    });

    log('Connecting to the device...');
    const server = await device.gatt.connect();
    log('Connected');

    let miband = new MiBand(server);

    await miband.init();

    await test_all(miband, log);

  } catch(error) {
    log('Argh!', error);
  }
}

scan();

