'use strict';

import MiBand from './miband';
import test_all from './test';

import './styles/index.less';

const bluetooth = navigator.bluetooth;

const output = document.querySelector('#output');

function log() {
  document.querySelector('main').style.display = 'block';

  output.innerHTML += [...arguments].join(' ') + '\n';
}

async function scan() {
  if (!bluetooth) {
    log('WebBluetooth is not supported by your browser!');
    return;
  }

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

    await device.gatt.disconnect();

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

document.querySelector('#scanBtn').addEventListener('click', scan)

