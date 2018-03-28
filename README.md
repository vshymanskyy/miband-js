# Mi Band 2 JS library

A clean implementation of [**Mi Band 2**](http://www.mi.com/en/miband2/) library for Browsers and Node.js, using WebBluetooth API.
![demo](/public/demo.png)

## Setting up

It's best to unbind your Mi Band 2 from MiFit App first.  
You should be able to bind it back again, but no guaranee here ;)

### Browser

[![LIVE DEMO](/public/live-demo-btn.png)](https://tiny.cc/miband-js)

You need a browser with [WebBluetooth support](https://github.com/WebBluetoothCG/web-bluetooth/blob/master/implementation-status.md). Tested with:
- Chrome on OS X (Yosemite or later)
- Chrome on Android (6.0 Marshmallow or later)
- Chrome on Windows 10 and Linux (the `chrome://flags/#enable-experimental-web-platform-features` flag must be enabled)

### Node.js

```sh
npm install -g https://github.com/vshymanskyy/miband-js.git
miband-test
```

This should work on Windows, Linux and OSX.  
On Linux, you need to grant Bluetooth access for Node.js:
```sh
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

## Features

- Authentication
- Device info: time, battery status, hw/sw versions, etc.
- Button tap event
- Notifications: message, phone, vibrate
- Heart Rate Monitor
- Realtime data (soon)

## API usage example

```js
const MiBand = require('miband');

const device = await bluetooth.requestDevice({
  filters: [
    { services: [ MiBand.advertisementService ] }
  ],
  optionalServices: MiBand.optionalServices
});

const server = await device.gatt.connect();

let miband = new MiBand(server);
await miband.init();

log('Notifications demo...')
await miband.showNotification('message');
```

For more API examples, see https://github.com/vshymanskyy/miband-js/blob/master/src/test.js

---
## Contributing

Please check out [DEVELOPMENT.md](/DEVELOPMENT.md)
