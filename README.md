# Mi Band 2 JS library

Playing around with the [**Mi Band 2**](http://www.mi.com/en/miband2/).

![demo](/public/demo.png)

## Setting up

It's best to unbind your Mi Band 2 from MiFit App first.  
You should be able to bind it back again, but no guaranee here ;)

### Browser

Head to https://vshymanskyy.github.io/miband-js/

You need a browser with [WebBluettoth support](https://github.com/WebBluetoothCG/web-bluetooth/blob/master/README.md):
- Chrome on Mac OS
- Chrome on Linux (need to enable experimental flag)
- Chrome on Android

### Node.js

```sh
npm install -g https://github.com/vshymanskyy/miband-js.git
miband-test
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

log('Notifications demo...')
await miband.showNotification('message');
```

## Available API

```js

```
