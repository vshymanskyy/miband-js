# Mi Band 2 JS library

Playing around with the [**Mi Band 2**](http://www.mi.com/en/miband2/)

## Features
- Authentication
- Device info: time, battery status, hw/sw versions, etc.
- Button tap event
- Notifications: message, phone, vibrate
- Heart Rate Monitor
- Realtime data (soon)

![demo](/public/demo.png)

## Setting up

It's best to unbind your Mi Band 2 from MiFit App first.  
You should be able to bind it back again, but no guaranee here ;)

### Browser

Head to https://tiny.cc/miband-js

You need a browser with [WebBluetooth support](https://github.com/WebBluetoothCG/web-bluetooth/blob/master/implementation-status.md). Tested with:
- Chrome on Linux (with enabled experimental flag)
- Chrome on OS X
- Chrome on Android (6.0+)

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

If you're interested in Python implementation, take a look at https://github.com/vshymanskyy/miband2-python-test

---
## Contributing

Please check out [DEVELOPMENT.md](/DEVELOPMENT.md)
