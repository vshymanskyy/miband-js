# Mi Band 2 JS library: Development

You can help this project by taking a look at the [list of tasks and issues](https://github.com/vshymanskyy/miband-js/issues)

## Enabling debug logs

**Node.js:** set DEBUG env. variable: `DEBUG = MiBand`  
**Browser:** open dev. console and run `localStorage.debug = 'MiBand'`, then refresh the page

## Useful info on Mi Band 2 protocol

1. Leo Soares wrote a nice article here: [Mi Band 2, Part 1: Authentication](https://leojrfs.github.io/writing/miband2-part1-auth/). He also provided a [Python example](https://github.com/leojrfs/miband2).
2. Andrey Nikishaev described some basic BLE priciples and a good way of [intercepting original **Mi Fit App** communication on Android](https://medium.com/@a.nikishaev/how-i-hacked-xiaomi-miband-2-to-control-it-from-linux-a5bd2f36d3ad).
   Check out his [Python library implementation](https://github.com/creotiv/MiBand2).
3. Some protocol implementation details can be found in [Freeyourgadget](https://github.com/Freeyourgadget/Gadgetbridge/tree/master/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/miband2) project.

## Linux cheatsheet

List all visible BLE devices to find out the MAC address:
```sh
sudo hcitool lescan
```

To list all descriptors of a device:
```sh
sudo gatttool -b YOUR_MAC -I -t random
> connect
> char-desc
```

Sometimes, BLE stack might fail, and the reset is needed:

```sh
sudo hciconfig hci0 reset
```
