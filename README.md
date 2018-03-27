# Mi Band 2 JS library

Playing around with the [**Mi Band 2**](http://www.mi.com/en/miband2/) and Linux.

![demo](/demo.png)

**Note:** This is a fixed and improved version of a sample script, provided by [Leo Soares](https://github.com/leojrfs/miband2).  
He also wrote a nice article here: [Mi Band 2, Part 1: Authentication](https://leojrfs.github.io/writing/miband2-part1-auth/)

## Setting up

It's best to unbind your Mi Band 2 from MiFit App first.  
You should be able to bind it back again, but no guaranee here ;)

Next, install `Python 2` or `Python 3` and the `bluepy` library:
```sh
pip install bluepy --user
```

We're good to go!  
On the first run, you need to init your device with a new key:
```sh
miband2.py YOUR_MAC --init
```

Now you can run some samples:
```sh
miband2.py YOUR_MAC --notify
miband2.py YOUR_MAC --heart
```

## Cheatsheet

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
