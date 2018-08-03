(function () {
            'use strict';

            function __$styleInject(css) {
                if (!css) return;

                if (typeof window == 'undefined') return;
                var style = document.createElement('style');
                style.setAttribute('media', 'screen');

                style.innerHTML = css;
                document.head.appendChild(style);
                return css;
            }

            var global$1 = (typeof global !== "undefined" ? global :
                        typeof self !== "undefined" ? self :
                        typeof window !== "undefined" ? window : {});

            var lookup = [];
            var revLookup = [];
            var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
            var inited = false;
            function init () {
              inited = true;
              var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
              for (var i = 0, len = code.length; i < len; ++i) {
                lookup[i] = code[i];
                revLookup[code.charCodeAt(i)] = i;
              }

              revLookup['-'.charCodeAt(0)] = 62;
              revLookup['_'.charCodeAt(0)] = 63;
            }

            function toByteArray (b64) {
              if (!inited) {
                init();
              }
              var i, j, l, tmp, placeHolders, arr;
              var len = b64.length;

              if (len % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
              }

              // the number of equal signs (place holders)
              // if there are two placeholders, than the two characters before it
              // represent one byte
              // if there is only one, then the three characters before it represent 2 bytes
              // this is just a cheap hack to not do indexOf twice
              placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

              // base64 is 4/3 + up to two characters of the original data
              arr = new Arr(len * 3 / 4 - placeHolders);

              // if there are placeholders, only get up to the last complete 4 chars
              l = placeHolders > 0 ? len - 4 : len;

              var L = 0;

              for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
                arr[L++] = (tmp >> 16) & 0xFF;
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              if (placeHolders === 2) {
                tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
                arr[L++] = tmp & 0xFF;
              } else if (placeHolders === 1) {
                tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              return arr
            }

            function tripletToBase64 (num) {
              return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
            }

            function encodeChunk (uint8, start, end) {
              var tmp;
              var output = [];
              for (var i = start; i < end; i += 3) {
                tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
                output.push(tripletToBase64(tmp));
              }
              return output.join('')
            }

            function fromByteArray (uint8) {
              if (!inited) {
                init();
              }
              var tmp;
              var len = uint8.length;
              var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
              var output = '';
              var parts = [];
              var maxChunkLength = 16383; // must be multiple of 3

              // go through the array every three bytes, we'll deal with trailing stuff later
              for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
              }

              // pad the end with zeros, but make sure to not forget the extra bytes
              if (extraBytes === 1) {
                tmp = uint8[len - 1];
                output += lookup[tmp >> 2];
                output += lookup[(tmp << 4) & 0x3F];
                output += '==';
              } else if (extraBytes === 2) {
                tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
                output += lookup[tmp >> 10];
                output += lookup[(tmp >> 4) & 0x3F];
                output += lookup[(tmp << 2) & 0x3F];
                output += '=';
              }

              parts.push(output);

              return parts.join('')
            }

            function read (buffer, offset, isLE, mLen, nBytes) {
              var e, m;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var nBits = -7;
              var i = isLE ? (nBytes - 1) : 0;
              var d = isLE ? -1 : 1;
              var s = buffer[offset + i];

              i += d;

              e = s & ((1 << (-nBits)) - 1);
              s >>= (-nBits);
              nBits += eLen;
              for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              m = e & ((1 << (-nBits)) - 1);
              e >>= (-nBits);
              nBits += mLen;
              for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              if (e === 0) {
                e = 1 - eBias;
              } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity)
              } else {
                m = m + Math.pow(2, mLen);
                e = e - eBias;
              }
              return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
            }

            function write (buffer, value, offset, isLE, mLen, nBytes) {
              var e, m, c;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
              var i = isLE ? 0 : (nBytes - 1);
              var d = isLE ? 1 : -1;
              var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

              value = Math.abs(value);

              if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0;
                e = eMax;
              } else {
                e = Math.floor(Math.log(value) / Math.LN2);
                if (value * (c = Math.pow(2, -e)) < 1) {
                  e--;
                  c *= 2;
                }
                if (e + eBias >= 1) {
                  value += rt / c;
                } else {
                  value += rt * Math.pow(2, 1 - eBias);
                }
                if (value * c >= 2) {
                  e++;
                  c /= 2;
                }

                if (e + eBias >= eMax) {
                  m = 0;
                  e = eMax;
                } else if (e + eBias >= 1) {
                  m = (value * c - 1) * Math.pow(2, mLen);
                  e = e + eBias;
                } else {
                  m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                  e = 0;
                }
              }

              for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

              e = (e << mLen) | m;
              eLen += mLen;
              for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

              buffer[offset + i - d] |= s * 128;
            }

            var toString = {}.toString;

            var isArray = Array.isArray || function (arr) {
              return toString.call(arr) == '[object Array]';
            };

            var INSPECT_MAX_BYTES = 50;

            /**
             * If `Buffer.TYPED_ARRAY_SUPPORT`:
             *   === true    Use Uint8Array implementation (fastest)
             *   === false   Use Object implementation (most compatible, even IE6)
             *
             * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
             * Opera 11.6+, iOS 4.2+.
             *
             * Due to various browser bugs, sometimes the Object implementation will be used even
             * when the browser supports typed arrays.
             *
             * Note:
             *
             *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
             *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
             *
             *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
             *
             *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
             *     incorrect length in some situations.

             * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
             * get the Object implementation, which is slower but behaves correctly.
             */
            Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
              ? global$1.TYPED_ARRAY_SUPPORT
              : true;

            /*
             * Export kMaxLength after typed array support is determined.
             */
            var _kMaxLength = kMaxLength();

            function kMaxLength () {
              return Buffer.TYPED_ARRAY_SUPPORT
                ? 0x7fffffff
                : 0x3fffffff
            }

            function createBuffer (that, length) {
              if (kMaxLength() < length) {
                throw new RangeError('Invalid typed array length')
              }
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = new Uint8Array(length);
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                if (that === null) {
                  that = new Buffer(length);
                }
                that.length = length;
              }

              return that
            }

            /**
             * The Buffer constructor returns instances of `Uint8Array` that have their
             * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
             * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
             * and the `Uint8Array` methods. Square bracket notation works as expected -- it
             * returns a single octet.
             *
             * The `Uint8Array` prototype remains unmodified.
             */

            function Buffer (arg, encodingOrOffset, length) {
              if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
                return new Buffer(arg, encodingOrOffset, length)
              }

              // Common case.
              if (typeof arg === 'number') {
                if (typeof encodingOrOffset === 'string') {
                  throw new Error(
                    'If encoding is specified then the first argument must be a string'
                  )
                }
                return allocUnsafe(this, arg)
              }
              return from(this, arg, encodingOrOffset, length)
            }

            Buffer.poolSize = 8192; // not used by this implementation

            // TODO: Legacy, not needed anymore. Remove in next major version.
            Buffer._augment = function (arr) {
              arr.__proto__ = Buffer.prototype;
              return arr
            };

            function from (that, value, encodingOrOffset, length) {
              if (typeof value === 'number') {
                throw new TypeError('"value" argument must not be a number')
              }

              if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
                return fromArrayBuffer(that, value, encodingOrOffset, length)
              }

              if (typeof value === 'string') {
                return fromString(that, value, encodingOrOffset)
              }

              return fromObject(that, value)
            }

            /**
             * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
             * if value is a number.
             * Buffer.from(str[, encoding])
             * Buffer.from(array)
             * Buffer.from(buffer)
             * Buffer.from(arrayBuffer[, byteOffset[, length]])
             **/
            Buffer.from = function (value, encodingOrOffset, length) {
              return from(null, value, encodingOrOffset, length)
            };

            if (Buffer.TYPED_ARRAY_SUPPORT) {
              Buffer.prototype.__proto__ = Uint8Array.prototype;
              Buffer.__proto__ = Uint8Array;
            }

            function assertSize (size) {
              if (typeof size !== 'number') {
                throw new TypeError('"size" argument must be a number')
              } else if (size < 0) {
                throw new RangeError('"size" argument must not be negative')
              }
            }

            function alloc (that, size, fill, encoding) {
              assertSize(size);
              if (size <= 0) {
                return createBuffer(that, size)
              }
              if (fill !== undefined) {
                // Only pay attention to encoding if it's a string. This
                // prevents accidentally sending in a number that would
                // be interpretted as a start offset.
                return typeof encoding === 'string'
                  ? createBuffer(that, size).fill(fill, encoding)
                  : createBuffer(that, size).fill(fill)
              }
              return createBuffer(that, size)
            }

            /**
             * Creates a new filled Buffer instance.
             * alloc(size[, fill[, encoding]])
             **/
            Buffer.alloc = function (size, fill, encoding) {
              return alloc(null, size, fill, encoding)
            };

            function allocUnsafe (that, size) {
              assertSize(size);
              that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) {
                for (var i = 0; i < size; ++i) {
                  that[i] = 0;
                }
              }
              return that
            }

            /**
             * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
             * */
            Buffer.allocUnsafe = function (size) {
              return allocUnsafe(null, size)
            };
            /**
             * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
             */
            Buffer.allocUnsafeSlow = function (size) {
              return allocUnsafe(null, size)
            };

            function fromString (that, string, encoding) {
              if (typeof encoding !== 'string' || encoding === '') {
                encoding = 'utf8';
              }

              if (!Buffer.isEncoding(encoding)) {
                throw new TypeError('"encoding" must be a valid string encoding')
              }

              var length = byteLength(string, encoding) | 0;
              that = createBuffer(that, length);

              var actual = that.write(string, encoding);

              if (actual !== length) {
                // Writing a hex string, for example, that contains invalid characters will
                // cause everything after the first invalid character to be ignored. (e.g.
                // 'abxxcd' will be treated as 'ab')
                that = that.slice(0, actual);
              }

              return that
            }

            function fromArrayLike (that, array) {
              var length = array.length < 0 ? 0 : checked(array.length) | 0;
              that = createBuffer(that, length);
              for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255;
              }
              return that
            }

            function fromArrayBuffer (that, array, byteOffset, length) {
              array.byteLength; // this throws if `array` is not a valid ArrayBuffer

              if (byteOffset < 0 || array.byteLength < byteOffset) {
                throw new RangeError('\'offset\' is out of bounds')
              }

              if (array.byteLength < byteOffset + (length || 0)) {
                throw new RangeError('\'length\' is out of bounds')
              }

              if (byteOffset === undefined && length === undefined) {
                array = new Uint8Array(array);
              } else if (length === undefined) {
                array = new Uint8Array(array, byteOffset);
              } else {
                array = new Uint8Array(array, byteOffset, length);
              }

              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = array;
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                that = fromArrayLike(that, array);
              }
              return that
            }

            function fromObject (that, obj) {
              if (internalIsBuffer(obj)) {
                var len = checked(obj.length) | 0;
                that = createBuffer(that, len);

                if (that.length === 0) {
                  return that
                }

                obj.copy(that, 0, 0, len);
                return that
              }

              if (obj) {
                if ((typeof ArrayBuffer !== 'undefined' &&
                    obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
                  if (typeof obj.length !== 'number' || isnan(obj.length)) {
                    return createBuffer(that, 0)
                  }
                  return fromArrayLike(that, obj)
                }

                if (obj.type === 'Buffer' && isArray(obj.data)) {
                  return fromArrayLike(that, obj.data)
                }
              }

              throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
            }

            function checked (length) {
              // Note: cannot use `length < kMaxLength()` here because that fails when
              // length is NaN (which is otherwise coerced to zero.)
              if (length >= kMaxLength()) {
                throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                                     'size: 0x' + kMaxLength().toString(16) + ' bytes')
              }
              return length | 0
            }

            function SlowBuffer (length) {
              if (+length != length) { // eslint-disable-line eqeqeq
                length = 0;
              }
              return Buffer.alloc(+length)
            }
            Buffer.isBuffer = isBuffer;
            function internalIsBuffer (b) {
              return !!(b != null && b._isBuffer)
            }

            Buffer.compare = function compare (a, b) {
              if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
                throw new TypeError('Arguments must be Buffers')
              }

              if (a === b) return 0

              var x = a.length;
              var y = b.length;

              for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                if (a[i] !== b[i]) {
                  x = a[i];
                  y = b[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            Buffer.isEncoding = function isEncoding (encoding) {
              switch (String(encoding).toLowerCase()) {
                case 'hex':
                case 'utf8':
                case 'utf-8':
                case 'ascii':
                case 'latin1':
                case 'binary':
                case 'base64':
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return true
                default:
                  return false
              }
            };

            Buffer.concat = function concat (list, length) {
              if (!isArray(list)) {
                throw new TypeError('"list" argument must be an Array of Buffers')
              }

              if (list.length === 0) {
                return Buffer.alloc(0)
              }

              var i;
              if (length === undefined) {
                length = 0;
                for (i = 0; i < list.length; ++i) {
                  length += list[i].length;
                }
              }

              var buffer = Buffer.allocUnsafe(length);
              var pos = 0;
              for (i = 0; i < list.length; ++i) {
                var buf = list[i];
                if (!internalIsBuffer(buf)) {
                  throw new TypeError('"list" argument must be an Array of Buffers')
                }
                buf.copy(buffer, pos);
                pos += buf.length;
              }
              return buffer
            };

            function byteLength (string, encoding) {
              if (internalIsBuffer(string)) {
                return string.length
              }
              if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
                  (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
                return string.byteLength
              }
              if (typeof string !== 'string') {
                string = '' + string;
              }

              var len = string.length;
              if (len === 0) return 0

              // Use a for loop to avoid recursion
              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'ascii':
                  case 'latin1':
                  case 'binary':
                    return len
                  case 'utf8':
                  case 'utf-8':
                  case undefined:
                    return utf8ToBytes(string).length
                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return len * 2
                  case 'hex':
                    return len >>> 1
                  case 'base64':
                    return base64ToBytes(string).length
                  default:
                    if (loweredCase) return utf8ToBytes(string).length // assume utf8
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            }
            Buffer.byteLength = byteLength;

            function slowToString (encoding, start, end) {
              var loweredCase = false;

              // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
              // property of a typed array.

              // This behaves neither like String nor Uint8Array in that we set start/end
              // to their upper/lower bounds if the value passed is out of range.
              // undefined is handled specially as per ECMA-262 6th Edition,
              // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
              if (start === undefined || start < 0) {
                start = 0;
              }
              // Return early if start > this.length. Done here to prevent potential uint32
              // coercion fail below.
              if (start > this.length) {
                return ''
              }

              if (end === undefined || end > this.length) {
                end = this.length;
              }

              if (end <= 0) {
                return ''
              }

              // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
              end >>>= 0;
              start >>>= 0;

              if (end <= start) {
                return ''
              }

              if (!encoding) encoding = 'utf8';

              while (true) {
                switch (encoding) {
                  case 'hex':
                    return hexSlice(this, start, end)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Slice(this, start, end)

                  case 'ascii':
                    return asciiSlice(this, start, end)

                  case 'latin1':
                  case 'binary':
                    return latin1Slice(this, start, end)

                  case 'base64':
                    return base64Slice(this, start, end)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return utf16leSlice(this, start, end)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = (encoding + '').toLowerCase();
                    loweredCase = true;
                }
              }
            }

            // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
            // Buffer instances.
            Buffer.prototype._isBuffer = true;

            function swap (b, n, m) {
              var i = b[n];
              b[n] = b[m];
              b[m] = i;
            }

            Buffer.prototype.swap16 = function swap16 () {
              var len = this.length;
              if (len % 2 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 16-bits')
              }
              for (var i = 0; i < len; i += 2) {
                swap(this, i, i + 1);
              }
              return this
            };

            Buffer.prototype.swap32 = function swap32 () {
              var len = this.length;
              if (len % 4 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 32-bits')
              }
              for (var i = 0; i < len; i += 4) {
                swap(this, i, i + 3);
                swap(this, i + 1, i + 2);
              }
              return this
            };

            Buffer.prototype.swap64 = function swap64 () {
              var len = this.length;
              if (len % 8 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 64-bits')
              }
              for (var i = 0; i < len; i += 8) {
                swap(this, i, i + 7);
                swap(this, i + 1, i + 6);
                swap(this, i + 2, i + 5);
                swap(this, i + 3, i + 4);
              }
              return this
            };

            Buffer.prototype.toString = function toString () {
              var length = this.length | 0;
              if (length === 0) return ''
              if (arguments.length === 0) return utf8Slice(this, 0, length)
              return slowToString.apply(this, arguments)
            };

            Buffer.prototype.equals = function equals (b) {
              if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
              if (this === b) return true
              return Buffer.compare(this, b) === 0
            };

            Buffer.prototype.inspect = function inspect () {
              var str = '';
              var max = INSPECT_MAX_BYTES;
              if (this.length > 0) {
                str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
                if (this.length > max) str += ' ... ';
              }
              return '<Buffer ' + str + '>'
            };

            Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
              if (!internalIsBuffer(target)) {
                throw new TypeError('Argument must be a Buffer')
              }

              if (start === undefined) {
                start = 0;
              }
              if (end === undefined) {
                end = target ? target.length : 0;
              }
              if (thisStart === undefined) {
                thisStart = 0;
              }
              if (thisEnd === undefined) {
                thisEnd = this.length;
              }

              if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                throw new RangeError('out of range index')
              }

              if (thisStart >= thisEnd && start >= end) {
                return 0
              }
              if (thisStart >= thisEnd) {
                return -1
              }
              if (start >= end) {
                return 1
              }

              start >>>= 0;
              end >>>= 0;
              thisStart >>>= 0;
              thisEnd >>>= 0;

              if (this === target) return 0

              var x = thisEnd - thisStart;
              var y = end - start;
              var len = Math.min(x, y);

              var thisCopy = this.slice(thisStart, thisEnd);
              var targetCopy = target.slice(start, end);

              for (var i = 0; i < len; ++i) {
                if (thisCopy[i] !== targetCopy[i]) {
                  x = thisCopy[i];
                  y = targetCopy[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
            // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
            //
            // Arguments:
            // - buffer - a Buffer to search
            // - val - a string, Buffer, or number
            // - byteOffset - an index into `buffer`; will be clamped to an int32
            // - encoding - an optional encoding, relevant is val is a string
            // - dir - true for indexOf, false for lastIndexOf
            function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
              // Empty buffer means no match
              if (buffer.length === 0) return -1

              // Normalize byteOffset
              if (typeof byteOffset === 'string') {
                encoding = byteOffset;
                byteOffset = 0;
              } else if (byteOffset > 0x7fffffff) {
                byteOffset = 0x7fffffff;
              } else if (byteOffset < -0x80000000) {
                byteOffset = -0x80000000;
              }
              byteOffset = +byteOffset;  // Coerce to Number.
              if (isNaN(byteOffset)) {
                // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
                byteOffset = dir ? 0 : (buffer.length - 1);
              }

              // Normalize byteOffset: negative offsets start from the end of the buffer
              if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
              if (byteOffset >= buffer.length) {
                if (dir) return -1
                else byteOffset = buffer.length - 1;
              } else if (byteOffset < 0) {
                if (dir) byteOffset = 0;
                else return -1
              }

              // Normalize val
              if (typeof val === 'string') {
                val = Buffer.from(val, encoding);
              }

              // Finally, search either indexOf (if dir is true) or lastIndexOf
              if (internalIsBuffer(val)) {
                // Special case: looking for empty string/buffer always fails
                if (val.length === 0) {
                  return -1
                }
                return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
              } else if (typeof val === 'number') {
                val = val & 0xFF; // Search for a byte value [0-255]
                if (Buffer.TYPED_ARRAY_SUPPORT &&
                    typeof Uint8Array.prototype.indexOf === 'function') {
                  if (dir) {
                    return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                  } else {
                    return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                  }
                }
                return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
              }

              throw new TypeError('val must be string, number or Buffer')
            }

            function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
              var indexSize = 1;
              var arrLength = arr.length;
              var valLength = val.length;

              if (encoding !== undefined) {
                encoding = String(encoding).toLowerCase();
                if (encoding === 'ucs2' || encoding === 'ucs-2' ||
                    encoding === 'utf16le' || encoding === 'utf-16le') {
                  if (arr.length < 2 || val.length < 2) {
                    return -1
                  }
                  indexSize = 2;
                  arrLength /= 2;
                  valLength /= 2;
                  byteOffset /= 2;
                }
              }

              function read$$1 (buf, i) {
                if (indexSize === 1) {
                  return buf[i]
                } else {
                  return buf.readUInt16BE(i * indexSize)
                }
              }

              var i;
              if (dir) {
                var foundIndex = -1;
                for (i = byteOffset; i < arrLength; i++) {
                  if (read$$1(arr, i) === read$$1(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                    if (foundIndex === -1) foundIndex = i;
                    if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                  } else {
                    if (foundIndex !== -1) i -= i - foundIndex;
                    foundIndex = -1;
                  }
                }
              } else {
                if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
                for (i = byteOffset; i >= 0; i--) {
                  var found = true;
                  for (var j = 0; j < valLength; j++) {
                    if (read$$1(arr, i + j) !== read$$1(val, j)) {
                      found = false;
                      break
                    }
                  }
                  if (found) return i
                }
              }

              return -1
            }

            Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
              return this.indexOf(val, byteOffset, encoding) !== -1
            };

            Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
            };

            Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
            };

            function hexWrite (buf, string, offset, length) {
              offset = Number(offset) || 0;
              var remaining = buf.length - offset;
              if (!length) {
                length = remaining;
              } else {
                length = Number(length);
                if (length > remaining) {
                  length = remaining;
                }
              }

              // must be an even number of digits
              var strLen = string.length;
              if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

              if (length > strLen / 2) {
                length = strLen / 2;
              }
              for (var i = 0; i < length; ++i) {
                var parsed = parseInt(string.substr(i * 2, 2), 16);
                if (isNaN(parsed)) return i
                buf[offset + i] = parsed;
              }
              return i
            }

            function utf8Write (buf, string, offset, length) {
              return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
            }

            function asciiWrite (buf, string, offset, length) {
              return blitBuffer(asciiToBytes(string), buf, offset, length)
            }

            function latin1Write (buf, string, offset, length) {
              return asciiWrite(buf, string, offset, length)
            }

            function base64Write (buf, string, offset, length) {
              return blitBuffer(base64ToBytes(string), buf, offset, length)
            }

            function ucs2Write (buf, string, offset, length) {
              return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
            }

            Buffer.prototype.write = function write$$1 (string, offset, length, encoding) {
              // Buffer#write(string)
              if (offset === undefined) {
                encoding = 'utf8';
                length = this.length;
                offset = 0;
              // Buffer#write(string, encoding)
              } else if (length === undefined && typeof offset === 'string') {
                encoding = offset;
                length = this.length;
                offset = 0;
              // Buffer#write(string, offset[, length][, encoding])
              } else if (isFinite(offset)) {
                offset = offset | 0;
                if (isFinite(length)) {
                  length = length | 0;
                  if (encoding === undefined) encoding = 'utf8';
                } else {
                  encoding = length;
                  length = undefined;
                }
              // legacy write(string, encoding, offset, length) - remove in v0.13
              } else {
                throw new Error(
                  'Buffer.write(string, encoding, offset[, length]) is no longer supported'
                )
              }

              var remaining = this.length - offset;
              if (length === undefined || length > remaining) length = remaining;

              if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                throw new RangeError('Attempt to write outside buffer bounds')
              }

              if (!encoding) encoding = 'utf8';

              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'hex':
                    return hexWrite(this, string, offset, length)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Write(this, string, offset, length)

                  case 'ascii':
                    return asciiWrite(this, string, offset, length)

                  case 'latin1':
                  case 'binary':
                    return latin1Write(this, string, offset, length)

                  case 'base64':
                    // Warning: maxLength not taken into account in base64Write
                    return base64Write(this, string, offset, length)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return ucs2Write(this, string, offset, length)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            };

            Buffer.prototype.toJSON = function toJSON () {
              return {
                type: 'Buffer',
                data: Array.prototype.slice.call(this._arr || this, 0)
              }
            };

            function base64Slice (buf, start, end) {
              if (start === 0 && end === buf.length) {
                return fromByteArray(buf)
              } else {
                return fromByteArray(buf.slice(start, end))
              }
            }

            function utf8Slice (buf, start, end) {
              end = Math.min(buf.length, end);
              var res = [];

              var i = start;
              while (i < end) {
                var firstByte = buf[i];
                var codePoint = null;
                var bytesPerSequence = (firstByte > 0xEF) ? 4
                  : (firstByte > 0xDF) ? 3
                  : (firstByte > 0xBF) ? 2
                  : 1;

                if (i + bytesPerSequence <= end) {
                  var secondByte, thirdByte, fourthByte, tempCodePoint;

                  switch (bytesPerSequence) {
                    case 1:
                      if (firstByte < 0x80) {
                        codePoint = firstByte;
                      }
                      break
                    case 2:
                      secondByte = buf[i + 1];
                      if ((secondByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
                        if (tempCodePoint > 0x7F) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 3:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
                        if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 4:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      fourthByte = buf[i + 3];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
                        if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                          codePoint = tempCodePoint;
                        }
                      }
                  }
                }

                if (codePoint === null) {
                  // we did not generate a valid codePoint so insert a
                  // replacement char (U+FFFD) and advance only 1 byte
                  codePoint = 0xFFFD;
                  bytesPerSequence = 1;
                } else if (codePoint > 0xFFFF) {
                  // encode to utf16 (surrogate pair dance)
                  codePoint -= 0x10000;
                  res.push(codePoint >>> 10 & 0x3FF | 0xD800);
                  codePoint = 0xDC00 | codePoint & 0x3FF;
                }

                res.push(codePoint);
                i += bytesPerSequence;
              }

              return decodeCodePointsArray(res)
            }

            // Based on http://stackoverflow.com/a/22747272/680742, the browser with
            // the lowest limit is Chrome, with 0x10000 args.
            // We go 1 magnitude less, for safety
            var MAX_ARGUMENTS_LENGTH = 0x1000;

            function decodeCodePointsArray (codePoints) {
              var len = codePoints.length;
              if (len <= MAX_ARGUMENTS_LENGTH) {
                return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
              }

              // Decode in chunks to avoid "call stack size exceeded".
              var res = '';
              var i = 0;
              while (i < len) {
                res += String.fromCharCode.apply(
                  String,
                  codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                );
              }
              return res
            }

            function asciiSlice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i] & 0x7F);
              }
              return ret
            }

            function latin1Slice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i]);
              }
              return ret
            }

            function hexSlice (buf, start, end) {
              var len = buf.length;

              if (!start || start < 0) start = 0;
              if (!end || end < 0 || end > len) end = len;

              var out = '';
              for (var i = start; i < end; ++i) {
                out += toHex(buf[i]);
              }
              return out
            }

            function utf16leSlice (buf, start, end) {
              var bytes = buf.slice(start, end);
              var res = '';
              for (var i = 0; i < bytes.length; i += 2) {
                res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
              }
              return res
            }

            Buffer.prototype.slice = function slice (start, end) {
              var len = this.length;
              start = ~~start;
              end = end === undefined ? len : ~~end;

              if (start < 0) {
                start += len;
                if (start < 0) start = 0;
              } else if (start > len) {
                start = len;
              }

              if (end < 0) {
                end += len;
                if (end < 0) end = 0;
              } else if (end > len) {
                end = len;
              }

              if (end < start) end = start;

              var newBuf;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                newBuf = this.subarray(start, end);
                newBuf.__proto__ = Buffer.prototype;
              } else {
                var sliceLen = end - start;
                newBuf = new Buffer(sliceLen, undefined);
                for (var i = 0; i < sliceLen; ++i) {
                  newBuf[i] = this[i + start];
                }
              }

              return newBuf
            };

            /*
             * Need to make sure that buffer isn't trying to write out of bounds.
             */
            function checkOffset (offset, ext, length) {
              if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
              if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
            }

            Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }

              return val
            };

            Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
              }

              var val = this[offset + --byteLength];
              var mul = 1;
              while (byteLength > 0 && (mul *= 0x100)) {
                val += this[offset + --byteLength] * mul;
              }

              return val
            };

            Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              return this[offset]
            };

            Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return this[offset] | (this[offset + 1] << 8)
            };

            Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return (this[offset] << 8) | this[offset + 1]
            };

            Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return ((this[offset]) |
                  (this[offset + 1] << 8) |
                  (this[offset + 2] << 16)) +
                  (this[offset + 3] * 0x1000000)
            };

            Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] * 0x1000000) +
                ((this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                this[offset + 3])
            };

            Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var i = byteLength;
              var mul = 1;
              var val = this[offset + --i];
              while (i > 0 && (mul *= 0x100)) {
                val += this[offset + --i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              if (!(this[offset] & 0x80)) return (this[offset])
              return ((0xff - this[offset] + 1) * -1)
            };

            Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset] | (this[offset + 1] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset + 1] | (this[offset] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16) |
                (this[offset + 3] << 24)
            };

            Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] << 24) |
                (this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                (this[offset + 3])
            };

            Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, true, 23, 4)
            };

            Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, false, 23, 4)
            };

            Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, true, 52, 8)
            };

            Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, false, 52, 8)
            };

            function checkInt (buf, value, offset, ext, max, min) {
              if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
              if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
            }

            Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var mul = 1;
              var i = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var i = byteLength - 1;
              var mul = 1;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              this[offset] = (value & 0xff);
              return offset + 1
            };

            function objectWriteUInt16 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
                buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                  (littleEndian ? i : 1 - i) * 8;
              }
            }

            Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            function objectWriteUInt32 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffffffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
                buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
              }
            }

            Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset + 3] = (value >>> 24);
                this[offset + 2] = (value >>> 16);
                this[offset + 1] = (value >>> 8);
                this[offset] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = 0;
              var mul = 1;
              var sub = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = byteLength - 1;
              var mul = 1;
              var sub = 0;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              if (value < 0) value = 0xff + value + 1;
              this[offset] = (value & 0xff);
              return offset + 1
            };

            Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
                this[offset + 2] = (value >>> 16);
                this[offset + 3] = (value >>> 24);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (value < 0) value = 0xffffffff + value + 1;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            function checkIEEE754 (buf, value, offset, ext, max, min) {
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
              if (offset < 0) throw new RangeError('Index out of range')
            }

            function writeFloat (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
              }
              write(buf, value, offset, littleEndian, 23, 4);
              return offset + 4
            }

            Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
              return writeFloat(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
              return writeFloat(this, value, offset, false, noAssert)
            };

            function writeDouble (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
              }
              write(buf, value, offset, littleEndian, 52, 8);
              return offset + 8
            }

            Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
              return writeDouble(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
              return writeDouble(this, value, offset, false, noAssert)
            };

            // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
            Buffer.prototype.copy = function copy (target, targetStart, start, end) {
              if (!start) start = 0;
              if (!end && end !== 0) end = this.length;
              if (targetStart >= target.length) targetStart = target.length;
              if (!targetStart) targetStart = 0;
              if (end > 0 && end < start) end = start;

              // Copy 0 bytes; we're done
              if (end === start) return 0
              if (target.length === 0 || this.length === 0) return 0

              // Fatal error conditions
              if (targetStart < 0) {
                throw new RangeError('targetStart out of bounds')
              }
              if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
              if (end < 0) throw new RangeError('sourceEnd out of bounds')

              // Are we oob?
              if (end > this.length) end = this.length;
              if (target.length - targetStart < end - start) {
                end = target.length - targetStart + start;
              }

              var len = end - start;
              var i;

              if (this === target && start < targetStart && targetStart < end) {
                // descending copy from end
                for (i = len - 1; i >= 0; --i) {
                  target[i + targetStart] = this[i + start];
                }
              } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                // ascending copy from start
                for (i = 0; i < len; ++i) {
                  target[i + targetStart] = this[i + start];
                }
              } else {
                Uint8Array.prototype.set.call(
                  target,
                  this.subarray(start, start + len),
                  targetStart
                );
              }

              return len
            };

            // Usage:
            //    buffer.fill(number[, offset[, end]])
            //    buffer.fill(buffer[, offset[, end]])
            //    buffer.fill(string[, offset[, end]][, encoding])
            Buffer.prototype.fill = function fill (val, start, end, encoding) {
              // Handle string cases:
              if (typeof val === 'string') {
                if (typeof start === 'string') {
                  encoding = start;
                  start = 0;
                  end = this.length;
                } else if (typeof end === 'string') {
                  encoding = end;
                  end = this.length;
                }
                if (val.length === 1) {
                  var code = val.charCodeAt(0);
                  if (code < 256) {
                    val = code;
                  }
                }
                if (encoding !== undefined && typeof encoding !== 'string') {
                  throw new TypeError('encoding must be a string')
                }
                if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                  throw new TypeError('Unknown encoding: ' + encoding)
                }
              } else if (typeof val === 'number') {
                val = val & 255;
              }

              // Invalid ranges are not set to a default, so can range check early.
              if (start < 0 || this.length < start || this.length < end) {
                throw new RangeError('Out of range index')
              }

              if (end <= start) {
                return this
              }

              start = start >>> 0;
              end = end === undefined ? this.length : end >>> 0;

              if (!val) val = 0;

              var i;
              if (typeof val === 'number') {
                for (i = start; i < end; ++i) {
                  this[i] = val;
                }
              } else {
                var bytes = internalIsBuffer(val)
                  ? val
                  : utf8ToBytes(new Buffer(val, encoding).toString());
                var len = bytes.length;
                for (i = 0; i < end - start; ++i) {
                  this[i + start] = bytes[i % len];
                }
              }

              return this
            };

            // HELPER FUNCTIONS
            // ================

            var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

            function base64clean (str) {
              // Node strips out invalid characters like \n and \t from the string, base64-js does not
              str = stringtrim(str).replace(INVALID_BASE64_RE, '');
              // Node converts strings with length < 2 to ''
              if (str.length < 2) return ''
              // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
              while (str.length % 4 !== 0) {
                str = str + '=';
              }
              return str
            }

            function stringtrim (str) {
              if (str.trim) return str.trim()
              return str.replace(/^\s+|\s+$/g, '')
            }

            function toHex (n) {
              if (n < 16) return '0' + n.toString(16)
              return n.toString(16)
            }

            function utf8ToBytes (string, units) {
              units = units || Infinity;
              var codePoint;
              var length = string.length;
              var leadSurrogate = null;
              var bytes = [];

              for (var i = 0; i < length; ++i) {
                codePoint = string.charCodeAt(i);

                // is surrogate component
                if (codePoint > 0xD7FF && codePoint < 0xE000) {
                  // last char was a lead
                  if (!leadSurrogate) {
                    // no lead yet
                    if (codePoint > 0xDBFF) {
                      // unexpected trail
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    } else if (i + 1 === length) {
                      // unpaired lead
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    }

                    // valid lead
                    leadSurrogate = codePoint;

                    continue
                  }

                  // 2 leads in a row
                  if (codePoint < 0xDC00) {
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                    leadSurrogate = codePoint;
                    continue
                  }

                  // valid surrogate pair
                  codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
                } else if (leadSurrogate) {
                  // valid bmp char, but last char was a lead
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                }

                leadSurrogate = null;

                // encode utf8
                if (codePoint < 0x80) {
                  if ((units -= 1) < 0) break
                  bytes.push(codePoint);
                } else if (codePoint < 0x800) {
                  if ((units -= 2) < 0) break
                  bytes.push(
                    codePoint >> 0x6 | 0xC0,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x10000) {
                  if ((units -= 3) < 0) break
                  bytes.push(
                    codePoint >> 0xC | 0xE0,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x110000) {
                  if ((units -= 4) < 0) break
                  bytes.push(
                    codePoint >> 0x12 | 0xF0,
                    codePoint >> 0xC & 0x3F | 0x80,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else {
                  throw new Error('Invalid code point')
                }
              }

              return bytes
            }

            function asciiToBytes (str) {
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                // Node's code seems to be doing this and not & 0x7F..
                byteArray.push(str.charCodeAt(i) & 0xFF);
              }
              return byteArray
            }

            function utf16leToBytes (str, units) {
              var c, hi, lo;
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                if ((units -= 2) < 0) break

                c = str.charCodeAt(i);
                hi = c >> 8;
                lo = c % 256;
                byteArray.push(lo);
                byteArray.push(hi);
              }

              return byteArray
            }


            function base64ToBytes (str) {
              return toByteArray(base64clean(str))
            }

            function blitBuffer (src, dst, offset, length) {
              for (var i = 0; i < length; ++i) {
                if ((i + offset >= dst.length) || (i >= src.length)) break
                dst[i + offset] = src[i];
              }
              return i
            }

            function isnan (val) {
              return val !== val // eslint-disable-line no-self-compare
            }


            // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
            // The _isBuffer check is for Safari 5-7 support, because it's missing
            // Object.prototype.constructor. Remove this eventually
            function isBuffer(obj) {
              return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
            }

            function isFastBuffer (obj) {
              return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
            }

            // For Node v0.10 support. Remove this eventually.
            function isSlowBuffer (obj) {
              return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
            }

            var bufferEs6 = /*#__PURE__*/Object.freeze({
                        INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
                        kMaxLength: _kMaxLength,
                        Buffer: Buffer,
                        SlowBuffer: SlowBuffer,
                        isBuffer: isBuffer
            });

            var domain;

            // This constructor is used to store event handlers. Instantiating this is
            // faster than explicitly calling `Object.create(null)` to get a "clean" empty
            // object (tested with v8 v4.9).
            function EventHandlers() {}
            EventHandlers.prototype = Object.create(null);

            function EventEmitter() {
              EventEmitter.init.call(this);
            }

            // nodejs oddity
            // require('events') === require('events').EventEmitter
            EventEmitter.EventEmitter = EventEmitter;

            EventEmitter.usingDomains = false;

            EventEmitter.prototype.domain = undefined;
            EventEmitter.prototype._events = undefined;
            EventEmitter.prototype._maxListeners = undefined;

            // By default EventEmitters will print a warning if more than 10 listeners are
            // added to it. This is a useful default which helps finding memory leaks.
            EventEmitter.defaultMaxListeners = 10;

            EventEmitter.init = function() {
              this.domain = null;
              if (EventEmitter.usingDomains) {
                // if there is an active domain, then attach to it.
                if (domain.active && !(this instanceof domain.Domain)) ;
              }

              if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
                this._events = new EventHandlers();
                this._eventsCount = 0;
              }

              this._maxListeners = this._maxListeners || undefined;
            };

            // Obviously not all Emitters should be limited to 10. This function allows
            // that to be increased. Set to zero for unlimited.
            EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
              if (typeof n !== 'number' || n < 0 || isNaN(n))
                throw new TypeError('"n" argument must be a positive number');
              this._maxListeners = n;
              return this;
            };

            function $getMaxListeners(that) {
              if (that._maxListeners === undefined)
                return EventEmitter.defaultMaxListeners;
              return that._maxListeners;
            }

            EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
              return $getMaxListeners(this);
            };

            // These standalone emit* functions are used to optimize calling of event
            // handlers for fast cases because emit() itself often has a variable number of
            // arguments and can be deoptimized because of that. These functions always have
            // the same number of arguments and thus do not get deoptimized, so the code
            // inside them can execute faster.
            function emitNone(handler, isFn, self) {
              if (isFn)
                handler.call(self);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self);
              }
            }
            function emitOne(handler, isFn, self, arg1) {
              if (isFn)
                handler.call(self, arg1);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1);
              }
            }
            function emitTwo(handler, isFn, self, arg1, arg2) {
              if (isFn)
                handler.call(self, arg1, arg2);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1, arg2);
              }
            }
            function emitThree(handler, isFn, self, arg1, arg2, arg3) {
              if (isFn)
                handler.call(self, arg1, arg2, arg3);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].call(self, arg1, arg2, arg3);
              }
            }

            function emitMany(handler, isFn, self, args) {
              if (isFn)
                handler.apply(self, args);
              else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                  listeners[i].apply(self, args);
              }
            }

            EventEmitter.prototype.emit = function emit(type) {
              var er, handler, len, args, i, events, domain;
              var doError = (type === 'error');

              events = this._events;
              if (events)
                doError = (doError && events.error == null);
              else if (!doError)
                return false;

              domain = this.domain;

              // If there is no 'error' event listener then throw.
              if (doError) {
                er = arguments[1];
                if (domain) {
                  if (!er)
                    er = new Error('Uncaught, unspecified "error" event');
                  er.domainEmitter = this;
                  er.domain = domain;
                  er.domainThrown = false;
                  domain.emit('error', er);
                } else if (er instanceof Error) {
                  throw er; // Unhandled 'error' event
                } else {
                  // At least give some kind of context to the user
                  var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
                  err.context = er;
                  throw err;
                }
                return false;
              }

              handler = events[type];

              if (!handler)
                return false;

              var isFn = typeof handler === 'function';
              len = arguments.length;
              switch (len) {
                // fast cases
                case 1:
                  emitNone(handler, isFn, this);
                  break;
                case 2:
                  emitOne(handler, isFn, this, arguments[1]);
                  break;
                case 3:
                  emitTwo(handler, isFn, this, arguments[1], arguments[2]);
                  break;
                case 4:
                  emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
                  break;
                // slower
                default:
                  args = new Array(len - 1);
                  for (i = 1; i < len; i++)
                    args[i - 1] = arguments[i];
                  emitMany(handler, isFn, this, args);
              }

              return true;
            };

            function _addListener(target, type, listener, prepend) {
              var m;
              var events;
              var existing;

              if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');

              events = target._events;
              if (!events) {
                events = target._events = new EventHandlers();
                target._eventsCount = 0;
              } else {
                // To avoid recursion in the case that type === "newListener"! Before
                // adding it to the listeners, first emit "newListener".
                if (events.newListener) {
                  target.emit('newListener', type,
                              listener.listener ? listener.listener : listener);

                  // Re-assign `events` because a newListener handler could have caused the
                  // this._events to be assigned to a new object
                  events = target._events;
                }
                existing = events[type];
              }

              if (!existing) {
                // Optimize the case of one listener. Don't need the extra array object.
                existing = events[type] = listener;
                ++target._eventsCount;
              } else {
                if (typeof existing === 'function') {
                  // Adding the second element, need to change to array.
                  existing = events[type] = prepend ? [listener, existing] :
                                                      [existing, listener];
                } else {
                  // If we've already got an array, just append.
                  if (prepend) {
                    existing.unshift(listener);
                  } else {
                    existing.push(listener);
                  }
                }

                // Check for listener leak
                if (!existing.warned) {
                  m = $getMaxListeners(target);
                  if (m && m > 0 && existing.length > m) {
                    existing.warned = true;
                    var w = new Error('Possible EventEmitter memory leak detected. ' +
                                        existing.length + ' ' + type + ' listeners added. ' +
                                        'Use emitter.setMaxListeners() to increase limit');
                    w.name = 'MaxListenersExceededWarning';
                    w.emitter = target;
                    w.type = type;
                    w.count = existing.length;
                    emitWarning(w);
                  }
                }
              }

              return target;
            }
            function emitWarning(e) {
              typeof console.warn === 'function' ? console.warn(e) : console.log(e);
            }
            EventEmitter.prototype.addListener = function addListener(type, listener) {
              return _addListener(this, type, listener, false);
            };

            EventEmitter.prototype.on = EventEmitter.prototype.addListener;

            EventEmitter.prototype.prependListener =
                function prependListener(type, listener) {
                  return _addListener(this, type, listener, true);
                };

            function _onceWrap(target, type, listener) {
              var fired = false;
              function g() {
                target.removeListener(type, g);
                if (!fired) {
                  fired = true;
                  listener.apply(target, arguments);
                }
              }
              g.listener = listener;
              return g;
            }

            EventEmitter.prototype.once = function once(type, listener) {
              if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');
              this.on(type, _onceWrap(this, type, listener));
              return this;
            };

            EventEmitter.prototype.prependOnceListener =
                function prependOnceListener(type, listener) {
                  if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');
                  this.prependListener(type, _onceWrap(this, type, listener));
                  return this;
                };

            // emits a 'removeListener' event iff the listener was removed
            EventEmitter.prototype.removeListener =
                function removeListener(type, listener) {
                  var list, events, position, i, originalListener;

                  if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');

                  events = this._events;
                  if (!events)
                    return this;

                  list = events[type];
                  if (!list)
                    return this;

                  if (list === listener || (list.listener && list.listener === listener)) {
                    if (--this._eventsCount === 0)
                      this._events = new EventHandlers();
                    else {
                      delete events[type];
                      if (events.removeListener)
                        this.emit('removeListener', type, list.listener || listener);
                    }
                  } else if (typeof list !== 'function') {
                    position = -1;

                    for (i = list.length; i-- > 0;) {
                      if (list[i] === listener ||
                          (list[i].listener && list[i].listener === listener)) {
                        originalListener = list[i].listener;
                        position = i;
                        break;
                      }
                    }

                    if (position < 0)
                      return this;

                    if (list.length === 1) {
                      list[0] = undefined;
                      if (--this._eventsCount === 0) {
                        this._events = new EventHandlers();
                        return this;
                      } else {
                        delete events[type];
                      }
                    } else {
                      spliceOne(list, position);
                    }

                    if (events.removeListener)
                      this.emit('removeListener', type, originalListener || listener);
                  }

                  return this;
                };

            EventEmitter.prototype.removeAllListeners =
                function removeAllListeners(type) {
                  var listeners, events;

                  events = this._events;
                  if (!events)
                    return this;

                  // not listening for removeListener, no need to emit
                  if (!events.removeListener) {
                    if (arguments.length === 0) {
                      this._events = new EventHandlers();
                      this._eventsCount = 0;
                    } else if (events[type]) {
                      if (--this._eventsCount === 0)
                        this._events = new EventHandlers();
                      else
                        delete events[type];
                    }
                    return this;
                  }

                  // emit removeListener for all listeners on all events
                  if (arguments.length === 0) {
                    var keys = Object.keys(events);
                    for (var i = 0, key; i < keys.length; ++i) {
                      key = keys[i];
                      if (key === 'removeListener') continue;
                      this.removeAllListeners(key);
                    }
                    this.removeAllListeners('removeListener');
                    this._events = new EventHandlers();
                    this._eventsCount = 0;
                    return this;
                  }

                  listeners = events[type];

                  if (typeof listeners === 'function') {
                    this.removeListener(type, listeners);
                  } else if (listeners) {
                    // LIFO order
                    do {
                      this.removeListener(type, listeners[listeners.length - 1]);
                    } while (listeners[0]);
                  }

                  return this;
                };

            EventEmitter.prototype.listeners = function listeners(type) {
              var evlistener;
              var ret;
              var events = this._events;

              if (!events)
                ret = [];
              else {
                evlistener = events[type];
                if (!evlistener)
                  ret = [];
                else if (typeof evlistener === 'function')
                  ret = [evlistener.listener || evlistener];
                else
                  ret = unwrapListeners(evlistener);
              }

              return ret;
            };

            EventEmitter.listenerCount = function(emitter, type) {
              if (typeof emitter.listenerCount === 'function') {
                return emitter.listenerCount(type);
              } else {
                return listenerCount.call(emitter, type);
              }
            };

            EventEmitter.prototype.listenerCount = listenerCount;
            function listenerCount(type) {
              var events = this._events;

              if (events) {
                var evlistener = events[type];

                if (typeof evlistener === 'function') {
                  return 1;
                } else if (evlistener) {
                  return evlistener.length;
                }
              }

              return 0;
            }

            EventEmitter.prototype.eventNames = function eventNames() {
              return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
            };

            // About 1.5x faster than the two-arg version of Array#splice().
            function spliceOne(list, index) {
              for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
                list[i] = list[k];
              list.pop();
            }

            function arrayClone(arr, i) {
              var copy = new Array(i);
              while (i--)
                copy[i] = arr[i];
              return copy;
            }

            function unwrapListeners(arr) {
              var ret = new Array(arr.length);
              for (var i = 0; i < ret.length; ++i) {
                ret[i] = arr[i].listener || arr[i];
              }
              return ret;
            }

            var events = /*#__PURE__*/Object.freeze({
                        default: EventEmitter,
                        EventEmitter: EventEmitter
            });

            function createCommonjsModule(fn, module) {
            	return module = { exports: {} }, fn(module, module.exports), module.exports;
            }

            var encrypt = function (self, block) {
              return self._cipher.encryptBlock(block)
            };

            var decrypt = function (self, block) {
              return self._cipher.decryptBlock(block)
            };

            var ecb = {
            	encrypt: encrypt,
            	decrypt: decrypt
            };

            var bufferXor = function xor (a, b) {
              var length = Math.min(a.length, b.length);
              var buffer = new Buffer(length);

              for (var i = 0; i < length; ++i) {
                buffer[i] = a[i] ^ b[i];
              }

              return buffer
            };

            var encrypt$1 = function (self, block) {
              var data = bufferXor(block, self._prev);

              self._prev = self._cipher.encryptBlock(data);
              return self._prev
            };

            var decrypt$1 = function (self, block) {
              var pad = self._prev;

              self._prev = block;
              var out = self._cipher.decryptBlock(block);

              return bufferXor(out, pad)
            };

            var cbc = {
            	encrypt: encrypt$1,
            	decrypt: decrypt$1
            };

            var safeBuffer = createCommonjsModule(function (module, exports) {
            /* eslint-disable node/no-deprecated-api */

            var Buffer = bufferEs6.Buffer;

            // alternative to using Object.keys for old browsers
            function copyProps (src, dst) {
              for (var key in src) {
                dst[key] = src[key];
              }
            }
            if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
              module.exports = bufferEs6;
            } else {
              // Copy properties from require('buffer')
              copyProps(bufferEs6, exports);
              exports.Buffer = SafeBuffer;
            }

            function SafeBuffer (arg, encodingOrOffset, length) {
              return Buffer(arg, encodingOrOffset, length)
            }

            // Copy static methods from Buffer
            copyProps(Buffer, SafeBuffer);

            SafeBuffer.from = function (arg, encodingOrOffset, length) {
              if (typeof arg === 'number') {
                throw new TypeError('Argument must not be a number')
              }
              return Buffer(arg, encodingOrOffset, length)
            };

            SafeBuffer.alloc = function (size, fill, encoding) {
              if (typeof size !== 'number') {
                throw new TypeError('Argument must be a number')
              }
              var buf = Buffer(size);
              if (fill !== undefined) {
                if (typeof encoding === 'string') {
                  buf.fill(fill, encoding);
                } else {
                  buf.fill(fill);
                }
              } else {
                buf.fill(0);
              }
              return buf
            };

            SafeBuffer.allocUnsafe = function (size) {
              if (typeof size !== 'number') {
                throw new TypeError('Argument must be a number')
              }
              return Buffer(size)
            };

            SafeBuffer.allocUnsafeSlow = function (size) {
              if (typeof size !== 'number') {
                throw new TypeError('Argument must be a number')
              }
              return bufferEs6.SlowBuffer(size)
            };
            });
            var safeBuffer_1 = safeBuffer.Buffer;

            var Buffer$1 = safeBuffer.Buffer;


            function encryptStart (self, data, decrypt) {
              var len = data.length;
              var out = bufferXor(data, self._cache);
              self._cache = self._cache.slice(len);
              self._prev = Buffer$1.concat([self._prev, decrypt ? data : out]);
              return out
            }

            var encrypt$2 = function (self, data, decrypt) {
              var out = Buffer$1.allocUnsafe(0);
              var len;

              while (data.length) {
                if (self._cache.length === 0) {
                  self._cache = self._cipher.encryptBlock(self._prev);
                  self._prev = Buffer$1.allocUnsafe(0);
                }

                if (self._cache.length <= data.length) {
                  len = self._cache.length;
                  out = Buffer$1.concat([out, encryptStart(self, data.slice(0, len), decrypt)]);
                  data = data.slice(len);
                } else {
                  out = Buffer$1.concat([out, encryptStart(self, data, decrypt)]);
                  break
                }
              }

              return out
            };

            var cfb = {
            	encrypt: encrypt$2
            };

            var Buffer$2 = safeBuffer.Buffer;

            function encryptByte (self, byteParam, decrypt) {
              var pad = self._cipher.encryptBlock(self._prev);
              var out = pad[0] ^ byteParam;

              self._prev = Buffer$2.concat([
                self._prev.slice(1),
                Buffer$2.from([decrypt ? byteParam : out])
              ]);

              return out
            }

            var encrypt$3 = function (self, chunk, decrypt) {
              var len = chunk.length;
              var out = Buffer$2.allocUnsafe(len);
              var i = -1;

              while (++i < len) {
                out[i] = encryptByte(self, chunk[i], decrypt);
              }

              return out
            };

            var cfb8 = {
            	encrypt: encrypt$3
            };

            var Buffer$3 = safeBuffer.Buffer;

            function encryptByte$1 (self, byteParam, decrypt) {
              var pad;
              var i = -1;
              var len = 8;
              var out = 0;
              var bit, value;
              while (++i < len) {
                pad = self._cipher.encryptBlock(self._prev);
                bit = (byteParam & (1 << (7 - i))) ? 0x80 : 0;
                value = pad[0] ^ bit;
                out += ((value & 0x80) >> (i % 8));
                self._prev = shiftIn(self._prev, decrypt ? bit : value);
              }
              return out
            }

            function shiftIn (buffer, value) {
              var len = buffer.length;
              var i = -1;
              var out = Buffer$3.allocUnsafe(buffer.length);
              buffer = Buffer$3.concat([buffer, Buffer$3.from([value])]);

              while (++i < len) {
                out[i] = buffer[i] << 1 | buffer[i + 1] >> (7);
              }

              return out
            }

            var encrypt$4 = function (self, chunk, decrypt) {
              var len = chunk.length;
              var out = Buffer$3.allocUnsafe(len);
              var i = -1;

              while (++i < len) {
                out[i] = encryptByte$1(self, chunk[i], decrypt);
              }

              return out
            };

            var cfb1 = {
            	encrypt: encrypt$4
            };

            function getBlock (self) {
              self._prev = self._cipher.encryptBlock(self._prev);
              return self._prev
            }

            var encrypt$5 = function (self, chunk) {
              while (self._cache.length < chunk.length) {
                self._cache = Buffer.concat([self._cache, getBlock(self)]);
              }

              var pad = self._cache.slice(0, chunk.length);
              self._cache = self._cache.slice(chunk.length);
              return bufferXor(chunk, pad)
            };

            var ofb = {
            	encrypt: encrypt$5
            };

            function incr32 (iv) {
              var len = iv.length;
              var item;
              while (len--) {
                item = iv.readUInt8(len);
                if (item === 255) {
                  iv.writeUInt8(0, len);
                } else {
                  item++;
                  iv.writeUInt8(item, len);
                  break
                }
              }
            }
            var incr32_1 = incr32;

            var Buffer$4 = safeBuffer.Buffer;


            function getBlock$1 (self) {
              var out = self._cipher.encryptBlockRaw(self._prev);
              incr32_1(self._prev);
              return out
            }

            var blockSize = 16;
            var encrypt$6 = function (self, chunk) {
              var chunkNum = Math.ceil(chunk.length / blockSize);
              var start = self._cache.length;
              self._cache = Buffer$4.concat([
                self._cache,
                Buffer$4.allocUnsafe(chunkNum * blockSize)
              ]);
              for (var i = 0; i < chunkNum; i++) {
                var out = getBlock$1(self);
                var offset = start + i * blockSize;
                self._cache.writeUInt32BE(out[0], offset + 0);
                self._cache.writeUInt32BE(out[1], offset + 4);
                self._cache.writeUInt32BE(out[2], offset + 8);
                self._cache.writeUInt32BE(out[3], offset + 12);
              }
              var pad = self._cache.slice(0, chunk.length);
              self._cache = self._cache.slice(chunk.length);
              return bufferXor(chunk, pad)
            };

            var ctr = {
            	encrypt: encrypt$6
            };

            var aes128 = {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            };
            var aes192 = {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            };
            var aes256 = {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            };
            var list = {
            	"aes-128-ecb": {
            	cipher: "AES",
            	key: 128,
            	iv: 0,
            	mode: "ECB",
            	type: "block"
            },
            	"aes-192-ecb": {
            	cipher: "AES",
            	key: 192,
            	iv: 0,
            	mode: "ECB",
            	type: "block"
            },
            	"aes-256-ecb": {
            	cipher: "AES",
            	key: 256,
            	iv: 0,
            	mode: "ECB",
            	type: "block"
            },
            	"aes-128-cbc": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            },
            	"aes-192-cbc": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            },
            	"aes-256-cbc": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CBC",
            	type: "block"
            },
            	aes128: aes128,
            	aes192: aes192,
            	aes256: aes256,
            	"aes-128-cfb": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CFB",
            	type: "stream"
            },
            	"aes-192-cfb": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CFB",
            	type: "stream"
            },
            	"aes-256-cfb": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CFB",
            	type: "stream"
            },
            	"aes-128-cfb8": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CFB8",
            	type: "stream"
            },
            	"aes-192-cfb8": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CFB8",
            	type: "stream"
            },
            	"aes-256-cfb8": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CFB8",
            	type: "stream"
            },
            	"aes-128-cfb1": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CFB1",
            	type: "stream"
            },
            	"aes-192-cfb1": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CFB1",
            	type: "stream"
            },
            	"aes-256-cfb1": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CFB1",
            	type: "stream"
            },
            	"aes-128-ofb": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "OFB",
            	type: "stream"
            },
            	"aes-192-ofb": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "OFB",
            	type: "stream"
            },
            	"aes-256-ofb": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "OFB",
            	type: "stream"
            },
            	"aes-128-ctr": {
            	cipher: "AES",
            	key: 128,
            	iv: 16,
            	mode: "CTR",
            	type: "stream"
            },
            	"aes-192-ctr": {
            	cipher: "AES",
            	key: 192,
            	iv: 16,
            	mode: "CTR",
            	type: "stream"
            },
            	"aes-256-ctr": {
            	cipher: "AES",
            	key: 256,
            	iv: 16,
            	mode: "CTR",
            	type: "stream"
            },
            	"aes-128-gcm": {
            	cipher: "AES",
            	key: 128,
            	iv: 12,
            	mode: "GCM",
            	type: "auth"
            },
            	"aes-192-gcm": {
            	cipher: "AES",
            	key: 192,
            	iv: 12,
            	mode: "GCM",
            	type: "auth"
            },
            	"aes-256-gcm": {
            	cipher: "AES",
            	key: 256,
            	iv: 12,
            	mode: "GCM",
            	type: "auth"
            }
            };

            var list$1 = /*#__PURE__*/Object.freeze({
                        aes128: aes128,
                        aes192: aes192,
                        aes256: aes256,
                        default: list
            });

            var modes = ( list$1 && list ) || list$1;

            var modeModules = {
              ECB: ecb,
              CBC: cbc,
              CFB: cfb,
              CFB8: cfb8,
              CFB1: cfb1,
              OFB: ofb,
              CTR: ctr,
              GCM: ctr
            };



            for (var key in modes) {
              modes[key].module = modeModules[modes[key].mode];
            }

            var modes_1 = modes;

            // based on the aes implimentation in triple sec
            // https://github.com/keybase/triplesec
            // which is in turn based on the one from crypto-js
            // https://code.google.com/p/crypto-js/

            var Buffer$5 = safeBuffer.Buffer;

            function asUInt32Array (buf) {
              if (!Buffer$5.isBuffer(buf)) buf = Buffer$5.from(buf);

              var len = (buf.length / 4) | 0;
              var out = new Array(len);

              for (var i = 0; i < len; i++) {
                out[i] = buf.readUInt32BE(i * 4);
              }

              return out
            }

            function scrubVec (v) {
              for (var i = 0; i < v.length; v++) {
                v[i] = 0;
              }
            }

            function cryptBlock (M, keySchedule, SUB_MIX, SBOX, nRounds) {
              var SUB_MIX0 = SUB_MIX[0];
              var SUB_MIX1 = SUB_MIX[1];
              var SUB_MIX2 = SUB_MIX[2];
              var SUB_MIX3 = SUB_MIX[3];

              var s0 = M[0] ^ keySchedule[0];
              var s1 = M[1] ^ keySchedule[1];
              var s2 = M[2] ^ keySchedule[2];
              var s3 = M[3] ^ keySchedule[3];
              var t0, t1, t2, t3;
              var ksRow = 4;

              for (var round = 1; round < nRounds; round++) {
                t0 = SUB_MIX0[s0 >>> 24] ^ SUB_MIX1[(s1 >>> 16) & 0xff] ^ SUB_MIX2[(s2 >>> 8) & 0xff] ^ SUB_MIX3[s3 & 0xff] ^ keySchedule[ksRow++];
                t1 = SUB_MIX0[s1 >>> 24] ^ SUB_MIX1[(s2 >>> 16) & 0xff] ^ SUB_MIX2[(s3 >>> 8) & 0xff] ^ SUB_MIX3[s0 & 0xff] ^ keySchedule[ksRow++];
                t2 = SUB_MIX0[s2 >>> 24] ^ SUB_MIX1[(s3 >>> 16) & 0xff] ^ SUB_MIX2[(s0 >>> 8) & 0xff] ^ SUB_MIX3[s1 & 0xff] ^ keySchedule[ksRow++];
                t3 = SUB_MIX0[s3 >>> 24] ^ SUB_MIX1[(s0 >>> 16) & 0xff] ^ SUB_MIX2[(s1 >>> 8) & 0xff] ^ SUB_MIX3[s2 & 0xff] ^ keySchedule[ksRow++];
                s0 = t0;
                s1 = t1;
                s2 = t2;
                s3 = t3;
              }

              t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
              t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
              t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
              t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];
              t0 = t0 >>> 0;
              t1 = t1 >>> 0;
              t2 = t2 >>> 0;
              t3 = t3 >>> 0;

              return [t0, t1, t2, t3]
            }

            // AES constants
            var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
            var G = (function () {
              // Compute double table
              var d = new Array(256);
              for (var j = 0; j < 256; j++) {
                if (j < 128) {
                  d[j] = j << 1;
                } else {
                  d[j] = (j << 1) ^ 0x11b;
                }
              }

              var SBOX = [];
              var INV_SBOX = [];
              var SUB_MIX = [[], [], [], []];
              var INV_SUB_MIX = [[], [], [], []];

              // Walk GF(2^8)
              var x = 0;
              var xi = 0;
              for (var i = 0; i < 256; ++i) {
                // Compute sbox
                var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
                sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
                SBOX[x] = sx;
                INV_SBOX[sx] = x;

                // Compute multiplication
                var x2 = d[x];
                var x4 = d[x2];
                var x8 = d[x4];

                // Compute sub bytes, mix columns tables
                var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
                SUB_MIX[0][x] = (t << 24) | (t >>> 8);
                SUB_MIX[1][x] = (t << 16) | (t >>> 16);
                SUB_MIX[2][x] = (t << 8) | (t >>> 24);
                SUB_MIX[3][x] = t;

                // Compute inv sub bytes, inv mix columns tables
                t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
                INV_SUB_MIX[0][sx] = (t << 24) | (t >>> 8);
                INV_SUB_MIX[1][sx] = (t << 16) | (t >>> 16);
                INV_SUB_MIX[2][sx] = (t << 8) | (t >>> 24);
                INV_SUB_MIX[3][sx] = t;

                if (x === 0) {
                  x = xi = 1;
                } else {
                  x = x2 ^ d[d[d[x8 ^ x2]]];
                  xi ^= d[d[xi]];
                }
              }

              return {
                SBOX: SBOX,
                INV_SBOX: INV_SBOX,
                SUB_MIX: SUB_MIX,
                INV_SUB_MIX: INV_SUB_MIX
              }
            })();

            function AES (key) {
              this._key = asUInt32Array(key);
              this._reset();
            }

            AES.blockSize = 4 * 4;
            AES.keySize = 256 / 8;
            AES.prototype.blockSize = AES.blockSize;
            AES.prototype.keySize = AES.keySize;
            AES.prototype._reset = function () {
              var keyWords = this._key;
              var keySize = keyWords.length;
              var nRounds = keySize + 6;
              var ksRows = (nRounds + 1) * 4;

              var keySchedule = [];
              for (var k = 0; k < keySize; k++) {
                keySchedule[k] = keyWords[k];
              }

              for (k = keySize; k < ksRows; k++) {
                var t = keySchedule[k - 1];

                if (k % keySize === 0) {
                  t = (t << 8) | (t >>> 24);
                  t =
                    (G.SBOX[t >>> 24] << 24) |
                    (G.SBOX[(t >>> 16) & 0xff] << 16) |
                    (G.SBOX[(t >>> 8) & 0xff] << 8) |
                    (G.SBOX[t & 0xff]);

                  t ^= RCON[(k / keySize) | 0] << 24;
                } else if (keySize > 6 && k % keySize === 4) {
                  t =
                    (G.SBOX[t >>> 24] << 24) |
                    (G.SBOX[(t >>> 16) & 0xff] << 16) |
                    (G.SBOX[(t >>> 8) & 0xff] << 8) |
                    (G.SBOX[t & 0xff]);
                }

                keySchedule[k] = keySchedule[k - keySize] ^ t;
              }

              var invKeySchedule = [];
              for (var ik = 0; ik < ksRows; ik++) {
                var ksR = ksRows - ik;
                var tt = keySchedule[ksR - (ik % 4 ? 0 : 4)];

                if (ik < 4 || ksR <= 4) {
                  invKeySchedule[ik] = tt;
                } else {
                  invKeySchedule[ik] =
                    G.INV_SUB_MIX[0][G.SBOX[tt >>> 24]] ^
                    G.INV_SUB_MIX[1][G.SBOX[(tt >>> 16) & 0xff]] ^
                    G.INV_SUB_MIX[2][G.SBOX[(tt >>> 8) & 0xff]] ^
                    G.INV_SUB_MIX[3][G.SBOX[tt & 0xff]];
                }
              }

              this._nRounds = nRounds;
              this._keySchedule = keySchedule;
              this._invKeySchedule = invKeySchedule;
            };

            AES.prototype.encryptBlockRaw = function (M) {
              M = asUInt32Array(M);
              return cryptBlock(M, this._keySchedule, G.SUB_MIX, G.SBOX, this._nRounds)
            };

            AES.prototype.encryptBlock = function (M) {
              var out = this.encryptBlockRaw(M);
              var buf = Buffer$5.allocUnsafe(16);
              buf.writeUInt32BE(out[0], 0);
              buf.writeUInt32BE(out[1], 4);
              buf.writeUInt32BE(out[2], 8);
              buf.writeUInt32BE(out[3], 12);
              return buf
            };

            AES.prototype.decryptBlock = function (M) {
              M = asUInt32Array(M);

              // swap
              var m1 = M[1];
              M[1] = M[3];
              M[3] = m1;

              var out = cryptBlock(M, this._invKeySchedule, G.INV_SUB_MIX, G.INV_SBOX, this._nRounds);
              var buf = Buffer$5.allocUnsafe(16);
              buf.writeUInt32BE(out[0], 0);
              buf.writeUInt32BE(out[3], 4);
              buf.writeUInt32BE(out[2], 8);
              buf.writeUInt32BE(out[1], 12);
              return buf
            };

            AES.prototype.scrub = function () {
              scrubVec(this._keySchedule);
              scrubVec(this._invKeySchedule);
              scrubVec(this._key);
            };

            var AES_1 = AES;

            var aes = {
            	AES: AES_1
            };

            // shim for using process in browser
            // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

            function defaultSetTimout() {
                throw new Error('setTimeout has not been defined');
            }
            function defaultClearTimeout () {
                throw new Error('clearTimeout has not been defined');
            }
            var cachedSetTimeout = defaultSetTimout;
            var cachedClearTimeout = defaultClearTimeout;
            if (typeof global$1.setTimeout === 'function') {
                cachedSetTimeout = setTimeout;
            }
            if (typeof global$1.clearTimeout === 'function') {
                cachedClearTimeout = clearTimeout;
            }

            function runTimeout(fun) {
                if (cachedSetTimeout === setTimeout) {
                    //normal enviroments in sane situations
                    return setTimeout(fun, 0);
                }
                // if setTimeout wasn't available but was latter defined
                if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
                    cachedSetTimeout = setTimeout;
                    return setTimeout(fun, 0);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedSetTimeout(fun, 0);
                } catch(e){
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                        return cachedSetTimeout.call(null, fun, 0);
                    } catch(e){
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                        return cachedSetTimeout.call(this, fun, 0);
                    }
                }


            }
            function runClearTimeout(marker) {
                if (cachedClearTimeout === clearTimeout) {
                    //normal enviroments in sane situations
                    return clearTimeout(marker);
                }
                // if clearTimeout wasn't available but was latter defined
                if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
                    cachedClearTimeout = clearTimeout;
                    return clearTimeout(marker);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedClearTimeout(marker);
                } catch (e){
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                        return cachedClearTimeout.call(null, marker);
                    } catch (e){
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                        // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                        return cachedClearTimeout.call(this, marker);
                    }
                }



            }
            var queue = [];
            var draining = false;
            var currentQueue;
            var queueIndex = -1;

            function cleanUpNextTick() {
                if (!draining || !currentQueue) {
                    return;
                }
                draining = false;
                if (currentQueue.length) {
                    queue = currentQueue.concat(queue);
                } else {
                    queueIndex = -1;
                }
                if (queue.length) {
                    drainQueue();
                }
            }

            function drainQueue() {
                if (draining) {
                    return;
                }
                var timeout = runTimeout(cleanUpNextTick);
                draining = true;

                var len = queue.length;
                while(len) {
                    currentQueue = queue;
                    queue = [];
                    while (++queueIndex < len) {
                        if (currentQueue) {
                            currentQueue[queueIndex].run();
                        }
                    }
                    queueIndex = -1;
                    len = queue.length;
                }
                currentQueue = null;
                draining = false;
                runClearTimeout(timeout);
            }
            function nextTick(fun) {
                var args = new Array(arguments.length - 1);
                if (arguments.length > 1) {
                    for (var i = 1; i < arguments.length; i++) {
                        args[i - 1] = arguments[i];
                    }
                }
                queue.push(new Item(fun, args));
                if (queue.length === 1 && !draining) {
                    runTimeout(drainQueue);
                }
            }
            // v8 likes predictible objects
            function Item(fun, array) {
                this.fun = fun;
                this.array = array;
            }
            Item.prototype.run = function () {
                this.fun.apply(null, this.array);
            };
            var title = 'browser';
            var platform = 'browser';
            var browser = true;
            var env = {};
            var argv = [];
            var version = ''; // empty string to avoid regexp issues
            var versions = {};
            var release = {};
            var config = {};

            function noop() {}

            var on = noop;
            var addListener = noop;
            var once = noop;
            var off = noop;
            var removeListener = noop;
            var removeAllListeners = noop;
            var emit = noop;

            function binding(name) {
                throw new Error('process.binding is not supported');
            }

            function cwd () { return '/' }
            function chdir (dir) {
                throw new Error('process.chdir is not supported');
            }function umask() { return 0; }

            // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
            var performance = global$1.performance || {};
            var performanceNow =
              performance.now        ||
              performance.mozNow     ||
              performance.msNow      ||
              performance.oNow       ||
              performance.webkitNow  ||
              function(){ return (new Date()).getTime() };

            // generate timestamp or delta
            // see http://nodejs.org/api/process.html#process_process_hrtime
            function hrtime(previousTimestamp){
              var clocktime = performanceNow.call(performance)*1e-3;
              var seconds = Math.floor(clocktime);
              var nanoseconds = Math.floor((clocktime%1)*1e9);
              if (previousTimestamp) {
                seconds = seconds - previousTimestamp[0];
                nanoseconds = nanoseconds - previousTimestamp[1];
                if (nanoseconds<0) {
                  seconds--;
                  nanoseconds += 1e9;
                }
              }
              return [seconds,nanoseconds]
            }

            var startTime = new Date();
            function uptime() {
              var currentTime = new Date();
              var dif = currentTime - startTime;
              return dif / 1000;
            }

            var process = {
              nextTick: nextTick,
              title: title,
              browser: browser,
              env: env,
              argv: argv,
              version: version,
              versions: versions,
              on: on,
              addListener: addListener,
              once: once,
              off: off,
              removeListener: removeListener,
              removeAllListeners: removeAllListeners,
              emit: emit,
              binding: binding,
              cwd: cwd,
              chdir: chdir,
              umask: umask,
              hrtime: hrtime,
              platform: platform,
              release: release,
              config: config,
              uptime: uptime
            };

            var inherits;
            if (typeof Object.create === 'function'){
              inherits = function inherits(ctor, superCtor) {
                // implementation from standard node.js 'util' module
                ctor.super_ = superCtor;
                ctor.prototype = Object.create(superCtor.prototype, {
                  constructor: {
                    value: ctor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                  }
                });
              };
            } else {
              inherits = function inherits(ctor, superCtor) {
                ctor.super_ = superCtor;
                var TempCtor = function () {};
                TempCtor.prototype = superCtor.prototype;
                ctor.prototype = new TempCtor();
                ctor.prototype.constructor = ctor;
              };
            }
            var inherits$1 = inherits;

            var formatRegExp = /%[sdj%]/g;
            function format(f) {
              if (!isString(f)) {
                var objects = [];
                for (var i = 0; i < arguments.length; i++) {
                  objects.push(inspect(arguments[i]));
                }
                return objects.join(' ');
              }

              var i = 1;
              var args = arguments;
              var len = args.length;
              var str = String(f).replace(formatRegExp, function(x) {
                if (x === '%%') return '%';
                if (i >= len) return x;
                switch (x) {
                  case '%s': return String(args[i++]);
                  case '%d': return Number(args[i++]);
                  case '%j':
                    try {
                      return JSON.stringify(args[i++]);
                    } catch (_) {
                      return '[Circular]';
                    }
                  default:
                    return x;
                }
              });
              for (var x = args[i]; i < len; x = args[++i]) {
                if (isNull(x) || !isObject(x)) {
                  str += ' ' + x;
                } else {
                  str += ' ' + inspect(x);
                }
              }
              return str;
            }

            // Mark that a method should not be used.
            // Returns a modified function which warns once by default.
            // If --no-deprecation is set, then it is a no-op.
            function deprecate(fn, msg) {
              // Allow for deprecating things in the process of starting up.
              if (isUndefined(global$1.process)) {
                return function() {
                  return deprecate(fn, msg).apply(this, arguments);
                };
              }

              var warned = false;
              function deprecated() {
                if (!warned) {
                  {
                    console.error(msg);
                  }
                  warned = true;
                }
                return fn.apply(this, arguments);
              }

              return deprecated;
            }

            var debugs = {};
            var debugEnviron;
            function debuglog(set) {
              if (isUndefined(debugEnviron))
                debugEnviron = process.env.NODE_DEBUG || '';
              set = set.toUpperCase();
              if (!debugs[set]) {
                if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
                  var pid = 0;
                  debugs[set] = function() {
                    var msg = format.apply(null, arguments);
                    console.error('%s %d: %s', set, pid, msg);
                  };
                } else {
                  debugs[set] = function() {};
                }
              }
              return debugs[set];
            }

            /**
             * Echos the value of a value. Trys to print the value out
             * in the best way possible given the different types.
             *
             * @param {Object} obj The object to print out.
             * @param {Object} opts Optional options object that alters the output.
             */
            /* legacy: obj, showHidden, depth, colors*/
            function inspect(obj, opts) {
              // default options
              var ctx = {
                seen: [],
                stylize: stylizeNoColor
              };
              // legacy...
              if (arguments.length >= 3) ctx.depth = arguments[2];
              if (arguments.length >= 4) ctx.colors = arguments[3];
              if (isBoolean(opts)) {
                // legacy...
                ctx.showHidden = opts;
              } else if (opts) {
                // got an "options" object
                _extend(ctx, opts);
              }
              // set default options
              if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
              if (isUndefined(ctx.depth)) ctx.depth = 2;
              if (isUndefined(ctx.colors)) ctx.colors = false;
              if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
              if (ctx.colors) ctx.stylize = stylizeWithColor;
              return formatValue(ctx, obj, ctx.depth);
            }

            // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
            inspect.colors = {
              'bold' : [1, 22],
              'italic' : [3, 23],
              'underline' : [4, 24],
              'inverse' : [7, 27],
              'white' : [37, 39],
              'grey' : [90, 39],
              'black' : [30, 39],
              'blue' : [34, 39],
              'cyan' : [36, 39],
              'green' : [32, 39],
              'magenta' : [35, 39],
              'red' : [31, 39],
              'yellow' : [33, 39]
            };

            // Don't use 'blue' not visible on cmd.exe
            inspect.styles = {
              'special': 'cyan',
              'number': 'yellow',
              'boolean': 'yellow',
              'undefined': 'grey',
              'null': 'bold',
              'string': 'green',
              'date': 'magenta',
              // "name": intentionally not styling
              'regexp': 'red'
            };


            function stylizeWithColor(str, styleType) {
              var style = inspect.styles[styleType];

              if (style) {
                return '\u001b[' + inspect.colors[style][0] + 'm' + str +
                       '\u001b[' + inspect.colors[style][1] + 'm';
              } else {
                return str;
              }
            }


            function stylizeNoColor(str, styleType) {
              return str;
            }


            function arrayToHash(array) {
              var hash = {};

              array.forEach(function(val, idx) {
                hash[val] = true;
              });

              return hash;
            }


            function formatValue(ctx, value, recurseTimes) {
              // Provide a hook for user-specified inspect functions.
              // Check that value is an object with an inspect function on it
              if (ctx.customInspect &&
                  value &&
                  isFunction(value.inspect) &&
                  // Filter out the util module, it's inspect function is special
                  value.inspect !== inspect &&
                  // Also filter out any prototype objects using the circular check.
                  !(value.constructor && value.constructor.prototype === value)) {
                var ret = value.inspect(recurseTimes, ctx);
                if (!isString(ret)) {
                  ret = formatValue(ctx, ret, recurseTimes);
                }
                return ret;
              }

              // Primitive types cannot have properties
              var primitive = formatPrimitive(ctx, value);
              if (primitive) {
                return primitive;
              }

              // Look up the keys of the object.
              var keys = Object.keys(value);
              var visibleKeys = arrayToHash(keys);

              if (ctx.showHidden) {
                keys = Object.getOwnPropertyNames(value);
              }

              // IE doesn't make error fields non-enumerable
              // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
              if (isError(value)
                  && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
                return formatError(value);
              }

              // Some type of object without properties can be shortcutted.
              if (keys.length === 0) {
                if (isFunction(value)) {
                  var name = value.name ? ': ' + value.name : '';
                  return ctx.stylize('[Function' + name + ']', 'special');
                }
                if (isRegExp(value)) {
                  return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                }
                if (isDate(value)) {
                  return ctx.stylize(Date.prototype.toString.call(value), 'date');
                }
                if (isError(value)) {
                  return formatError(value);
                }
              }

              var base = '', array = false, braces = ['{', '}'];

              // Make Array say that they are Array
              if (isArray$1(value)) {
                array = true;
                braces = ['[', ']'];
              }

              // Make functions say that they are functions
              if (isFunction(value)) {
                var n = value.name ? ': ' + value.name : '';
                base = ' [Function' + n + ']';
              }

              // Make RegExps say that they are RegExps
              if (isRegExp(value)) {
                base = ' ' + RegExp.prototype.toString.call(value);
              }

              // Make dates with properties first say the date
              if (isDate(value)) {
                base = ' ' + Date.prototype.toUTCString.call(value);
              }

              // Make error with message first say the error
              if (isError(value)) {
                base = ' ' + formatError(value);
              }

              if (keys.length === 0 && (!array || value.length == 0)) {
                return braces[0] + base + braces[1];
              }

              if (recurseTimes < 0) {
                if (isRegExp(value)) {
                  return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                } else {
                  return ctx.stylize('[Object]', 'special');
                }
              }

              ctx.seen.push(value);

              var output;
              if (array) {
                output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
              } else {
                output = keys.map(function(key) {
                  return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
                });
              }

              ctx.seen.pop();

              return reduceToSingleString(output, base, braces);
            }


            function formatPrimitive(ctx, value) {
              if (isUndefined(value))
                return ctx.stylize('undefined', 'undefined');
              if (isString(value)) {
                var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                         .replace(/'/g, "\\'")
                                                         .replace(/\\"/g, '"') + '\'';
                return ctx.stylize(simple, 'string');
              }
              if (isNumber(value))
                return ctx.stylize('' + value, 'number');
              if (isBoolean(value))
                return ctx.stylize('' + value, 'boolean');
              // For some reason typeof null is "object", so special case here.
              if (isNull(value))
                return ctx.stylize('null', 'null');
            }


            function formatError(value) {
              return '[' + Error.prototype.toString.call(value) + ']';
            }


            function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
              var output = [];
              for (var i = 0, l = value.length; i < l; ++i) {
                if (hasOwnProperty(value, String(i))) {
                  output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                      String(i), true));
                } else {
                  output.push('');
                }
              }
              keys.forEach(function(key) {
                if (!key.match(/^\d+$/)) {
                  output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                      key, true));
                }
              });
              return output;
            }


            function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
              var name, str, desc;
              desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
              if (desc.get) {
                if (desc.set) {
                  str = ctx.stylize('[Getter/Setter]', 'special');
                } else {
                  str = ctx.stylize('[Getter]', 'special');
                }
              } else {
                if (desc.set) {
                  str = ctx.stylize('[Setter]', 'special');
                }
              }
              if (!hasOwnProperty(visibleKeys, key)) {
                name = '[' + key + ']';
              }
              if (!str) {
                if (ctx.seen.indexOf(desc.value) < 0) {
                  if (isNull(recurseTimes)) {
                    str = formatValue(ctx, desc.value, null);
                  } else {
                    str = formatValue(ctx, desc.value, recurseTimes - 1);
                  }
                  if (str.indexOf('\n') > -1) {
                    if (array) {
                      str = str.split('\n').map(function(line) {
                        return '  ' + line;
                      }).join('\n').substr(2);
                    } else {
                      str = '\n' + str.split('\n').map(function(line) {
                        return '   ' + line;
                      }).join('\n');
                    }
                  }
                } else {
                  str = ctx.stylize('[Circular]', 'special');
                }
              }
              if (isUndefined(name)) {
                if (array && key.match(/^\d+$/)) {
                  return str;
                }
                name = JSON.stringify('' + key);
                if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                  name = name.substr(1, name.length - 2);
                  name = ctx.stylize(name, 'name');
                } else {
                  name = name.replace(/'/g, "\\'")
                             .replace(/\\"/g, '"')
                             .replace(/(^"|"$)/g, "'");
                  name = ctx.stylize(name, 'string');
                }
              }

              return name + ': ' + str;
            }


            function reduceToSingleString(output, base, braces) {
              var length = output.reduce(function(prev, cur) {
                if (cur.indexOf('\n') >= 0) ;
                return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
              }, 0);

              if (length > 60) {
                return braces[0] +
                       (base === '' ? '' : base + '\n ') +
                       ' ' +
                       output.join(',\n  ') +
                       ' ' +
                       braces[1];
              }

              return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
            }


            // NOTE: These type checking functions intentionally don't use `instanceof`
            // because it is fragile and can be easily faked with `Object.create()`.
            function isArray$1(ar) {
              return Array.isArray(ar);
            }

            function isBoolean(arg) {
              return typeof arg === 'boolean';
            }

            function isNull(arg) {
              return arg === null;
            }

            function isNumber(arg) {
              return typeof arg === 'number';
            }

            function isString(arg) {
              return typeof arg === 'string';
            }

            function isUndefined(arg) {
              return arg === void 0;
            }

            function isRegExp(re) {
              return isObject(re) && objectToString(re) === '[object RegExp]';
            }

            function isObject(arg) {
              return typeof arg === 'object' && arg !== null;
            }

            function isDate(d) {
              return isObject(d) && objectToString(d) === '[object Date]';
            }

            function isError(e) {
              return isObject(e) &&
                  (objectToString(e) === '[object Error]' || e instanceof Error);
            }

            function isFunction(arg) {
              return typeof arg === 'function';
            }

            function objectToString(o) {
              return Object.prototype.toString.call(o);
            }

            function _extend(origin, add) {
              // Don't do anything if add isn't an object
              if (!add || !isObject(add)) return origin;

              var keys = Object.keys(add);
              var i = keys.length;
              while (i--) {
                origin[keys[i]] = add[keys[i]];
              }
              return origin;
            }
            function hasOwnProperty(obj, prop) {
              return Object.prototype.hasOwnProperty.call(obj, prop);
            }

            function BufferList() {
              this.head = null;
              this.tail = null;
              this.length = 0;
            }

            BufferList.prototype.push = function (v) {
              var entry = { data: v, next: null };
              if (this.length > 0) this.tail.next = entry;else this.head = entry;
              this.tail = entry;
              ++this.length;
            };

            BufferList.prototype.unshift = function (v) {
              var entry = { data: v, next: this.head };
              if (this.length === 0) this.tail = entry;
              this.head = entry;
              ++this.length;
            };

            BufferList.prototype.shift = function () {
              if (this.length === 0) return;
              var ret = this.head.data;
              if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
              --this.length;
              return ret;
            };

            BufferList.prototype.clear = function () {
              this.head = this.tail = null;
              this.length = 0;
            };

            BufferList.prototype.join = function (s) {
              if (this.length === 0) return '';
              var p = this.head;
              var ret = '' + p.data;
              while (p = p.next) {
                ret += s + p.data;
              }return ret;
            };

            BufferList.prototype.concat = function (n) {
              if (this.length === 0) return Buffer.alloc(0);
              if (this.length === 1) return this.head.data;
              var ret = Buffer.allocUnsafe(n >>> 0);
              var p = this.head;
              var i = 0;
              while (p) {
                p.data.copy(ret, i);
                i += p.data.length;
                p = p.next;
              }
              return ret;
            };

            // Copyright Joyent, Inc. and other Node contributors.
            var isBufferEncoding = Buffer.isEncoding
              || function(encoding) {
                   switch (encoding && encoding.toLowerCase()) {
                     case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
                     default: return false;
                   }
                 };


            function assertEncoding(encoding) {
              if (encoding && !isBufferEncoding(encoding)) {
                throw new Error('Unknown encoding: ' + encoding);
              }
            }

            // StringDecoder provides an interface for efficiently splitting a series of
            // buffers into a series of JS strings without breaking apart multi-byte
            // characters. CESU-8 is handled as part of the UTF-8 encoding.
            //
            // @TODO Handling all encodings inside a single object makes it very difficult
            // to reason about this code, so it should be split up in the future.
            // @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
            // points as used by CESU-8.
            function StringDecoder(encoding) {
              this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
              assertEncoding(encoding);
              switch (this.encoding) {
                case 'utf8':
                  // CESU-8 represents each of Surrogate Pair by 3-bytes
                  this.surrogateSize = 3;
                  break;
                case 'ucs2':
                case 'utf16le':
                  // UTF-16 represents each of Surrogate Pair by 2-bytes
                  this.surrogateSize = 2;
                  this.detectIncompleteChar = utf16DetectIncompleteChar;
                  break;
                case 'base64':
                  // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
                  this.surrogateSize = 3;
                  this.detectIncompleteChar = base64DetectIncompleteChar;
                  break;
                default:
                  this.write = passThroughWrite;
                  return;
              }

              // Enough space to store all bytes of a single character. UTF-8 needs 4
              // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
              this.charBuffer = new Buffer(6);
              // Number of bytes received for the current incomplete multi-byte character.
              this.charReceived = 0;
              // Number of bytes expected for the current incomplete multi-byte character.
              this.charLength = 0;
            }

            // write decodes the given buffer and returns it as JS string that is
            // guaranteed to not contain any partial multi-byte characters. Any partial
            // character found at the end of the buffer is buffered up, and will be
            // returned when calling write again with the remaining bytes.
            //
            // Note: Converting a Buffer containing an orphan surrogate to a String
            // currently works, but converting a String to a Buffer (via `new Buffer`, or
            // Buffer#write) will replace incomplete surrogates with the unicode
            // replacement character. See https://codereview.chromium.org/121173009/ .
            StringDecoder.prototype.write = function(buffer) {
              var charStr = '';
              // if our last write ended with an incomplete multibyte character
              while (this.charLength) {
                // determine how many remaining bytes this buffer has to offer for this char
                var available = (buffer.length >= this.charLength - this.charReceived) ?
                    this.charLength - this.charReceived :
                    buffer.length;

                // add the new bytes to the char buffer
                buffer.copy(this.charBuffer, this.charReceived, 0, available);
                this.charReceived += available;

                if (this.charReceived < this.charLength) {
                  // still not enough chars in this buffer? wait for more ...
                  return '';
                }

                // remove bytes belonging to the current character from the buffer
                buffer = buffer.slice(available, buffer.length);

                // get the character that was split
                charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

                // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
                var charCode = charStr.charCodeAt(charStr.length - 1);
                if (charCode >= 0xD800 && charCode <= 0xDBFF) {
                  this.charLength += this.surrogateSize;
                  charStr = '';
                  continue;
                }
                this.charReceived = this.charLength = 0;

                // if there are no more bytes in this buffer, just emit our char
                if (buffer.length === 0) {
                  return charStr;
                }
                break;
              }

              // determine and set charLength / charReceived
              this.detectIncompleteChar(buffer);

              var end = buffer.length;
              if (this.charLength) {
                // buffer the incomplete character bytes we got
                buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
                end -= this.charReceived;
              }

              charStr += buffer.toString(this.encoding, 0, end);

              var end = charStr.length - 1;
              var charCode = charStr.charCodeAt(end);
              // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
              if (charCode >= 0xD800 && charCode <= 0xDBFF) {
                var size = this.surrogateSize;
                this.charLength += size;
                this.charReceived += size;
                this.charBuffer.copy(this.charBuffer, size, 0, size);
                buffer.copy(this.charBuffer, 0, 0, size);
                return charStr.substring(0, end);
              }

              // or just emit the charStr
              return charStr;
            };

            // detectIncompleteChar determines if there is an incomplete UTF-8 character at
            // the end of the given buffer. If so, it sets this.charLength to the byte
            // length that character, and sets this.charReceived to the number of bytes
            // that are available for this character.
            StringDecoder.prototype.detectIncompleteChar = function(buffer) {
              // determine how many bytes we have to check at the end of this buffer
              var i = (buffer.length >= 3) ? 3 : buffer.length;

              // Figure out if one of the last i bytes of our buffer announces an
              // incomplete char.
              for (; i > 0; i--) {
                var c = buffer[buffer.length - i];

                // See http://en.wikipedia.org/wiki/UTF-8#Description

                // 110XXXXX
                if (i == 1 && c >> 5 == 0x06) {
                  this.charLength = 2;
                  break;
                }

                // 1110XXXX
                if (i <= 2 && c >> 4 == 0x0E) {
                  this.charLength = 3;
                  break;
                }

                // 11110XXX
                if (i <= 3 && c >> 3 == 0x1E) {
                  this.charLength = 4;
                  break;
                }
              }
              this.charReceived = i;
            };

            StringDecoder.prototype.end = function(buffer) {
              var res = '';
              if (buffer && buffer.length)
                res = this.write(buffer);

              if (this.charReceived) {
                var cr = this.charReceived;
                var buf = this.charBuffer;
                var enc = this.encoding;
                res += buf.slice(0, cr).toString(enc);
              }

              return res;
            };

            function passThroughWrite(buffer) {
              return buffer.toString(this.encoding);
            }

            function utf16DetectIncompleteChar(buffer) {
              this.charReceived = buffer.length % 2;
              this.charLength = this.charReceived ? 2 : 0;
            }

            function base64DetectIncompleteChar(buffer) {
              this.charReceived = buffer.length % 3;
              this.charLength = this.charReceived ? 3 : 0;
            }

            var stringDecoder = /*#__PURE__*/Object.freeze({
                        StringDecoder: StringDecoder
            });

            Readable.ReadableState = ReadableState;

            var debug = debuglog('stream');
            inherits$1(Readable, EventEmitter);

            function prependListener(emitter, event, fn) {
              // Sadly this is not cacheable as some libraries bundle their own
              // event emitter implementation with them.
              if (typeof emitter.prependListener === 'function') {
                return emitter.prependListener(event, fn);
              } else {
                // This is a hack to make sure that our error handler is attached before any
                // userland ones.  NEVER DO THIS. This is here only because this code needs
                // to continue to work with older versions of Node.js that do not include
                // the prependListener() method. The goal is to eventually remove this hack.
                if (!emitter._events || !emitter._events[event])
                  emitter.on(event, fn);
                else if (Array.isArray(emitter._events[event]))
                  emitter._events[event].unshift(fn);
                else
                  emitter._events[event] = [fn, emitter._events[event]];
              }
            }
            function listenerCount$1 (emitter, type) {
              return emitter.listeners(type).length;
            }
            function ReadableState(options, stream) {

              options = options || {};

              // object stream flag. Used to make read(n) ignore n and to
              // make all the buffer merging and length checks go away
              this.objectMode = !!options.objectMode;

              if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

              // the point at which it stops calling _read() to fill the buffer
              // Note: 0 is a valid value, means "don't call _read preemptively ever"
              var hwm = options.highWaterMark;
              var defaultHwm = this.objectMode ? 16 : 16 * 1024;
              this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

              // cast to ints.
              this.highWaterMark = ~ ~this.highWaterMark;

              // A linked list is used to store data chunks instead of an array because the
              // linked list can remove elements from the beginning faster than
              // array.shift()
              this.buffer = new BufferList();
              this.length = 0;
              this.pipes = null;
              this.pipesCount = 0;
              this.flowing = null;
              this.ended = false;
              this.endEmitted = false;
              this.reading = false;

              // a flag to be able to tell if the onwrite cb is called immediately,
              // or on a later tick.  We set this to true at first, because any
              // actions that shouldn't happen until "later" should generally also
              // not happen before the first write call.
              this.sync = true;

              // whenever we return null, then we set a flag to say
              // that we're awaiting a 'readable' event emission.
              this.needReadable = false;
              this.emittedReadable = false;
              this.readableListening = false;
              this.resumeScheduled = false;

              // Crypto is kind of old and crusty.  Historically, its default string
              // encoding is 'binary' so we have to make this configurable.
              // Everything else in the universe uses 'utf8', though.
              this.defaultEncoding = options.defaultEncoding || 'utf8';

              // when piping, we only care about 'readable' events that happen
              // after read()ing all the bytes and not getting any pushback.
              this.ranOut = false;

              // the number of writers that are awaiting a drain event in .pipe()s
              this.awaitDrain = 0;

              // if true, a maybeReadMore has been scheduled
              this.readingMore = false;

              this.decoder = null;
              this.encoding = null;
              if (options.encoding) {
                this.decoder = new StringDecoder(options.encoding);
                this.encoding = options.encoding;
              }
            }
            function Readable(options) {

              if (!(this instanceof Readable)) return new Readable(options);

              this._readableState = new ReadableState(options, this);

              // legacy
              this.readable = true;

              if (options && typeof options.read === 'function') this._read = options.read;

              EventEmitter.call(this);
            }

            // Manually shove something into the read() buffer.
            // This returns true if the highWaterMark has not been hit yet,
            // similar to how Writable.write() returns true if you should
            // write() some more.
            Readable.prototype.push = function (chunk, encoding) {
              var state = this._readableState;

              if (!state.objectMode && typeof chunk === 'string') {
                encoding = encoding || state.defaultEncoding;
                if (encoding !== state.encoding) {
                  chunk = Buffer.from(chunk, encoding);
                  encoding = '';
                }
              }

              return readableAddChunk(this, state, chunk, encoding, false);
            };

            // Unshift should *always* be something directly out of read()
            Readable.prototype.unshift = function (chunk) {
              var state = this._readableState;
              return readableAddChunk(this, state, chunk, '', true);
            };

            Readable.prototype.isPaused = function () {
              return this._readableState.flowing === false;
            };

            function readableAddChunk(stream, state, chunk, encoding, addToFront) {
              var er = chunkInvalid(state, chunk);
              if (er) {
                stream.emit('error', er);
              } else if (chunk === null) {
                state.reading = false;
                onEofChunk(stream, state);
              } else if (state.objectMode || chunk && chunk.length > 0) {
                if (state.ended && !addToFront) {
                  var e = new Error('stream.push() after EOF');
                  stream.emit('error', e);
                } else if (state.endEmitted && addToFront) {
                  var _e = new Error('stream.unshift() after end event');
                  stream.emit('error', _e);
                } else {
                  var skipAdd;
                  if (state.decoder && !addToFront && !encoding) {
                    chunk = state.decoder.write(chunk);
                    skipAdd = !state.objectMode && chunk.length === 0;
                  }

                  if (!addToFront) state.reading = false;

                  // Don't add to the buffer if we've decoded to an empty string chunk and
                  // we're not in object mode
                  if (!skipAdd) {
                    // if we want the data now, just emit it.
                    if (state.flowing && state.length === 0 && !state.sync) {
                      stream.emit('data', chunk);
                      stream.read(0);
                    } else {
                      // update the buffer info.
                      state.length += state.objectMode ? 1 : chunk.length;
                      if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

                      if (state.needReadable) emitReadable(stream);
                    }
                  }

                  maybeReadMore(stream, state);
                }
              } else if (!addToFront) {
                state.reading = false;
              }

              return needMoreData(state);
            }

            // if it's past the high water mark, we can push in some more.
            // Also, if we have no data yet, we can stand some
            // more bytes.  This is to work around cases where hwm=0,
            // such as the repl.  Also, if the push() triggered a
            // readable event, and the user called read(largeNumber) such that
            // needReadable was set, then we ought to push more, so that another
            // 'readable' event will be triggered.
            function needMoreData(state) {
              return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
            }

            // backwards compatibility.
            Readable.prototype.setEncoding = function (enc) {
              this._readableState.decoder = new StringDecoder(enc);
              this._readableState.encoding = enc;
              return this;
            };

            // Don't raise the hwm > 8MB
            var MAX_HWM = 0x800000;
            function computeNewHighWaterMark(n) {
              if (n >= MAX_HWM) {
                n = MAX_HWM;
              } else {
                // Get the next highest power of 2 to prevent increasing hwm excessively in
                // tiny amounts
                n--;
                n |= n >>> 1;
                n |= n >>> 2;
                n |= n >>> 4;
                n |= n >>> 8;
                n |= n >>> 16;
                n++;
              }
              return n;
            }

            // This function is designed to be inlinable, so please take care when making
            // changes to the function body.
            function howMuchToRead(n, state) {
              if (n <= 0 || state.length === 0 && state.ended) return 0;
              if (state.objectMode) return 1;
              if (n !== n) {
                // Only flow one buffer at a time
                if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
              }
              // If we're asking for more than the current hwm, then raise the hwm.
              if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
              if (n <= state.length) return n;
              // Don't have enough
              if (!state.ended) {
                state.needReadable = true;
                return 0;
              }
              return state.length;
            }

            // you can override either this method, or the async _read(n) below.
            Readable.prototype.read = function (n) {
              debug('read', n);
              n = parseInt(n, 10);
              var state = this._readableState;
              var nOrig = n;

              if (n !== 0) state.emittedReadable = false;

              // if we're doing read(0) to trigger a readable event, but we
              // already have a bunch of data in the buffer, then just trigger
              // the 'readable' event and move on.
              if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
                debug('read: emitReadable', state.length, state.ended);
                if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
                return null;
              }

              n = howMuchToRead(n, state);

              // if we've ended, and we're now clear, then finish it up.
              if (n === 0 && state.ended) {
                if (state.length === 0) endReadable(this);
                return null;
              }

              // All the actual chunk generation logic needs to be
              // *below* the call to _read.  The reason is that in certain
              // synthetic stream cases, such as passthrough streams, _read
              // may be a completely synchronous operation which may change
              // the state of the read buffer, providing enough data when
              // before there was *not* enough.
              //
              // So, the steps are:
              // 1. Figure out what the state of things will be after we do
              // a read from the buffer.
              //
              // 2. If that resulting state will trigger a _read, then call _read.
              // Note that this may be asynchronous, or synchronous.  Yes, it is
              // deeply ugly to write APIs this way, but that still doesn't mean
              // that the Readable class should behave improperly, as streams are
              // designed to be sync/async agnostic.
              // Take note if the _read call is sync or async (ie, if the read call
              // has returned yet), so that we know whether or not it's safe to emit
              // 'readable' etc.
              //
              // 3. Actually pull the requested chunks out of the buffer and return.

              // if we need a readable event, then we need to do some reading.
              var doRead = state.needReadable;
              debug('need readable', doRead);

              // if we currently have less than the highWaterMark, then also read some
              if (state.length === 0 || state.length - n < state.highWaterMark) {
                doRead = true;
                debug('length less than watermark', doRead);
              }

              // however, if we've ended, then there's no point, and if we're already
              // reading, then it's unnecessary.
              if (state.ended || state.reading) {
                doRead = false;
                debug('reading or ended', doRead);
              } else if (doRead) {
                debug('do read');
                state.reading = true;
                state.sync = true;
                // if the length is currently zero, then we *need* a readable event.
                if (state.length === 0) state.needReadable = true;
                // call internal read method
                this._read(state.highWaterMark);
                state.sync = false;
                // If _read pushed data synchronously, then `reading` will be false,
                // and we need to re-evaluate how much data we can return to the user.
                if (!state.reading) n = howMuchToRead(nOrig, state);
              }

              var ret;
              if (n > 0) ret = fromList(n, state);else ret = null;

              if (ret === null) {
                state.needReadable = true;
                n = 0;
              } else {
                state.length -= n;
              }

              if (state.length === 0) {
                // If we have nothing in the buffer, then we want to know
                // as soon as we *do* get something into the buffer.
                if (!state.ended) state.needReadable = true;

                // If we tried to read() past the EOF, then emit end on the next tick.
                if (nOrig !== n && state.ended) endReadable(this);
              }

              if (ret !== null) this.emit('data', ret);

              return ret;
            };

            function chunkInvalid(state, chunk) {
              var er = null;
              if (!isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
                er = new TypeError('Invalid non-string/buffer chunk');
              }
              return er;
            }

            function onEofChunk(stream, state) {
              if (state.ended) return;
              if (state.decoder) {
                var chunk = state.decoder.end();
                if (chunk && chunk.length) {
                  state.buffer.push(chunk);
                  state.length += state.objectMode ? 1 : chunk.length;
                }
              }
              state.ended = true;

              // emit 'readable' now to make sure it gets picked up.
              emitReadable(stream);
            }

            // Don't emit readable right away in sync mode, because this can trigger
            // another read() call => stack overflow.  This way, it might trigger
            // a nextTick recursion warning, but that's not so bad.
            function emitReadable(stream) {
              var state = stream._readableState;
              state.needReadable = false;
              if (!state.emittedReadable) {
                debug('emitReadable', state.flowing);
                state.emittedReadable = true;
                if (state.sync) nextTick(emitReadable_, stream);else emitReadable_(stream);
              }
            }

            function emitReadable_(stream) {
              debug('emit readable');
              stream.emit('readable');
              flow(stream);
            }

            // at this point, the user has presumably seen the 'readable' event,
            // and called read() to consume some data.  that may have triggered
            // in turn another _read(n) call, in which case reading = true if
            // it's in progress.
            // However, if we're not ended, or reading, and the length < hwm,
            // then go ahead and try to read some more preemptively.
            function maybeReadMore(stream, state) {
              if (!state.readingMore) {
                state.readingMore = true;
                nextTick(maybeReadMore_, stream, state);
              }
            }

            function maybeReadMore_(stream, state) {
              var len = state.length;
              while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
                debug('maybeReadMore read 0');
                stream.read(0);
                if (len === state.length)
                  // didn't get any data, stop spinning.
                  break;else len = state.length;
              }
              state.readingMore = false;
            }

            // abstract method.  to be overridden in specific implementation classes.
            // call cb(er, data) where data is <= n in length.
            // for virtual (non-string, non-buffer) streams, "length" is somewhat
            // arbitrary, and perhaps not very meaningful.
            Readable.prototype._read = function (n) {
              this.emit('error', new Error('not implemented'));
            };

            Readable.prototype.pipe = function (dest, pipeOpts) {
              var src = this;
              var state = this._readableState;

              switch (state.pipesCount) {
                case 0:
                  state.pipes = dest;
                  break;
                case 1:
                  state.pipes = [state.pipes, dest];
                  break;
                default:
                  state.pipes.push(dest);
                  break;
              }
              state.pipesCount += 1;
              debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

              var doEnd = (!pipeOpts || pipeOpts.end !== false);

              var endFn = doEnd ? onend : cleanup;
              if (state.endEmitted) nextTick(endFn);else src.once('end', endFn);

              dest.on('unpipe', onunpipe);
              function onunpipe(readable) {
                debug('onunpipe');
                if (readable === src) {
                  cleanup();
                }
              }

              function onend() {
                debug('onend');
                dest.end();
              }

              // when the dest drains, it reduces the awaitDrain counter
              // on the source.  This would be more elegant with a .once()
              // handler in flow(), but adding and removing repeatedly is
              // too slow.
              var ondrain = pipeOnDrain(src);
              dest.on('drain', ondrain);

              var cleanedUp = false;
              function cleanup() {
                debug('cleanup');
                // cleanup event handlers once the pipe is broken
                dest.removeListener('close', onclose);
                dest.removeListener('finish', onfinish);
                dest.removeListener('drain', ondrain);
                dest.removeListener('error', onerror);
                dest.removeListener('unpipe', onunpipe);
                src.removeListener('end', onend);
                src.removeListener('end', cleanup);
                src.removeListener('data', ondata);

                cleanedUp = true;

                // if the reader is waiting for a drain event from this
                // specific writer, then it would cause it to never start
                // flowing again.
                // So, if this is awaiting a drain, then we just call it now.
                // If we don't know, then assume that we are waiting for one.
                if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
              }

              // If the user pushes more data while we're writing to dest then we'll end up
              // in ondata again. However, we only want to increase awaitDrain once because
              // dest will only emit one 'drain' event for the multiple writes.
              // => Introduce a guard on increasing awaitDrain.
              var increasedAwaitDrain = false;
              src.on('data', ondata);
              function ondata(chunk) {
                debug('ondata');
                increasedAwaitDrain = false;
                var ret = dest.write(chunk);
                if (false === ret && !increasedAwaitDrain) {
                  // If the user unpiped during `dest.write()`, it is possible
                  // to get stuck in a permanently paused state if that write
                  // also returned false.
                  // => Check whether `dest` is still a piping destination.
                  if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
                    debug('false write response, pause', src._readableState.awaitDrain);
                    src._readableState.awaitDrain++;
                    increasedAwaitDrain = true;
                  }
                  src.pause();
                }
              }

              // if the dest has an error, then stop piping into it.
              // however, don't suppress the throwing behavior for this.
              function onerror(er) {
                debug('onerror', er);
                unpipe();
                dest.removeListener('error', onerror);
                if (listenerCount$1(dest, 'error') === 0) dest.emit('error', er);
              }

              // Make sure our error handler is attached before userland ones.
              prependListener(dest, 'error', onerror);

              // Both close and finish should trigger unpipe, but only once.
              function onclose() {
                dest.removeListener('finish', onfinish);
                unpipe();
              }
              dest.once('close', onclose);
              function onfinish() {
                debug('onfinish');
                dest.removeListener('close', onclose);
                unpipe();
              }
              dest.once('finish', onfinish);

              function unpipe() {
                debug('unpipe');
                src.unpipe(dest);
              }

              // tell the dest that it's being piped to
              dest.emit('pipe', src);

              // start the flow if it hasn't been started already.
              if (!state.flowing) {
                debug('pipe resume');
                src.resume();
              }

              return dest;
            };

            function pipeOnDrain(src) {
              return function () {
                var state = src._readableState;
                debug('pipeOnDrain', state.awaitDrain);
                if (state.awaitDrain) state.awaitDrain--;
                if (state.awaitDrain === 0 && src.listeners('data').length) {
                  state.flowing = true;
                  flow(src);
                }
              };
            }

            Readable.prototype.unpipe = function (dest) {
              var state = this._readableState;

              // if we're not piping anywhere, then do nothing.
              if (state.pipesCount === 0) return this;

              // just one destination.  most common case.
              if (state.pipesCount === 1) {
                // passed in one, but it's not the right one.
                if (dest && dest !== state.pipes) return this;

                if (!dest) dest = state.pipes;

                // got a match.
                state.pipes = null;
                state.pipesCount = 0;
                state.flowing = false;
                if (dest) dest.emit('unpipe', this);
                return this;
              }

              // slow case. multiple pipe destinations.

              if (!dest) {
                // remove all.
                var dests = state.pipes;
                var len = state.pipesCount;
                state.pipes = null;
                state.pipesCount = 0;
                state.flowing = false;

                for (var _i = 0; _i < len; _i++) {
                  dests[_i].emit('unpipe', this);
                }return this;
              }

              // try to find the right one.
              var i = indexOf(state.pipes, dest);
              if (i === -1) return this;

              state.pipes.splice(i, 1);
              state.pipesCount -= 1;
              if (state.pipesCount === 1) state.pipes = state.pipes[0];

              dest.emit('unpipe', this);

              return this;
            };

            // set up data events if they are asked for
            // Ensure readable listeners eventually get something
            Readable.prototype.on = function (ev, fn) {
              var res = EventEmitter.prototype.on.call(this, ev, fn);

              if (ev === 'data') {
                // Start flowing on next tick if stream isn't explicitly paused
                if (this._readableState.flowing !== false) this.resume();
              } else if (ev === 'readable') {
                var state = this._readableState;
                if (!state.endEmitted && !state.readableListening) {
                  state.readableListening = state.needReadable = true;
                  state.emittedReadable = false;
                  if (!state.reading) {
                    nextTick(nReadingNextTick, this);
                  } else if (state.length) {
                    emitReadable(this, state);
                  }
                }
              }

              return res;
            };
            Readable.prototype.addListener = Readable.prototype.on;

            function nReadingNextTick(self) {
              debug('readable nexttick read 0');
              self.read(0);
            }

            // pause() and resume() are remnants of the legacy readable stream API
            // If the user uses them, then switch into old mode.
            Readable.prototype.resume = function () {
              var state = this._readableState;
              if (!state.flowing) {
                debug('resume');
                state.flowing = true;
                resume(this, state);
              }
              return this;
            };

            function resume(stream, state) {
              if (!state.resumeScheduled) {
                state.resumeScheduled = true;
                nextTick(resume_, stream, state);
              }
            }

            function resume_(stream, state) {
              if (!state.reading) {
                debug('resume read 0');
                stream.read(0);
              }

              state.resumeScheduled = false;
              state.awaitDrain = 0;
              stream.emit('resume');
              flow(stream);
              if (state.flowing && !state.reading) stream.read(0);
            }

            Readable.prototype.pause = function () {
              debug('call pause flowing=%j', this._readableState.flowing);
              if (false !== this._readableState.flowing) {
                debug('pause');
                this._readableState.flowing = false;
                this.emit('pause');
              }
              return this;
            };

            function flow(stream) {
              var state = stream._readableState;
              debug('flow', state.flowing);
              while (state.flowing && stream.read() !== null) {}
            }

            // wrap an old-style stream as the async data source.
            // This is *not* part of the readable stream interface.
            // It is an ugly unfortunate mess of history.
            Readable.prototype.wrap = function (stream) {
              var state = this._readableState;
              var paused = false;

              var self = this;
              stream.on('end', function () {
                debug('wrapped end');
                if (state.decoder && !state.ended) {
                  var chunk = state.decoder.end();
                  if (chunk && chunk.length) self.push(chunk);
                }

                self.push(null);
              });

              stream.on('data', function (chunk) {
                debug('wrapped data');
                if (state.decoder) chunk = state.decoder.write(chunk);

                // don't skip over falsy values in objectMode
                if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

                var ret = self.push(chunk);
                if (!ret) {
                  paused = true;
                  stream.pause();
                }
              });

              // proxy all the other methods.
              // important when wrapping filters and duplexes.
              for (var i in stream) {
                if (this[i] === undefined && typeof stream[i] === 'function') {
                  this[i] = function (method) {
                    return function () {
                      return stream[method].apply(stream, arguments);
                    };
                  }(i);
                }
              }

              // proxy certain important events.
              var events = ['error', 'close', 'destroy', 'pause', 'resume'];
              forEach(events, function (ev) {
                stream.on(ev, self.emit.bind(self, ev));
              });

              // when we try to consume some more bytes, simply unpause the
              // underlying stream.
              self._read = function (n) {
                debug('wrapped _read', n);
                if (paused) {
                  paused = false;
                  stream.resume();
                }
              };

              return self;
            };

            // exposed for testing purposes only.
            Readable._fromList = fromList;

            // Pluck off n bytes from an array of buffers.
            // Length is the combined lengths of all the buffers in the list.
            // This function is designed to be inlinable, so please take care when making
            // changes to the function body.
            function fromList(n, state) {
              // nothing buffered
              if (state.length === 0) return null;

              var ret;
              if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
                // read it all, truncate the list
                if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
                state.buffer.clear();
              } else {
                // read part of list
                ret = fromListPartial(n, state.buffer, state.decoder);
              }

              return ret;
            }

            // Extracts only enough buffered data to satisfy the amount requested.
            // This function is designed to be inlinable, so please take care when making
            // changes to the function body.
            function fromListPartial(n, list, hasStrings) {
              var ret;
              if (n < list.head.data.length) {
                // slice is the same for buffers and strings
                ret = list.head.data.slice(0, n);
                list.head.data = list.head.data.slice(n);
              } else if (n === list.head.data.length) {
                // first chunk is a perfect match
                ret = list.shift();
              } else {
                // result spans more than one buffer
                ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
              }
              return ret;
            }

            // Copies a specified amount of characters from the list of buffered data
            // chunks.
            // This function is designed to be inlinable, so please take care when making
            // changes to the function body.
            function copyFromBufferString(n, list) {
              var p = list.head;
              var c = 1;
              var ret = p.data;
              n -= ret.length;
              while (p = p.next) {
                var str = p.data;
                var nb = n > str.length ? str.length : n;
                if (nb === str.length) ret += str;else ret += str.slice(0, n);
                n -= nb;
                if (n === 0) {
                  if (nb === str.length) {
                    ++c;
                    if (p.next) list.head = p.next;else list.head = list.tail = null;
                  } else {
                    list.head = p;
                    p.data = str.slice(nb);
                  }
                  break;
                }
                ++c;
              }
              list.length -= c;
              return ret;
            }

            // Copies a specified amount of bytes from the list of buffered data chunks.
            // This function is designed to be inlinable, so please take care when making
            // changes to the function body.
            function copyFromBuffer(n, list) {
              var ret = Buffer.allocUnsafe(n);
              var p = list.head;
              var c = 1;
              p.data.copy(ret);
              n -= p.data.length;
              while (p = p.next) {
                var buf = p.data;
                var nb = n > buf.length ? buf.length : n;
                buf.copy(ret, ret.length - n, 0, nb);
                n -= nb;
                if (n === 0) {
                  if (nb === buf.length) {
                    ++c;
                    if (p.next) list.head = p.next;else list.head = list.tail = null;
                  } else {
                    list.head = p;
                    p.data = buf.slice(nb);
                  }
                  break;
                }
                ++c;
              }
              list.length -= c;
              return ret;
            }

            function endReadable(stream) {
              var state = stream._readableState;

              // If we get here before consuming all the bytes, then that is a
              // bug in node.  Should never happen.
              if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

              if (!state.endEmitted) {
                state.ended = true;
                nextTick(endReadableNT, state, stream);
              }
            }

            function endReadableNT(state, stream) {
              // Check that we didn't get one last unshift.
              if (!state.endEmitted && state.length === 0) {
                state.endEmitted = true;
                stream.readable = false;
                stream.emit('end');
              }
            }

            function forEach(xs, f) {
              for (var i = 0, l = xs.length; i < l; i++) {
                f(xs[i], i);
              }
            }

            function indexOf(xs, x) {
              for (var i = 0, l = xs.length; i < l; i++) {
                if (xs[i] === x) return i;
              }
              return -1;
            }

            // A bit simpler than readable streams.
            Writable.WritableState = WritableState;
            inherits$1(Writable, EventEmitter);

            function nop() {}

            function WriteReq(chunk, encoding, cb) {
              this.chunk = chunk;
              this.encoding = encoding;
              this.callback = cb;
              this.next = null;
            }

            function WritableState(options, stream) {
              Object.defineProperty(this, 'buffer', {
                get: deprecate(function () {
                  return this.getBuffer();
                }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
              });
              options = options || {};

              // object stream flag to indicate whether or not this stream
              // contains buffers or objects.
              this.objectMode = !!options.objectMode;

              if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

              // the point at which write() starts returning false
              // Note: 0 is a valid value, means that we always return false if
              // the entire buffer is not flushed immediately on write()
              var hwm = options.highWaterMark;
              var defaultHwm = this.objectMode ? 16 : 16 * 1024;
              this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

              // cast to ints.
              this.highWaterMark = ~ ~this.highWaterMark;

              this.needDrain = false;
              // at the start of calling end()
              this.ending = false;
              // when end() has been called, and returned
              this.ended = false;
              // when 'finish' is emitted
              this.finished = false;

              // should we decode strings into buffers before passing to _write?
              // this is here so that some node-core streams can optimize string
              // handling at a lower level.
              var noDecode = options.decodeStrings === false;
              this.decodeStrings = !noDecode;

              // Crypto is kind of old and crusty.  Historically, its default string
              // encoding is 'binary' so we have to make this configurable.
              // Everything else in the universe uses 'utf8', though.
              this.defaultEncoding = options.defaultEncoding || 'utf8';

              // not an actual buffer we keep track of, but a measurement
              // of how much we're waiting to get pushed to some underlying
              // socket or file.
              this.length = 0;

              // a flag to see when we're in the middle of a write.
              this.writing = false;

              // when true all writes will be buffered until .uncork() call
              this.corked = 0;

              // a flag to be able to tell if the onwrite cb is called immediately,
              // or on a later tick.  We set this to true at first, because any
              // actions that shouldn't happen until "later" should generally also
              // not happen before the first write call.
              this.sync = true;

              // a flag to know if we're processing previously buffered items, which
              // may call the _write() callback in the same tick, so that we don't
              // end up in an overlapped onwrite situation.
              this.bufferProcessing = false;

              // the callback that's passed to _write(chunk,cb)
              this.onwrite = function (er) {
                onwrite(stream, er);
              };

              // the callback that the user supplies to write(chunk,encoding,cb)
              this.writecb = null;

              // the amount that is being written when _write is called.
              this.writelen = 0;

              this.bufferedRequest = null;
              this.lastBufferedRequest = null;

              // number of pending user-supplied write callbacks
              // this must be 0 before 'finish' can be emitted
              this.pendingcb = 0;

              // emit prefinish if the only thing we're waiting for is _write cbs
              // This is relevant for synchronous Transform streams
              this.prefinished = false;

              // True if the error was already emitted and should not be thrown again
              this.errorEmitted = false;

              // count buffered requests
              this.bufferedRequestCount = 0;

              // allocate the first CorkedRequest, there is always
              // one allocated and free to use, and we maintain at most two
              this.corkedRequestsFree = new CorkedRequest(this);
            }

            WritableState.prototype.getBuffer = function writableStateGetBuffer() {
              var current = this.bufferedRequest;
              var out = [];
              while (current) {
                out.push(current);
                current = current.next;
              }
              return out;
            };
            function Writable(options) {

              // Writable ctor is applied to Duplexes, though they're not
              // instanceof Writable, they're instanceof Readable.
              if (!(this instanceof Writable) && !(this instanceof Duplex)) return new Writable(options);

              this._writableState = new WritableState(options, this);

              // legacy.
              this.writable = true;

              if (options) {
                if (typeof options.write === 'function') this._write = options.write;

                if (typeof options.writev === 'function') this._writev = options.writev;
              }

              EventEmitter.call(this);
            }

            // Otherwise people can pipe Writable streams, which is just wrong.
            Writable.prototype.pipe = function () {
              this.emit('error', new Error('Cannot pipe, not readable'));
            };

            function writeAfterEnd(stream, cb) {
              var er = new Error('write after end');
              // TODO: defer error events consistently everywhere, not just the cb
              stream.emit('error', er);
              nextTick(cb, er);
            }

            // If we get something that is not a buffer, string, null, or undefined,
            // and we're not in objectMode, then that's an error.
            // Otherwise stream chunks are all considered to be of length=1, and the
            // watermarks determine how many objects to keep in the buffer, rather than
            // how many bytes or characters.
            function validChunk(stream, state, chunk, cb) {
              var valid = true;
              var er = false;
              // Always throw error if a null is written
              // if we are not in object mode then throw
              // if it is not a buffer, string, or undefined.
              if (chunk === null) {
                er = new TypeError('May not write null values to stream');
              } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
                er = new TypeError('Invalid non-string/buffer chunk');
              }
              if (er) {
                stream.emit('error', er);
                nextTick(cb, er);
                valid = false;
              }
              return valid;
            }

            Writable.prototype.write = function (chunk, encoding, cb) {
              var state = this._writableState;
              var ret = false;

              if (typeof encoding === 'function') {
                cb = encoding;
                encoding = null;
              }

              if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

              if (typeof cb !== 'function') cb = nop;

              if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
                state.pendingcb++;
                ret = writeOrBuffer(this, state, chunk, encoding, cb);
              }

              return ret;
            };

            Writable.prototype.cork = function () {
              var state = this._writableState;

              state.corked++;
            };

            Writable.prototype.uncork = function () {
              var state = this._writableState;

              if (state.corked) {
                state.corked--;

                if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
              }
            };

            Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
              // node::ParseEncoding() requires lower case.
              if (typeof encoding === 'string') encoding = encoding.toLowerCase();
              if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
              this._writableState.defaultEncoding = encoding;
              return this;
            };

            function decodeChunk(state, chunk, encoding) {
              if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
                chunk = Buffer.from(chunk, encoding);
              }
              return chunk;
            }

            // if we're already writing something, then just put this
            // in the queue, and wait our turn.  Otherwise, call _write
            // If we return false, then we need a drain event, so set that flag.
            function writeOrBuffer(stream, state, chunk, encoding, cb) {
              chunk = decodeChunk(state, chunk, encoding);

              if (Buffer.isBuffer(chunk)) encoding = 'buffer';
              var len = state.objectMode ? 1 : chunk.length;

              state.length += len;

              var ret = state.length < state.highWaterMark;
              // we must ensure that previous needDrain will not be reset to false.
              if (!ret) state.needDrain = true;

              if (state.writing || state.corked) {
                var last = state.lastBufferedRequest;
                state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
                if (last) {
                  last.next = state.lastBufferedRequest;
                } else {
                  state.bufferedRequest = state.lastBufferedRequest;
                }
                state.bufferedRequestCount += 1;
              } else {
                doWrite(stream, state, false, len, chunk, encoding, cb);
              }

              return ret;
            }

            function doWrite(stream, state, writev, len, chunk, encoding, cb) {
              state.writelen = len;
              state.writecb = cb;
              state.writing = true;
              state.sync = true;
              if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
              state.sync = false;
            }

            function onwriteError(stream, state, sync, er, cb) {
              --state.pendingcb;
              if (sync) nextTick(cb, er);else cb(er);

              stream._writableState.errorEmitted = true;
              stream.emit('error', er);
            }

            function onwriteStateUpdate(state) {
              state.writing = false;
              state.writecb = null;
              state.length -= state.writelen;
              state.writelen = 0;
            }

            function onwrite(stream, er) {
              var state = stream._writableState;
              var sync = state.sync;
              var cb = state.writecb;

              onwriteStateUpdate(state);

              if (er) onwriteError(stream, state, sync, er, cb);else {
                // Check if we're actually ready to finish, but don't emit yet
                var finished = needFinish(state);

                if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
                  clearBuffer(stream, state);
                }

                if (sync) {
                  /*<replacement>*/
                    nextTick(afterWrite, stream, state, finished, cb);
                  /*</replacement>*/
                } else {
                    afterWrite(stream, state, finished, cb);
                  }
              }
            }

            function afterWrite(stream, state, finished, cb) {
              if (!finished) onwriteDrain(stream, state);
              state.pendingcb--;
              cb();
              finishMaybe(stream, state);
            }

            // Must force callback to be called on nextTick, so that we don't
            // emit 'drain' before the write() consumer gets the 'false' return
            // value, and has a chance to attach a 'drain' listener.
            function onwriteDrain(stream, state) {
              if (state.length === 0 && state.needDrain) {
                state.needDrain = false;
                stream.emit('drain');
              }
            }

            // if there's something in the buffer waiting, then process it
            function clearBuffer(stream, state) {
              state.bufferProcessing = true;
              var entry = state.bufferedRequest;

              if (stream._writev && entry && entry.next) {
                // Fast case, write everything using _writev()
                var l = state.bufferedRequestCount;
                var buffer = new Array(l);
                var holder = state.corkedRequestsFree;
                holder.entry = entry;

                var count = 0;
                while (entry) {
                  buffer[count] = entry;
                  entry = entry.next;
                  count += 1;
                }

                doWrite(stream, state, true, state.length, buffer, '', holder.finish);

                // doWrite is almost always async, defer these to save a bit of time
                // as the hot path ends with doWrite
                state.pendingcb++;
                state.lastBufferedRequest = null;
                if (holder.next) {
                  state.corkedRequestsFree = holder.next;
                  holder.next = null;
                } else {
                  state.corkedRequestsFree = new CorkedRequest(state);
                }
              } else {
                // Slow case, write chunks one-by-one
                while (entry) {
                  var chunk = entry.chunk;
                  var encoding = entry.encoding;
                  var cb = entry.callback;
                  var len = state.objectMode ? 1 : chunk.length;

                  doWrite(stream, state, false, len, chunk, encoding, cb);
                  entry = entry.next;
                  // if we didn't call the onwrite immediately, then
                  // it means that we need to wait until it does.
                  // also, that means that the chunk and cb are currently
                  // being processed, so move the buffer counter past them.
                  if (state.writing) {
                    break;
                  }
                }

                if (entry === null) state.lastBufferedRequest = null;
              }

              state.bufferedRequestCount = 0;
              state.bufferedRequest = entry;
              state.bufferProcessing = false;
            }

            Writable.prototype._write = function (chunk, encoding, cb) {
              cb(new Error('not implemented'));
            };

            Writable.prototype._writev = null;

            Writable.prototype.end = function (chunk, encoding, cb) {
              var state = this._writableState;

              if (typeof chunk === 'function') {
                cb = chunk;
                chunk = null;
                encoding = null;
              } else if (typeof encoding === 'function') {
                cb = encoding;
                encoding = null;
              }

              if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

              // .end() fully uncorks
              if (state.corked) {
                state.corked = 1;
                this.uncork();
              }

              // ignore unnecessary end() calls.
              if (!state.ending && !state.finished) endWritable(this, state, cb);
            };

            function needFinish(state) {
              return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
            }

            function prefinish(stream, state) {
              if (!state.prefinished) {
                state.prefinished = true;
                stream.emit('prefinish');
              }
            }

            function finishMaybe(stream, state) {
              var need = needFinish(state);
              if (need) {
                if (state.pendingcb === 0) {
                  prefinish(stream, state);
                  state.finished = true;
                  stream.emit('finish');
                } else {
                  prefinish(stream, state);
                }
              }
              return need;
            }

            function endWritable(stream, state, cb) {
              state.ending = true;
              finishMaybe(stream, state);
              if (cb) {
                if (state.finished) nextTick(cb);else stream.once('finish', cb);
              }
              state.ended = true;
              stream.writable = false;
            }

            // It seems a linked list but it is not
            // there will be only 2 of these for each stream
            function CorkedRequest(state) {
              var _this = this;

              this.next = null;
              this.entry = null;

              this.finish = function (err) {
                var entry = _this.entry;
                _this.entry = null;
                while (entry) {
                  var cb = entry.callback;
                  state.pendingcb--;
                  cb(err);
                  entry = entry.next;
                }
                if (state.corkedRequestsFree) {
                  state.corkedRequestsFree.next = _this;
                } else {
                  state.corkedRequestsFree = _this;
                }
              };
            }

            inherits$1(Duplex, Readable);

            var keys = Object.keys(Writable.prototype);
            for (var v = 0; v < keys.length; v++) {
              var method = keys[v];
              if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
            }
            function Duplex(options) {
              if (!(this instanceof Duplex)) return new Duplex(options);

              Readable.call(this, options);
              Writable.call(this, options);

              if (options && options.readable === false) this.readable = false;

              if (options && options.writable === false) this.writable = false;

              this.allowHalfOpen = true;
              if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

              this.once('end', onend);
            }

            // the no-half-open enforcer
            function onend() {
              // if we allow half-open state, or if the writable side ended,
              // then we're ok.
              if (this.allowHalfOpen || this._writableState.ended) return;

              // no more data can be written.
              // But allow more writes to happen in this tick.
              nextTick(onEndNT, this);
            }

            function onEndNT(self) {
              self.end();
            }

            // a transform stream is a readable/writable stream where you do
            inherits$1(Transform, Duplex);

            function TransformState(stream) {
              this.afterTransform = function (er, data) {
                return afterTransform(stream, er, data);
              };

              this.needTransform = false;
              this.transforming = false;
              this.writecb = null;
              this.writechunk = null;
              this.writeencoding = null;
            }

            function afterTransform(stream, er, data) {
              var ts = stream._transformState;
              ts.transforming = false;

              var cb = ts.writecb;

              if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

              ts.writechunk = null;
              ts.writecb = null;

              if (data !== null && data !== undefined) stream.push(data);

              cb(er);

              var rs = stream._readableState;
              rs.reading = false;
              if (rs.needReadable || rs.length < rs.highWaterMark) {
                stream._read(rs.highWaterMark);
              }
            }
            function Transform(options) {
              if (!(this instanceof Transform)) return new Transform(options);

              Duplex.call(this, options);

              this._transformState = new TransformState(this);

              // when the writable side finishes, then flush out anything remaining.
              var stream = this;

              // start out asking for a readable event once data is transformed.
              this._readableState.needReadable = true;

              // we have implemented the _read method, and done the other things
              // that Readable wants before the first _read call, so unset the
              // sync guard flag.
              this._readableState.sync = false;

              if (options) {
                if (typeof options.transform === 'function') this._transform = options.transform;

                if (typeof options.flush === 'function') this._flush = options.flush;
              }

              this.once('prefinish', function () {
                if (typeof this._flush === 'function') this._flush(function (er) {
                  done(stream, er);
                });else done(stream);
              });
            }

            Transform.prototype.push = function (chunk, encoding) {
              this._transformState.needTransform = false;
              return Duplex.prototype.push.call(this, chunk, encoding);
            };

            // This is the part where you do stuff!
            // override this function in implementation classes.
            // 'chunk' is an input chunk.
            //
            // Call `push(newChunk)` to pass along transformed output
            // to the readable side.  You may call 'push' zero or more times.
            //
            // Call `cb(err)` when you are done with this chunk.  If you pass
            // an error, then that'll put the hurt on the whole operation.  If you
            // never call cb(), then you'll never get another chunk.
            Transform.prototype._transform = function (chunk, encoding, cb) {
              throw new Error('Not implemented');
            };

            Transform.prototype._write = function (chunk, encoding, cb) {
              var ts = this._transformState;
              ts.writecb = cb;
              ts.writechunk = chunk;
              ts.writeencoding = encoding;
              if (!ts.transforming) {
                var rs = this._readableState;
                if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
              }
            };

            // Doesn't matter what the args are here.
            // _transform does all the work.
            // That we got here means that the readable side wants more data.
            Transform.prototype._read = function (n) {
              var ts = this._transformState;

              if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
                ts.transforming = true;
                this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
              } else {
                // mark that we need a transform, so that any data that comes in
                // will get processed, now that we've asked for it.
                ts.needTransform = true;
              }
            };

            function done(stream, er) {
              if (er) return stream.emit('error', er);

              // if there's nothing in the write buffer, then that means
              // that nothing more will ever be provided
              var ws = stream._writableState;
              var ts = stream._transformState;

              if (ws.length) throw new Error('Calling transform done when ws.length != 0');

              if (ts.transforming) throw new Error('Calling transform done when still transforming');

              return stream.push(null);
            }

            inherits$1(PassThrough, Transform);
            function PassThrough(options) {
              if (!(this instanceof PassThrough)) return new PassThrough(options);

              Transform.call(this, options);
            }

            PassThrough.prototype._transform = function (chunk, encoding, cb) {
              cb(null, chunk);
            };

            inherits$1(Stream, EventEmitter);
            Stream.Readable = Readable;
            Stream.Writable = Writable;
            Stream.Duplex = Duplex;
            Stream.Transform = Transform;
            Stream.PassThrough = PassThrough;

            // Backwards-compat with node 0.4.x
            Stream.Stream = Stream;

            // old-style streams.  Note that the pipe method (the only relevant
            // part of this class) is overridden in the Readable class.

            function Stream() {
              EventEmitter.call(this);
            }

            Stream.prototype.pipe = function(dest, options) {
              var source = this;

              function ondata(chunk) {
                if (dest.writable) {
                  if (false === dest.write(chunk) && source.pause) {
                    source.pause();
                  }
                }
              }

              source.on('data', ondata);

              function ondrain() {
                if (source.readable && source.resume) {
                  source.resume();
                }
              }

              dest.on('drain', ondrain);

              // If the 'end' option is not supplied, dest.end() will be called when
              // source gets the 'end' or 'close' events.  Only dest.end() once.
              if (!dest._isStdio && (!options || options.end !== false)) {
                source.on('end', onend);
                source.on('close', onclose);
              }

              var didOnEnd = false;
              function onend() {
                if (didOnEnd) return;
                didOnEnd = true;

                dest.end();
              }


              function onclose() {
                if (didOnEnd) return;
                didOnEnd = true;

                if (typeof dest.destroy === 'function') dest.destroy();
              }

              // don't leave dangling pipes when there are errors.
              function onerror(er) {
                cleanup();
                if (EventEmitter.listenerCount(this, 'error') === 0) {
                  throw er; // Unhandled stream error in pipe.
                }
              }

              source.on('error', onerror);
              dest.on('error', onerror);

              // remove all the event listeners that were added.
              function cleanup() {
                source.removeListener('data', ondata);
                dest.removeListener('drain', ondrain);

                source.removeListener('end', onend);
                source.removeListener('close', onclose);

                source.removeListener('error', onerror);
                dest.removeListener('error', onerror);

                source.removeListener('end', cleanup);
                source.removeListener('close', cleanup);

                dest.removeListener('close', cleanup);
              }

              source.on('end', cleanup);
              source.on('close', cleanup);

              dest.on('close', cleanup);

              dest.emit('pipe', source);

              // Allow for unix-like usage: A.pipe(B).pipe(C)
              return dest;
            };

            var stream = /*#__PURE__*/Object.freeze({
                        default: Stream,
                        Readable: Readable,
                        Writable: Writable,
                        Duplex: Duplex,
                        Transform: Transform,
                        PassThrough: PassThrough,
                        Stream: Stream
            });

            var inherits_browser = createCommonjsModule(function (module) {
            if (typeof Object.create === 'function') {
              // implementation from standard node.js 'util' module
              module.exports = function inherits(ctor, superCtor) {
                ctor.super_ = superCtor;
                ctor.prototype = Object.create(superCtor.prototype, {
                  constructor: {
                    value: ctor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                  }
                });
              };
            } else {
              // old school shim for old browsers
              module.exports = function inherits(ctor, superCtor) {
                ctor.super_ = superCtor;
                var TempCtor = function () {};
                TempCtor.prototype = superCtor.prototype;
                ctor.prototype = new TempCtor();
                ctor.prototype.constructor = ctor;
              };
            }
            });

            var require$$1 = ( stream && Stream ) || stream;

            var Buffer$6 = safeBuffer.Buffer;
            var Transform$1 = require$$1.Transform;
            var StringDecoder$1 = stringDecoder.StringDecoder;


            function CipherBase (hashMode) {
              Transform$1.call(this);
              this.hashMode = typeof hashMode === 'string';
              if (this.hashMode) {
                this[hashMode] = this._finalOrDigest;
              } else {
                this.final = this._finalOrDigest;
              }
              if (this._final) {
                this.__final = this._final;
                this._final = null;
              }
              this._decoder = null;
              this._encoding = null;
            }
            inherits_browser(CipherBase, Transform$1);

            CipherBase.prototype.update = function (data, inputEnc, outputEnc) {
              if (typeof data === 'string') {
                data = Buffer$6.from(data, inputEnc);
              }

              var outData = this._update(data);
              if (this.hashMode) return this

              if (outputEnc) {
                outData = this._toString(outData, outputEnc);
              }

              return outData
            };

            CipherBase.prototype.setAutoPadding = function () {};
            CipherBase.prototype.getAuthTag = function () {
              throw new Error('trying to get auth tag in unsupported state')
            };

            CipherBase.prototype.setAuthTag = function () {
              throw new Error('trying to set auth tag in unsupported state')
            };

            CipherBase.prototype.setAAD = function () {
              throw new Error('trying to set aad in unsupported state')
            };

            CipherBase.prototype._transform = function (data, _, next) {
              var err;
              try {
                if (this.hashMode) {
                  this._update(data);
                } else {
                  this.push(this._update(data));
                }
              } catch (e) {
                err = e;
              } finally {
                next(err);
              }
            };
            CipherBase.prototype._flush = function (done) {
              var err;
              try {
                this.push(this.__final());
              } catch (e) {
                err = e;
              }

              done(err);
            };
            CipherBase.prototype._finalOrDigest = function (outputEnc) {
              var outData = this.__final() || Buffer$6.alloc(0);
              if (outputEnc) {
                outData = this._toString(outData, outputEnc, true);
              }
              return outData
            };

            CipherBase.prototype._toString = function (value, enc, fin) {
              if (!this._decoder) {
                this._decoder = new StringDecoder$1(enc);
                this._encoding = enc;
              }

              if (this._encoding !== enc) throw new Error('can\'t switch encodings')

              var out = this._decoder.write(value);
              if (fin) {
                out += this._decoder.end();
              }

              return out
            };

            var cipherBase = CipherBase;

            var Buffer$7 = safeBuffer.Buffer;
            var ZEROES = Buffer$7.alloc(16, 0);

            function toArray (buf) {
              return [
                buf.readUInt32BE(0),
                buf.readUInt32BE(4),
                buf.readUInt32BE(8),
                buf.readUInt32BE(12)
              ]
            }

            function fromArray (out) {
              var buf = Buffer$7.allocUnsafe(16);
              buf.writeUInt32BE(out[0] >>> 0, 0);
              buf.writeUInt32BE(out[1] >>> 0, 4);
              buf.writeUInt32BE(out[2] >>> 0, 8);
              buf.writeUInt32BE(out[3] >>> 0, 12);
              return buf
            }

            function GHASH (key) {
              this.h = key;
              this.state = Buffer$7.alloc(16, 0);
              this.cache = Buffer$7.allocUnsafe(0);
            }

            // from http://bitwiseshiftleft.github.io/sjcl/doc/symbols/src/core_gcm.js.html
            // by Juho Vähä-Herttua
            GHASH.prototype.ghash = function (block) {
              var i = -1;
              while (++i < block.length) {
                this.state[i] ^= block[i];
              }
              this._multiply();
            };

            GHASH.prototype._multiply = function () {
              var Vi = toArray(this.h);
              var Zi = [0, 0, 0, 0];
              var j, xi, lsbVi;
              var i = -1;
              while (++i < 128) {
                xi = (this.state[~~(i / 8)] & (1 << (7 - (i % 8)))) !== 0;
                if (xi) {
                  // Z_i+1 = Z_i ^ V_i
                  Zi[0] ^= Vi[0];
                  Zi[1] ^= Vi[1];
                  Zi[2] ^= Vi[2];
                  Zi[3] ^= Vi[3];
                }

                // Store the value of LSB(V_i)
                lsbVi = (Vi[3] & 1) !== 0;

                // V_i+1 = V_i >> 1
                for (j = 3; j > 0; j--) {
                  Vi[j] = (Vi[j] >>> 1) | ((Vi[j - 1] & 1) << 31);
                }
                Vi[0] = Vi[0] >>> 1;

                // If LSB(V_i) is 1, V_i+1 = (V_i >> 1) ^ R
                if (lsbVi) {
                  Vi[0] = Vi[0] ^ (0xe1 << 24);
                }
              }
              this.state = fromArray(Zi);
            };

            GHASH.prototype.update = function (buf) {
              this.cache = Buffer$7.concat([this.cache, buf]);
              var chunk;
              while (this.cache.length >= 16) {
                chunk = this.cache.slice(0, 16);
                this.cache = this.cache.slice(16);
                this.ghash(chunk);
              }
            };

            GHASH.prototype.final = function (abl, bl) {
              if (this.cache.length) {
                this.ghash(Buffer$7.concat([this.cache, ZEROES], 16));
              }

              this.ghash(fromArray([0, abl, 0, bl]));
              return this.state
            };

            var ghash = GHASH;

            var Buffer$8 = safeBuffer.Buffer;






            function xorTest (a, b) {
              var out = 0;
              if (a.length !== b.length) out++;

              var len = Math.min(a.length, b.length);
              for (var i = 0; i < len; ++i) {
                out += (a[i] ^ b[i]);
              }

              return out
            }

            function calcIv (self, iv, ck) {
              if (iv.length === 12) {
                self._finID = Buffer$8.concat([iv, Buffer$8.from([0, 0, 0, 1])]);
                return Buffer$8.concat([iv, Buffer$8.from([0, 0, 0, 2])])
              }
              var ghash$$1 = new ghash(ck);
              var len = iv.length;
              var toPad = len % 16;
              ghash$$1.update(iv);
              if (toPad) {
                toPad = 16 - toPad;
                ghash$$1.update(Buffer$8.alloc(toPad, 0));
              }
              ghash$$1.update(Buffer$8.alloc(8, 0));
              var ivBits = len * 8;
              var tail = Buffer$8.alloc(8);
              tail.writeUIntBE(ivBits, 0, 8);
              ghash$$1.update(tail);
              self._finID = ghash$$1.state;
              var out = Buffer$8.from(self._finID);
              incr32_1(out);
              return out
            }
            function StreamCipher (mode, key, iv, decrypt) {
              cipherBase.call(this);

              var h = Buffer$8.alloc(4, 0);

              this._cipher = new aes.AES(key);
              var ck = this._cipher.encryptBlock(h);
              this._ghash = new ghash(ck);
              iv = calcIv(this, iv, ck);

              this._prev = Buffer$8.from(iv);
              this._cache = Buffer$8.allocUnsafe(0);
              this._secCache = Buffer$8.allocUnsafe(0);
              this._decrypt = decrypt;
              this._alen = 0;
              this._len = 0;
              this._mode = mode;

              this._authTag = null;
              this._called = false;
            }

            inherits_browser(StreamCipher, cipherBase);

            StreamCipher.prototype._update = function (chunk) {
              if (!this._called && this._alen) {
                var rump = 16 - (this._alen % 16);
                if (rump < 16) {
                  rump = Buffer$8.alloc(rump, 0);
                  this._ghash.update(rump);
                }
              }

              this._called = true;
              var out = this._mode.encrypt(this, chunk);
              if (this._decrypt) {
                this._ghash.update(chunk);
              } else {
                this._ghash.update(out);
              }
              this._len += chunk.length;
              return out
            };

            StreamCipher.prototype._final = function () {
              if (this._decrypt && !this._authTag) throw new Error('Unsupported state or unable to authenticate data')

              var tag = bufferXor(this._ghash.final(this._alen * 8, this._len * 8), this._cipher.encryptBlock(this._finID));
              if (this._decrypt && xorTest(tag, this._authTag)) throw new Error('Unsupported state or unable to authenticate data')

              this._authTag = tag;
              this._cipher.scrub();
            };

            StreamCipher.prototype.getAuthTag = function getAuthTag () {
              if (this._decrypt || !Buffer$8.isBuffer(this._authTag)) throw new Error('Attempting to get auth tag in unsupported state')

              return this._authTag
            };

            StreamCipher.prototype.setAuthTag = function setAuthTag (tag) {
              if (!this._decrypt) throw new Error('Attempting to set auth tag in unsupported state')

              this._authTag = tag;
            };

            StreamCipher.prototype.setAAD = function setAAD (buf) {
              if (this._called) throw new Error('Attempting to set AAD in unsupported state')

              this._ghash.update(buf);
              this._alen += buf.length;
            };

            var authCipher = StreamCipher;

            var Buffer$9 = safeBuffer.Buffer;



            function StreamCipher$1 (mode, key, iv, decrypt) {
              cipherBase.call(this);

              this._cipher = new aes.AES(key);
              this._prev = Buffer$9.from(iv);
              this._cache = Buffer$9.allocUnsafe(0);
              this._secCache = Buffer$9.allocUnsafe(0);
              this._decrypt = decrypt;
              this._mode = mode;
            }

            inherits_browser(StreamCipher$1, cipherBase);

            StreamCipher$1.prototype._update = function (chunk) {
              return this._mode.encrypt(this, chunk, this._decrypt)
            };

            StreamCipher$1.prototype._final = function () {
              this._cipher.scrub();
            };

            var streamCipher = StreamCipher$1;

            var Buffer$a = safeBuffer.Buffer;
            var Transform$2 = require$$1.Transform;


            function throwIfNotStringOrBuffer (val, prefix) {
              if (!Buffer$a.isBuffer(val) && typeof val !== 'string') {
                throw new TypeError(prefix + ' must be a string or a buffer')
              }
            }

            function HashBase (blockSize) {
              Transform$2.call(this);

              this._block = Buffer$a.allocUnsafe(blockSize);
              this._blockSize = blockSize;
              this._blockOffset = 0;
              this._length = [0, 0, 0, 0];

              this._finalized = false;
            }

            inherits_browser(HashBase, Transform$2);

            HashBase.prototype._transform = function (chunk, encoding, callback) {
              var error = null;
              try {
                this.update(chunk, encoding);
              } catch (err) {
                error = err;
              }

              callback(error);
            };

            HashBase.prototype._flush = function (callback) {
              var error = null;
              try {
                this.push(this.digest());
              } catch (err) {
                error = err;
              }

              callback(error);
            };

            HashBase.prototype.update = function (data, encoding) {
              throwIfNotStringOrBuffer(data, 'Data');
              if (this._finalized) throw new Error('Digest already called')
              if (!Buffer$a.isBuffer(data)) data = Buffer$a.from(data, encoding);

              // consume data
              var block = this._block;
              var offset = 0;
              while (this._blockOffset + data.length - offset >= this._blockSize) {
                for (var i = this._blockOffset; i < this._blockSize;) block[i++] = data[offset++];
                this._update();
                this._blockOffset = 0;
              }
              while (offset < data.length) block[this._blockOffset++] = data[offset++];

              // update length
              for (var j = 0, carry = data.length * 8; carry > 0; ++j) {
                this._length[j] += carry;
                carry = (this._length[j] / 0x0100000000) | 0;
                if (carry > 0) this._length[j] -= 0x0100000000 * carry;
              }

              return this
            };

            HashBase.prototype._update = function () {
              throw new Error('_update is not implemented')
            };

            HashBase.prototype.digest = function (encoding) {
              if (this._finalized) throw new Error('Digest already called')
              this._finalized = true;

              var digest = this._digest();
              if (encoding !== undefined) digest = digest.toString(encoding);

              // reset state
              this._block.fill(0);
              this._blockOffset = 0;
              for (var i = 0; i < 4; ++i) this._length[i] = 0;

              return digest
            };

            HashBase.prototype._digest = function () {
              throw new Error('_digest is not implemented')
            };

            var hashBase = HashBase;

            var ARRAY16 = new Array(16);

            function MD5 () {
              hashBase.call(this, 64);

              // state
              this._a = 0x67452301;
              this._b = 0xefcdab89;
              this._c = 0x98badcfe;
              this._d = 0x10325476;
            }

            inherits_browser(MD5, hashBase);

            MD5.prototype._update = function () {
              var M = ARRAY16;
              for (var i = 0; i < 16; ++i) M[i] = this._block.readInt32LE(i * 4);

              var a = this._a;
              var b = this._b;
              var c = this._c;
              var d = this._d;

              a = fnF(a, b, c, d, M[0], 0xd76aa478, 7);
              d = fnF(d, a, b, c, M[1], 0xe8c7b756, 12);
              c = fnF(c, d, a, b, M[2], 0x242070db, 17);
              b = fnF(b, c, d, a, M[3], 0xc1bdceee, 22);
              a = fnF(a, b, c, d, M[4], 0xf57c0faf, 7);
              d = fnF(d, a, b, c, M[5], 0x4787c62a, 12);
              c = fnF(c, d, a, b, M[6], 0xa8304613, 17);
              b = fnF(b, c, d, a, M[7], 0xfd469501, 22);
              a = fnF(a, b, c, d, M[8], 0x698098d8, 7);
              d = fnF(d, a, b, c, M[9], 0x8b44f7af, 12);
              c = fnF(c, d, a, b, M[10], 0xffff5bb1, 17);
              b = fnF(b, c, d, a, M[11], 0x895cd7be, 22);
              a = fnF(a, b, c, d, M[12], 0x6b901122, 7);
              d = fnF(d, a, b, c, M[13], 0xfd987193, 12);
              c = fnF(c, d, a, b, M[14], 0xa679438e, 17);
              b = fnF(b, c, d, a, M[15], 0x49b40821, 22);

              a = fnG(a, b, c, d, M[1], 0xf61e2562, 5);
              d = fnG(d, a, b, c, M[6], 0xc040b340, 9);
              c = fnG(c, d, a, b, M[11], 0x265e5a51, 14);
              b = fnG(b, c, d, a, M[0], 0xe9b6c7aa, 20);
              a = fnG(a, b, c, d, M[5], 0xd62f105d, 5);
              d = fnG(d, a, b, c, M[10], 0x02441453, 9);
              c = fnG(c, d, a, b, M[15], 0xd8a1e681, 14);
              b = fnG(b, c, d, a, M[4], 0xe7d3fbc8, 20);
              a = fnG(a, b, c, d, M[9], 0x21e1cde6, 5);
              d = fnG(d, a, b, c, M[14], 0xc33707d6, 9);
              c = fnG(c, d, a, b, M[3], 0xf4d50d87, 14);
              b = fnG(b, c, d, a, M[8], 0x455a14ed, 20);
              a = fnG(a, b, c, d, M[13], 0xa9e3e905, 5);
              d = fnG(d, a, b, c, M[2], 0xfcefa3f8, 9);
              c = fnG(c, d, a, b, M[7], 0x676f02d9, 14);
              b = fnG(b, c, d, a, M[12], 0x8d2a4c8a, 20);

              a = fnH(a, b, c, d, M[5], 0xfffa3942, 4);
              d = fnH(d, a, b, c, M[8], 0x8771f681, 11);
              c = fnH(c, d, a, b, M[11], 0x6d9d6122, 16);
              b = fnH(b, c, d, a, M[14], 0xfde5380c, 23);
              a = fnH(a, b, c, d, M[1], 0xa4beea44, 4);
              d = fnH(d, a, b, c, M[4], 0x4bdecfa9, 11);
              c = fnH(c, d, a, b, M[7], 0xf6bb4b60, 16);
              b = fnH(b, c, d, a, M[10], 0xbebfbc70, 23);
              a = fnH(a, b, c, d, M[13], 0x289b7ec6, 4);
              d = fnH(d, a, b, c, M[0], 0xeaa127fa, 11);
              c = fnH(c, d, a, b, M[3], 0xd4ef3085, 16);
              b = fnH(b, c, d, a, M[6], 0x04881d05, 23);
              a = fnH(a, b, c, d, M[9], 0xd9d4d039, 4);
              d = fnH(d, a, b, c, M[12], 0xe6db99e5, 11);
              c = fnH(c, d, a, b, M[15], 0x1fa27cf8, 16);
              b = fnH(b, c, d, a, M[2], 0xc4ac5665, 23);

              a = fnI(a, b, c, d, M[0], 0xf4292244, 6);
              d = fnI(d, a, b, c, M[7], 0x432aff97, 10);
              c = fnI(c, d, a, b, M[14], 0xab9423a7, 15);
              b = fnI(b, c, d, a, M[5], 0xfc93a039, 21);
              a = fnI(a, b, c, d, M[12], 0x655b59c3, 6);
              d = fnI(d, a, b, c, M[3], 0x8f0ccc92, 10);
              c = fnI(c, d, a, b, M[10], 0xffeff47d, 15);
              b = fnI(b, c, d, a, M[1], 0x85845dd1, 21);
              a = fnI(a, b, c, d, M[8], 0x6fa87e4f, 6);
              d = fnI(d, a, b, c, M[15], 0xfe2ce6e0, 10);
              c = fnI(c, d, a, b, M[6], 0xa3014314, 15);
              b = fnI(b, c, d, a, M[13], 0x4e0811a1, 21);
              a = fnI(a, b, c, d, M[4], 0xf7537e82, 6);
              d = fnI(d, a, b, c, M[11], 0xbd3af235, 10);
              c = fnI(c, d, a, b, M[2], 0x2ad7d2bb, 15);
              b = fnI(b, c, d, a, M[9], 0xeb86d391, 21);

              this._a = (this._a + a) | 0;
              this._b = (this._b + b) | 0;
              this._c = (this._c + c) | 0;
              this._d = (this._d + d) | 0;
            };

            MD5.prototype._digest = function () {
              // create padding and handle blocks
              this._block[this._blockOffset++] = 0x80;
              if (this._blockOffset > 56) {
                this._block.fill(0, this._blockOffset, 64);
                this._update();
                this._blockOffset = 0;
              }

              this._block.fill(0, this._blockOffset, 56);
              this._block.writeUInt32LE(this._length[0], 56);
              this._block.writeUInt32LE(this._length[1], 60);
              this._update();

              // produce result
              var buffer = new Buffer(16);
              buffer.writeInt32LE(this._a, 0);
              buffer.writeInt32LE(this._b, 4);
              buffer.writeInt32LE(this._c, 8);
              buffer.writeInt32LE(this._d, 12);
              return buffer
            };

            function rotl (x, n) {
              return (x << n) | (x >>> (32 - n))
            }

            function fnF (a, b, c, d, m, k, s) {
              return (rotl((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + b) | 0
            }

            function fnG (a, b, c, d, m, k, s) {
              return (rotl((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + b) | 0
            }

            function fnH (a, b, c, d, m, k, s) {
              return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + b) | 0
            }

            function fnI (a, b, c, d, m, k, s) {
              return (rotl((a + ((c ^ (b | (~d)))) + m + k) | 0, s) + b) | 0
            }

            var md5_js = MD5;

            var Buffer$b = safeBuffer.Buffer;


            /* eslint-disable camelcase */
            function EVP_BytesToKey (password, salt, keyBits, ivLen) {
              if (!Buffer$b.isBuffer(password)) password = Buffer$b.from(password, 'binary');
              if (salt) {
                if (!Buffer$b.isBuffer(salt)) salt = Buffer$b.from(salt, 'binary');
                if (salt.length !== 8) throw new RangeError('salt should be Buffer with 8 byte length')
              }

              var keyLen = keyBits / 8;
              var key = Buffer$b.alloc(keyLen);
              var iv = Buffer$b.alloc(ivLen || 0);
              var tmp = Buffer$b.alloc(0);

              while (keyLen > 0 || ivLen > 0) {
                var hash = new md5_js();
                hash.update(tmp);
                hash.update(password);
                if (salt) hash.update(salt);
                tmp = hash.digest();

                var used = 0;

                if (keyLen > 0) {
                  var keyStart = key.length - keyLen;
                  used = Math.min(keyLen, tmp.length);
                  tmp.copy(key, keyStart, 0, used);
                  keyLen -= used;
                }

                if (used < tmp.length && ivLen > 0) {
                  var ivStart = iv.length - ivLen;
                  var length = Math.min(ivLen, tmp.length - used);
                  tmp.copy(iv, ivStart, used, used + length);
                  ivLen -= length;
                }
              }

              tmp.fill(0);
              return { key: key, iv: iv }
            }

            var evp_bytestokey = EVP_BytesToKey;

            var Buffer$c = safeBuffer.Buffer;






            function Cipher (mode, key, iv) {
              cipherBase.call(this);

              this._cache = new Splitter();
              this._cipher = new aes.AES(key);
              this._prev = Buffer$c.from(iv);
              this._mode = mode;
              this._autopadding = true;
            }

            inherits_browser(Cipher, cipherBase);

            Cipher.prototype._update = function (data) {
              this._cache.add(data);
              var chunk;
              var thing;
              var out = [];

              while ((chunk = this._cache.get())) {
                thing = this._mode.encrypt(this, chunk);
                out.push(thing);
              }

              return Buffer$c.concat(out)
            };

            var PADDING = Buffer$c.alloc(16, 0x10);

            Cipher.prototype._final = function () {
              var chunk = this._cache.flush();
              if (this._autopadding) {
                chunk = this._mode.encrypt(this, chunk);
                this._cipher.scrub();
                return chunk
              }

              if (!chunk.equals(PADDING)) {
                this._cipher.scrub();
                throw new Error('data not multiple of block length')
              }
            };

            Cipher.prototype.setAutoPadding = function (setTo) {
              this._autopadding = !!setTo;
              return this
            };

            function Splitter () {
              this.cache = Buffer$c.allocUnsafe(0);
            }

            Splitter.prototype.add = function (data) {
              this.cache = Buffer$c.concat([this.cache, data]);
            };

            Splitter.prototype.get = function () {
              if (this.cache.length > 15) {
                var out = this.cache.slice(0, 16);
                this.cache = this.cache.slice(16);
                return out
              }
              return null
            };

            Splitter.prototype.flush = function () {
              var len = 16 - this.cache.length;
              var padBuff = Buffer$c.allocUnsafe(len);

              var i = -1;
              while (++i < len) {
                padBuff.writeUInt8(len, i);
              }

              return Buffer$c.concat([this.cache, padBuff])
            };

            function createCipheriv (suite, password, iv) {
              var config = modes_1[suite.toLowerCase()];
              if (!config) throw new TypeError('invalid suite type')

              if (typeof password === 'string') password = Buffer$c.from(password);
              if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

              if (typeof iv === 'string') iv = Buffer$c.from(iv);
              if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

              if (config.type === 'stream') {
                return new streamCipher(config.module, password, iv)
              } else if (config.type === 'auth') {
                return new authCipher(config.module, password, iv)
              }

              return new Cipher(config.module, password, iv)
            }

            function createCipher (suite, password) {
              var config = modes_1[suite.toLowerCase()];
              if (!config) throw new TypeError('invalid suite type')

              var keys = evp_bytestokey(password, false, config.key, config.iv);
              return createCipheriv(suite, keys.key, keys.iv)
            }

            var createCipheriv_1 = createCipheriv;
            var createCipher_1 = createCipher;

            var encrypter = {
            	createCipheriv: createCipheriv_1,
            	createCipher: createCipher_1
            };

            var Buffer$d = safeBuffer.Buffer;







            function Decipher (mode, key, iv) {
              cipherBase.call(this);

              this._cache = new Splitter$1();
              this._last = void 0;
              this._cipher = new aes.AES(key);
              this._prev = Buffer$d.from(iv);
              this._mode = mode;
              this._autopadding = true;
            }

            inherits_browser(Decipher, cipherBase);

            Decipher.prototype._update = function (data) {
              this._cache.add(data);
              var chunk;
              var thing;
              var out = [];
              while ((chunk = this._cache.get(this._autopadding))) {
                thing = this._mode.decrypt(this, chunk);
                out.push(thing);
              }
              return Buffer$d.concat(out)
            };

            Decipher.prototype._final = function () {
              var chunk = this._cache.flush();
              if (this._autopadding) {
                return unpad(this._mode.decrypt(this, chunk))
              } else if (chunk) {
                throw new Error('data not multiple of block length')
              }
            };

            Decipher.prototype.setAutoPadding = function (setTo) {
              this._autopadding = !!setTo;
              return this
            };

            function Splitter$1 () {
              this.cache = Buffer$d.allocUnsafe(0);
            }

            Splitter$1.prototype.add = function (data) {
              this.cache = Buffer$d.concat([this.cache, data]);
            };

            Splitter$1.prototype.get = function (autoPadding) {
              var out;
              if (autoPadding) {
                if (this.cache.length > 16) {
                  out = this.cache.slice(0, 16);
                  this.cache = this.cache.slice(16);
                  return out
                }
              } else {
                if (this.cache.length >= 16) {
                  out = this.cache.slice(0, 16);
                  this.cache = this.cache.slice(16);
                  return out
                }
              }

              return null
            };

            Splitter$1.prototype.flush = function () {
              if (this.cache.length) return this.cache
            };

            function unpad (last) {
              var padded = last[15];
              if (padded < 1 || padded > 16) {
                throw new Error('unable to decrypt data')
              }
              var i = -1;
              while (++i < padded) {
                if (last[(i + (16 - padded))] !== padded) {
                  throw new Error('unable to decrypt data')
                }
              }
              if (padded === 16) return

              return last.slice(0, 16 - padded)
            }

            function createDecipheriv (suite, password, iv) {
              var config = modes_1[suite.toLowerCase()];
              if (!config) throw new TypeError('invalid suite type')

              if (typeof iv === 'string') iv = Buffer$d.from(iv);
              if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

              if (typeof password === 'string') password = Buffer$d.from(password);
              if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

              if (config.type === 'stream') {
                return new streamCipher(config.module, password, iv, true)
              } else if (config.type === 'auth') {
                return new authCipher(config.module, password, iv, true)
              }

              return new Decipher(config.module, password, iv)
            }

            function createDecipher (suite, password) {
              var config = modes_1[suite.toLowerCase()];
              if (!config) throw new TypeError('invalid suite type')

              var keys = evp_bytestokey(password, false, config.key, config.iv);
              return createDecipheriv(suite, keys.key, keys.iv)
            }

            var createDecipher_1 = createDecipher;
            var createDecipheriv_1 = createDecipheriv;

            var decrypter = {
            	createDecipher: createDecipher_1,
            	createDecipheriv: createDecipheriv_1
            };

            var browser$1 = createCommonjsModule(function (module, exports) {
            function getCiphers () {
              return Object.keys(modes)
            }

            exports.createCipher = exports.Cipher = encrypter.createCipher;
            exports.createCipheriv = exports.Cipheriv = encrypter.createCipheriv;
            exports.createDecipher = exports.Decipher = decrypter.createDecipher;
            exports.createDecipheriv = exports.Decipheriv = decrypter.createDecipheriv;
            exports.listCiphers = exports.getCiphers = getCiphers;
            });
            var browser_1 = browser$1.createCipher;
            var browser_2 = browser$1.Cipher;
            var browser_3 = browser$1.createCipheriv;
            var browser_4 = browser$1.Cipheriv;
            var browser_5 = browser$1.createDecipher;
            var browser_6 = browser$1.Decipher;
            var browser_7 = browser$1.createDecipheriv;
            var browser_8 = browser$1.Decipheriv;
            var browser_9 = browser$1.listCiphers;
            var browser_10 = browser$1.getCiphers;

            /**
             * Helpers.
             */

            var s = 1000;
            var m = s * 60;
            var h = m * 60;
            var d = h * 24;
            var y = d * 365.25;

            /**
             * Parse or format the given `val`.
             *
             * Options:
             *
             *  - `long` verbose formatting [false]
             *
             * @param {String|Number} val
             * @param {Object} options
             * @return {String|Number}
             * @api public
             */

            var ms = function(val, options){
              options = options || {};
              if ('string' == typeof val) return parse(val);
              return options.long
                ? long(val)
                : short(val);
            };

            /**
             * Parse the given `str` and return milliseconds.
             *
             * @param {String} str
             * @return {Number}
             * @api private
             */

            function parse(str) {
              str = '' + str;
              if (str.length > 10000) return;
              var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
              if (!match) return;
              var n = parseFloat(match[1]);
              var type = (match[2] || 'ms').toLowerCase();
              switch (type) {
                case 'years':
                case 'year':
                case 'yrs':
                case 'yr':
                case 'y':
                  return n * y;
                case 'days':
                case 'day':
                case 'd':
                  return n * d;
                case 'hours':
                case 'hour':
                case 'hrs':
                case 'hr':
                case 'h':
                  return n * h;
                case 'minutes':
                case 'minute':
                case 'mins':
                case 'min':
                case 'm':
                  return n * m;
                case 'seconds':
                case 'second':
                case 'secs':
                case 'sec':
                case 's':
                  return n * s;
                case 'milliseconds':
                case 'millisecond':
                case 'msecs':
                case 'msec':
                case 'ms':
                  return n;
              }
            }

            /**
             * Short format for `ms`.
             *
             * @param {Number} ms
             * @return {String}
             * @api private
             */

            function short(ms) {
              if (ms >= d) return Math.round(ms / d) + 'd';
              if (ms >= h) return Math.round(ms / h) + 'h';
              if (ms >= m) return Math.round(ms / m) + 'm';
              if (ms >= s) return Math.round(ms / s) + 's';
              return ms + 'ms';
            }

            /**
             * Long format for `ms`.
             *
             * @param {Number} ms
             * @return {String}
             * @api private
             */

            function long(ms) {
              return plural(ms, d, 'day')
                || plural(ms, h, 'hour')
                || plural(ms, m, 'minute')
                || plural(ms, s, 'second')
                || ms + ' ms';
            }

            /**
             * Pluralization helper.
             */

            function plural(ms, n, name) {
              if (ms < n) return;
              if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
              return Math.ceil(ms / n) + ' ' + name + 's';
            }

            var debug_1 = createCommonjsModule(function (module, exports) {
            /**
             * This is the common logic for both the Node.js and web browser
             * implementations of `debug()`.
             *
             * Expose `debug()` as the module.
             */

            exports = module.exports = debug;
            exports.coerce = coerce;
            exports.disable = disable;
            exports.enable = enable;
            exports.enabled = enabled;
            exports.humanize = ms;

            /**
             * The currently active debug mode names, and names to skip.
             */

            exports.names = [];
            exports.skips = [];

            /**
             * Map of special "%n" handling functions, for the debug "format" argument.
             *
             * Valid key names are a single, lowercased letter, i.e. "n".
             */

            exports.formatters = {};

            /**
             * Previously assigned color.
             */

            var prevColor = 0;

            /**
             * Previous log timestamp.
             */

            var prevTime;

            /**
             * Select a color.
             *
             * @return {Number}
             * @api private
             */

            function selectColor() {
              return exports.colors[prevColor++ % exports.colors.length];
            }

            /**
             * Create a debugger with the given `namespace`.
             *
             * @param {String} namespace
             * @return {Function}
             * @api public
             */

            function debug(namespace) {

              // define the `disabled` version
              function disabled() {
              }
              disabled.enabled = false;

              // define the `enabled` version
              function enabled() {

                var self = enabled;

                // set `diff` timestamp
                var curr = +new Date();
                var ms$$1 = curr - (prevTime || curr);
                self.diff = ms$$1;
                self.prev = prevTime;
                self.curr = curr;
                prevTime = curr;

                // add the `color` if not set
                if (null == self.useColors) self.useColors = exports.useColors();
                if (null == self.color && self.useColors) self.color = selectColor();

                var args = Array.prototype.slice.call(arguments);

                args[0] = exports.coerce(args[0]);

                if ('string' !== typeof args[0]) {
                  // anything else let's inspect with %o
                  args = ['%o'].concat(args);
                }

                // apply any `formatters` transformations
                var index = 0;
                args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
                  // if we encounter an escaped % then don't increase the array index
                  if (match === '%%') return match;
                  index++;
                  var formatter = exports.formatters[format];
                  if ('function' === typeof formatter) {
                    var val = args[index];
                    match = formatter.call(self, val);

                    // now we need to remove `args[index]` since it's inlined in the `format`
                    args.splice(index, 1);
                    index--;
                  }
                  return match;
                });

                if ('function' === typeof exports.formatArgs) {
                  args = exports.formatArgs.apply(self, args);
                }
                var logFn = enabled.log || exports.log || console.log.bind(console);
                logFn.apply(self, args);
              }
              enabled.enabled = true;

              var fn = exports.enabled(namespace) ? enabled : disabled;

              fn.namespace = namespace;

              return fn;
            }

            /**
             * Enables a debug mode by namespaces. This can include modes
             * separated by a colon and wildcards.
             *
             * @param {String} namespaces
             * @api public
             */

            function enable(namespaces) {
              exports.save(namespaces);

              var split = (namespaces || '').split(/[\s,]+/);
              var len = split.length;

              for (var i = 0; i < len; i++) {
                if (!split[i]) continue; // ignore empty strings
                namespaces = split[i].replace(/\*/g, '.*?');
                if (namespaces[0] === '-') {
                  exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
                } else {
                  exports.names.push(new RegExp('^' + namespaces + '$'));
                }
              }
            }

            /**
             * Disable debug output.
             *
             * @api public
             */

            function disable() {
              exports.enable('');
            }

            /**
             * Returns true if the given mode name is enabled, false otherwise.
             *
             * @param {String} name
             * @return {Boolean}
             * @api public
             */

            function enabled(name) {
              var i, len;
              for (i = 0, len = exports.skips.length; i < len; i++) {
                if (exports.skips[i].test(name)) {
                  return false;
                }
              }
              for (i = 0, len = exports.names.length; i < len; i++) {
                if (exports.names[i].test(name)) {
                  return true;
                }
              }
              return false;
            }

            /**
             * Coerce `val`.
             *
             * @param {Mixed} val
             * @return {Mixed}
             * @api private
             */

            function coerce(val) {
              if (val instanceof Error) return val.stack || val.message;
              return val;
            }
            });
            var debug_2 = debug_1.coerce;
            var debug_3 = debug_1.disable;
            var debug_4 = debug_1.enable;
            var debug_5 = debug_1.enabled;
            var debug_6 = debug_1.humanize;
            var debug_7 = debug_1.names;
            var debug_8 = debug_1.skips;
            var debug_9 = debug_1.formatters;

            var browser$2 = createCommonjsModule(function (module, exports) {
            /**
             * This is the web browser implementation of `debug()`.
             *
             * Expose `debug()` as the module.
             */

            exports = module.exports = debug_1;
            exports.log = log;
            exports.formatArgs = formatArgs;
            exports.save = save;
            exports.load = load;
            exports.useColors = useColors;
            exports.storage = 'undefined' != typeof chrome
                           && 'undefined' != typeof chrome.storage
                              ? chrome.storage.local
                              : localstorage();

            /**
             * Colors.
             */

            exports.colors = [
              'lightseagreen',
              'forestgreen',
              'goldenrod',
              'dodgerblue',
              'darkorchid',
              'crimson'
            ];

            /**
             * Currently only WebKit-based Web Inspectors, Firefox >= v31,
             * and the Firebug extension (any Firefox version) are known
             * to support "%c" CSS customizations.
             *
             * TODO: add a `localStorage` variable to explicitly enable/disable colors
             */

            function useColors() {
              // is webkit? http://stackoverflow.com/a/16459606/376773
              return ('WebkitAppearance' in document.documentElement.style) ||
                // is firebug? http://stackoverflow.com/a/398120/376773
                (window.console && (console.firebug || (console.exception && console.table))) ||
                // is firefox >= v31?
                // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
                (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
            }

            /**
             * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
             */

            exports.formatters.j = function(v) {
              return JSON.stringify(v);
            };


            /**
             * Colorize log arguments if enabled.
             *
             * @api public
             */

            function formatArgs() {
              var args = arguments;
              var useColors = this.useColors;

              args[0] = (useColors ? '%c' : '')
                + this.namespace
                + (useColors ? ' %c' : ' ')
                + args[0]
                + (useColors ? '%c ' : ' ')
                + '+' + exports.humanize(this.diff);

              if (!useColors) return args;

              var c = 'color: ' + this.color;
              args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

              // the final "%c" is somewhat tricky, because there could be other
              // arguments passed either before or after the %c, so we need to
              // figure out the correct index to insert the CSS into
              var index = 0;
              var lastC = 0;
              args[0].replace(/%[a-z%]/g, function(match) {
                if ('%%' === match) return;
                index++;
                if ('%c' === match) {
                  // we only are interested in the *last* %c
                  // (the user may have provided their own)
                  lastC = index;
                }
              });

              args.splice(lastC, 0, c);
              return args;
            }

            /**
             * Invokes `console.log()` when available.
             * No-op when `console.log` is not a "function".
             *
             * @api public
             */

            function log() {
              // this hackery is required for IE8/9, where
              // the `console.log` function doesn't have 'apply'
              return 'object' === typeof console
                && console.log
                && Function.prototype.apply.call(console.log, console, arguments);
            }

            /**
             * Save `namespaces`.
             *
             * @param {String} namespaces
             * @api private
             */

            function save(namespaces) {
              try {
                if (null == namespaces) {
                  exports.storage.removeItem('debug');
                } else {
                  exports.storage.debug = namespaces;
                }
              } catch(e) {}
            }

            /**
             * Load `namespaces`.
             *
             * @return {String} returns the previously persisted debug modes
             * @api private
             */

            function load() {
              var r;
              try {
                r = exports.storage.debug;
              } catch(e) {}
              return r;
            }

            /**
             * Enable namespaces listed in `localStorage.debug` initially.
             */

            exports.enable(load());

            /**
             * Localstorage attempts to return the localstorage.
             *
             * This is necessary because safari throws
             * when a user disables cookies/localstorage
             * and you attempt to access it.
             *
             * @return {LocalStorage}
             * @api private
             */

            function localstorage(){
              try {
                return window.localStorage;
              } catch (e) {}
            }
            });
            var browser_1$1 = browser$2.log;
            var browser_2$1 = browser$2.formatArgs;
            var browser_3$1 = browser$2.save;
            var browser_4$1 = browser$2.load;
            var browser_5$1 = browser$2.useColors;
            var browser_6$1 = browser$2.storage;
            var browser_7$1 = browser$2.colors;

            var EventEmitter$1 = ( events && EventEmitter ) || events;

            const debug$1 = browser$2('MiBand');

            const UUID_BASE = (x) => `0000${x}-0000-3512-2118-0009af100700`;

            const UUID_SERVICE_GENERIC_ACCESS =     0x1800;
            const UUID_SERVICE_GENERIC_ATTRIBUTE =  0x1801;
            const UUID_SERVICE_DEVICE_INFORMATION = 0x180a;
            const UUID_SERVICE_FIRMWARE =           UUID_BASE('1530');
            const UUID_SERVICE_ALERT_NOTIFICATION = 0x1811;
            const UUID_SERVICE_IMMEDIATE_ALERT =    0x1802;
            const UUID_SERVICE_HEART_RATE =         0x180d;
            const UUID_SERVICE_MIBAND_1 =           0xfee0;
            const UUID_SERVICE_MIBAND_2 =           0xfee1;

            // This is a helper function that constructs an ArrayBuffer based on arguments
            const AB = function() {
              let args = [...arguments];

              // Convert all arrays to buffers
              args = args.map(function(i) {
                if (i instanceof Array) {
                  return Buffer.from(i);
                }
                return i;
              });

              // Merge into a single buffer
              let buf = Buffer.concat(args);

              // Convert into ArrayBuffer
              let ab = new ArrayBuffer(buf.length);
              let view = new Uint8Array(ab);
              for (let i = 0; i < buf.length; ++i) {
                view[i] = buf[i];
              }
              return ab;
            };

            function parseDate(buff) {
              let year = buff.readUInt16LE(0),
                mon = buff[2]-1,
                day = buff[3],
                hrs = buff[4],
                min = buff[5],
                sec = buff[6],
                msec = buff[8] * 1000 / 256;
              return new Date(year, mon, day, hrs, min, sec)
            }

            class MiBand extends EventEmitter$1 {

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
                this.char = {};

                // TODO: this is constant for now, but should random and managed per-device
                this.key = new Buffer('30313233343536373839404142434445', 'hex');
                this.textDec = new TextDecoder();
              }

              async startNotificationsFor(c) {
                let char = this.char[c];
                await char.startNotifications();
                char.addEventListener('characteristicvaluechanged', this._handleNotify.bind(this));
              }

              async init() {
                let miband2 = await this.device.getPrimaryService(UUID_SERVICE_MIBAND_2);
                this.char.auth = await miband2.getCharacteristic(UUID_BASE('0009'));

                let miband1 = await this.device.getPrimaryService(UUID_SERVICE_MIBAND_1);
                this.char.time =   await miband1.getCharacteristic(0x2a2b);
                this.char.raw_ctrl = await miband1.getCharacteristic(UUID_BASE('0001'));
                this.char.raw_data = await miband1.getCharacteristic(UUID_BASE('0002'));
                this.char.config = await miband1.getCharacteristic(UUID_BASE('0003'));
                this.char.activ =  await miband1.getCharacteristic(UUID_BASE('0005'));
                this.char.batt =   await miband1.getCharacteristic(UUID_BASE('0006'));
                this.char.steps =  await miband1.getCharacteristic(UUID_BASE('0007'));
                this.char.user =   await miband1.getCharacteristic(UUID_BASE('0008'));
                this.char.event =  await miband1.getCharacteristic(UUID_BASE('0010'));

                let hrm = await this.device.getPrimaryService(UUID_SERVICE_HEART_RATE);
                this.char.hrm_ctrl = await hrm.getCharacteristic(0x2a39);
                this.char.hrm_data = await hrm.getCharacteristic(0x2a37);

                let imm_alert = await this.device.getPrimaryService(UUID_SERVICE_IMMEDIATE_ALERT);
                this.char.alert = await imm_alert.getCharacteristic(0x2a06);

                let devinfo = await this.device.getPrimaryService(UUID_SERVICE_DEVICE_INFORMATION);
                this.char.info_hwrev = await devinfo.getCharacteristic(0x2a27);
                this.char.info_swrev = await devinfo.getCharacteristic(0x2a28);
                try { // Serial Number is in blocklist of WebBluetooth spec
                  this.char.info_serial = await devinfo.getCharacteristic(0x2a25);
                } catch(error) {
                  // do nothing
                }

                let fw = await this.device.getPrimaryService(UUID_SERVICE_FIRMWARE);
                this.char.fw_ctrl = await fw.getCharacteristic(UUID_BASE('1531'));
                this.char.fw_data = await fw.getCharacteristic(UUID_BASE('1532'));

                await this.startNotificationsFor('auth');

                await this.authenticate();

                // Notifications should be enabled after auth
                for (let char of ['hrm_data', 'event', 'raw_data']) {
                  await this.startNotificationsFor(char);
                }
              }

              /*
               * Authentication
               */

              async authenticate() {
                await this.authReqRandomKey();

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
                debug$1('Notification:', type);
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
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]));
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x00]));
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x01]));
                return new Promise((resolve, reject) => {
                  setTimeout(() => reject('Timeout'), 15000);
                  this.once('heart_rate', resolve);
                });
              }

              async hrmStart() {
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x02, 0x00]));
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]));
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x01]));

                // Start pinging HRM
                this.hrmTimer = this.hrmTimer || setInterval(() => {
                  debug$1('Pinging HRM');
                  this.char.hrm_ctrl.writeValue(AB([0x16]));
                },12000);
              }

              async hrmStop() {
                clearInterval(this.hrmTimer);
                this.hrmTimer = undefined;
                await this.char.hrm_ctrl.writeValue(AB([0x15, 0x01, 0x00]));
              }

              /*
               * Pedometer
               */

              async getPedometerStats() {
                let data = await this.char.steps.readValue();
                data = Buffer.from(data.buffer);
                let result = {};
                //unknown = data.readUInt8(0)
                result.steps = data.readUInt16LE(1);
                //unknown = data.readUInt16LE(3) // 2 more bytes for steps? ;)
                if (data.length >= 8)  result.distance = data.readUInt32LE(5);
                if (data.length >= 12) result.calories = data.readUInt32LE(9);
                return result;
              }

              /*
               * General functions
               */

              async getBatteryInfo() {
                let data = await this.char.batt.readValue();
                data = Buffer.from(data.buffer);
                if (data.length <= 2) return 'unknown';

                let result = {};
                result.level = data[1];
                result.charging = !!data[2];
                result.off_date = parseDate(data.slice(3, 10));
                result.charge_date = parseDate(data.slice(11, 18));
                //result.charge_num = data[10]
                result.charge_level = data[19];
                return result;
              }

              async getTime() {
                let data = await this.char.time.readValue();
                data = Buffer.from(data.buffer);
                return parseDate(data)
              }

              async getSerial() {
                if (!this.char.info_serial) return undefined;
                let data = await this.char.info_serial.readValue();
                return this.textDec.decode(data)
              }

              async getHwRevision() {
                let data = await this.char.info_hwrev.readValue();
                data = this.textDec.decode(data);
                if (data.startsWith('V') || data.startsWith('v'))
                  data = data.substring(1);
                return data
              }

              async getSwRevision() {
                let data = await this.char.info_swrev.readValue();
                data = this.textDec.decode(data);
                if (data.startsWith('V') || data.startsWith('v'))
                  data = data.substring(1);
                return data
              }

              async setUserInfo(user) {
                let data = new Buffer(16);
                data.writeUInt8   (0x4f, 0); // Set user info command

                data.writeUInt16LE(user.born.getFullYear(), 3);
                data.writeUInt8   (user.born.getMonth()+1, 5);
                data.writeUInt8   (user.born.getDate(), 6);
                switch (user.sex) {
                case 'male':   data.writeUInt8   (0, 7); break;
                case 'female': data.writeUInt8   (1, 7); break;
                default:       data.writeUInt8   (2, 7); break;
                }
                data.writeUInt16LE(user.height,  8); // cm
                data.writeUInt16LE(user.weight, 10); // kg
                data.writeUInt32LE(user.id,     12); // id

                await this.char.user.writeValue(AB(data));
              }

              //async reboot() {
              //  await this.char.fw_ctrl.writeValue(AB([0x05]))
              //}

              /*
               * RAW data
               */

              async rawStart() {
                await this.char.raw_ctrl.writeValue(AB([0x01, 0x03, 0x19]));
                await this.hrmStart();
                await this.char.raw_ctrl.writeValue(AB([0x02]));
              }

              async rawStop() {
                await this.char.raw_ctrl.writeValue(AB([0x03]));
                await this.hrmStop();
              }

              /*
               * Internals
               */

              _handleNotify(event) {
                const value = Buffer.from(event.target.value.buffer);

                if (event.target.uuid === this.char.auth.uuid) {
                  const cmd = value.slice(0,3).toString('hex');
                  if (cmd === '100101') {         // Set New Key OK
                    this.authReqRandomKey();
                  } else if (cmd === '100201') {  // Req Random Number OK
                    let rdn = value.slice(3);
                    let cipher = browser$1.createCipheriv('aes-128-ecb', this.key, '').setAutoPadding(false);
                    let encrypted = Buffer.concat([cipher.update(rdn), cipher.final()]);
                    this.authSendEncKey(encrypted);
                  } else if (cmd === '100301') {
                    debug$1('Authenticated');
                    this.emit('authenticated');

                  } else if (cmd === '100104') {  // Set New Key FAIL
                    this.emit('error', 'Key Sending failed');
                  } else if (cmd === '100204') {  // Req Random Number FAIL
                    this.emit('error', 'Key Sending failed');
                  } else if (cmd === '100304') {
                    debug$1('Encryption Key Auth Fail, sending new key...');
                    this.authSendNewKey(this.key);
                  } else {
                    debug$1('Unhandled auth rsp:', value);
                  }

                } else if (event.target.uuid === this.char.hrm_data.uuid) {
                  let rate = value.readUInt16BE(0);
                  this.emit('heart_rate', rate);

                } else if (event.target.uuid === this.char.event.uuid) {
                  const cmd = value.toString('hex');
                  if (cmd === '04') {
                    this.emit('button');
                  } else {
                    debug$1('Unhandled event:', value);
                  }
                } else if (event.target.uuid === this.char.raw_data.uuid) {
                  // TODO: parse adxl362 data
                  // https://github.com/Freeyourgadget/Gadgetbridge/issues/63#issuecomment-302815121
                  debug$1('RAW data:', value);
                } else {
                  debug$1(event.target.uuid, '=>', value);
                }
              }
            }

            var miband = MiBand;

            function delay(ms) {
              return new Promise(resolve => setTimeout(resolve, ms))
            }

            async function test_all(miband, log) {

              let info = {
                time:     await miband.getTime(),
                battery:  await miband.getBatteryInfo(),
                hw_ver:   await miband.getHwRevision(),
                sw_ver:   await miband.getSwRevision(),
                serial:   await miband.getSerial(),
              };

              log(`HW ver: ${info.hw_ver}  SW ver: ${info.sw_ver}`);
              info.serial && log(`Serial: ${info.serial}`);
              log(`Battery: ${info.battery.level}%`);
              log(`Time: ${info.time.toLocaleString()}`);

              let ped = await miband.getPedometerStats();
              log('Pedometer:', JSON.stringify(ped));

              log('Notifications demo...');
              await miband.showNotification('message');
              await delay(3000);
              await miband.showNotification('phone');
              await delay(5000);
              await miband.showNotification('off');

              log('Tap MiBand button, quick!');
              miband.on('button', () => log('Tap detected'));
              try {
                await miband.waitButton(10000);
              } catch (e) {
                log('OK, nevermind ;)');
              }

              log('Heart Rate Monitor (single-shot)');
              log('Result:', await miband.hrmRead());

              log('Heart Rate Monitor (continuous for 30 sec)...');
              miband.on('heart_rate', (rate) => {
                log('Heart Rate:', rate);
              });
              await miband.hrmStart();
              await delay(30000);
              await miband.hrmStop();

              //log('RAW data (no decoding)...')
              //miband.rawStart();
              //await delay(30000);
              //miband.rawStop();

              log('Finished.');
            }

            var test = test_all;

            __$styleInject("html {\n  background: #eee;\n}\nbody {\n  max-width: 960px;\n  width: 80%;\n  box-sizing: border-box;\n  margin: 50px auto;\n  min-height: calc(100vh - 100px);\n  background: #000;\n  box-shadow: 0 0 96px black;\n  border-radius: 16px;\n  border-bottom-left-radius: 0;\n  border-bottom-right-radius: 0;\n  font-family: monospace;\n}\nheader {\n  padding: 4px 16px 0px;\n  background: #333;\n  border-radius: 16px;\n  border-bottom-left-radius: 0;\n  border-bottom-right-radius: 0;\n  display: flex;\n  justify-content: space-between;\n  font-family: \"Arial\";\n}\nmain {\n  background: black;\n  color: white;\n  padding: 4px 16px;\n  overflow-y: auto;\n  max-height: calc(100vh - 164px);\n}\n#output {\n  margin: 0;\n}\nh1 {\n  text-shadow: 1px 1px 0 black;\n  font-size: 28px;\n  margin: 10px 0;\n  cursor: pointer;\n  color: transparent;\n}\nh1:hover .h1-left,\nh1:hover .h1-right {\n  color: #fff;\n}\nh1 .h1-left {\n  color: #A9D96C;\n  transition: 0.25s ease-in-out color;\n}\nh1 .h1-right {\n  margin-left: -6px;\n  color: #41c5f4;\n  transition: 0.25s ease-in-out color;\n}\nh1 a {\n  color: transparent;\n  text-decoration: none;\n}\n.btn-scan {\n  margin: 12px 0;\n  padding: 0 24px;\n  cursor: pointer;\n  background: #A9D96C;\n  border: none;\n  color: white;\n  font-weight: bold;\n  border-radius: 4px;\n  outline: none;\n  transition: 0.25s ease-in-out color;\n}\n.btn-scan:hover {\n  color: black;\n}\n.fork-me {\n  position: fixed;\n  top: 0;\n  right: 0;\n  border: 0;\n  z-index: -1;\n  transform: rotate(90deg);\n}\n");

            const bluetooth = navigator.bluetooth;

            const output = document.querySelector('#output');

            function log$1() {
              document.querySelector('main').style.display = 'block';

              output.innerHTML += [...arguments].join(' ') + '\n';
            }

            async function scan() {
              if (!bluetooth) {
                log$1('WebBluetooth is not supported by your browser!');
                return;
              }

              try {
                log$1('Requesting Bluetooth Device...');
                const device = await bluetooth.requestDevice({
                  filters: [
                    { services: [ miband.advertisementService ] }
                  ],
                  optionalServices: miband.optionalServices
                });

                device.addEventListener('gattserverdisconnected', () => {
                  log$1('Device disconnected');
                });

                await device.gatt.disconnect();

                log$1('Connecting to the device...');
                const server = await device.gatt.connect();
                log$1('Connected');

                let miband$$1 = new miband(server);

                await miband$$1.init();

                await test(miband$$1, log$1);

              } catch(error) {
                log$1('Argh!', error);
              }
            }

            document.querySelector('#scanBtn').addEventListener('click', scan);

}());
//# sourceMappingURL=webapp.bundle.js.map
