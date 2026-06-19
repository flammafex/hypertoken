var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// examples/confluence/web/crypto-browser-shim.js
function randomUUID() {
  return globalThis.crypto.randomUUID();
}
var webcrypto, crypto_browser_shim_default;
var init_crypto_browser_shim = __esm({
  "examples/confluence/web/crypto-browser-shim.js"() {
    "use strict";
    webcrypto = globalThis.crypto;
    crypto_browser_shim_default = globalThis.crypto;
  }
});

// core/crypto.ts
function generateId() {
  return typeof randomUUID === "function" ? randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
var init_crypto = __esm({
  "core/crypto.ts"() {
    "use strict";
    init_crypto_browser_shim();
  }
});

// core/events.ts
var Emitter;
var init_events = __esm({
  "core/events.ts"() {
    "use strict";
    init_crypto();
    Emitter = class {
      constructor() {
        // Map event names to sets of handlers
        __publicField(this, "_events", {});
        this._events = {};
      }
      on(type, fn) {
        if (!this._events[type]) this._events[type] = /* @__PURE__ */ new Set();
        this._events[type].add(fn);
        return this;
      }
      off(type, fn) {
        if (this._events[type]) this._events[type].delete(fn);
        return this;
      }
      once(type, fn) {
        const wrapper = (evt) => {
          fn(evt);
          this.off(type, wrapper);
        };
        return this.on(type, wrapper);
      }
      emit(type, payload = {}) {
        const evt = payload && payload.type && payload.payload !== void 0 ? payload : {
          id: generateId(),
          type,
          payload,
          ts: Date.now()
        };
        if (this._events[type]) {
          for (const fn of this._events[type]) fn(evt);
        }
        if (this._events["*"]) {
          for (const fn of this._events["*"]) fn(evt);
        }
        return true;
      }
    };
  }
});

// node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/base64-js/index.js"(exports) {
    "use strict";
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/ieee754/index.js"(exports) {
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
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
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/buffer/index.js
var require_buffer = __commonJS({
  "node_modules/buffer/index.js"(exports) {
    "use strict";
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer4;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer4.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer4.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer4.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer4.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer4.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer4.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer4.prototype);
      return buf;
    }
    function Buffer4(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from2(arg, encodingOrOffset, length);
    }
    Buffer4.poolSize = 8192;
    function from2(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer4.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer4.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer4.from = function(value, encodingOrOffset, length) {
      return from2(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer4.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer4, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer4.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer4.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer4.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer4.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer4.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer4.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer4.alloc(+length);
    }
    Buffer4.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer4.prototype;
    };
    Buffer4.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer4.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer4.from(b, b.offset, b.byteLength);
      if (!Buffer4.isBuffer(a) || !Buffer4.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer4.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer4.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer4.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer4.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer4.isBuffer(buf)) buf = Buffer4.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer4.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer4.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer4.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer4.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer4.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer4.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer4.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer4.prototype.toString = function toString3() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer4.prototype.toLocaleString = Buffer4.prototype.toString;
    Buffer4.prototype.equals = function equals(b) {
      if (!Buffer4.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer4.compare(this, b) === 0;
    };
    Buffer4.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer4.prototype[customInspectSymbol] = Buffer4.prototype.inspect;
    }
    Buffer4.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer4.from(target, target.offset, target.byteLength);
      }
      if (!Buffer4.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer4.from(val, encoding);
      }
      if (Buffer4.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer4.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer4.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer4.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer4.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer4.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer4.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
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
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer4.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer4.prototype.readUintLE = Buffer4.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer4.prototype.readUintBE = Buffer4.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer4.prototype.readUint8 = Buffer4.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer4.prototype.readUint16LE = Buffer4.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer4.prototype.readUint16BE = Buffer4.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer4.prototype.readUint32LE = Buffer4.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer4.prototype.readUint32BE = Buffer4.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer4.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer4.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer4.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer4.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer4.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer4.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer4.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer4.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer4.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer4.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer4.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer4.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer4.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer4.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer4.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer4.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer4.prototype.writeUintLE = Buffer4.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer4.prototype.writeUintBE = Buffer4.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer4.prototype.writeUint8 = Buffer4.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer4.prototype.writeUint16LE = Buffer4.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer4.prototype.writeUint16BE = Buffer4.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer4.prototype.writeUint32LE = Buffer4.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer4.prototype.writeUint32BE = Buffer4.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer4.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer4.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer4.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer4.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer4.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer4.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer4.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer4.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer4.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer4.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer4.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer4.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer4.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer4.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer4.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer4.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer4.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer4.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer4.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer4.isBuffer(val) ? val : Buffer4.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// examples/confluence/web/path-shim.js
function fileURLToPath() {
  return "";
}
function dirname() {
  return "";
}
function join() {
  return "";
}
var init_path_shim = __esm({
  "examples/confluence/web/path-shim.js"() {
    "use strict";
  }
});

// examples/confluence/web/worker-shim.js
var Worker2;
var init_worker_shim = __esm({
  "examples/confluence/web/worker-shim.js"() {
    "use strict";
    Worker2 = class {
      constructor() {
        throw new Error("Worker not available in browser");
      }
    };
  }
});

// node_modules/events/events.js
var require_events = __commonJS({
  "node_modules/events/events.js"(exports, module) {
    "use strict";
    var R = typeof Reflect === "object" ? Reflect : null;
    var ReflectApply = R && typeof R.apply === "function" ? R.apply : function ReflectApply2(target, receiver, args) {
      return Function.prototype.apply.call(target, receiver, args);
    };
    var ReflectOwnKeys;
    if (R && typeof R.ownKeys === "function") {
      ReflectOwnKeys = R.ownKeys;
    } else if (Object.getOwnPropertySymbols) {
      ReflectOwnKeys = function ReflectOwnKeys2(target) {
        return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
      };
    } else {
      ReflectOwnKeys = function ReflectOwnKeys2(target) {
        return Object.getOwnPropertyNames(target);
      };
    }
    function ProcessEmitWarning(warning) {
      if (console && console.warn) console.warn(warning);
    }
    var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
      return value !== value;
    };
    function EventEmitter2() {
      EventEmitter2.init.call(this);
    }
    module.exports = EventEmitter2;
    module.exports.once = once;
    EventEmitter2.EventEmitter = EventEmitter2;
    EventEmitter2.prototype._events = void 0;
    EventEmitter2.prototype._eventsCount = 0;
    EventEmitter2.prototype._maxListeners = void 0;
    var defaultMaxListeners = 10;
    function checkListener(listener) {
      if (typeof listener !== "function") {
        throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
      }
    }
    Object.defineProperty(EventEmitter2, "defaultMaxListeners", {
      enumerable: true,
      get: function() {
        return defaultMaxListeners;
      },
      set: function(arg) {
        if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
          throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
        }
        defaultMaxListeners = arg;
      }
    });
    EventEmitter2.init = function() {
      if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
        this._events = /* @__PURE__ */ Object.create(null);
        this._eventsCount = 0;
      }
      this._maxListeners = this._maxListeners || void 0;
    };
    EventEmitter2.prototype.setMaxListeners = function setMaxListeners(n) {
      if (typeof n !== "number" || n < 0 || NumberIsNaN(n)) {
        throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + ".");
      }
      this._maxListeners = n;
      return this;
    };
    function _getMaxListeners(that) {
      if (that._maxListeners === void 0)
        return EventEmitter2.defaultMaxListeners;
      return that._maxListeners;
    }
    EventEmitter2.prototype.getMaxListeners = function getMaxListeners() {
      return _getMaxListeners(this);
    };
    EventEmitter2.prototype.emit = function emit(type) {
      var args = [];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      var doError = type === "error";
      var events = this._events;
      if (events !== void 0)
        doError = doError && events.error === void 0;
      else if (!doError)
        return false;
      if (doError) {
        var er;
        if (args.length > 0)
          er = args[0];
        if (er instanceof Error) {
          throw er;
        }
        var err2 = new Error("Unhandled error." + (er ? " (" + er.message + ")" : ""));
        err2.context = er;
        throw err2;
      }
      var handler = events[type];
      if (handler === void 0)
        return false;
      if (typeof handler === "function") {
        ReflectApply(handler, this, args);
      } else {
        var len = handler.length;
        var listeners = arrayClone(handler, len);
        for (var i = 0; i < len; ++i)
          ReflectApply(listeners[i], this, args);
      }
      return true;
    };
    function _addListener(target, type, listener, prepend) {
      var m;
      var events;
      var existing;
      checkListener(listener);
      events = target._events;
      if (events === void 0) {
        events = target._events = /* @__PURE__ */ Object.create(null);
        target._eventsCount = 0;
      } else {
        if (events.newListener !== void 0) {
          target.emit(
            "newListener",
            type,
            listener.listener ? listener.listener : listener
          );
          events = target._events;
        }
        existing = events[type];
      }
      if (existing === void 0) {
        existing = events[type] = listener;
        ++target._eventsCount;
      } else {
        if (typeof existing === "function") {
          existing = events[type] = prepend ? [listener, existing] : [existing, listener];
        } else if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
        m = _getMaxListeners(target);
        if (m > 0 && existing.length > m && !existing.warned) {
          existing.warned = true;
          var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
          w.name = "MaxListenersExceededWarning";
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          ProcessEmitWarning(w);
        }
      }
      return target;
    }
    EventEmitter2.prototype.addListener = function addListener(type, listener) {
      return _addListener(this, type, listener, false);
    };
    EventEmitter2.prototype.on = EventEmitter2.prototype.addListener;
    EventEmitter2.prototype.prependListener = function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };
    function onceWrapper() {
      if (!this.fired) {
        this.target.removeListener(this.type, this.wrapFn);
        this.fired = true;
        if (arguments.length === 0)
          return this.listener.call(this.target);
        return this.listener.apply(this.target, arguments);
      }
    }
    function _onceWrap(target, type, listener) {
      var state2 = { fired: false, wrapFn: void 0, target, type, listener };
      var wrapped = onceWrapper.bind(state2);
      wrapped.listener = listener;
      state2.wrapFn = wrapped;
      return wrapped;
    }
    EventEmitter2.prototype.once = function once2(type, listener) {
      checkListener(listener);
      this.on(type, _onceWrap(this, type, listener));
      return this;
    };
    EventEmitter2.prototype.prependOnceListener = function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };
    EventEmitter2.prototype.removeListener = function removeListener(type, listener) {
      var list, events, position, i, originalListener;
      checkListener(listener);
      events = this._events;
      if (events === void 0)
        return this;
      list = events[type];
      if (list === void 0)
        return this;
      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = /* @__PURE__ */ Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit("removeListener", type, list.listener || listener);
        }
      } else if (typeof list !== "function") {
        position = -1;
        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }
        if (position < 0)
          return this;
        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }
        if (list.length === 1)
          events[type] = list[0];
        if (events.removeListener !== void 0)
          this.emit("removeListener", type, originalListener || listener);
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(type) {
      var listeners, events, i;
      events = this._events;
      if (events === void 0)
        return this;
      if (events.removeListener === void 0) {
        if (arguments.length === 0) {
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== void 0) {
          if (--this._eventsCount === 0)
            this._events = /* @__PURE__ */ Object.create(null);
          else
            delete events[type];
        }
        return this;
      }
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === "removeListener") continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners("removeListener");
        this._events = /* @__PURE__ */ Object.create(null);
        this._eventsCount = 0;
        return this;
      }
      listeners = events[type];
      if (typeof listeners === "function") {
        this.removeListener(type, listeners);
      } else if (listeners !== void 0) {
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }
      return this;
    };
    function _listeners(target, type, unwrap) {
      var events = target._events;
      if (events === void 0)
        return [];
      var evlistener = events[type];
      if (evlistener === void 0)
        return [];
      if (typeof evlistener === "function")
        return unwrap ? [evlistener.listener || evlistener] : [evlistener];
      return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
    }
    EventEmitter2.prototype.listeners = function listeners(type) {
      return _listeners(this, type, true);
    };
    EventEmitter2.prototype.rawListeners = function rawListeners(type) {
      return _listeners(this, type, false);
    };
    EventEmitter2.listenerCount = function(emitter, type) {
      if (typeof emitter.listenerCount === "function") {
        return emitter.listenerCount(type);
      } else {
        return listenerCount.call(emitter, type);
      }
    };
    EventEmitter2.prototype.listenerCount = listenerCount;
    function listenerCount(type) {
      var events = this._events;
      if (events !== void 0) {
        var evlistener = events[type];
        if (typeof evlistener === "function") {
          return 1;
        } else if (evlistener !== void 0) {
          return evlistener.length;
        }
      }
      return 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
    };
    function arrayClone(arr, n) {
      var copy = new Array(n);
      for (var i = 0; i < n; ++i)
        copy[i] = arr[i];
      return copy;
    }
    function spliceOne(list, index) {
      for (; index + 1 < list.length; index++)
        list[index] = list[index + 1];
      list.pop();
    }
    function unwrapListeners(arr) {
      var ret = new Array(arr.length);
      for (var i = 0; i < ret.length; ++i) {
        ret[i] = arr[i].listener || arr[i];
      }
      return ret;
    }
    function once(emitter, name) {
      return new Promise(function(resolve, reject) {
        function errorListener(err2) {
          emitter.removeListener(name, resolver);
          reject(err2);
        }
        function resolver() {
          if (typeof emitter.removeListener === "function") {
            emitter.removeListener("error", errorListener);
          }
          resolve([].slice.call(arguments));
        }
        ;
        eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
        if (name !== "error") {
          addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
        }
      });
    }
    function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
      if (typeof emitter.on === "function") {
        eventTargetAgnosticAddListener(emitter, "error", handler, flags);
      }
    }
    function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
      if (typeof emitter.on === "function") {
        if (flags.once) {
          emitter.once(name, listener);
        } else {
          emitter.on(name, listener);
        }
      } else if (typeof emitter.addEventListener === "function") {
        emitter.addEventListener(name, function wrapListener(arg) {
          if (flags.once) {
            emitter.removeEventListener(name, wrapListener);
          }
          listener(arg);
        });
      } else {
        throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
      }
    }
  }
});

// core/WorkerProtocol.ts
function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function createRequest(type, payload) {
  return {
    id: generateMessageId(),
    type,
    timestamp: Date.now(),
    payload
  };
}
function isWorkerResponse(msg) {
  return msg && typeof msg === "object" && "id" in msg && "type" in msg && "requestId" in msg && "timestamp" in msg && Object.values(WorkerResponseType).includes(msg.type);
}
var WorkerResponseType;
var init_WorkerProtocol = __esm({
  "core/WorkerProtocol.ts"() {
    "use strict";
    WorkerResponseType = /* @__PURE__ */ ((WorkerResponseType2) => {
      WorkerResponseType2["SUCCESS"] = "success";
      WorkerResponseType2["ERROR"] = "error";
      WorkerResponseType2["STATE_CHANGED"] = "state_changed";
      WorkerResponseType2["ACTION_COMPLETED"] = "action_completed";
      WorkerResponseType2["READY"] = "ready";
      WorkerResponseType2["PONG"] = "pong";
      return WorkerResponseType2;
    })(WorkerResponseType || {});
  }
});

// core/WasmWorker.ts
var WasmWorker_exports = {};
__export(WasmWorker_exports, {
  WasmWorker: () => WasmWorker
});
var import_events5, WasmWorker;
var init_WasmWorker = __esm({
  "core/WasmWorker.ts"() {
    "use strict";
    init_worker_shim();
    init_path_shim();
    init_path_shim();
    import_events5 = __toESM(require_events(), 1);
    init_WorkerProtocol();
    WasmWorker = class extends import_events5.EventEmitter {
      constructor(options = {}) {
        super();
        __publicField(this, "worker", null);
        __publicField(this, "pendingRequests", /* @__PURE__ */ new Map());
        __publicField(this, "isReady", false);
        __publicField(this, "options");
        __publicField(this, "batchQueue", []);
        __publicField(this, "batchTimer", null);
        this.options = {
          workerPath: options.workerPath || join(dirname(fileURLToPath(import.meta.url)), "WasmWorker.worker.js"),
          debug: options.debug ?? false,
          timeout: options.timeout ?? 3e4,
          enableBatching: options.enableBatching ?? false,
          batchWindow: options.batchWindow ?? 10
        };
      }
      /**
       * Initialize the worker thread
       */
      async init() {
        if (this.worker) {
          throw new Error("Worker already initialized");
        }
        return new Promise((resolve, reject) => {
          try {
            this.worker = new Worker2(this.options.workerPath, {
              // Pass any worker options here
            });
            this.worker.on("message", this.handleMessage.bind(this));
            this.worker.on("error", this.handleError.bind(this));
            this.worker.on("exit", this.handleExit.bind(this));
            const readyHandler = (msg) => {
              if (msg.type === "ready") {
                this.isReady = true;
                if (this.options.debug) {
                  console.log("\u2705 WasmWorker ready");
                }
                resolve();
              }
            };
            this.once("ready", readyHandler);
            setTimeout(() => {
              if (!this.isReady) {
                this.removeListener("ready", readyHandler);
                reject(new Error("Worker initialization timeout"));
              }
            }, this.options.timeout);
          } catch (error) {
            reject(error);
          }
        });
      }
      /**
       * Dispatch a single action to the worker
       */
      async dispatch(actionType, actionPayload = {}) {
        if (this.options.enableBatching) {
          return this.queueAction(actionType, actionPayload);
        }
        return this.sendAction(actionType, actionPayload);
      }
      /**
       * Queue an action for batching
       */
      async queueAction(actionType, actionPayload) {
        return new Promise((resolve, reject) => {
          this.batchQueue.push({ actionType, actionPayload, resolve, reject });
          if (this.batchTimer) {
            clearTimeout(this.batchTimer);
          }
          this.batchTimer = setTimeout(() => {
            this.flushBatch();
          }, this.options.batchWindow);
        });
      }
      /**
       * Flush queued actions as a batch
       */
      async flushBatch() {
        if (this.batchQueue.length === 0) {
          return;
        }
        const entries = [...this.batchQueue];
        this.batchQueue = [];
        this.batchTimer = null;
        if (this.options.debug) {
          console.log(`\u{1F4E6} Flushing batch of ${entries.length} actions`);
        }
        const actions = entries.map((e) => ({ actionType: e.actionType, actionPayload: e.actionPayload }));
        const request = createRequest(
          "dispatch_batch",
          { actions }
        );
        try {
          const result = await this.sendRequest(request);
          for (const entry of entries) {
            entry.resolve(result);
          }
        } catch (err2) {
          for (const entry of entries) {
            entry.reject(err2);
          }
        }
      }
      /**
       * Send a single action immediately
       */
      async sendAction(actionType, actionPayload) {
        const request = createRequest(
          "dispatch_action",
          { actionType, actionPayload }
        );
        return this.sendRequest(request);
      }
      /**
       * Send a request to the worker and wait for response
       */
      sendRequest(request) {
        if (!this.worker || !this.isReady) {
          return Promise.reject(new Error("Worker not ready"));
        }
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingRequests.delete(request.id);
            reject(
              new Error(
                `Worker request timeout (${this.options.timeout}ms): ${request.type}`
              )
            );
          }, this.options.timeout);
          this.pendingRequests.set(request.id, {
            resolve,
            reject,
            timer,
            requestType: request.type
          });
          this.worker.postMessage(request);
          if (this.options.debug) {
            console.log(`\u2192 Sent: ${request.type} (${request.id})`);
          }
        });
      }
      /**
       * Handle message from worker
       */
      handleMessage(message) {
        if (!isWorkerResponse(message)) {
          console.warn("Invalid worker response:", message);
          return;
        }
        const response = message;
        if (this.options.debug) {
          console.log(`\u2190 Received: ${response.type} (${response.id})`);
        }
        if (response.type === "ready") {
          this.emit("ready", response);
          return;
        }
        if (response.type === "state_changed") {
          this.emit("state_changed", response.payload);
          return;
        }
        if (response.type === "action_completed") {
          this.emit("action_completed", response.payload);
        }
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
          console.warn("No pending request for response:", response.requestId);
          return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.requestId);
        if (response.type === "error" || response.error) {
          const error = new Error(
            response.error?.message || "Worker error"
          );
          if (response.error?.stack) {
            error.stack = response.error.stack;
          }
          pending.reject(error);
        } else {
          pending.resolve(response.payload);
        }
      }
      /**
       * Handle worker error
       */
      handleError(error) {
        console.error("Worker error:", error);
        this.emit("error", error);
        for (const [id, pending] of this.pendingRequests.entries()) {
          pending.reject(error);
          clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
      }
      /**
       * Handle worker exit
       */
      handleExit(code) {
        if (code !== 0) {
          console.error(`Worker exited with code ${code}`);
        }
        this.isReady = false;
        this.worker = null;
        this.emit("exit", code);
        const error = new Error(`Worker exited with code ${code}`);
        for (const [id, pending] of this.pendingRequests.entries()) {
          pending.reject(error);
          clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
      }
      /**
       * Get current state from worker
       */
      async getState() {
        const request = createRequest("get_state");
        return this.sendRequest(request);
      }
      /**
       * Merge CRDT state from remote peer
       */
      async mergeState(data) {
        const request = createRequest("merge_state", { data });
        return this.sendRequest(request);
      }
      /**
       * Save CRDT snapshot
       */
      async saveSnapshot() {
        const request = createRequest("save_snapshot");
        return this.sendRequest(request);
      }
      /**
       * Load CRDT snapshot
       */
      async loadSnapshot(data) {
        const request = createRequest("load_snapshot", { data });
        return this.sendRequest(request);
      }
      /**
       * Ping worker (health check)
       */
      async ping() {
        const start = Date.now();
        const request = createRequest("ping");
        await this.sendRequest(request);
        return Date.now() - start;
      }
      /**
       * Terminate the worker
       */
      async terminate() {
        if (!this.worker) {
          return;
        }
        try {
          const request = createRequest("shutdown");
          await this.sendRequest(request);
        } catch {
        }
        await this.worker.terminate();
        this.worker = null;
        this.isReady = false;
        this.pendingRequests.clear();
      }
      /**
       * Check if worker is ready
       */
      get ready() {
        return this.isReady;
      }
    };
  }
});

// core/WebWorker.ts
var WebWorker_exports = {};
__export(WebWorker_exports, {
  WebWorker: () => WebWorker
});
var WebWorker;
var init_WebWorker = __esm({
  "core/WebWorker.ts"() {
    "use strict";
    init_events();
    init_WorkerProtocol();
    WebWorker = class extends Emitter {
      constructor(options = {}) {
        super();
        __publicField(this, "worker", null);
        __publicField(this, "pendingRequests", /* @__PURE__ */ new Map());
        __publicField(this, "_isReady", false);
        __publicField(this, "options");
        __publicField(this, "batchQueue", []);
        __publicField(this, "batchTimer", null);
        this.options = {
          workerPath: options.workerPath || "/workers/hypertoken.worker.js",
          wasmPath: options.wasmPath || "/wasm/",
          debug: options.debug ?? false,
          timeout: options.timeout ?? 3e4,
          enableBatching: options.enableBatching ?? false,
          batchWindow: options.batchWindow ?? 10
        };
      }
      /**
       * Initialize the Web Worker
       */
      async init() {
        if (this.worker) {
          throw new Error("Worker already initialized");
        }
        return new Promise((resolve, reject) => {
          try {
            this.worker = new Worker(this.options.workerPath, { type: "module" });
            this.worker.onmessage = this.handleMessage.bind(this);
            this.worker.onerror = (event) => {
              this.handleError(new Error(event.message || "Worker error"));
            };
            const readyHandler = (msg) => {
              if (msg.type === "ready") {
                this.sendInitRequest().then(() => {
                  this._isReady = true;
                  if (this.options.debug) {
                    console.log("[WebWorker] Ready");
                  }
                  resolve();
                }).catch(reject);
              }
            };
            this.once("ready", readyHandler);
            setTimeout(() => {
              if (!this._isReady) {
                this.off("ready", readyHandler);
                reject(new Error("Worker initialization timeout"));
              }
            }, this.options.timeout);
          } catch (error) {
            reject(error);
          }
        });
      }
      /**
       * Send initialization request to worker
       */
      async sendInitRequest() {
        const request = createRequest("init", {
          wasmPath: this.options.wasmPath
        });
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingRequests.delete(request.id);
            reject(new Error(`Worker init timeout (${this.options.timeout}ms)`));
          }, this.options.timeout);
          this.pendingRequests.set(request.id, {
            resolve,
            reject,
            timer,
            requestType: request.type
          });
          this.worker.postMessage(request);
        });
      }
      /**
       * Dispatch a single action to the worker
       */
      async dispatch(actionType, actionPayload = {}) {
        if (this.options.enableBatching) {
          return this.queueAction(actionType, actionPayload);
        }
        return this.sendAction(actionType, actionPayload);
      }
      /**
       * Queue an action for batching
       */
      async queueAction(actionType, actionPayload) {
        return new Promise((resolve, reject) => {
          this.batchQueue.push({ actionType, actionPayload, resolve, reject });
          if (this.batchTimer) {
            clearTimeout(this.batchTimer);
          }
          this.batchTimer = setTimeout(() => {
            this.flushBatch();
          }, this.options.batchWindow);
        });
      }
      /**
       * Flush queued actions as a batch
       */
      async flushBatch() {
        if (this.batchQueue.length === 0) {
          return;
        }
        const entries = [...this.batchQueue];
        this.batchQueue = [];
        this.batchTimer = null;
        if (this.options.debug) {
          console.log(`[WebWorker] Flushing batch of ${entries.length} actions`);
        }
        const actions = entries.map((e) => ({ actionType: e.actionType, actionPayload: e.actionPayload }));
        const request = createRequest(
          "dispatch_batch",
          { actions }
        );
        try {
          const result = await this.sendRequest(request);
          for (const entry of entries) {
            entry.resolve(result);
          }
        } catch (err2) {
          for (const entry of entries) {
            entry.reject(err2);
          }
        }
      }
      /**
       * Send a single action immediately
       */
      async sendAction(actionType, actionPayload) {
        const request = createRequest(
          "dispatch_action",
          { actionType, actionPayload }
        );
        return this.sendRequest(request);
      }
      /**
       * Send a request to the worker and wait for response
       */
      sendRequest(request) {
        if (!this.worker || !this._isReady) {
          return Promise.reject(new Error("Worker not ready"));
        }
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingRequests.delete(request.id);
            reject(
              new Error(
                `Worker request timeout (${this.options.timeout}ms): ${request.type}`
              )
            );
          }, this.options.timeout);
          this.pendingRequests.set(request.id, {
            resolve,
            reject,
            timer,
            requestType: request.type
          });
          this.worker.postMessage(request);
          if (this.options.debug) {
            console.log(`[WebWorker] -> ${request.type} (${request.id})`);
          }
        });
      }
      /**
       * Handle message from worker
       */
      handleMessage(event) {
        const message = event.data;
        if (!isWorkerResponse(message)) {
          console.warn("[WebWorker] Invalid worker response:", message);
          return;
        }
        const response = message;
        if (this.options.debug) {
          console.log(`[WebWorker] <- ${response.type} (${response.id})`);
        }
        if (response.type === "ready") {
          this.emit("ready", response);
          return;
        }
        if (response.type === "state_changed") {
          this.emit("state_changed", response.payload);
          return;
        }
        if (response.type === "action_completed") {
          this.emit("action_completed", response.payload);
        }
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
          if (response.requestId !== "boot") {
            console.warn("[WebWorker] No pending request for response:", response.requestId);
          }
          return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.requestId);
        if (response.type === "error" || response.error) {
          const error = new Error(
            response.error?.message || "Worker error"
          );
          if (response.error?.stack) {
            error.stack = response.error.stack;
          }
          pending.reject(error);
        } else {
          pending.resolve(response.payload);
        }
      }
      /**
       * Handle worker error
       */
      handleError(error) {
        console.error("[WebWorker] Error:", error);
        this.emit("error", error);
        for (const [id, pending] of this.pendingRequests.entries()) {
          pending.reject(error);
          clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
      }
      /**
       * Get current state from worker
       */
      async getState() {
        const request = createRequest("get_state");
        return this.sendRequest(request);
      }
      /**
       * Merge CRDT state from remote peer
       */
      async mergeState(data) {
        const request = createRequest("merge_state", { data });
        return this.sendRequest(request);
      }
      /**
       * Save CRDT snapshot
       */
      async saveSnapshot() {
        const request = createRequest("save_snapshot");
        return this.sendRequest(request);
      }
      /**
       * Load CRDT snapshot
       */
      async loadSnapshot(data) {
        const request = createRequest("load_snapshot", { data });
        return this.sendRequest(request);
      }
      /**
       * Ping worker (health check)
       */
      async ping() {
        const start = Date.now();
        const request = createRequest("ping");
        await this.sendRequest(request);
        return Date.now() - start;
      }
      /**
       * Terminate the worker
       */
      async terminate() {
        if (!this.worker) {
          return;
        }
        try {
          const request = createRequest("shutdown");
          this.worker.postMessage(request);
        } catch {
        }
        this.worker.terminate();
        this.worker = null;
        this._isReady = false;
        this.pendingRequests.clear();
      }
      /**
       * Check if worker is ready
       */
      get ready() {
        return this._isReady;
      }
      /**
       * Alias for ready (API compatibility with WasmWorker)
       */
      get isReady() {
        return this._isReady;
      }
    };
  }
});

// core/UniversalWorker.ts
var UniversalWorker_exports = {};
__export(UniversalWorker_exports, {
  UniversalWorker: () => UniversalWorker,
  getEnvironment: () => getEnvironment,
  supportsWorkers: () => supportsWorkers
});
function supportsWorkers() {
  if (typeof process !== "undefined" && process.versions != null && process.versions.node != null) {
    const version = parseInt(process.versions.node.split(".")[0], 10);
    return version >= 12;
  }
  return typeof Worker !== "undefined";
}
function getEnvironment() {
  if (typeof process !== "undefined" && process.versions != null && process.versions.node != null) {
    return "node";
  }
  if (typeof window !== "undefined" || typeof self !== "undefined") {
    return "browser";
  }
  return "unknown";
}
var UniversalWorker;
var init_UniversalWorker = __esm({
  "core/UniversalWorker.ts"() {
    "use strict";
    init_events();
    UniversalWorker = class extends Emitter {
      constructor(options = {}) {
        super();
        __publicField(this, "implementation", null);
        __publicField(this, "_isNode");
        __publicField(this, "options");
        this.options = options;
        this._isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
      }
      /**
       * Check if running in Node.js environment
       */
      get isNode() {
        return this._isNode;
      }
      /**
       * Check if running in browser environment
       */
      get isBrowser() {
        return !this._isNode;
      }
      /**
       * Get the environment name
       */
      get environment() {
        return this._isNode ? "node" : "browser";
      }
      /**
       * Initialize the worker (auto-detects environment)
       */
      async init() {
        if (this.implementation) {
          throw new Error("Worker already initialized");
        }
        if (this._isNode) {
          const { WasmWorker: WasmWorker2 } = await Promise.resolve().then(() => (init_WasmWorker(), WasmWorker_exports));
          this.implementation = new WasmWorker2({
            debug: this.options.debug,
            timeout: this.options.timeout,
            enableBatching: this.options.enableBatching,
            batchWindow: this.options.batchWindow
          });
        } else {
          const { WebWorker: WebWorker2 } = await Promise.resolve().then(() => (init_WebWorker(), WebWorker_exports));
          this.implementation = new WebWorker2({
            debug: this.options.debug,
            timeout: this.options.timeout,
            enableBatching: this.options.enableBatching,
            batchWindow: this.options.batchWindow,
            workerPath: this.options.workerPath,
            wasmPath: this.options.wasmPath
          });
        }
        this.implementation.on(
          "action_completed",
          (payload) => this.emit("action_completed", payload)
        );
        this.implementation.on(
          "state_changed",
          (payload) => this.emit("state_changed", payload)
        );
        this.implementation.on(
          "error",
          (payload) => this.emit("error", payload)
        );
        await this.implementation.init();
        if (this.options.debug) {
          console.log(`[UniversalWorker] Initialized in ${this.environment} mode`);
        }
      }
      /**
       * Dispatch an action to the worker
       */
      async dispatch(actionType, actionPayload = {}) {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.dispatch(actionType, actionPayload);
      }
      /**
       * Get current state from worker
       */
      async getState() {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.getState();
      }
      /**
       * Merge CRDT state from remote peer
       */
      async mergeState(data) {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.mergeState(data);
      }
      /**
       * Save CRDT snapshot
       */
      async saveSnapshot() {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.saveSnapshot();
      }
      /**
       * Load CRDT snapshot
       */
      async loadSnapshot(data) {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.loadSnapshot(data);
      }
      /**
       * Ping worker (health check)
       */
      async ping() {
        if (!this.implementation) {
          throw new Error("Worker not initialized. Call init() first.");
        }
        return this.implementation.ping();
      }
      /**
       * Terminate the worker
       */
      async terminate() {
        if (!this.implementation) {
          return;
        }
        await this.implementation.terminate();
        this.implementation = null;
        if (this.options.debug) {
          console.log("[UniversalWorker] Terminated");
        }
      }
      /**
       * Check if worker is ready
       */
      get ready() {
        return this.implementation?.ready ?? false;
      }
      /**
       * Alias for ready (API compatibility)
       */
      get isReady() {
        return this.ready;
      }
    };
  }
});

// engine/Engine.ts
init_events();

// core/Space.ts
init_events();

// core/serialize.ts
function sanitizeToken(token) {
  const plain = { ...token };
  if (plain._tags instanceof Set) {
    plain._tags = Array.from(plain._tags);
  }
  return JSON.parse(JSON.stringify(plain));
}

// core/Space.ts
init_crypto();

// core/random.ts
function mulberry32(seed) {
  return function() {
    let t = (seed += 1831565813) | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffleArray(arr, seed) {
  const rand = seed != null ? mulberry32(seed >>> 0) : Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// core/Space.ts
var Space = class extends Emitter {
  /**
   * Create a new Space
   * @param session - Chronicle instance for CRDT state management
   * @param name - Name of this space
   * @throws Error if session is null/undefined
   */
  constructor(session, name = "space") {
    super();
    __publicField(this, "session");
    __publicField(this, "name");
    __publicField(this, "spreads", {});
    __publicField(this, "_lockedZones", /* @__PURE__ */ new Set());
    __publicField(this, "log", []);
    if (!session) {
      throw new Error("Space requires a valid Chronicle session");
    }
    this.session = session;
    this.name = name;
  }
  // ... (Rest of the class implementation remains unchanged)
  // Include all original methods below
  // --- HELPERS ---
  // Helper to sanitize token data for CRDT
  get zones() {
    return this.session.state.zones ? Object.keys(this.session.state.zones) : [];
  }
  toJSON() {
    return {
      name: this.name,
      zones: this.session.state.zones || {},
      log: this.log
    };
  }
  snapshot() {
    return this.toJSON();
  }
  zone(name) {
    return this.session.state.zones?.[name] || [];
  }
  zoneCount(name) {
    return this.zone(name).length;
  }
  cards(zoneName) {
    if (zoneName) return this.zone(zoneName);
    if (!this.session.state.zones) return [];
    return Object.values(this.session.state.zones).flat();
  }
  findCard(idOrFn) {
    const all = this.cards();
    if (typeof idOrFn === "function") {
      return all.find(idOrFn) || null;
    }
    return all.find((p) => p.id === idOrFn) || null;
  }
  _isLocked(name) {
    return this._lockedZones.has(name);
  }
  /**
   * Place a token in a zone
   * @param zoneName - Name of the zone
   * @param token - Token to place
   * @param opts - Placement options (position, face up, etc.)
   * @returns Placement object or null if zone is locked
   * @throws Error if token is invalid
   * @emits space:locked if zone is locked
   */
  place(zoneName, token, opts = {}) {
    if (!token || !token.id) {
      throw new Error("Cannot place invalid token (missing id)");
    }
    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "place", zoneName });
      return null;
    }
    const safeToken = sanitizeToken(token);
    const placement = {
      id: generateId(),
      tokenId: token.id,
      tokenSnapshot: safeToken,
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      faceUp: opts.faceUp ?? true,
      label: opts.label ?? null,
      ts: Date.now(),
      reversed: !!token._rev,
      tags: []
    };
    this.session.change(`place card in ${zoneName}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[zoneName]) doc.zones[zoneName] = [];
      doc.zones[zoneName].push(placement);
    });
    this.log.push({ type: "place", zoneName, placementId: placement.id, timestamp: Date.now() });
    this.emit("space:place", placement);
    return placement;
  }
  /**
   * Move a placement from one zone to another
   * @param fromZone - Source zone name
   * @param toZone - Destination zone name
   * @param placementId - ID of placement to move
   * @param opts - Optional new position
   * @throws Error if placement not found
   * @emits space:locked if either zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  move(fromZone, toZone, placementId, opts = {}) {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) {
      this.emit("space:locked", { operation: "move", fromZone, toZone });
      return;
    }
    let found = false;
    this.session.change(`move card from ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return;
      const from2 = doc.zones[fromZone];
      if (!from2) return;
      const idx = from2.findIndex((p) => p.id === placementId);
      if (idx === -1) return;
      found = true;
      const [placement] = from2.splice(idx, 1);
      if (opts.x !== void 0) placement.x = opts.x;
      if (opts.y !== void 0) placement.y = opts.y;
      if (!doc.zones[toZone]) doc.zones[toZone] = [];
      doc.zones[toZone].push(placement);
    });
    if (!found) {
      this.emit("space:notFound", { operation: "move", placementId, fromZone });
      return;
    }
    this.log.push({ type: "move", fromZone, toZone, placementId, timestamp: Date.now() });
    this.emit("space:move", { fromZone, toZone, placementId });
  }
  /**
   * Flip a placement face up or face down
   * @param zoneName - Zone name
   * @param placementId - Placement ID
   * @param faceUp - Optional explicit face state (toggles if not provided)
   * @emits space:locked if zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  flip(zoneName, placementId, faceUp) {
    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "flip", zoneName });
      return;
    }
    let found = false;
    this.session.change(`flip card in ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (!zone) return;
      const placement = zone.find((p) => p.id === placementId);
      if (placement) {
        found = true;
        placement.faceUp = faceUp !== void 0 ? faceUp : !placement.faceUp;
      }
    });
    if (!found) {
      this.emit("space:notFound", { operation: "flip", placementId, zoneName });
      return;
    }
    this.log.push({ type: "flip", zoneName, placementId, faceUp, timestamp: Date.now() });
    this.emit("space:flip", { id: placementId, faceUp });
  }
  /**
   * Remove a placement from a zone
   * @param zoneName - Zone name
   * @param placementId - Placement ID
   * @emits space:locked if zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  remove(zoneName, placementId) {
    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "remove", zoneName });
      return;
    }
    let found = false;
    this.session.change(`remove card from ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (zone) {
        const idx = zone.findIndex((p) => p.id === placementId);
        if (idx >= 0) {
          zone.splice(idx, 1);
          found = true;
        }
      }
    });
    if (!found) {
      this.emit("space:notFound", { operation: "remove", placementId, zoneName });
      return;
    }
    this.log.push({ type: "remove", zoneName, placementId, timestamp: Date.now() });
    this.emit("space:remove", { id: placementId });
  }
  clear() {
    this.session.change("clear space", (doc) => {
      doc.zones = {};
    });
    this.log = [];
    this.emit("space:clear");
  }
  createZone(id, { label = id, x = 0, y = 0 } = {}) {
    this.session.change(`create zone ${id}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[id]) doc.zones[id] = [];
    });
    this.emit("zone:created", { payload: { id, label, x, y } });
    return this;
  }
  deleteZone(id) {
    this.session.change(`delete zone ${id}`, (doc) => {
      if (doc.zones) delete doc.zones[id];
    });
    this.emit("zone:deleted", { payload: { id } });
    return this;
  }
  clearZone(name) {
    if (this._isLocked(name)) return this;
    this.session.change(`clear zone ${name}`, (doc) => {
      if (doc.zones) doc.zones[name] = [];
    });
    this.emit("space:clearZone", { name });
    return this;
  }
  lockZone(id, locked = true) {
    if (!this._lockedZones) this._lockedZones = /* @__PURE__ */ new Set();
    locked ? this._lockedZones.add(id) : this._lockedZones.delete(id);
    this.emit("zone:locked", { payload: { id, locked } });
    return this;
  }
  transferZone(fromZone, toZone) {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) return 0;
    let count = 0;
    this.session.change(`transfer ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return;
      const from2 = doc.zones[fromZone];
      if (!from2 || from2.length === 0) return;
      if (!doc.zones[toZone]) doc.zones[toZone] = [];
      const items = from2.splice(0, from2.length);
      doc.zones[toZone].push(...items);
      count = items.length;
    });
    this.emit("space:transferZone", { fromZone, toZone, count });
    return count;
  }
  fan(zoneName, opts = {}) {
    this.spreadZone(zoneName, { pattern: "arc", ...opts });
  }
  stackZone(id) {
    if (this._isLocked(id)) return this;
    this.session.change(`stack zone ${id}`, (doc) => {
      if (!doc.zones) return;
      const arr = doc.zones[id];
      if (arr) {
        arr.forEach((p) => {
          p.x = 0;
          p.y = 0;
        });
      }
    });
    this.emit("zone:stacked", { payload: { id } });
    return this;
  }
  spreadZone(id, { pattern = "linear", angleStep = 15, radius = 100 } = {}) {
    if (this._isLocked(id)) return this;
    this.session.change(`spread zone ${id}`, (doc) => {
      if (!doc.zones) return;
      const arr = doc.zones[id];
      if (!arr) return;
      if (pattern === "arc") {
        arr.forEach((p, i) => {
          const a = (i - arr.length / 2) * angleStep * Math.PI / 180;
          p.x = Math.cos(a) * radius;
          p.y = Math.sin(a) * radius;
        });
      } else {
        arr.forEach((p, i) => {
          p.x = i * angleStep;
          p.y = 0;
        });
      }
    });
    this.emit("zone:spread", { payload: { id, pattern } });
    return this;
  }
  shuffleZone(name, seed) {
    if (this._isLocked(name)) return;
    this.session.change(`shuffle zone ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      const zone = doc.zones[name];
      if (!zone || zone.length === 0) return;
      const items = zone.map((item) => JSON.parse(JSON.stringify(item)));
      shuffleArray(items, seed);
      doc.zones[name] = items;
    });
    this.log.push({ type: "shuffleZone", name, timestamp: Date.now() });
  }
  pile(name) {
    return this.zone(name);
  }
  peekZone(name, n = 1) {
    const pile = this.zone(name);
    if (pile.length === 0) return null;
    if (n === 1) return pile[pile.length - 1];
    return pile.slice(-n).reverse();
  }
  drawFromZone(name, n = 1) {
    if (this._isLocked(name)) return [];
    let drawn = [];
    this.session.change(`draw ${n} from ${name}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[name];
      if (zone && zone.length > 0) {
        const amount = Math.min(n, zone.length);
        drawn = zone.splice(zone.length - amount, amount);
      }
    });
    drawn.reverse();
    this.emit("space:drawFromZone", { zone: name, count: drawn.length });
    return drawn;
  }
  pushToZone(name, cards) {
    if (this._isLocked(name)) return;
    const arr = Array.isArray(cards) ? cards : [cards];
    if (arr.length === 0) return;
    this.session.change(`push ${arr.length} to ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[name]) doc.zones[name] = [];
      doc.zones[name].push(...arr);
    });
    this.emit("space:pushToZone", { zone: name, count: arr.length });
  }
  returnToStack(stack, zoneName, n = 1, { toTop = true } = {}) {
    const removedPlacements = this.drawFromZone(zoneName, n);
    const tokens = removedPlacements.map((p) => p.tokenSnapshot);
    if (toTop) {
      tokens.forEach((t) => stack.insertAt(t, stack.size));
    } else {
      tokens.forEach((t) => stack.insertAt(t, 0));
    }
    this.emit("space:returnToStack", { zone: zoneName, count: tokens.length });
    return tokens;
  }
  collectAllInto(stack, { includeEmpty = false } = {}) {
    const tokensToReturn = [];
    const zonesToClear = [];
    for (const zoneName of this.zones) {
      const pile = this.zone(zoneName);
      if (!includeEmpty && pile.length === 0) continue;
      pile.forEach((p) => tokensToReturn.push(p.tokenSnapshot));
      zonesToClear.push(zoneName);
    }
    if (tokensToReturn.length === 0) {
      this.emit("space:collectAllInto", { zones: 0 });
      return 0;
    }
    const sameSession = stack.session === this.session;
    if (sameSession) {
      this.session.change("collect all to stack", (doc) => {
        if (doc.zones) {
          zonesToClear.forEach((z) => doc.zones[z] = []);
        }
        if (doc.stack && doc.stack.stack) {
          for (const t of tokensToReturn) {
            const sanitized = JSON.parse(JSON.stringify(t));
            doc.stack.stack.push(sanitized);
          }
        }
      });
    } else {
      tokensToReturn.forEach((t) => stack.insertAt(t, stack.size));
      this.session.change("collect all to stack", (doc) => {
        if (doc.zones) {
          zonesToClear.forEach((z) => doc.zones[z] = []);
        }
      });
    }
    stack.shuffle();
    this.emit("space:collectAllInto", { zones: tokensToReturn.length });
    return tokensToReturn.length;
  }
  defineSpread(name, zones) {
    this.spreads[name] = zones;
    return this;
  }
  dealSpread(name, source, { faceUp = true } = {}) {
    const pattern = this.spreads[name];
    if (!pattern) throw new Error(`Spread "${name}" not defined.`);
    for (const zone of pattern) {
      const card = source.draw();
      if (!card) break;
      this.place(zone.id, card, {
        x: zone.x ?? null,
        y: zone.y ?? null,
        faceUp,
        label: zone.label ?? zone.id
      });
    }
    this.emit("space:dealSpread", { name });
  }
  clearSpread(name) {
    const pattern = this.spreads?.[name];
    if (!pattern) return this;
    const ids = new Set(pattern.map((z) => z.id));
    this.session.change(`clear spread ${name}`, (doc) => {
      if (!doc.zones) return;
      Object.keys(doc.zones).forEach((zone) => {
        if (ids.has(zone)) doc.zones[zone] = [];
      });
    });
    this.emit("space:clearSpread", { name });
    return this;
  }
};

// engine/Action.ts
init_crypto();
var Action = class _Action {
  constructor(type, payload = {}, { seed = null, reversible = true } = {}) {
    __publicField(this, "id");
    __publicField(this, "type");
    __publicField(this, "payload");
    __publicField(this, "seed");
    __publicField(this, "reversible");
    __publicField(this, "timestamp");
    __publicField(this, "result");
    this.id = generateId();
    this.type = type;
    this.payload = payload;
    this.seed = seed;
    this.reversible = reversible;
    this.timestamp = Date.now();
  }
  static fromJSON(data) {
    const a = new _Action(data.type, data.payload, {
      seed: data.seed,
      reversible: data.reversible
    });
    if (data.timestamp) a.timestamp = data.timestamp;
    if (data.id) a.id = data.id;
    return a;
  }
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      seed: this.seed,
      reversible: this.reversible,
      timestamp: this.timestamp
    };
  }
};

// engine/actions.ts
var StackActions = {
  "stack:draw": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.draw(count);
  },
  "stack:peek": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.tokens.slice(-count).reverse();
  },
  "stack:shuffle": (engine, { seed = null } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.shuffle(seed ?? void 0);
  },
  "stack:burn": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.burn(count);
  },
  "stack:reset": (engine) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.reset();
  },
  "stack:cut": (engine, { position = 0 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.cut(position);
  },
  "stack:insertAt": (engine, { position = 0, card } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    engine.stack.insertAt(card, position);
  },
  "stack:removeAt": (engine, { position = 0 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.removeAt(position);
  },
  "stack:swap": (engine, { i, j } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.swap(i, j);
  },
  "stack:reverse": (engine) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.reverseRange(0, engine.stack.size - 1);
  },
  "stack:discard": (engine, { card } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    return engine.stack.discard(card);
  }
};
var SpaceActions = {
  "space:place": (engine, { zone, card, opts = {} } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    if (!zone) throw new Error("zone required");
    if (!card) throw new Error("card required");
    return engine.space.place(zone, card, opts);
  },
  "space:remove": (engine, { zone, placementId } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.remove(zone, placementId);
  },
  "space:move": (engine, { fromZone, toZone, placementId, x, y } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.move(fromZone, toZone, placementId, { x, y });
  },
  "space:flip": (engine, { zone, placementId, faceUp } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.flip(zone, placementId, faceUp);
  },
  "space:createZone": (engine, { name, label, x, y } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.createZone(name, { label, x, y });
  },
  "space:deleteZone": (engine, { name } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.deleteZone(name);
  },
  "space:clearZone": (engine, { zone } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.clearZone(zone);
  },
  "space:lockZone": (engine, { zone, locked = true } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.lockZone(zone, locked);
  },
  "space:shuffleZone": (engine, { zone, seed } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.shuffleZone(zone, seed);
  },
  "space:fanZone": (engine, { zone, ...opts } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.fan(zone, opts);
  },
  "space:spreadZone": (engine, { zone, pattern, angleStep, radius } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.spreadZone(zone, { pattern, angleStep, radius });
  },
  "space:stackZone": (engine, { zone } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.stackZone(zone);
  },
  "space:transferZone": (engine, { fromZone, toZone } = {}) => {
    if (!engine.space) throw new Error("No space attached to engine");
    return engine.space.transferZone(fromZone, toZone);
  },
  "space:clear": (engine) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.clear();
  }
};
var SourceActions = {
  "source:draw": (engine, { count = 1 } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.draw(count);
  },
  "source:shuffle": (engine, { seed } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    engine.source.shuffle(seed);
  },
  "source:burn": (engine, { count = 1 } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.burn(count);
  },
  "source:addStack": (engine, { stack } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    if (!stack) throw new Error("stack required");
    engine.source.addStack(stack);
  },
  "source:removeStack": (engine, { stack } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    if (!stack) throw new Error("stack required");
    engine.source.removeStack(stack);
  },
  "source:reset": (engine) => {
    if (!engine.source) throw new Error("No source attached to engine");
    engine.source.reset();
  },
  "source:inspect": (engine) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.inspect();
  }
};
function getAgentMap(engine) {
  return engine.session.state.agents ?? {};
}
function findAgent(engine, name) {
  const agent = getAgentMap(engine)[name];
  if (!agent) throw new Error(`Agent "${name}" not found`);
  return agent;
}
var AgentActions = {
  "agent:create": (engine, { id, name, meta } = {}) => {
    if (!name) throw new Error("name required");
    if (getAgentMap(engine)[name]) throw new Error(`Agent "${name}" already exists`);
    const agent = {
      id: id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      meta: meta ?? {},
      active: true,
      resources: {},
      inventory: []
    };
    engine.session.change("agent:create", (doc) => {
      if (!doc.agents) doc.agents = {};
      doc.agents[name] = agent;
    });
    return agent;
  },
  "agent:remove": (engine, { name } = {}) => {
    if (!getAgentMap(engine)[name]) throw new Error(`Agent "${name}" not found`);
    engine.session.change("agent:remove", (doc) => {
      if (doc.agents) delete doc.agents[name];
    });
  },
  "agent:setActive": (engine, { name, active = true } = {}) => {
    findAgent(engine, name);
    engine.session.change("agent:setActive", (doc) => {
      if (doc.agents?.[name]) doc.agents[name].active = active;
    });
  },
  "agent:giveResource": (engine, { name, resource, amount = 1 } = {}) => {
    findAgent(engine, name);
    engine.session.change("agent:giveResource", (doc) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].resources) doc.agents[name].resources = {};
      doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) + amount;
    });
  },
  "agent:takeResource": (engine, { name, resource, amount = 1 } = {}) => {
    findAgent(engine, name);
    engine.session.change("agent:takeResource", (doc) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].resources) doc.agents[name].resources = {};
      doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) - amount;
    });
  },
  "agent:addToken": (engine, { name, token } = {}) => {
    findAgent(engine, name);
    engine.session.change("agent:addToken", (doc) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
      doc.agents[name].inventory.push(token);
    });
  },
  "agent:removeToken": (engine, { name, tokenId } = {}) => {
    const agent = findAgent(engine, name);
    const idx = (agent.inventory ?? []).findIndex((t) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${name}"`);
    const removed = agent.inventory[idx];
    engine.session.change("agent:removeToken", (doc) => {
      if (!doc.agents?.[name]?.inventory) return;
      const i = doc.agents[name].inventory.findIndex((t) => t.id === tokenId);
      if (i !== -1) doc.agents[name].inventory.splice(i, 1);
    });
    return removed;
  },
  "agent:get": (engine, { name } = {}) => {
    return findAgent(engine, name);
  },
  "agent:getAll": (engine) => {
    return engine._agents;
  },
  "agent:transferResource": (engine, { from: from2, to, resource, amount = 1 } = {}) => {
    findAgent(engine, from2);
    findAgent(engine, to);
    engine.session.change("agent:transferResource", (doc) => {
      if (!doc.agents) return;
      if (!doc.agents[from2].resources) doc.agents[from2].resources = {};
      if (!doc.agents[to].resources) doc.agents[to].resources = {};
      doc.agents[from2].resources[resource] = (doc.agents[from2].resources[resource] ?? 0) - amount;
      doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + amount;
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "resource_transfer", from: from2, to, resource, amount, timestamp: Date.now() });
    });
    const state2 = engine.session.state;
    return {
      from: state2.agents?.[from2]?.resources?.[resource] ?? 0,
      to: state2.agents?.[to]?.resources?.[resource] ?? 0
    };
  },
  "agent:transferToken": (engine, { from: from2, to, tokenId } = {}) => {
    const src = findAgent(engine, from2);
    findAgent(engine, to);
    const idx = (src.inventory ?? []).findIndex((t) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from2}"`);
    const token = src.inventory[idx];
    engine.session.change("agent:transferToken", (doc) => {
      if (!doc.agents) return;
      const i = doc.agents[from2].inventory.findIndex((t) => t.id === tokenId);
      if (i !== -1) {
        const [moved] = doc.agents[from2].inventory.splice(i, 1);
        if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
        doc.agents[to].inventory.push(moved);
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "token_transfer", from: from2, to, token: tokenId, timestamp: Date.now() });
    });
    return token;
  },
  "agent:stealResource": (engine, { from: from2, to, resource, amount = 1 } = {}) => {
    const src = findAgent(engine, from2);
    findAgent(engine, to);
    const available = src.resources?.[resource] ?? 0;
    const stolen = Math.min(amount, available);
    engine.session.change("agent:stealResource", (doc) => {
      if (!doc.agents) return;
      if (!doc.agents[from2].resources) doc.agents[from2].resources = {};
      if (!doc.agents[to].resources) doc.agents[to].resources = {};
      doc.agents[from2].resources[resource] = available - stolen;
      doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + stolen;
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "steal_resource", from: from2, to, resource, amount: stolen, timestamp: Date.now() });
    });
    const state2 = engine.session.state;
    return {
      stolen,
      from: state2.agents?.[from2]?.resources?.[resource] ?? 0,
      to: state2.agents?.[to]?.resources?.[resource] ?? 0
    };
  },
  "agent:stealToken": (engine, { from: from2, to, tokenId } = {}) => {
    const src = findAgent(engine, from2);
    findAgent(engine, to);
    const idx = (src.inventory ?? []).findIndex((t) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from2}"`);
    const token = src.inventory[idx];
    engine.session.change("agent:stealToken", (doc) => {
      if (!doc.agents) return;
      const i = doc.agents[from2].inventory.findIndex((t) => t.id === tokenId);
      if (i !== -1) {
        const [moved] = doc.agents[from2].inventory.splice(i, 1);
        if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
        doc.agents[to].inventory.push(moved);
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "steal_token", from: from2, to, token: tokenId, timestamp: Date.now() });
    });
    return token;
  },
  "agent:trade": (engine, { agent1, agent2, offer1, offer2 } = {}) => {
    findAgent(engine, agent1);
    findAgent(engine, agent2);
    engine.session.change("agent:trade", (doc) => {
      if (!doc.agents) return;
      const a1 = doc.agents[agent1];
      const a2 = doc.agents[agent2];
      if (!a1.inventory) a1.inventory = [];
      if (!a2.inventory) a2.inventory = [];
      if (!a1.resources) a1.resources = {};
      if (!a2.resources) a2.resources = {};
      if (offer1?.token) {
        const idx = a1.inventory.findIndex((t) => t.id === offer1.token.id);
        if (idx !== -1) a2.inventory.push(...a1.inventory.splice(idx, 1));
      }
      if (offer1?.resource && offer1?.amount) {
        a1.resources[offer1.resource] = (a1.resources[offer1.resource] ?? 0) - offer1.amount;
        a2.resources[offer1.resource] = (a2.resources[offer1.resource] ?? 0) + offer1.amount;
      }
      if (offer2?.token) {
        const idx = a2.inventory.findIndex((t) => t.id === offer2.token.id);
        if (idx !== -1) a1.inventory.push(...a2.inventory.splice(idx, 1));
      }
      if (offer2?.resource && offer2?.amount) {
        a2.resources[offer2.resource] = (a2.resources[offer2.resource] ?? 0) - offer2.amount;
        a1.resources[offer2.resource] = (a1.resources[offer2.resource] ?? 0) + offer2.amount;
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "trade", from: agent1, to: agent2, agent1, agent2, offer1, offer2, timestamp: Date.now() });
    });
  },
  "agent:drawCards": (engine, { name, count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    findAgent(engine, name);
    const drawn = engine.stack.draw(count);
    const cards = Array.isArray(drawn) ? drawn : drawn ? [drawn] : [];
    engine.session.change("agent:drawCards", (doc) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
      doc.agents[name].inventory.push(...cards);
    });
    return cards;
  },
  "agent:setMeta": (engine, { name, key, value } = {}) => {
    if (!key) throw new Error("key required");
    findAgent(engine, name);
    engine.session.change("agent:setMeta", (doc) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].meta) doc.agents[name].meta = {};
      doc.agents[name].meta[key] = value;
    });
  },
  "agent:discardCards": (engine, { name, tokenIds } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    const agent = findAgent(engine, name);
    const discarded = [];
    for (const tokenId of tokenIds || []) {
      const idx = (agent.inventory ?? []).findIndex((t) => t.id === tokenId);
      if (idx !== -1) discarded.push(agent.inventory[idx]);
    }
    if (discarded.length > 0) {
      const discardedIds = new Set(discarded.map((t) => t.id));
      engine.session.change("agent:discardCards", (doc) => {
        if (!doc.agents?.[name]?.inventory) return;
        doc.agents[name].inventory = doc.agents[name].inventory.filter((t) => !discardedIds.has(t.id));
      });
      for (const card of discarded) engine.stack.discard(card);
    }
    return discarded;
  }
};
var GameActions = {
  "game:start": (engine) => {
    engine.session.change("game:start", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.started = true;
      doc.gameState.startTime = Date.now();
      doc.gameState.ended = false;
      doc.gameState.paused = false;
      doc.gameState.totalPauseDuration = 0;
    });
    engine.emit("game:started", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:end": (engine, { winner, reason } = {}) => {
    engine.session.change("game:end", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.ended = true;
      doc.gameState.endTime = Date.now();
      if (winner) doc.gameState.winner = winner;
      if (reason) doc.gameState.reason = reason;
    });
    engine.emit("game:ended", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:pause": (engine) => {
    engine.session.change("game:pause", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.paused = true;
      doc.gameState.pauseTime = Date.now();
    });
    engine.emit("game:paused", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:resume": (engine) => {
    engine.session.change("game:resume", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      if (doc.gameState.pauseTime) {
        doc.gameState.totalPauseDuration = (doc.gameState.totalPauseDuration ?? 0) + (Date.now() - doc.gameState.pauseTime);
      }
      doc.gameState.paused = false;
      doc.gameState.resumeTime = Date.now();
    });
    engine.emit("game:resumed", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:nextPhase": (engine, { phase } = {}) => {
    engine.session.change("game:nextPhase", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.phase = phase;
      doc.gameState.turn = (doc.gameState.turn ?? 0) + 1;
    });
    engine.emit("game:phaseChanged", { payload: { phase, turn: engine._gameState.turn } });
    return engine._gameState;
  },
  "game:setProperty": (engine, { key, value } = {}) => {
    if (!key) throw new Error("key required");
    engine.session.change("game:setProperty", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState[key] = value;
    });
    return engine._gameState;
  },
  "game:mergeState": (engine, { state: state2 } = {}) => {
    if (!state2 || typeof state2 !== "object") throw new Error("state object required");
    engine.session.change("game:mergeState", (doc) => {
      if (!doc.gameState) doc.gameState = {};
      Object.assign(doc.gameState, state2);
    });
    return engine._gameState;
  },
  "game:getState": (engine) => {
    return engine._gameState;
  }
};
var GameLoopActions = {
  "game:loopInit": (engine, { maxTurns = 100 } = {}) => {
    engine.session.change("init loop", (doc) => {
      doc.gameLoop = {
        turn: 0,
        running: false,
        activeAgentIndex: -1,
        phase: "setup",
        maxTurns
      };
    });
  },
  "game:loopStart": (engine) => {
    engine.session.change("start loop", (doc) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = true;
        doc.gameLoop.turn = 0;
        doc.gameLoop.phase = "play";
        doc.gameLoop.activeAgentIndex = 0;
      }
    });
  },
  "game:loopStop": (engine, { phase = "stopped" } = {}) => {
    engine.session.change("stop loop", (doc) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = false;
        doc.gameLoop.phase = phase;
      }
    });
  },
  "game:nextTurn": (engine, { agentCount = 0 } = {}) => {
    engine.session.change("next turn", (doc) => {
      if (!doc.gameLoop) return;
      doc.gameLoop.turn++;
      doc.gameLoop.activeAgentIndex = agentCount > 0 ? (doc.gameLoop.activeAgentIndex + 1) % agentCount : 0;
    });
  },
  "game:setPhase": (engine, { phase } = {}) => {
    engine.session.change("set phase", (doc) => {
      if (doc.gameLoop) doc.gameLoop.phase = phase;
    });
  },
  "game:setMaxTurns": (engine, { maxTurns } = {}) => {
    engine.session.change("set maxTurns", (doc) => {
      if (doc.gameLoop) doc.gameLoop.maxTurns = maxTurns;
    });
  },
  "game:setActiveAgent": (engine, { index } = {}) => {
    engine.session.change("set active agent", (doc) => {
      if (doc.gameLoop) doc.gameLoop.activeAgentIndex = index;
    });
  }
};
var RuleActions = {
  "rule:markFired": (engine, { name, timestamp } = {}) => {
    engine.session.change("mark fired", (doc) => {
      if (doc.rules) doc.rules.fired[name] = timestamp ?? Date.now();
    });
  },
  "rule:initRules": (engine) => {
    engine.session.change("init rules", (doc) => {
      doc.rules = { fired: {} };
    });
  }
};
var TokenActions = {
  "token:transform": (engine, { token, properties = {} } = {}) => {
    if (!token) throw new Error("token required");
    return { ...token, ...properties, _transformedFrom: token.id };
  },
  "token:attach": (engine, { host, attachment, attachmentType = "default" } = {}) => {
    if (!host || !attachment) throw new Error("host and attachment required");
    const attachments = [...host._attachments || [], { ...attachment, _attachmentType: attachmentType }];
    return { ...host, _attachments: attachments };
  },
  "token:detach": (engine, { host, attachmentId } = {}) => {
    if (!host) throw new Error("host required");
    const attachments = (host._attachments || []).filter((a) => a.id !== attachmentId);
    return { ...host, _attachments: attachments };
  },
  "token:merge": (engine, { tokens, properties, keepOriginals = false } = {}) => {
    if (!tokens || tokens.length < 2) throw new Error("At least 2 tokens required to merge");
    const merged = {
      id: `merged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...Object.assign({}, ...tokens),
      ...properties || {},
      _mergedFrom: tokens.map((t) => t.id)
    };
    return { merged, originals: keepOriginals ? tokens : void 0 };
  },
  "token:split": (engine, { token, count = 2, propertiesArray } = {}) => {
    if (!token) throw new Error("token required");
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        ...token,
        id: `split-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        ...propertiesArray?.[i] || {},
        _splitFrom: token.id
      });
    }
    return parts;
  }
};
var DebugActions = {
  "debug:log": (engine, payload) => {
    if (engine.debug) console.log("[debug:log]", payload);
    return payload;
  }
};
var ActionRegistry = {
  ...StackActions,
  ...SpaceActions,
  ...SourceActions,
  ...AgentActions,
  ...GameActions,
  ...GameLoopActions,
  ...RuleActions,
  ...TokenActions,
  ...DebugActions
};

// node_modules/@automerge/automerge/dist/mjs/wasm_bindgen_output/web/automerge_wasm.js
var wasm;
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}
var WASM_VECTOR_LEN = 0;
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_export_4.set(idx, obj);
  return idx;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_export_4.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
var AutomergeFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_automerge_free(ptr >>> 0, 1));
var Automerge = class _Automerge {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_Automerge.prototype);
    obj.__wbg_ptr = ptr;
    AutomergeFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    AutomergeFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_automerge_free(ptr, 0);
  }
  /**
   * @param {string | null} [actor]
   * @returns {Automerge}
   */
  static new(actor) {
    var ptr0 = isLikeNone(actor) ? 0 : passStringToWasm0(actor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.automerge_new(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @param {string | null} [actor]
   * @returns {Automerge}
   */
  clone(actor) {
    var ptr0 = isLikeNone(actor) ? 0 : passStringToWasm0(actor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.automerge_clone(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @param {string | null | undefined} actor
   * @param {any} heads
   * @returns {Automerge}
   */
  fork(actor, heads) {
    var ptr0 = isLikeNone(actor) ? 0 : passStringToWasm0(actor, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.automerge_fork(this.__wbg_ptr, ptr0, len0, heads);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @returns {number}
   */
  pendingOps() {
    const ret = wasm.automerge_pendingOps(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {string | null} [message]
   * @param {number | null} [time]
   * @returns {Hash | null}
   */
  commit(message, time) {
    var ptr0 = isLikeNone(message) ? 0 : passStringToWasm0(message, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.automerge_commit(this.__wbg_ptr, ptr0, len0, !isLikeNone(time), isLikeNone(time) ? 0 : time);
    return ret;
  }
  /**
   * @param {Automerge} other
   * @returns {Heads}
   */
  merge(other) {
    _assertClass(other, _Automerge);
    const ret = wasm.automerge_merge(this.__wbg_ptr, other.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @returns {number}
   */
  rollback() {
    const ret = wasm.automerge_rollback(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  keys(obj, heads) {
    const ret = wasm.automerge_keys(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {string}
   */
  text(obj, heads) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm.automerge_text(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm0(ptr1, len1);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  spans(obj, heads) {
    const ret = wasm.automerge_spans(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {number} start
   * @param {number} delete_count
   * @param {any} text
   */
  splice(obj, start, delete_count, text) {
    const ret = wasm.automerge_splice(this.__wbg_ptr, obj, start, delete_count, text);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {string} new_text
   */
  updateText(obj, new_text) {
    const ret = wasm.automerge_updateText(this.__wbg_ptr, obj, new_text);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {Span[]} args
   * @param {UpdateSpansConfig | undefined | null} config
   */
  updateSpans(obj, args, config) {
    const ret = wasm.automerge_updateSpans(this.__wbg_ptr, obj, args, config);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {any} value
   * @param {any} datatype
   */
  push(obj, value, datatype) {
    const ret = wasm.automerge_push(this.__wbg_ptr, obj, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {ObjType} value
   * @returns {ObjID}
   */
  pushObject(obj, value) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm.automerge_pushObject(this.__wbg_ptr, obj, value);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm0(ptr1, len1);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {number} index
   * @param {any} value
   * @param {any} datatype
   */
  insert(obj, index, value, datatype) {
    const ret = wasm.automerge_insert(this.__wbg_ptr, obj, index, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {{[key: string]: MaterializeValue}} block
   */
  splitBlock(obj, index, block) {
    const ret = wasm.automerge_splitBlock(this.__wbg_ptr, obj, index, block);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   */
  joinBlock(obj, index) {
    const ret = wasm.automerge_joinBlock(this.__wbg_ptr, obj, index);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {{[key: string]: MaterializeValue}} block
   */
  updateBlock(obj, index, block) {
    const ret = wasm.automerge_updateBlock(this.__wbg_ptr, obj, index, block);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {any} text
   * @param {number} index
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  getBlock(text, index, heads) {
    const ret = wasm.automerge_getBlock(this.__wbg_ptr, text, index, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {ObjType} value
   * @returns {ObjID}
   */
  insertObject(obj, index, value) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm.automerge_insertObject(this.__wbg_ptr, obj, index, value);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm0(ptr1, len1);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {any} value
   * @param {any} datatype
   */
  put(obj, prop, value, datatype) {
    const ret = wasm.automerge_put(this.__wbg_ptr, obj, prop, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   * @param {ObjType} value
   * @returns {ObjID}
   */
  putObject(obj, prop, value) {
    const ret = wasm.automerge_putObject(this.__wbg_ptr, obj, prop, value);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   * @param {number} value
   */
  increment(obj, prop, value) {
    const ret = wasm.automerge_increment(this.__wbg_ptr, obj, prop, value);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  get(obj, prop, heads) {
    const ret = wasm.automerge_get(this.__wbg_ptr, obj, prop, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  getWithType(obj, prop, heads) {
    const ret = wasm.automerge_getWithType(this.__wbg_ptr, obj, prop, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {object}
   */
  objInfo(obj, heads) {
    const ret = wasm.automerge_objInfo(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} arg
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  getAll(obj, arg, heads) {
    const ret = wasm.automerge_getAll(this.__wbg_ptr, obj, arg, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {boolean} enable
   * @returns {boolean}
   */
  enableFreeze(enable) {
    const ret = wasm.automerge_enableFreeze(this.__wbg_ptr, enable);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
  }
  /**
   * @param {string} datatype
   * @param {Function} construct
   * @param {(arg: any) => any | undefined} deconstruct
   */
  registerDatatype(datatype, construct, deconstruct) {
    const ret = wasm.automerge_registerDatatype(this.__wbg_ptr, datatype, construct, deconstruct);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {any} object
   * @param {any} meta
   * @returns {any}
   */
  applyPatches(object, meta) {
    const ret = wasm.automerge_applyPatches(this.__wbg_ptr, object, meta);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} object
   * @param {any} meta
   * @returns {any}
   */
  applyAndReturnPatches(object, meta) {
    const ret = wasm.automerge_applyAndReturnPatches(this.__wbg_ptr, object, meta);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @returns {Patch[]}
   */
  diffIncremental() {
    const ret = wasm.automerge_diffIncremental(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  updateDiffCursor() {
    wasm.automerge_updateDiffCursor(this.__wbg_ptr);
  }
  resetDiffCursor() {
    wasm.automerge_resetDiffCursor(this.__wbg_ptr);
  }
  /**
   * @param {Heads} before
   * @param {Heads} after
   * @returns {Patch[]}
   */
  diff(before, after) {
    const ret = wasm.automerge_diff(this.__wbg_ptr, before, after);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Heads} heads
   */
  isolate(heads) {
    const ret = wasm.automerge_isolate(this.__wbg_ptr, heads);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  integrate() {
    wasm.automerge_integrate(this.__wbg_ptr);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {number}
   */
  length(obj, heads) {
    const ret = wasm.automerge_length(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   */
  delete(obj, prop) {
    const ret = wasm.automerge_delete(this.__wbg_ptr, obj, prop);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {Uint8Array}
   */
  save() {
    const ret = wasm.automerge_save(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Uint8Array}
   */
  saveIncremental() {
    const ret = wasm.automerge_saveIncremental(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {Heads} heads
   * @returns {Uint8Array}
   */
  saveSince(heads) {
    const ret = wasm.automerge_saveSince(this.__wbg_ptr, heads);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @returns {Uint8Array}
   */
  saveNoCompress() {
    const ret = wasm.automerge_saveNoCompress(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Uint8Array}
   */
  saveAndVerify() {
    const ret = wasm.automerge_saveAndVerify(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Uint8Array} data
   * @returns {number}
   */
  loadIncremental(data) {
    const ret = wasm.automerge_loadIncremental(this.__wbg_ptr, data);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {Change[]} changes
   */
  applyChanges(changes) {
    const ret = wasm.automerge_applyChanges(this.__wbg_ptr, changes);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Heads} have_deps
   * @returns {Change[]}
   */
  getChanges(have_deps) {
    const ret = wasm.automerge_getChanges(this.__wbg_ptr, have_deps);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Heads} have_deps
   * @returns {ChangeMetadata[]}
   */
  getChangesMeta(have_deps) {
    const ret = wasm.automerge_getChangesMeta(this.__wbg_ptr, have_deps);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {Change | null}
   */
  getChangeByHash(hash) {
    const ret = wasm.automerge_getChangeByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {ChangeMetadata | null}
   */
  getChangeMetaByHash(hash) {
    const ret = wasm.automerge_getChangeMetaByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {DecodedChange | null}
   */
  getDecodedChangeByHash(hash) {
    const ret = wasm.automerge_getDecodedChangeByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {Automerge} other
   * @returns {Change[]}
   */
  getChangesAdded(other) {
    _assertClass(other, _Automerge);
    const ret = wasm.automerge_getChangesAdded(this.__wbg_ptr, other.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Heads}
   */
  getHeads() {
    const ret = wasm.automerge_getHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Actor}
   */
  getActorId() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.automerge_getActorId(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Change | null}
   */
  getLastLocalChange() {
    const ret = wasm.automerge_getLastLocalChange(this.__wbg_ptr);
    return ret;
  }
  dump() {
    wasm.automerge_dump(this.__wbg_ptr);
  }
  /**
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  getMissingDeps(heads) {
    const ret = wasm.automerge_getMissingDeps(this.__wbg_ptr, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {SyncState} state
   * @param {SyncMessage} message
   */
  receiveSyncMessage(state2, message) {
    _assertClass(state2, SyncState);
    const ret = wasm.automerge_receiveSyncMessage(this.__wbg_ptr, state2.__wbg_ptr, message);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {SyncState} state
   * @returns {SyncMessage | null}
   */
  generateSyncMessage(state2) {
    _assertClass(state2, SyncState);
    const ret = wasm.automerge_generateSyncMessage(this.__wbg_ptr, state2.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} meta
   * @returns {MaterializeValue}
   */
  toJS(meta) {
    const ret = wasm.automerge_toJS(this.__wbg_ptr, meta);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null | undefined} heads
   * @param {any} meta
   * @returns {any}
   */
  materialize(obj, heads, meta) {
    const ret = wasm.automerge_materialize(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads), meta);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} position
   * @param {Array<any> | null | undefined} heads
   * @param {any} move_cursor
   * @returns {string}
   */
  getCursor(obj, position, heads, move_cursor) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm.automerge_getCursor(this.__wbg_ptr, obj, position, isLikeNone(heads) ? 0 : addToExternrefTable0(heads), move_cursor);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm0(ptr1, len1);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {any} cursor
   * @param {Array<any> | null} [heads]
   * @returns {number}
   */
  getCursorPosition(obj, cursor, heads) {
    const ret = wasm.automerge_getCursorPosition(this.__wbg_ptr, obj, cursor, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {string | null} [message]
   * @param {number | null} [time]
   * @returns {Hash}
   */
  emptyChange(message, time) {
    var ptr0 = isLikeNone(message) ? 0 : passStringToWasm0(message, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.automerge_emptyChange(this.__wbg_ptr, ptr0, len0, !isLikeNone(time), isLikeNone(time) ? 0 : time);
    return ret;
  }
  /**
   * @param {any} obj
   * @param {any} range
   * @param {any} name
   * @param {any} value
   * @param {any} datatype
   */
  mark(obj, range, name, value, datatype) {
    const ret = wasm.automerge_mark(this.__wbg_ptr, obj, range, name, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {MarkRange} range
   * @param {string} name
   */
  unmark(obj, range, name) {
    const ret = wasm.automerge_unmark(this.__wbg_ptr, obj, range, name);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  marks(obj, heads) {
    const ret = wasm.automerge_marks(this.__wbg_ptr, obj, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {number} index
   * @param {Array<any> | null} [heads]
   * @returns {object}
   */
  marksAt(obj, index, heads) {
    const ret = wasm.automerge_marksAt(this.__wbg_ptr, obj, index, isLikeNone(heads) ? 0 : addToExternrefTable0(heads));
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * @param {SyncState} state
   * @returns {boolean}
   */
  hasOurChanges(state2) {
    _assertClass(state2, SyncState);
    const ret = wasm.automerge_hasOurChanges(this.__wbg_ptr, state2.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {Hash[]}
   */
  topoHistoryTraversal() {
    const ret = wasm.automerge_topoHistoryTraversal(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Stats}
   */
  stats() {
    const ret = wasm.automerge_stats(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} hashes
   * @returns {Uint8Array}
   */
  saveBundle(hashes) {
    const ret = wasm.automerge_saveBundle(this.__wbg_ptr, hashes);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
};
if (Symbol.dispose) Automerge.prototype[Symbol.dispose] = Automerge.prototype.free;
var SyncStateFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_syncstate_free(ptr >>> 0, 1));
var SyncState = class _SyncState {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_SyncState.prototype);
    obj.__wbg_ptr = ptr;
    SyncStateFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SyncStateFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_syncstate_free(ptr, 0);
  }
  /**
   * @returns {Heads}
   */
  get sharedHeads() {
    const ret = wasm.syncstate_sharedHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Heads}
   */
  get lastSentHeads() {
    const ret = wasm.syncstate_lastSentHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {Heads} heads
   */
  set lastSentHeads(heads) {
    const ret = wasm.syncstate_set_lastSentHeads(this.__wbg_ptr, heads);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {Heads} hashes
   */
  set sentHashes(hashes) {
    const ret = wasm.syncstate_set_sentHashes(this.__wbg_ptr, hashes);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @returns {SyncState}
   */
  clone() {
    const ret = wasm.syncstate_clone(this.__wbg_ptr);
    return _SyncState.__wrap(ret);
  }
};
if (Symbol.dispose) SyncState.prototype[Symbol.dispose] = SyncState.prototype.free;

// node_modules/@automerge/automerge/dist/mjs/low_level.js
var _initialized = false;
var _initializeListeners = [];
function UseApi(api) {
  for (const k in api) {
    ;
    ApiHandler[k] = api[k];
  }
  _initialized = true;
  for (const listener of _initializeListeners) {
    listener();
  }
}
var ApiHandler = {
  create(options) {
    throw new RangeError("Automerge.use() not called");
  },
  load(data, options) {
    throw new RangeError("Automerge.use() not called (load)");
  },
  encodeChange(change2) {
    throw new RangeError("Automerge.use() not called (encodeChange)");
  },
  decodeChange(change2) {
    throw new RangeError("Automerge.use() not called (decodeChange)");
  },
  initSyncState() {
    throw new RangeError("Automerge.use() not called (initSyncState)");
  },
  encodeSyncMessage(message) {
    throw new RangeError("Automerge.use() not called (encodeSyncMessage)");
  },
  decodeSyncMessage(msg) {
    throw new RangeError("Automerge.use() not called (decodeSyncMessage)");
  },
  encodeSyncState(state2) {
    throw new RangeError("Automerge.use() not called (encodeSyncState)");
  },
  decodeSyncState(data) {
    throw new RangeError("Automerge.use() not called (decodeSyncState)");
  },
  exportSyncState(state2) {
    throw new RangeError("Automerge.use() not called (exportSyncState)");
  },
  importSyncState(state2) {
    throw new RangeError("Automerge.use() not called (importSyncState)");
  },
  readBundle(data) {
    throw new RangeError("Automerge.use() not called (readBundle)");
  }
};

// node_modules/@automerge/automerge/dist/mjs/wasm_bindgen_output/bundler/automerge_wasm.js
var automerge_wasm_exports2 = {};
__export(automerge_wasm_exports2, {
  Automerge: () => Automerge2,
  SyncState: () => SyncState2,
  __wbg_BigInt_6adbfd8eb0f7ec07: () => __wbg_BigInt_6adbfd8eb0f7ec07,
  __wbg_Error_e17e777aac105295: () => __wbg_Error_e17e777aac105295,
  __wbg_String_8f0eb39a4a4c2f66: () => __wbg_String_8f0eb39a4a4c2f66,
  __wbg_apply_55d63d092a912d6f: () => __wbg_apply_55d63d092a912d6f,
  __wbg_assign_66f7942767cba7e3: () => __wbg_assign_66f7942767cba7e3,
  __wbg_call_13410aac570ffff7: () => __wbg_call_13410aac570ffff7,
  __wbg_call_a5400b25a865cfd8: () => __wbg_call_a5400b25a865cfd8,
  __wbg_concat_4a5e81410543b8f3: () => __wbg_concat_4a5e81410543b8f3,
  __wbg_defineProperty_1afba89a75bc184f: () => __wbg_defineProperty_1afba89a75bc184f,
  __wbg_deleteProperty_5fe99f4fd0f66ebe: () => __wbg_deleteProperty_5fe99f4fd0f66ebe,
  __wbg_done_75ed0ee6dd243d9d: () => __wbg_done_75ed0ee6dd243d9d,
  __wbg_entries_2be2f15bd5554996: () => __wbg_entries_2be2f15bd5554996,
  __wbg_error_7534b8e9a36f1ab4: () => __wbg_error_7534b8e9a36f1ab4,
  __wbg_for_fbb1cf47b8d6b3f6: () => __wbg_for_fbb1cf47b8d6b3f6,
  __wbg_freeze_881cf93497533f9e: () => __wbg_freeze_881cf93497533f9e,
  __wbg_from_88bc52ce20ba6318: () => __wbg_from_88bc52ce20ba6318,
  __wbg_getRandomValues_1c61fac11405ffdc: () => __wbg_getRandomValues_1c61fac11405ffdc,
  __wbg_getTime_6bb3f64e0f18f817: () => __wbg_getTime_6bb3f64e0f18f817,
  __wbg_get_0da715ceaecea5c8: () => __wbg_get_0da715ceaecea5c8,
  __wbg_get_458e874b43b18b25: () => __wbg_get_458e874b43b18b25,
  __wbg_instanceof_ArrayBuffer_67f3012529f6a2dd: () => __wbg_instanceof_ArrayBuffer_67f3012529f6a2dd,
  __wbg_instanceof_Date_c0cdff0c3b978b0e: () => __wbg_instanceof_Date_c0cdff0c3b978b0e,
  __wbg_instanceof_Object_fbf5fef4952ff29b: () => __wbg_instanceof_Object_fbf5fef4952ff29b,
  __wbg_instanceof_Uint8Array_9a8378d955933db7: () => __wbg_instanceof_Uint8Array_9a8378d955933db7,
  __wbg_isArray_030cce220591fb41: () => __wbg_isArray_030cce220591fb41,
  __wbg_isArray_52653600d4b65388: () => __wbg_isArray_52653600d4b65388,
  __wbg_iterator_f370b34483c71a1c: () => __wbg_iterator_f370b34483c71a1c,
  __wbg_keys_ef52390b2ae0e714: () => __wbg_keys_ef52390b2ae0e714,
  __wbg_length_186546c51cd61acd: () => __wbg_length_186546c51cd61acd,
  __wbg_length_6bb7e81f9d7713e4: () => __wbg_length_6bb7e81f9d7713e4,
  __wbg_length_9d771c54845e987f: () => __wbg_length_9d771c54845e987f,
  __wbg_log_6c7b5f4f00b8ce3f: () => __wbg_log_6c7b5f4f00b8ce3f,
  __wbg_log_7917fde260a8fd39: () => __wbg_log_7917fde260a8fd39,
  __wbg_new_19c25a3f2fa63a02: () => __wbg_new_19c25a3f2fa63a02,
  __wbg_new_1f3a344cf3123716: () => __wbg_new_1f3a344cf3123716,
  __wbg_new_5a2ae4557f92b50e: () => __wbg_new_5a2ae4557f92b50e,
  __wbg_new_638ebfaedbf32a5e: () => __wbg_new_638ebfaedbf32a5e,
  __wbg_new_8a6f238a6ece86ea: () => __wbg_new_8a6f238a6ece86ea,
  __wbg_new_da9dc54c5db29dfa: () => __wbg_new_da9dc54c5db29dfa,
  __wbg_new_ef4f9056d946f38b: () => __wbg_new_ef4f9056d946f38b,
  __wbg_newfromslice_074c56947bd43469: () => __wbg_newfromslice_074c56947bd43469,
  __wbg_next_5b3530e612fde77d: () => __wbg_next_5b3530e612fde77d,
  __wbg_next_692e82279131b03c: () => __wbg_next_692e82279131b03c,
  __wbg_ownKeys_36e096e00ffe2676: () => __wbg_ownKeys_36e096e00ffe2676,
  __wbg_prototypesetcall_3d4a26c1ed734349: () => __wbg_prototypesetcall_3d4a26c1ed734349,
  __wbg_push_330b2eb93e4e1212: () => __wbg_push_330b2eb93e4e1212,
  __wbg_set_3f1d0b984ed272ed: () => __wbg_set_3f1d0b984ed272ed,
  __wbg_set_453345bcda80b89a: () => __wbg_set_453345bcda80b89a,
  __wbg_set_90f6c0f7bd8c0415: () => __wbg_set_90f6c0f7bd8c0415,
  __wbg_set_wasm: () => __wbg_set_wasm2,
  __wbg_slice_974daea329f5c01d: () => __wbg_slice_974daea329f5c01d,
  __wbg_stack_0ed75d68575b0f3c: () => __wbg_stack_0ed75d68575b0f3c,
  __wbg_stringify_4a34a65f0d4e236f: () => __wbg_stringify_4a34a65f0d4e236f,
  __wbg_toString_1f1286a7a97689fe: () => __wbg_toString_1f1286a7a97689fe,
  __wbg_toString_7268338f40012a03: () => __wbg_toString_7268338f40012a03,
  __wbg_toString_ea9a6b07f936eb86: () => __wbg_toString_ea9a6b07f936eb86,
  __wbg_unshift_18d353edeebf9a72: () => __wbg_unshift_18d353edeebf9a72,
  __wbg_value_dd9372230531eade: () => __wbg_value_dd9372230531eade,
  __wbg_values_a574c29011369bea: () => __wbg_values_a574c29011369bea,
  __wbg_wbindgenbooleanget_3fe6f642c7d97746: () => __wbg_wbindgenbooleanget_3fe6f642c7d97746,
  __wbg_wbindgendebugstring_99ef257a3ddda34d: () => __wbg_wbindgendebugstring_99ef257a3ddda34d,
  __wbg_wbindgengt_5d4c5d18810de162: () => __wbg_wbindgengt_5d4c5d18810de162,
  __wbg_wbindgenisbigint_ecb90cc08a5a9154: () => __wbg_wbindgenisbigint_ecb90cc08a5a9154,
  __wbg_wbindgenisfunction_8cee7dce3725ae74: () => __wbg_wbindgenisfunction_8cee7dce3725ae74,
  __wbg_wbindgenisnull_f3037694abe4d97a: () => __wbg_wbindgenisnull_f3037694abe4d97a,
  __wbg_wbindgenisobject_307a53c6bd97fbf8: () => __wbg_wbindgenisobject_307a53c6bd97fbf8,
  __wbg_wbindgenisstring_d4fa939789f003b0: () => __wbg_wbindgenisstring_d4fa939789f003b0,
  __wbg_wbindgenisundefined_c4b71d073b92f3c5: () => __wbg_wbindgenisundefined_c4b71d073b92f3c5,
  __wbg_wbindgenjsvallooseeq_9bec8c9be826bed1: () => __wbg_wbindgenjsvallooseeq_9bec8c9be826bed1,
  __wbg_wbindgenlt_544155a2b3097bd5: () => __wbg_wbindgenlt_544155a2b3097bd5,
  __wbg_wbindgenneg_3577d8a6fd6fd98b: () => __wbg_wbindgenneg_3577d8a6fd6fd98b,
  __wbg_wbindgennumberget_f74b4c7525ac05cb: () => __wbg_wbindgennumberget_f74b4c7525ac05cb,
  __wbg_wbindgenstringget_0f16a6ddddef376f: () => __wbg_wbindgenstringget_0f16a6ddddef376f,
  __wbg_wbindgenthrow_451ec1a8469d7eb6: () => __wbg_wbindgenthrow_451ec1a8469d7eb6,
  __wbindgen_cast_2241b6af4c4b2941: () => __wbindgen_cast_2241b6af4c4b2941,
  __wbindgen_cast_4625c577ab2ec9ee: () => __wbindgen_cast_4625c577ab2ec9ee,
  __wbindgen_cast_9ae0607507abb057: () => __wbindgen_cast_9ae0607507abb057,
  __wbindgen_cast_d6cd19b81560fd6e: () => __wbindgen_cast_d6cd19b81560fd6e,
  __wbindgen_init_externref_table: () => __wbindgen_init_externref_table,
  create: () => create,
  decodeChange: () => decodeChange,
  decodeSyncMessage: () => decodeSyncMessage,
  decodeSyncState: () => decodeSyncState,
  encodeChange: () => encodeChange,
  encodeSyncMessage: () => encodeSyncMessage,
  encodeSyncState: () => encodeSyncState,
  exportSyncState: () => exportSyncState,
  importSyncState: () => importSyncState,
  initSyncState: () => initSyncState,
  load: () => load,
  readBundle: () => readBundle
});

// examples/confluence/web/wasm-stub.js
var wasm_stub_exports = {};
__export(wasm_stub_exports, {
  __wbg_set_wasm: () => __wbg_set_wasm,
  __wbindgen_start: () => __wbindgen_start,
  default: () => wasm_stub_default
});
function __wbg_set_wasm() {
}
function __wbindgen_start() {
}
var wasm_stub_default = {
  __wbg_set_wasm,
  __wbindgen_start
};

// node_modules/@automerge/automerge/dist/mjs/wasm_bindgen_output/bundler/automerge_wasm_bg.js
var wasm2;
function __wbg_set_wasm2(val) {
  wasm2 = val;
}
var cachedUint8ArrayMemory02 = null;
function getUint8ArrayMemory02() {
  if (cachedUint8ArrayMemory02 === null || cachedUint8ArrayMemory02.byteLength === 0) {
    cachedUint8ArrayMemory02 = new Uint8Array(wasm2.memory.buffer);
  }
  return cachedUint8ArrayMemory02;
}
var cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder2.decode();
var MAX_SAFARI_DECODE_BYTES2 = 2146435072;
var numBytesDecoded2 = 0;
function decodeText2(ptr, len) {
  numBytesDecoded2 += len;
  if (numBytesDecoded2 >= MAX_SAFARI_DECODE_BYTES2) {
    cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder2.decode();
    numBytesDecoded2 = len;
  }
  return cachedTextDecoder2.decode(getUint8ArrayMemory02().subarray(ptr, ptr + len));
}
function getStringFromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText2(ptr, len);
}
var WASM_VECTOR_LEN2 = 0;
var cachedTextEncoder2 = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder2)) {
  cachedTextEncoder2.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder2.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
function passStringToWasm02(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder2.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory02().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN2 = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory02();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory02().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder2.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN2 = offset;
  return ptr;
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm2.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm2.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function addToExternrefTable02(obj) {
  const idx = wasm2.__externref_table_alloc();
  wasm2.__wbindgen_export_4.set(idx, obj);
  return idx;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable02(e);
    wasm2.__wbindgen_exn_store(idx);
  }
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory02().subarray(ptr / 1, ptr / 1 + len);
}
function isLikeNone2(x) {
  return x === void 0 || x === null;
}
function debugString(val) {
  const type = typeof val;
  if (type == "number" || type == "boolean" || val == null) {
    return `${val}`;
  }
  if (type == "string") {
    return `"${val}"`;
  }
  if (type == "symbol") {
    const description = val.description;
    if (description == null) {
      return "Symbol";
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == "function") {
    const name = val.name;
    if (typeof name == "string" && name.length > 0) {
      return `Function(${name})`;
    } else {
      return "Function";
    }
  }
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = "[";
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ", " + debugString(val[i]);
    }
    debug += "]";
    return debug;
  }
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    return toString.call(val);
  }
  if (className == "Object") {
    try {
      return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
      return "Object";
    }
  }
  if (val instanceof Error) {
    return `${val.name}: ${val.message}
${val.stack}`;
  }
  return className;
}
function takeFromExternrefTable02(idx) {
  const value = wasm2.__wbindgen_export_4.get(idx);
  wasm2.__externref_table_dealloc(idx);
  return value;
}
function _assertClass2(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
function create(options) {
  const ret = wasm2.create(options);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return Automerge2.__wrap(ret[0]);
}
function load(data, options) {
  const ret = wasm2.load(data, options);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return Automerge2.__wrap(ret[0]);
}
function encodeChange(change2) {
  const ret = wasm2.encodeChange(change2);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function decodeChange(change2) {
  const ret = wasm2.decodeChange(change2);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function initSyncState() {
  const ret = wasm2.initSyncState();
  return SyncState2.__wrap(ret);
}
function importSyncState(state2) {
  const ret = wasm2.importSyncState(state2);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return SyncState2.__wrap(ret[0]);
}
function exportSyncState(state2) {
  _assertClass2(state2, SyncState2);
  const ret = wasm2.exportSyncState(state2.__wbg_ptr);
  return ret;
}
function encodeSyncMessage(message) {
  const ret = wasm2.encodeSyncMessage(message);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function decodeSyncMessage(msg) {
  const ret = wasm2.decodeSyncMessage(msg);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function encodeSyncState(state2) {
  _assertClass2(state2, SyncState2);
  const ret = wasm2.encodeSyncState(state2.__wbg_ptr);
  return ret;
}
function decodeSyncState(data) {
  const ret = wasm2.decodeSyncState(data);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return SyncState2.__wrap(ret[0]);
}
function readBundle(bundle) {
  const ret = wasm2.readBundle(bundle);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
var AutomergeFinalization2 = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_automerge_free(ptr >>> 0, 1));
var Automerge2 = class _Automerge {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_Automerge.prototype);
    obj.__wbg_ptr = ptr;
    AutomergeFinalization2.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    AutomergeFinalization2.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_automerge_free(ptr, 0);
  }
  /**
   * @param {string | null} [actor]
   * @returns {Automerge}
   */
  static new(actor) {
    var ptr0 = isLikeNone2(actor) ? 0 : passStringToWasm02(actor, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.automerge_new(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @param {string | null} [actor]
   * @returns {Automerge}
   */
  clone(actor) {
    var ptr0 = isLikeNone2(actor) ? 0 : passStringToWasm02(actor, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.automerge_clone(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @param {string | null | undefined} actor
   * @param {any} heads
   * @returns {Automerge}
   */
  fork(actor, heads) {
    var ptr0 = isLikeNone2(actor) ? 0 : passStringToWasm02(actor, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.automerge_fork(this.__wbg_ptr, ptr0, len0, heads);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return _Automerge.__wrap(ret[0]);
  }
  /**
   * @returns {number}
   */
  pendingOps() {
    const ret = wasm2.automerge_pendingOps(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {string | null} [message]
   * @param {number | null} [time]
   * @returns {Hash | null}
   */
  commit(message, time) {
    var ptr0 = isLikeNone2(message) ? 0 : passStringToWasm02(message, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.automerge_commit(this.__wbg_ptr, ptr0, len0, !isLikeNone2(time), isLikeNone2(time) ? 0 : time);
    return ret;
  }
  /**
   * @param {Automerge} other
   * @returns {Heads}
   */
  merge(other) {
    _assertClass2(other, _Automerge);
    const ret = wasm2.automerge_merge(this.__wbg_ptr, other.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @returns {number}
   */
  rollback() {
    const ret = wasm2.automerge_rollback(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  keys(obj, heads) {
    const ret = wasm2.automerge_keys(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {string}
   */
  text(obj, heads) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm2.automerge_text(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm02(ptr1, len1);
    } finally {
      wasm2.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  spans(obj, heads) {
    const ret = wasm2.automerge_spans(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {number} start
   * @param {number} delete_count
   * @param {any} text
   */
  splice(obj, start, delete_count, text) {
    const ret = wasm2.automerge_splice(this.__wbg_ptr, obj, start, delete_count, text);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {string} new_text
   */
  updateText(obj, new_text) {
    const ret = wasm2.automerge_updateText(this.__wbg_ptr, obj, new_text);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {Span[]} args
   * @param {UpdateSpansConfig | undefined | null} config
   */
  updateSpans(obj, args, config) {
    const ret = wasm2.automerge_updateSpans(this.__wbg_ptr, obj, args, config);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {any} value
   * @param {any} datatype
   */
  push(obj, value, datatype) {
    const ret = wasm2.automerge_push(this.__wbg_ptr, obj, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {ObjType} value
   * @returns {ObjID}
   */
  pushObject(obj, value) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm2.automerge_pushObject(this.__wbg_ptr, obj, value);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm02(ptr1, len1);
    } finally {
      wasm2.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {number} index
   * @param {any} value
   * @param {any} datatype
   */
  insert(obj, index, value, datatype) {
    const ret = wasm2.automerge_insert(this.__wbg_ptr, obj, index, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {{[key: string]: MaterializeValue}} block
   */
  splitBlock(obj, index, block) {
    const ret = wasm2.automerge_splitBlock(this.__wbg_ptr, obj, index, block);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   */
  joinBlock(obj, index) {
    const ret = wasm2.automerge_joinBlock(this.__wbg_ptr, obj, index);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {{[key: string]: MaterializeValue}} block
   */
  updateBlock(obj, index, block) {
    const ret = wasm2.automerge_updateBlock(this.__wbg_ptr, obj, index, block);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {any} text
   * @param {number} index
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  getBlock(text, index, heads) {
    const ret = wasm2.automerge_getBlock(this.__wbg_ptr, text, index, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {ObjID} obj
   * @param {number} index
   * @param {ObjType} value
   * @returns {ObjID}
   */
  insertObject(obj, index, value) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm2.automerge_insertObject(this.__wbg_ptr, obj, index, value);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm02(ptr1, len1);
    } finally {
      wasm2.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {any} value
   * @param {any} datatype
   */
  put(obj, prop, value, datatype) {
    const ret = wasm2.automerge_put(this.__wbg_ptr, obj, prop, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   * @param {ObjType} value
   * @returns {ObjID}
   */
  putObject(obj, prop, value) {
    const ret = wasm2.automerge_putObject(this.__wbg_ptr, obj, prop, value);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   * @param {number} value
   */
  increment(obj, prop, value) {
    const ret = wasm2.automerge_increment(this.__wbg_ptr, obj, prop, value);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  get(obj, prop, heads) {
    const ret = wasm2.automerge_get(this.__wbg_ptr, obj, prop, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} prop
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  getWithType(obj, prop, heads) {
    const ret = wasm2.automerge_getWithType(this.__wbg_ptr, obj, prop, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {object}
   */
  objInfo(obj, heads) {
    const ret = wasm2.automerge_objInfo(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} arg
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  getAll(obj, arg, heads) {
    const ret = wasm2.automerge_getAll(this.__wbg_ptr, obj, arg, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {boolean} enable
   * @returns {boolean}
   */
  enableFreeze(enable) {
    const ret = wasm2.automerge_enableFreeze(this.__wbg_ptr, enable);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return ret[0] !== 0;
  }
  /**
   * @param {string} datatype
   * @param {Function} construct
   * @param {(arg: any) => any | undefined} deconstruct
   */
  registerDatatype(datatype, construct, deconstruct) {
    const ret = wasm2.automerge_registerDatatype(this.__wbg_ptr, datatype, construct, deconstruct);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {any} object
   * @param {any} meta
   * @returns {any}
   */
  applyPatches(object, meta) {
    const ret = wasm2.automerge_applyPatches(this.__wbg_ptr, object, meta);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} object
   * @param {any} meta
   * @returns {any}
   */
  applyAndReturnPatches(object, meta) {
    const ret = wasm2.automerge_applyAndReturnPatches(this.__wbg_ptr, object, meta);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @returns {Patch[]}
   */
  diffIncremental() {
    const ret = wasm2.automerge_diffIncremental(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  updateDiffCursor() {
    wasm2.automerge_updateDiffCursor(this.__wbg_ptr);
  }
  resetDiffCursor() {
    wasm2.automerge_resetDiffCursor(this.__wbg_ptr);
  }
  /**
   * @param {Heads} before
   * @param {Heads} after
   * @returns {Patch[]}
   */
  diff(before, after) {
    const ret = wasm2.automerge_diff(this.__wbg_ptr, before, after);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Heads} heads
   */
  isolate(heads) {
    const ret = wasm2.automerge_isolate(this.__wbg_ptr, heads);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  integrate() {
    wasm2.automerge_integrate(this.__wbg_ptr);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {number}
   */
  length(obj, heads) {
    const ret = wasm2.automerge_length(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {ObjID} obj
   * @param {Prop} prop
   */
  delete(obj, prop) {
    const ret = wasm2.automerge_delete(this.__wbg_ptr, obj, prop);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @returns {Uint8Array}
   */
  save() {
    const ret = wasm2.automerge_save(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Uint8Array}
   */
  saveIncremental() {
    const ret = wasm2.automerge_saveIncremental(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {Heads} heads
   * @returns {Uint8Array}
   */
  saveSince(heads) {
    const ret = wasm2.automerge_saveSince(this.__wbg_ptr, heads);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @returns {Uint8Array}
   */
  saveNoCompress() {
    const ret = wasm2.automerge_saveNoCompress(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Uint8Array}
   */
  saveAndVerify() {
    const ret = wasm2.automerge_saveAndVerify(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Uint8Array} data
   * @returns {number}
   */
  loadIncremental(data) {
    const ret = wasm2.automerge_loadIncremental(this.__wbg_ptr, data);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {Change[]} changes
   */
  applyChanges(changes) {
    const ret = wasm2.automerge_applyChanges(this.__wbg_ptr, changes);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {Heads} have_deps
   * @returns {Change[]}
   */
  getChanges(have_deps) {
    const ret = wasm2.automerge_getChanges(this.__wbg_ptr, have_deps);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Heads} have_deps
   * @returns {ChangeMetadata[]}
   */
  getChangesMeta(have_deps) {
    const ret = wasm2.automerge_getChangesMeta(this.__wbg_ptr, have_deps);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {Change | null}
   */
  getChangeByHash(hash) {
    const ret = wasm2.automerge_getChangeByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {ChangeMetadata | null}
   */
  getChangeMetaByHash(hash) {
    const ret = wasm2.automerge_getChangeMetaByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Hash} hash
   * @returns {DecodedChange | null}
   */
  getDecodedChangeByHash(hash) {
    const ret = wasm2.automerge_getDecodedChangeByHash(this.__wbg_ptr, hash);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {Automerge} other
   * @returns {Change[]}
   */
  getChangesAdded(other) {
    _assertClass2(other, _Automerge);
    const ret = wasm2.automerge_getChangesAdded(this.__wbg_ptr, other.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Heads}
   */
  getHeads() {
    const ret = wasm2.automerge_getHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Actor}
   */
  getActorId() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm2.automerge_getActorId(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm02(ret[0], ret[1]);
    } finally {
      wasm2.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * @returns {Change | null}
   */
  getLastLocalChange() {
    const ret = wasm2.automerge_getLastLocalChange(this.__wbg_ptr);
    return ret;
  }
  dump() {
    wasm2.automerge_dump(this.__wbg_ptr);
  }
  /**
   * @param {Array<any> | null} [heads]
   * @returns {Array<any>}
   */
  getMissingDeps(heads) {
    const ret = wasm2.automerge_getMissingDeps(this.__wbg_ptr, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {SyncState} state
   * @param {SyncMessage} message
   */
  receiveSyncMessage(state2, message) {
    _assertClass2(state2, SyncState2);
    const ret = wasm2.automerge_receiveSyncMessage(this.__wbg_ptr, state2.__wbg_ptr, message);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {SyncState} state
   * @returns {SyncMessage | null}
   */
  generateSyncMessage(state2) {
    _assertClass2(state2, SyncState2);
    const ret = wasm2.automerge_generateSyncMessage(this.__wbg_ptr, state2.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} meta
   * @returns {MaterializeValue}
   */
  toJS(meta) {
    const ret = wasm2.automerge_toJS(this.__wbg_ptr, meta);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null | undefined} heads
   * @param {any} meta
   * @returns {any}
   */
  materialize(obj, heads, meta) {
    const ret = wasm2.automerge_materialize(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads), meta);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {any} position
   * @param {Array<any> | null | undefined} heads
   * @param {any} move_cursor
   * @returns {string}
   */
  getCursor(obj, position, heads, move_cursor) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ret = wasm2.automerge_getCursor(this.__wbg_ptr, obj, position, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads), move_cursor);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm02(ptr1, len1);
    } finally {
      wasm2.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {any} obj
   * @param {any} cursor
   * @param {Array<any> | null} [heads]
   * @returns {number}
   */
  getCursorPosition(obj, cursor, heads) {
    const ret = wasm2.automerge_getCursorPosition(this.__wbg_ptr, obj, cursor, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return ret[0];
  }
  /**
   * @param {string | null} [message]
   * @param {number | null} [time]
   * @returns {Hash}
   */
  emptyChange(message, time) {
    var ptr0 = isLikeNone2(message) ? 0 : passStringToWasm02(message, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.automerge_emptyChange(this.__wbg_ptr, ptr0, len0, !isLikeNone2(time), isLikeNone2(time) ? 0 : time);
    return ret;
  }
  /**
   * @param {any} obj
   * @param {any} range
   * @param {any} name
   * @param {any} value
   * @param {any} datatype
   */
  mark(obj, range, name, value, datatype) {
    const ret = wasm2.automerge_mark(this.__wbg_ptr, obj, range, name, value, datatype);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {ObjID} obj
   * @param {MarkRange} range
   * @param {string} name
   */
  unmark(obj, range, name) {
    const ret = wasm2.automerge_unmark(this.__wbg_ptr, obj, range, name);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {any} obj
   * @param {Array<any> | null} [heads]
   * @returns {any}
   */
  marks(obj, heads) {
    const ret = wasm2.automerge_marks(this.__wbg_ptr, obj, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {any} obj
   * @param {number} index
   * @param {Array<any> | null} [heads]
   * @returns {object}
   */
  marksAt(obj, index, heads) {
    const ret = wasm2.automerge_marksAt(this.__wbg_ptr, obj, index, isLikeNone2(heads) ? 0 : addToExternrefTable02(heads));
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * @param {SyncState} state
   * @returns {boolean}
   */
  hasOurChanges(state2) {
    _assertClass2(state2, SyncState2);
    const ret = wasm2.automerge_hasOurChanges(this.__wbg_ptr, state2.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {Hash[]}
   */
  topoHistoryTraversal() {
    const ret = wasm2.automerge_topoHistoryTraversal(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Stats}
   */
  stats() {
    const ret = wasm2.automerge_stats(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {any} hashes
   * @returns {Uint8Array}
   */
  saveBundle(hashes) {
    const ret = wasm2.automerge_saveBundle(this.__wbg_ptr, hashes);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
};
if (Symbol.dispose) Automerge2.prototype[Symbol.dispose] = Automerge2.prototype.free;
var SyncStateFinalization2 = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_syncstate_free(ptr >>> 0, 1));
var SyncState2 = class _SyncState {
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_SyncState.prototype);
    obj.__wbg_ptr = ptr;
    SyncStateFinalization2.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SyncStateFinalization2.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_syncstate_free(ptr, 0);
  }
  /**
   * @returns {Heads}
   */
  get sharedHeads() {
    const ret = wasm2.syncstate_sharedHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {Heads}
   */
  get lastSentHeads() {
    const ret = wasm2.syncstate_lastSentHeads(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {Heads} heads
   */
  set lastSentHeads(heads) {
    const ret = wasm2.syncstate_set_lastSentHeads(this.__wbg_ptr, heads);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @param {Heads} hashes
   */
  set sentHashes(hashes) {
    const ret = wasm2.syncstate_set_sentHashes(this.__wbg_ptr, hashes);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * @returns {SyncState}
   */
  clone() {
    const ret = wasm2.syncstate_clone(this.__wbg_ptr);
    return _SyncState.__wrap(ret);
  }
};
if (Symbol.dispose) SyncState2.prototype[Symbol.dispose] = SyncState2.prototype.free;
function __wbg_BigInt_6adbfd8eb0f7ec07(arg0) {
  const ret = BigInt(arg0);
  return ret;
}
function __wbg_Error_e17e777aac105295(arg0, arg1) {
  const ret = Error(getStringFromWasm02(arg0, arg1));
  return ret;
}
function __wbg_String_8f0eb39a4a4c2f66(arg0, arg1) {
  const ret = String(arg1);
  const ptr1 = passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_apply_55d63d092a912d6f() {
  return handleError(function(arg0, arg1, arg2) {
    const ret = Reflect.apply(arg0, arg1, arg2);
    return ret;
  }, arguments);
}
function __wbg_assign_66f7942767cba7e3(arg0, arg1) {
  const ret = Object.assign(arg0, arg1);
  return ret;
}
function __wbg_call_13410aac570ffff7() {
  return handleError(function(arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
  }, arguments);
}
function __wbg_call_a5400b25a865cfd8() {
  return handleError(function(arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
  }, arguments);
}
function __wbg_concat_4a5e81410543b8f3(arg0, arg1) {
  const ret = arg0.concat(arg1);
  return ret;
}
function __wbg_defineProperty_1afba89a75bc184f(arg0, arg1, arg2) {
  const ret = Object.defineProperty(arg0, arg1, arg2);
  return ret;
}
function __wbg_deleteProperty_5fe99f4fd0f66ebe() {
  return handleError(function(arg0, arg1) {
    const ret = Reflect.deleteProperty(arg0, arg1);
    return ret;
  }, arguments);
}
function __wbg_done_75ed0ee6dd243d9d(arg0) {
  const ret = arg0.done;
  return ret;
}
function __wbg_entries_2be2f15bd5554996(arg0) {
  const ret = Object.entries(arg0);
  return ret;
}
function __wbg_error_7534b8e9a36f1ab4(arg0, arg1) {
  let deferred0_0;
  let deferred0_1;
  try {
    deferred0_0 = arg0;
    deferred0_1 = arg1;
    console.error(getStringFromWasm02(arg0, arg1));
  } finally {
    wasm2.__wbindgen_free(deferred0_0, deferred0_1, 1);
  }
}
function __wbg_for_fbb1cf47b8d6b3f6(arg0, arg1) {
  const ret = Symbol.for(getStringFromWasm02(arg0, arg1));
  return ret;
}
function __wbg_freeze_881cf93497533f9e(arg0) {
  const ret = Object.freeze(arg0);
  return ret;
}
function __wbg_from_88bc52ce20ba6318(arg0) {
  const ret = Array.from(arg0);
  return ret;
}
function __wbg_getRandomValues_1c61fac11405ffdc() {
  return handleError(function(arg0, arg1) {
    globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
  }, arguments);
}
function __wbg_getTime_6bb3f64e0f18f817(arg0) {
  const ret = arg0.getTime();
  return ret;
}
function __wbg_get_0da715ceaecea5c8(arg0, arg1) {
  const ret = arg0[arg1 >>> 0];
  return ret;
}
function __wbg_get_458e874b43b18b25() {
  return handleError(function(arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
  }, arguments);
}
function __wbg_instanceof_ArrayBuffer_67f3012529f6a2dd(arg0) {
  let result;
  try {
    result = arg0 instanceof ArrayBuffer;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_instanceof_Date_c0cdff0c3b978b0e(arg0) {
  let result;
  try {
    result = arg0 instanceof Date;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_instanceof_Object_fbf5fef4952ff29b(arg0) {
  let result;
  try {
    result = arg0 instanceof Object;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_instanceof_Uint8Array_9a8378d955933db7(arg0) {
  let result;
  try {
    result = arg0 instanceof Uint8Array;
  } catch (_) {
    result = false;
  }
  const ret = result;
  return ret;
}
function __wbg_isArray_030cce220591fb41(arg0) {
  const ret = Array.isArray(arg0);
  return ret;
}
function __wbg_isArray_52653600d4b65388(arg0) {
  const ret = Array.isArray(arg0);
  return ret;
}
function __wbg_iterator_f370b34483c71a1c() {
  const ret = Symbol.iterator;
  return ret;
}
function __wbg_keys_ef52390b2ae0e714(arg0) {
  const ret = Object.keys(arg0);
  return ret;
}
function __wbg_length_186546c51cd61acd(arg0) {
  const ret = arg0.length;
  return ret;
}
function __wbg_length_6bb7e81f9d7713e4(arg0) {
  const ret = arg0.length;
  return ret;
}
function __wbg_length_9d771c54845e987f(arg0) {
  const ret = arg0.length;
  return ret;
}
function __wbg_log_6c7b5f4f00b8ce3f(arg0) {
  console.log(arg0);
}
function __wbg_log_7917fde260a8fd39(arg0, arg1) {
  console.log(arg0, arg1);
}
function __wbg_new_19c25a3f2fa63a02() {
  const ret = new Object();
  return ret;
}
function __wbg_new_1f3a344cf3123716() {
  const ret = new Array();
  return ret;
}
function __wbg_new_5a2ae4557f92b50e(arg0) {
  const ret = new Date(arg0);
  return ret;
}
function __wbg_new_638ebfaedbf32a5e(arg0) {
  const ret = new Uint8Array(arg0);
  return ret;
}
function __wbg_new_8a6f238a6ece86ea() {
  const ret = new Error();
  return ret;
}
function __wbg_new_da9dc54c5db29dfa(arg0, arg1) {
  const ret = new Error(getStringFromWasm02(arg0, arg1));
  return ret;
}
function __wbg_new_ef4f9056d946f38b(arg0, arg1) {
  const ret = new RangeError(getStringFromWasm02(arg0, arg1));
  return ret;
}
function __wbg_newfromslice_074c56947bd43469(arg0, arg1) {
  const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
  return ret;
}
function __wbg_next_5b3530e612fde77d(arg0) {
  const ret = arg0.next;
  return ret;
}
function __wbg_next_692e82279131b03c() {
  return handleError(function(arg0) {
    const ret = arg0.next();
    return ret;
  }, arguments);
}
function __wbg_ownKeys_36e096e00ffe2676() {
  return handleError(function(arg0) {
    const ret = Reflect.ownKeys(arg0);
    return ret;
  }, arguments);
}
function __wbg_prototypesetcall_3d4a26c1ed734349(arg0, arg1, arg2) {
  Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
}
function __wbg_push_330b2eb93e4e1212(arg0, arg1) {
  const ret = arg0.push(arg1);
  return ret;
}
function __wbg_set_3f1d0b984ed272ed(arg0, arg1, arg2) {
  arg0[arg1] = arg2;
}
function __wbg_set_453345bcda80b89a() {
  return handleError(function(arg0, arg1, arg2) {
    const ret = Reflect.set(arg0, arg1, arg2);
    return ret;
  }, arguments);
}
function __wbg_set_90f6c0f7bd8c0415(arg0, arg1, arg2) {
  arg0[arg1 >>> 0] = arg2;
}
function __wbg_slice_974daea329f5c01d(arg0, arg1, arg2) {
  const ret = arg0.slice(arg1 >>> 0, arg2 >>> 0);
  return ret;
}
function __wbg_stack_0ed75d68575b0f3c(arg0, arg1) {
  const ret = arg1.stack;
  const ptr1 = passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_stringify_4a34a65f0d4e236f(arg0, arg1) {
  const ret = JSON.stringify(arg1);
  var ptr1 = isLikeNone2(ret) ? 0 : passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  var len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_toString_1f1286a7a97689fe(arg0, arg1, arg2) {
  const ret = arg1.toString(arg2);
  const ptr1 = passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_toString_7268338f40012a03() {
  return handleError(function(arg0, arg1) {
    const ret = arg0.toString(arg1);
    return ret;
  }, arguments);
}
function __wbg_toString_ea9a6b07f936eb86(arg0) {
  const ret = arg0.toString();
  return ret;
}
function __wbg_unshift_18d353edeebf9a72(arg0, arg1) {
  const ret = arg0.unshift(arg1);
  return ret;
}
function __wbg_value_dd9372230531eade(arg0) {
  const ret = arg0.value;
  return ret;
}
function __wbg_values_a574c29011369bea(arg0) {
  const ret = Object.values(arg0);
  return ret;
}
function __wbg_wbindgenbooleanget_3fe6f642c7d97746(arg0) {
  const v = arg0;
  const ret = typeof v === "boolean" ? v : void 0;
  return isLikeNone2(ret) ? 16777215 : ret ? 1 : 0;
}
function __wbg_wbindgendebugstring_99ef257a3ddda34d(arg0, arg1) {
  const ret = debugString(arg1);
  const ptr1 = passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_wbindgengt_5d4c5d18810de162(arg0, arg1) {
  const ret = arg0 > arg1;
  return ret;
}
function __wbg_wbindgenisbigint_ecb90cc08a5a9154(arg0) {
  const ret = typeof arg0 === "bigint";
  return ret;
}
function __wbg_wbindgenisfunction_8cee7dce3725ae74(arg0) {
  const ret = typeof arg0 === "function";
  return ret;
}
function __wbg_wbindgenisnull_f3037694abe4d97a(arg0) {
  const ret = arg0 === null;
  return ret;
}
function __wbg_wbindgenisobject_307a53c6bd97fbf8(arg0) {
  const val = arg0;
  const ret = typeof val === "object" && val !== null;
  return ret;
}
function __wbg_wbindgenisstring_d4fa939789f003b0(arg0) {
  const ret = typeof arg0 === "string";
  return ret;
}
function __wbg_wbindgenisundefined_c4b71d073b92f3c5(arg0) {
  const ret = arg0 === void 0;
  return ret;
}
function __wbg_wbindgenjsvallooseeq_9bec8c9be826bed1(arg0, arg1) {
  const ret = arg0 == arg1;
  return ret;
}
function __wbg_wbindgenlt_544155a2b3097bd5(arg0, arg1) {
  const ret = arg0 < arg1;
  return ret;
}
function __wbg_wbindgenneg_3577d8a6fd6fd98b(arg0) {
  const ret = -arg0;
  return ret;
}
function __wbg_wbindgennumberget_f74b4c7525ac05cb(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === "number" ? obj : void 0;
  getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone2(ret) ? 0 : ret, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone2(ret), true);
}
function __wbg_wbindgenstringget_0f16a6ddddef376f(arg0, arg1) {
  const obj = arg1;
  const ret = typeof obj === "string" ? obj : void 0;
  var ptr1 = isLikeNone2(ret) ? 0 : passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  var len1 = WASM_VECTOR_LEN2;
  getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
  getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
function __wbg_wbindgenthrow_451ec1a8469d7eb6(arg0, arg1) {
  throw new Error(getStringFromWasm02(arg0, arg1));
}
function __wbindgen_cast_2241b6af4c4b2941(arg0, arg1) {
  const ret = getStringFromWasm02(arg0, arg1);
  return ret;
}
function __wbindgen_cast_4625c577ab2ec9ee(arg0) {
  const ret = BigInt.asUintN(64, arg0);
  return ret;
}
function __wbindgen_cast_9ae0607507abb057(arg0) {
  const ret = arg0;
  return ret;
}
function __wbindgen_cast_d6cd19b81560fd6e(arg0) {
  const ret = arg0;
  return ret;
}
function __wbindgen_init_externref_table() {
  const table = wasm2.__wbindgen_export_4;
  const offset = table.grow(4);
  table.set(0, void 0);
  table.set(offset + 0, void 0);
  table.set(offset + 1, null);
  table.set(offset + 2, true);
  table.set(offset + 3, false);
  ;
}

// node_modules/@automerge/automerge/dist/mjs/wasm_bindgen_output/bundler/automerge_wasm.js
__wbg_set_wasm2(wasm_stub_exports);
__wbindgen_start();

// node_modules/@automerge/automerge/dist/mjs/constants.js
var STATE = /* @__PURE__ */ Symbol.for("_am_meta");
var TRACE = /* @__PURE__ */ Symbol.for("_am_trace");
var OBJECT_ID = /* @__PURE__ */ Symbol.for("_am_objectId");
var IS_PROXY = /* @__PURE__ */ Symbol.for("_am_isProxy");
var CLEAR_CACHE = /* @__PURE__ */ Symbol.for("_am_clearCache");
var UINT = /* @__PURE__ */ Symbol.for("_am_uint");
var INT = /* @__PURE__ */ Symbol.for("_am_int");
var F64 = /* @__PURE__ */ Symbol.for("_am_f64");
var COUNTER = /* @__PURE__ */ Symbol.for("_am_counter");
var IMMUTABLE_STRING = /* @__PURE__ */ Symbol.for("_am_immutableString");

// node_modules/@automerge/automerge/dist/mjs/counter.js
var Counter = class {
  constructor(value) {
    this.value = value || 0;
    Reflect.defineProperty(this, COUNTER, { value: true });
  }
  /**
   * A peculiar JavaScript language feature from its early days: if the object
   * `x` has a `valueOf()` method that returns a number, you can use numerical
   * operators on the object `x` directly, such as `x + 1` or `x < 4`.
   * This method is also called when coercing a value to a string by
   * concatenating it with another string, as in `x + ''`.
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf
   */
  valueOf() {
    return this.value;
  }
  /**
   * Returns the counter value as a decimal string. If `x` is a counter object,
   * this method is called e.g. when you do `['value: ', x].join('')` or when
   * you use string interpolation: `value: ${x}`.
   */
  toString() {
    return this.valueOf().toString();
  }
  /**
   * Returns the counter value, so that a JSON serialization of an Automerge
   * document represents the counter simply as an integer.
   */
  toJSON() {
    return this.value;
  }
  /**
   * Increases the value of the counter by `delta`. If `delta` is not given,
   * increases the value of the counter by 1.
   *
   * Will throw an error if used outside of a change callback.
   */
  increment(_delta) {
    throw new Error("Counters should not be incremented outside of a change callback");
  }
  /**
   * Decreases the value of the counter by `delta`. If `delta` is not given,
   * decreases the value of the counter by 1.
   *
   * Will throw an error if used outside of a change callback.
   */
  decrement(_delta) {
    throw new Error("Counters should not be decremented outside of a change callback");
  }
};
var WriteableCounter = class extends Counter {
  constructor(value, context, path, objectId, key) {
    super(value);
    this.context = context;
    this.path = path;
    this.objectId = objectId;
    this.key = key;
  }
  /**
   * Increases the value of the counter by `delta`. If `delta` is not given,
   * increases the value of the counter by 1.
   */
  increment(delta) {
    delta = typeof delta === "number" ? delta : 1;
    this.context.increment(this.objectId, this.key, delta);
    this.value += delta;
    return this.value;
  }
  /**
   * Decreases the value of the counter by `delta`. If `delta` is not given,
   * decreases the value of the counter by 1.
   */
  decrement(delta) {
    return this.increment(typeof delta === "number" ? -delta : -1);
  }
};
function getWriteableCounter(value, context, path, objectId, key) {
  return new WriteableCounter(value, context, path, objectId, key);
}

// node_modules/@automerge/automerge/dist/mjs/immutable_string.js
var _a;
var ImmutableString = class {
  constructor(val) {
    this[_a] = true;
    this.val = val;
  }
  /**
   * Returns the content of the ImmutableString object as a simple string
   */
  toString() {
    return this.val;
  }
  toJSON() {
    return this.val;
  }
};
_a = IMMUTABLE_STRING;

// node_modules/@automerge/automerge/dist/mjs/proxies.js
var MAX_I64 = BigInt("9223372036854775807");
function parseListIndex(key) {
  if (typeof key === "string" && /^[0-9]+$/.test(key))
    key = parseInt(key, 10);
  if (typeof key !== "number") {
    return key;
  }
  if (key < 0 || isNaN(key) || key === Infinity || key === -Infinity) {
    throw new RangeError("A list index must be positive, but you passed " + key);
  }
  return key;
}
function valueAt(target, prop) {
  const { context, objectId, path } = target;
  const value = context.getWithType(objectId, prop);
  if (value === null) {
    return;
  }
  const datatype = value[0];
  const val = value[1];
  switch (datatype) {
    case void 0:
      return;
    case "map":
      return mapProxy(context, val, [...path, prop]);
    case "list":
      return listProxy(context, val, [...path, prop]);
    case "text":
      return context.text(val);
    case "str":
      return new ImmutableString(val);
    case "uint":
      return val;
    case "int":
      return val;
    case "f64":
      return val;
    case "boolean":
      return val;
    case "null":
      return null;
    case "bytes":
      return val;
    case "timestamp":
      return val;
    case "counter": {
      const counter = getWriteableCounter(val, context, path, objectId, prop);
      return counter;
    }
    default:
      throw RangeError(`datatype ${datatype} unimplemented`);
  }
}
function import_value(value, path, context) {
  const type = typeof value;
  switch (type) {
    case "object":
      if (value == null) {
        return [null, "null"];
      } else if (value[UINT]) {
        return [value.value, "uint"];
      } else if (value[INT]) {
        return [value.value, "int"];
      } else if (value[F64]) {
        return [value.value, "f64"];
      } else if (value[COUNTER]) {
        return [value.value, "counter"];
      } else if (value instanceof Date) {
        return [value.getTime(), "timestamp"];
      } else if (isImmutableString(value)) {
        return [value.toString(), "str"];
      } else if (value instanceof Uint8Array) {
        return [value, "bytes"];
      } else if (value instanceof Array) {
        return [value, "list"];
      } else if (Object.prototype.toString.call(value) === "[object Object]") {
        return [value, "map"];
      } else if (isSameDocument(value, context)) {
        throw new RangeError("Cannot create a reference to an existing document object");
      } else {
        throw new RangeError(`Cannot assign unknown object: ${value}`);
      }
    case "boolean":
      return [value, "boolean"];
    case "bigint":
      if (value > MAX_I64) {
        return [value, "uint"];
      } else {
        return [value, "int"];
      }
    case "number":
      if (Number.isInteger(value)) {
        return [value, "int"];
      } else {
        return [value, "f64"];
      }
    case "string":
      return [value, "text"];
    case "undefined":
      throw new RangeError([
        `Cannot assign undefined value at ${printPath(path)}, `,
        "because `undefined` is not a valid JSON data type. ",
        "You might consider setting the property's value to `null`, ",
        "or using `delete` to remove it altogether."
      ].join(""));
    default:
      throw new RangeError([
        `Cannot assign ${type} value at ${printPath(path)}. `,
        `All JSON primitive datatypes (object, array, string, number, boolean, null) `,
        `are supported in an Automerge document; ${type} values are not. `
      ].join(""));
  }
}
function isSameDocument(val, context) {
  var _b, _c;
  if (val instanceof Date) {
    return false;
  }
  if (val && ((_c = (_b = val[STATE]) === null || _b === void 0 ? void 0 : _b.handle) === null || _c === void 0 ? void 0 : _c.__wbg_ptr) === context.__wbg_ptr) {
    return true;
  }
  return false;
}
var MapHandler = {
  get(target, key) {
    const { context, objectId, cache } = target;
    if (key === Symbol.toStringTag) {
      return target[Symbol.toStringTag];
    }
    if (key === OBJECT_ID)
      return objectId;
    if (key === IS_PROXY)
      return true;
    if (key === TRACE)
      return target.trace;
    if (key === STATE)
      return { handle: context };
    if (!cache[key]) {
      cache[key] = valueAt(target, key);
    }
    return cache[key];
  },
  set(target, key, val) {
    const { context, objectId, path } = target;
    target.cache = {};
    if (isSameDocument(val, context)) {
      throw new RangeError("Cannot create a reference to an existing document object");
    }
    if (key === TRACE) {
      target.trace = val;
      return true;
    }
    if (key === CLEAR_CACHE) {
      return true;
    }
    const [value, datatype] = import_value(val, [...path, key], context);
    switch (datatype) {
      case "list": {
        const list = context.putObject(objectId, key, []);
        const proxyList = listProxy(context, list, [...path, key]);
        for (let i = 0; i < value.length; i++) {
          proxyList[i] = value[i];
        }
        break;
      }
      case "text": {
        context.putObject(objectId, key, value);
        break;
      }
      case "map": {
        const map = context.putObject(objectId, key, {});
        const proxyMap = mapProxy(context, map, [...path, key]);
        for (const key2 in value) {
          proxyMap[key2] = value[key2];
        }
        break;
      }
      default:
        context.put(objectId, key, value, datatype);
    }
    return true;
  },
  deleteProperty(target, key) {
    const { context, objectId } = target;
    target.cache = {};
    context.delete(objectId, key);
    return true;
  },
  has(target, key) {
    const value = this.get(target, key);
    return value !== void 0;
  },
  getOwnPropertyDescriptor(target, key) {
    const value = this.get(target, key);
    if (typeof value !== "undefined") {
      return {
        configurable: true,
        enumerable: true,
        value
      };
    }
  },
  ownKeys(target) {
    const { context, objectId } = target;
    const keys = context.keys(objectId);
    return [...new Set(keys)];
  }
};
var ListHandler = {
  get(target, index) {
    const { context, objectId } = target;
    index = parseListIndex(index);
    if (index === Symbol.hasInstance) {
      return (instance) => {
        return Array.isArray(instance);
      };
    }
    if (index === Symbol.toStringTag) {
      return target[Symbol.toStringTag];
    }
    if (index === OBJECT_ID)
      return objectId;
    if (index === IS_PROXY)
      return true;
    if (index === TRACE)
      return target.trace;
    if (index === STATE)
      return { handle: context };
    if (index === "length")
      return context.length(objectId);
    if (typeof index === "number") {
      return valueAt(target, index);
    } else {
      return listMethods(target)[index];
    }
  },
  set(target, index, val) {
    const { context, objectId, path } = target;
    index = parseListIndex(index);
    if (isSameDocument(val, context)) {
      throw new RangeError("Cannot create a reference to an existing document object");
    }
    if (index === CLEAR_CACHE) {
      return true;
    }
    if (index === TRACE) {
      target.trace = val;
      return true;
    }
    if (typeof index == "string") {
      throw new RangeError("list index must be a number");
    }
    const [value, datatype] = import_value(val, [...path, index], context);
    switch (datatype) {
      case "list": {
        let list;
        if (index >= context.length(objectId)) {
          list = context.insertObject(objectId, index, []);
        } else {
          list = context.putObject(objectId, index, []);
        }
        const proxyList = listProxy(context, list, [...path, index]);
        proxyList.splice(0, 0, ...value);
        break;
      }
      case "text": {
        if (index >= context.length(objectId)) {
          context.insertObject(objectId, index, value);
        } else {
          context.putObject(objectId, index, value);
        }
        break;
      }
      case "map": {
        let map;
        if (index >= context.length(objectId)) {
          map = context.insertObject(objectId, index, {});
        } else {
          map = context.putObject(objectId, index, {});
        }
        const proxyMap = mapProxy(context, map, [...path, index]);
        for (const key in value) {
          proxyMap[key] = value[key];
        }
        break;
      }
      default:
        if (index >= context.length(objectId)) {
          context.insert(objectId, index, value, datatype);
        } else {
          context.put(objectId, index, value, datatype);
        }
    }
    return true;
  },
  deleteProperty(target, index) {
    const { context, objectId } = target;
    index = parseListIndex(index);
    const elem = context.get(objectId, index);
    if (elem != null && elem[0] == "counter") {
      throw new TypeError("Unsupported operation: deleting a counter from a list");
    }
    context.delete(objectId, index);
    return true;
  },
  has(target, index) {
    const { context, objectId } = target;
    index = parseListIndex(index);
    if (typeof index === "number") {
      return index < context.length(objectId);
    }
    return index === "length";
  },
  getOwnPropertyDescriptor(target, index) {
    const { context, objectId } = target;
    if (index === "length")
      return { writable: true, value: context.length(objectId) };
    if (index === OBJECT_ID)
      return { configurable: false, enumerable: false, value: objectId };
    index = parseListIndex(index);
    const value = valueAt(target, index);
    return { configurable: true, enumerable: true, value };
  },
  getPrototypeOf(target) {
    return Object.getPrototypeOf(target);
  },
  ownKeys() {
    const keys = [];
    keys.push("length");
    return keys;
  }
};
function mapProxy(context, objectId, path) {
  const target = {
    context,
    objectId,
    path: path || [],
    cache: {}
  };
  const proxied = {};
  Object.assign(proxied, target);
  const result = new Proxy(proxied, MapHandler);
  return result;
}
function listProxy(context, objectId, path) {
  const target = {
    context,
    objectId,
    path: path || [],
    cache: {}
  };
  const proxied = [];
  Object.assign(proxied, target);
  return new Proxy(proxied, ListHandler);
}
function rootProxy(context) {
  return mapProxy(context, "_root", []);
}
function listMethods(target) {
  const { context, objectId, path } = target;
  const methods = {
    at(index) {
      return valueAt(target, index);
    },
    deleteAt(index, numDelete) {
      if (typeof numDelete === "number") {
        context.splice(objectId, index, numDelete);
      } else {
        context.delete(objectId, index);
      }
      return this;
    },
    fill(val, start, end) {
      const [value, datatype] = import_value(val, [...path, start], context);
      const length = context.length(objectId);
      start = parseListIndex(start || 0);
      end = parseListIndex(end || length);
      for (let i = start; i < Math.min(end, length); i++) {
        if (datatype === "list" || datatype === "map") {
          context.putObject(objectId, i, value);
        } else if (datatype === "text") {
          context.putObject(objectId, i, value);
        } else {
          context.put(objectId, i, value, datatype);
        }
      }
      return this;
    },
    indexOf(searchElement, start = 0) {
      const length = context.length(objectId);
      for (let i = start; i < length; i++) {
        const valueWithType = context.getWithType(objectId, i);
        if (!valueWithType) {
          continue;
        }
        const [valType, value] = valueWithType;
        const isObject = ["map", "list", "text"].includes(valType);
        if (!isObject) {
          if (value === searchElement) {
            return i;
          } else {
            continue;
          }
        }
        if (valType === "text" && typeof searchElement === "string") {
          if (searchElement === valueAt(target, i)) {
            return i;
          }
        }
        if (searchElement[OBJECT_ID] === value) {
          return i;
        }
      }
      return -1;
    },
    insertAt(index, ...values) {
      this.splice(index, 0, ...values);
      return this;
    },
    pop() {
      const length = context.length(objectId);
      if (length == 0) {
        return void 0;
      }
      const last = valueAt(target, length - 1);
      context.delete(objectId, length - 1);
      return last;
    },
    push(...values) {
      const len = context.length(objectId);
      this.splice(len, 0, ...values);
      return context.length(objectId);
    },
    shift() {
      if (context.length(objectId) == 0)
        return;
      const first = valueAt(target, 0);
      context.delete(objectId, 0);
      return first;
    },
    splice(index, del, ...vals) {
      index = parseListIndex(index);
      if (typeof del !== "number") {
        del = context.length(objectId) - index;
      }
      del = parseListIndex(del);
      for (const val of vals) {
        if (isSameDocument(val, context)) {
          throw new RangeError("Cannot create a reference to an existing document object");
        }
      }
      const result = [];
      for (let i = 0; i < del; i++) {
        const value = valueAt(target, index);
        if (value !== void 0) {
          result.push(value);
        }
        context.delete(objectId, index);
      }
      const values = vals.map((val, index2) => {
        try {
          return import_value(val, [...path], context);
        } catch (e) {
          if (e instanceof RangeError) {
            throw new RangeError(`${e.message} (at index ${index2} in the input)`);
          } else {
            throw e;
          }
        }
      });
      for (const [value, datatype] of values) {
        switch (datatype) {
          case "list": {
            const list = context.insertObject(objectId, index, []);
            const proxyList = listProxy(context, list, [...path, index]);
            proxyList.splice(0, 0, ...value);
            break;
          }
          case "text": {
            context.insertObject(objectId, index, value);
            break;
          }
          case "map": {
            const map = context.insertObject(objectId, index, {});
            const proxyMap = mapProxy(context, map, [...path, index]);
            for (const key in value) {
              proxyMap[key] = value[key];
            }
            break;
          }
          default:
            context.insert(objectId, index, value, datatype);
        }
        index += 1;
      }
      return result;
    },
    unshift(...values) {
      this.splice(0, 0, ...values);
      return context.length(objectId);
    },
    entries() {
      let i = 0;
      const iterator = {
        next: () => {
          const value = valueAt(target, i);
          if (value === void 0) {
            return { value: void 0, done: true };
          } else {
            return { value: [i++, value], done: false };
          }
        },
        [Symbol.iterator]() {
          return this;
        }
      };
      return iterator;
    },
    keys() {
      let i = 0;
      const len = context.length(objectId);
      const iterator = {
        next: () => {
          if (i < len) {
            return { value: i++, done: false };
          }
          return { value: void 0, done: true };
        },
        [Symbol.iterator]() {
          return this;
        }
      };
      return iterator;
    },
    values() {
      let i = 0;
      const iterator = {
        next: () => {
          const value = valueAt(target, i++);
          if (value === void 0) {
            return { value: void 0, done: true };
          } else {
            return { value, done: false };
          }
        },
        [Symbol.iterator]() {
          return this;
        }
      };
      return iterator;
    },
    toArray() {
      const list = [];
      let value;
      do {
        value = valueAt(target, list.length);
        if (value !== void 0) {
          list.push(value);
        }
      } while (value !== void 0);
      return list;
    },
    map(f) {
      return this.toArray().map(f);
    },
    toString() {
      return this.toArray().toString();
    },
    toLocaleString() {
      return this.toArray().toLocaleString();
    },
    forEach(f) {
      return this.toArray().forEach(f);
    },
    // todo: real concat function is different
    concat(other) {
      return this.toArray().concat(other);
    },
    every(f) {
      return this.toArray().every(f);
    },
    filter(f) {
      return this.toArray().filter(f);
    },
    find(f) {
      let index = 0;
      for (const v of this) {
        if (f(v, index)) {
          return v;
        }
        index += 1;
      }
    },
    findIndex(f) {
      let index = 0;
      for (const v of this) {
        if (f(v, index)) {
          return index;
        }
        index += 1;
      }
      return -1;
    },
    includes(elem) {
      return this.find((e) => e === elem) !== void 0;
    },
    join(sep) {
      return this.toArray().join(sep);
    },
    reduce(f, initialValue) {
      return this.toArray().reduce(f, initialValue);
    },
    reduceRight(f, initialValue) {
      return this.toArray().reduceRight(f, initialValue);
    },
    lastIndexOf(search, fromIndex = Infinity) {
      return this.toArray().lastIndexOf(search, fromIndex);
    },
    slice(index, num) {
      return this.toArray().slice(index, num);
    },
    some(f) {
      let index = 0;
      for (const v of this) {
        if (f(v, index)) {
          return true;
        }
        index += 1;
      }
      return false;
    },
    [Symbol.iterator]: function* () {
      let i = 0;
      let value = valueAt(target, i);
      while (value !== void 0) {
        yield value;
        i += 1;
        value = valueAt(target, i);
      }
    }
  };
  return methods;
}
function printPath(path) {
  const jsonPointerComponents = path.map((component) => {
    if (typeof component === "number") {
      return component.toString();
    } else if (typeof component === "string") {
      return component.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  });
  if (path.length === 0) {
    return "";
  } else {
    return "/" + jsonPointerComponents.join("/");
  }
}
function isImmutableString(obj) {
  return typeof obj === "object" && obj !== null && Object.prototype.hasOwnProperty.call(obj, IMMUTABLE_STRING);
}

// node_modules/@automerge/automerge/dist/mjs/internal_state.js
function _state(doc, checkroot = true) {
  if (typeof doc !== "object") {
    throw new RangeError("must be the document root");
  }
  const state2 = Reflect.get(doc, STATE);
  if (state2 === void 0 || state2 == null || checkroot && _obj(doc) !== "_root") {
    throw new RangeError("must be the document root");
  }
  return state2;
}
function _trace(doc) {
  return Reflect.get(doc, TRACE);
}
function _obj(doc) {
  if (!(typeof doc === "object") || doc === null) {
    return null;
  }
  return Reflect.get(doc, OBJECT_ID);
}
function _is_proxy(doc) {
  return !!Reflect.get(doc, IS_PROXY);
}

// node_modules/@automerge/automerge/dist/mjs/implementation.js
function importOpts(_actor) {
  if (typeof _actor === "object") {
    return _actor;
  } else {
    return { actor: _actor };
  }
}
function init(_opts) {
  const opts = importOpts(_opts);
  const freeze = !!opts.freeze;
  const patchCallback = opts.patchCallback;
  const actor = opts.actor;
  const handle = ApiHandler.create({ actor });
  handle.enableFreeze(!!opts.freeze);
  registerDatatypes(handle);
  const doc = handle.materialize("/", void 0, {
    handle,
    heads: void 0,
    freeze,
    patchCallback
  });
  return doc;
}
function from(initialState, _opts) {
  return _change(init(_opts), "from", {}, (d) => Object.assign(d, initialState)).newDoc;
}
function change(doc, options, callback) {
  if (typeof options === "function") {
    return _change(doc, "change", {}, options).newDoc;
  } else if (typeof callback === "function") {
    if (typeof options === "string") {
      options = { message: options };
    }
    return _change(doc, "change", options, callback).newDoc;
  } else {
    throw RangeError("Invalid args for change");
  }
}
function progressDocument(doc, source, heads, callback) {
  if (heads == null) {
    return doc;
  }
  const state2 = _state(doc);
  const nextState = Object.assign(Object.assign({}, state2), { heads: void 0 });
  const { value: nextDoc, patches } = state2.handle.applyAndReturnPatches(doc, nextState);
  if (patches.length > 0) {
    if (callback != null) {
      callback(patches, { before: doc, after: nextDoc, source });
    }
    const newState = _state(nextDoc);
    newState.mostRecentPatch = {
      before: _state(doc).heads,
      after: newState.handle.getHeads(),
      patches
    };
  }
  state2.heads = heads;
  return nextDoc;
}
function _change(doc, source, options, callback, scope) {
  if (typeof callback !== "function") {
    throw new RangeError("invalid change function");
  }
  const state2 = _state(doc);
  if (doc === void 0 || state2 === void 0) {
    throw new RangeError("must be the document root");
  }
  if (state2.heads) {
    throw new RangeError("Attempting to change an outdated document.  Use Automerge.clone() if you wish to make a writable copy.");
  }
  if (_is_proxy(doc)) {
    throw new RangeError("Calls to Automerge.change cannot be nested");
  }
  let heads = state2.handle.getHeads();
  if (scope && headsEqual(scope, heads)) {
    scope = void 0;
  }
  if (scope) {
    state2.handle.isolate(scope);
    heads = scope;
  }
  if (!("time" in options)) {
    options.time = Math.floor(Date.now() / 1e3);
  }
  try {
    state2.heads = heads;
    const root = rootProxy(state2.handle);
    callback(root);
    if (state2.handle.pendingOps() === 0) {
      state2.heads = void 0;
      if (scope) {
        state2.handle.integrate();
      }
      return {
        newDoc: doc,
        newHeads: null
      };
    } else {
      const newHead = state2.handle.commit(options.message, options.time);
      state2.handle.integrate();
      return {
        newDoc: progressDocument(doc, source, heads, options.patchCallback || state2.patchCallback),
        newHeads: newHead != null ? [newHead] : null
      };
    }
  } catch (e) {
    state2.heads = void 0;
    state2.handle.rollback();
    throw e;
  }
}
function load2(data, _opts) {
  const opts = importOpts(_opts);
  if (opts.patchCallback) {
    return loadIncremental(init(opts), data);
  }
  const actor = opts.actor;
  const patchCallback = opts.patchCallback;
  const unchecked = opts.unchecked || false;
  const allowMissingDeps = opts.allowMissingChanges || false;
  const convertImmutableStringsToText = opts.convertImmutableStringsToText || false;
  const handle = ApiHandler.load(data, {
    actor,
    unchecked,
    allowMissingDeps,
    convertImmutableStringsToText
  });
  handle.enableFreeze(!!opts.freeze);
  registerDatatypes(handle);
  const doc = handle.materialize("/", void 0, {
    handle,
    heads: void 0,
    patchCallback
  });
  return doc;
}
function loadIncremental(doc, data, opts) {
  if (!opts) {
    opts = {};
  }
  const state2 = _state(doc);
  if (state2.heads) {
    throw new RangeError("Attempting to change an out of date document - set at: " + _trace(doc));
  }
  if (_is_proxy(doc)) {
    throw new RangeError("Calls to Automerge.change cannot be nested");
  }
  const heads = state2.handle.getHeads();
  state2.handle.loadIncremental(data);
  return progressDocument(doc, "loadIncremental", heads, opts.patchCallback || state2.patchCallback);
}
function save(doc) {
  return _state(doc).handle.save();
}
function merge(local, remote) {
  const localState = _state(local);
  if (localState.heads) {
    throw new RangeError("Attempting to change an out of date document - set at: " + _trace(local));
  }
  const heads = localState.handle.getHeads();
  const remoteState = _state(remote);
  const changes = localState.handle.getChangesAdded(remoteState.handle);
  localState.handle.applyChanges(changes);
  return progressDocument(local, "merge", heads, localState.patchCallback);
}
function headsEqual(heads1, heads2) {
  if (heads1.length !== heads2.length) {
    return false;
  }
  for (let i = 0; i < heads1.length; i++) {
    if (heads1[i] !== heads2[i]) {
      return false;
    }
  }
  return true;
}
function generateSyncMessage(doc, inState) {
  const state2 = _state(doc);
  const syncState = ApiHandler.importSyncState(inState);
  const message = state2.handle.generateSyncMessage(syncState);
  const outState = ApiHandler.exportSyncState(syncState);
  return [outState, message];
}
function receiveSyncMessage(doc, inState, message, opts) {
  const syncState = ApiHandler.importSyncState(inState);
  if (!opts) {
    opts = {};
  }
  const state2 = _state(doc);
  if (state2.heads) {
    throw new RangeError("Attempting to change an outdated document.  Use Automerge.clone() if you wish to make a writable copy.");
  }
  if (_is_proxy(doc)) {
    throw new RangeError("Calls to Automerge.change cannot be nested");
  }
  const heads = state2.handle.getHeads();
  state2.handle.receiveSyncMessage(syncState, message);
  const outSyncState = ApiHandler.exportSyncState(syncState);
  return [
    progressDocument(doc, "receiveSyncMessage", heads, opts.patchCallback || state2.patchCallback),
    outSyncState,
    null
  ];
}
function initSyncState2() {
  return ApiHandler.exportSyncState(ApiHandler.initSyncState());
}
function registerDatatypes(handle) {
  handle.registerDatatype("counter", (n) => new Counter(n), (n) => {
    if (n instanceof Counter) {
      return n.value;
    }
  });
  handle.registerDatatype("str", (n) => {
    return new ImmutableString(n);
  }, (s) => {
    if (isImmutableString(s)) {
      return s.val;
    }
  });
}

// node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_bundler.js
UseApi(automerge_wasm_exports2);

// core/Chronicle.ts
init_events();
var import_node_buffer = __toESM(require_buffer(), 1);
var Chronicle = class extends Emitter {
  constructor(initialState) {
    super();
    __publicField(this, "_doc");
    this._doc = initialState ? from(initialState) : init();
  }
  get state() {
    return this._doc;
  }
  // Modified to accept an optional source
  change(message, callback, source = "local") {
    const newDoc = change(this._doc, message, callback);
    this._doc = newDoc;
    this.emit("state:changed", { doc: newDoc, source });
  }
  // Modified to accept an optional source
  update(newDoc, source = "local") {
    this._doc = newDoc;
    this.emit("state:changed", { doc: this._doc, source });
  }
  // ... (merge, save, load methods remain the same)
  merge(remoteDoc) {
    this._doc = merge(this._doc, remoteDoc);
    this.emit("state:changed", { doc: this._doc, source: "merge" });
  }
  save() {
    return save(this._doc);
  }
  load(binary) {
    this._doc = load2(binary);
    this.emit("state:changed", { doc: this._doc, source: "load" });
  }
  saveToBase64() {
    const bytes = this.save();
    return import_node_buffer.Buffer.from(bytes).toString("base64");
  }
  loadFromBase64(base64) {
    const bytes = new Uint8Array(import_node_buffer.Buffer.from(base64, "base64"));
    this.load(bytes);
  }
  // Sync protocol — used by ConsensusCore via IChronicle
  initSyncState() {
    return initSyncState2();
  }
  generateSyncMessage(syncState) {
    const [nextSyncState, message] = generateSyncMessage(this._doc, syncState);
    return { nextSyncState, message };
  }
  receiveSyncMessage(syncState, message, source = "sync") {
    const [newDoc, nextSyncState] = receiveSyncMessage(this._doc, syncState, message);
    this._doc = newDoc;
    this.emit("state:changed", { doc: this._doc, source });
    return { nextSyncState };
  }
};

// engine/GameLoop.ts
init_events();
var GameLoop = class extends Emitter {
  constructor(engine, { maxTurns = Infinity, delay = 0 } = {}) {
    super();
    __publicField(this, "engine");
    __publicField(this, "delay");
    // Track previous state to detect changes (initialized to match default CRDT state
    // so the first _syncState() call does not fire spurious events)
    __publicField(this, "_lastState", {
      turn: 0,
      running: false,
      activeAgentIndex: -1,
      phase: "setup"
    });
    this.engine = engine;
    this.delay = delay;
    if (!this.engine.session.state.gameLoop) {
      this.engine.dispatch("game:loopInit", { maxTurns });
    }
    this.engine.on("state:updated", () => this._syncState());
    this._syncState();
  }
  // --- STATE GETTERS (always read through engine.session, never a stored ref) ---
  get turn() {
    return this.engine.session.state.gameLoop?.turn ?? 0;
  }
  get running() {
    return this.engine.session.state.gameLoop?.running ?? false;
  }
  get activeAgentIndex() {
    return this.engine.session.state.gameLoop?.activeAgentIndex ?? -1;
  }
  get phase() {
    return this.engine.session.state.gameLoop?.phase ?? "setup";
  }
  get maxTurns() {
    return this.engine.session.state.gameLoop?.maxTurns ?? Infinity;
  }
  set maxTurns(value) {
    this.engine.dispatch("game:setMaxTurns", { maxTurns: value });
  }
  // --- REACTIVE SYNC ---
  _syncState() {
    const current = this.engine.session.state.gameLoop;
    if (!current) return;
    if (this._lastState.running && !current.running) {
      this.emit("loop:stop", {
        payload: { reason: "state_change", phase: current.phase, turn: current.turn }
      });
    }
    if (!this._lastState.running && current.running) {
      this.emit("loop:start", { payload: { turn: current.turn } });
    }
    if (current.turn !== this._lastState.turn || current.activeAgentIndex !== this._lastState.activeAgentIndex) {
      const agent = this.activeAgent;
      this.emit("turn:changed", {
        payload: {
          turn: current.turn,
          agent: agent?.name ?? "unknown"
        }
      });
    }
    this._lastState = { ...current };
  }
  // --- CONTROLS ---
  start() {
    if (this.running) return;
    this.engine.dispatch("game:loopStart", {});
    this._syncState();
  }
  stop(reason = "manual") {
    this.engine.dispatch("game:loopStop", { phase: "stopped" });
    this._syncState();
  }
  nextTurn() {
    const agentCount = this.engine._agents.length;
    if (!agentCount) return;
    this.engine.dispatch("game:nextTurn", { agentCount });
    this._syncState();
  }
  get activeAgent() {
    const idx = this.activeAgentIndex;
    if (idx >= 0 && idx < this.engine._agents.length) {
      return this.engine._agents[idx];
    }
    return null;
  }
};

// engine/HistoryManager.ts
var HistoryManager = class {
  constructor() {
    __publicField(this, "history", []);
    __publicField(this, "future", []);
    __publicField(this, "_snapshots", []);
  }
  /** Record a successful action dispatch: push action + pre-snapshot, clear redo stack. */
  recordAction(action, snapshot) {
    this.history.push(action);
    this._snapshots.push(snapshot);
    this.future = [];
  }
  clear() {
    this.history = [];
    this.future = [];
    this._snapshots = [];
  }
  /**
   * Attempt undo: restores session to previous snapshot and moves action to future stack.
   * Returns the undone action, or null if nothing to undo.
   */
  undo(session) {
    const last = this.history.pop();
    if (!last || !last.reversible) {
      if (last) this.history.push(last);
      return null;
    }
    const snapshot = this._snapshots.pop();
    if (snapshot) {
      session.loadFromBase64(snapshot);
    }
    this.future.push(last);
    return last;
  }
  /** Pop next action from redo stack (caller must save current snapshot and apply the action). */
  popRedo() {
    return this.future.pop() ?? null;
  }
  /** Push a snapshot (used before re-applying a redo action). */
  pushSnapshot(snapshot) {
    this._snapshots.push(snapshot);
  }
  /** Push an action to history (used after successfully re-applying a redo). */
  pushHistory(action) {
    this.history.push(action);
  }
  /** Replace history from a restored snapshot. */
  restoreHistory(actions) {
    this.history = [...actions];
    this.future = [];
    this._snapshots = [];
  }
};

// core/WasmChronicleAdapter.ts
init_events();
var WasmChronicleAdapter = class extends Emitter {
  constructor(wasmDispatcher) {
    super();
    __publicField(this, "_wasm");
    // ActionDispatcher from WASM module
    __publicField(this, "_cache", {});
    this._wasm = wasmDispatcher;
    this._cache = JSON.parse(this._wasm.getState());
    this._wasm.clearDirty();
  }
  get state() {
    const dirtyJson = this._wasm.getDirty();
    const dirty = JSON.parse(dirtyJson);
    if (dirty.all) {
      this._cache = JSON.parse(this._wasm.getState());
    } else {
      if (dirty.stack) this._cache.stack = JSON.parse(this._wasm.exportStack());
      if (dirty.zones) this._cache.zones = JSON.parse(this._wasm.exportZones());
      if (dirty.source) this._cache.source = JSON.parse(this._wasm.exportSource());
      if (dirty.gameLoop) this._cache.gameLoop = JSON.parse(this._wasm.exportGameLoop());
      if (dirty.gameState) this._cache.gameState = JSON.parse(this._wasm.exportGameState());
      if (dirty.rules) this._cache.rules = JSON.parse(this._wasm.exportRules());
      if (dirty.agents) this._cache.agents = JSON.parse(this._wasm.exportAgents());
      if (dirty.nullifiers) this._cache.nullifiers = JSON.parse(this._wasm.exportNullifiers());
    }
    this._wasm.clearDirty();
    return this._cache;
  }
  change(message, callback, source = "local") {
    throw new Error(
      "Direct change() not supported with WASM Chronicle. Use engine.dispatch() instead."
    );
  }
  update(newDoc, source = "local") {
    throw new Error(
      "Direct update() not supported with WASM Chronicle. Use engine.dispatch() instead."
    );
  }
  save() {
    return this._wasm.save();
  }
  saveToBase64() {
    return this._wasm.saveToBase64();
  }
  load(data) {
    this._wasm.load(data);
    this._cache = {};
    this.emit("state:changed", { doc: this.state, source: "load" });
  }
  loadFromBase64(b64) {
    this._wasm.loadFromBase64(b64);
    this._cache = {};
    this.emit("state:changed", { doc: this.state, source: "load" });
  }
  merge(other) {
    this._wasm.merge(other);
    this._cache = {};
    this.emit("state:changed", { doc: this.state, source: "merge" });
  }
  // Sync protocol — not supported with WASM backend.
  // Engine.connect() guards against this by returning early when WASM is active.
  initSyncState() {
    throw new Error("Sync protocol not supported with WASM Chronicle backend.");
  }
  generateSyncMessage(syncState) {
    throw new Error("Sync protocol not supported with WASM Chronicle backend.");
  }
  receiveSyncMessage(syncState, message, source) {
    throw new Error("Sync protocol not supported with WASM Chronicle backend.");
  }
};

// core/WasmBridge.ts
init_path_shim();
init_path_shim();
var wasmModule = null;
var wasmLoadPromise = null;
var wasmLoadError = null;
async function loadWasm() {
  if (wasmModule) {
    return wasmModule;
  }
  if (wasmLoadPromise) {
    return wasmLoadPromise;
  }
  if (wasmLoadError) {
    wasmLoadError = null;
  }
  wasmLoadPromise = (async () => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const wasmPath = join(__dirname, "..", "core-rs", "pkg", "nodejs", "hypertoken_core.js");
      const wasmImport = await import(wasmPath);
      if (wasmImport.default && typeof wasmImport.default === "function") {
        await wasmImport.default();
      }
      wasmModule = wasmImport;
      console.log(`\u2705 HyperToken WASM loaded successfully (v${wasmModule.version()})`);
      return wasmModule;
    } catch (error) {
      wasmLoadError = error instanceof Error ? error : new Error(String(error));
      wasmLoadPromise = null;
      console.warn("\u26A0\uFE0F  Failed to load WASM module:", wasmLoadError.message);
      console.warn("    Falling back to TypeScript implementation");
      throw wasmLoadError;
    }
  })();
  return wasmLoadPromise;
}
function isWasmAvailable() {
  return wasmModule !== null;
}
function getWasmModule() {
  return wasmModule;
}
async function tryLoadWasm() {
  try {
    return await loadWasm();
  } catch {
    return null;
  }
}

// engine/WasmManager.ts
var WasmManager = class {
  constructor() {
    __publicField(this, "_dispatcher", null);
    __publicField(this, "_dispatchTable", null);
    __publicField(this, "_worker", null);
    __publicField(this, "_useWorker", false);
  }
  get dispatcher() {
    return this._dispatcher;
  }
  get worker() {
    return this._worker;
  }
  get useWorker() {
    return this._useWorker;
  }
  /** Override dispatcher (for test compatibility). Rebuilds dispatch table. */
  setDispatcher(v) {
    this._dispatcher = v;
    this._dispatchTable = v ? this._buildDispatchTable(v) : null;
  }
  async initWorker(options, debug, onStateChanged, onAction, onError, fallback) {
    try {
      const { UniversalWorker: UniversalWorker2 } = await Promise.resolve().then(() => (init_UniversalWorker(), UniversalWorker_exports));
      this._worker = new UniversalWorker2({
        debug: options.debug ?? debug,
        timeout: options.timeout,
        enableBatching: options.enableBatching,
        batchWindow: options.batchWindow,
        workerPath: options.workerPath,
        wasmPath: options.wasmPath
      });
      await this._worker.init();
      this._worker.on("state_changed", onStateChanged);
      this._worker.on("action_completed", onAction);
      this._worker.on("error", onError);
      if (debug) {
        const env = this._worker.environment;
        console.log(`\u2705 Engine: UniversalWorker initialized (${env} mode)`);
      }
    } catch (error) {
      console.error("\u274C Engine: UniversalWorker initialization failed:", error);
      this._useWorker = false;
      this._worker = null;
      fallback();
    }
  }
  initDispatcher(getStateJson, debug, onSessionReplace, onStateChanged) {
    if (!isWasmAvailable()) {
      this._tryLoadAsync(getStateJson, debug, onSessionReplace, onStateChanged);
      return;
    }
    try {
      const wasm3 = getWasmModule();
      if (!wasm3) return;
      this._dispatcher = new wasm3.ActionDispatcher();
      this._dispatchTable = this._buildDispatchTable(this._dispatcher);
      this._dispatcher.initializeState(getStateJson());
      const newSession = new WasmChronicleAdapter(this._dispatcher);
      newSession.on("state:changed", onStateChanged);
      onSessionReplace(newSession);
      if (debug) console.log("\u2705 WASM ActionDispatcher initialized");
    } catch (error) {
      if (debug) console.warn("\u26A0\uFE0F  WASM ActionDispatcher initialization failed:", error);
    }
  }
  async _tryLoadAsync(getStateJson, debug, onSessionReplace, onStateChanged) {
    try {
      const wasm3 = await tryLoadWasm();
      if (!wasm3 || this._dispatcher) return;
      this._dispatcher = new wasm3.ActionDispatcher();
      this._dispatchTable = this._buildDispatchTable(this._dispatcher);
      this._dispatcher.initializeState(getStateJson());
      const newSession = new WasmChronicleAdapter(this._dispatcher);
      newSession.on("state:changed", onStateChanged);
      onSessionReplace(newSession);
      if (debug) console.log("\u2705 WASM ActionDispatcher initialized (async)");
    } catch (_) {
    }
  }
  _buildDispatchTable(d) {
    return {
      // Stack
      "stack:draw": (p) => JSON.parse(d.stackDraw(p.count ?? 1)),
      "stack:peek": (p) => JSON.parse(d.stackPeek(p.count ?? 1)),
      "stack:shuffle": (p) => {
        d.stackShuffle(p.seed !== void 0 ? String(p.seed) : void 0);
      },
      "stack:burn": (p) => JSON.parse(d.stackBurn(p.count ?? 1)),
      "stack:reset": (_) => {
        d.stackReset();
      },
      "stack:cut": (p) => {
        d.stackCut(p.position ?? 0);
      },
      "stack:insertAt": (p) => {
        d.stackInsertAt(p.position ?? 0, JSON.stringify(p.card));
      },
      "stack:removeAt": (p) => JSON.parse(d.stackRemoveAt(p.position ?? 0)),
      "stack:swap": (p) => {
        d.stackSwap(p.i, p.j);
      },
      // Space
      "space:place": (p) => JSON.parse(d.spacePlace(p.zone, JSON.stringify(p.token), p.x, p.y)),
      "space:remove": (p) => JSON.parse(d.spaceRemove(p.zone, p.placementId)),
      "space:move": (p) => {
        d.spaceMove(p.placementId, p.fromZone, p.toZone, p.x, p.y);
      },
      "space:flip": (p) => {
        d.spaceFlip(p.zone, p.placementId);
      },
      "space:createZone": (p) => {
        d.spaceCreateZone(p.name);
      },
      "space:deleteZone": (p) => {
        d.spaceDeleteZone(p.name);
      },
      "space:clearZone": (p) => {
        d.spaceClearZone(p.zone);
      },
      "space:lockZone": (p) => {
        d.spaceLockZone(p.zone, p.locked ?? true);
      },
      "space:shuffleZone": (p) => {
        d.spaceShuffleZone(p.zone, p.seed !== void 0 ? String(p.seed) : void 0);
      },
      // Source
      "source:draw": (p) => JSON.parse(d.sourceDraw(p.count ?? 1)),
      "source:shuffle": (p) => {
        d.sourceShuffle(p.seed !== void 0 ? String(p.seed) : void 0);
      },
      "source:burn": (p) => JSON.parse(d.sourceBurn(p.count ?? 1)),
      // Agent
      "agent:create": (p) => JSON.parse(d.agentCreate(p.id, p.name, p.meta ? JSON.stringify(p.meta) : void 0)),
      "agent:remove": (p) => {
        d.agentRemove(p.name);
      },
      "agent:setActive": (p) => {
        d.agentSetActive(p.name, p.active ?? true);
      },
      "agent:setMeta": (p) => {
        d.agentSetMeta(p.name, p.key, JSON.stringify(p.value));
      },
      "agent:giveResource": (p) => {
        d.agentGiveResource(p.name, p.resource, p.amount ?? 1);
      },
      "agent:takeResource": (p) => {
        d.agentTakeResource(p.name, p.resource, p.amount ?? 1);
      },
      "agent:addToken": (p) => {
        d.agentAddToken(p.name, JSON.stringify(p.token));
      },
      "agent:removeToken": (p) => JSON.parse(d.agentRemoveToken(p.name, p.tokenId)),
      "agent:get": (p) => {
        const r = d.agentGet(p.name);
        return r ? JSON.parse(r) : null;
      },
      "agent:transferResource": (p) => {
        d.agentTransferResource(p.from, p.to, p.resource, p.amount ?? 1);
        return {};
      },
      "agent:transferToken": (p) => {
        d.agentTransferToken(p.from, p.to, p.tokenId);
        return {};
      },
      "agent:stealResource": (p) => {
        d.agentStealResource(p.from, p.to, p.resource, p.amount ?? 1);
        return {};
      },
      "agent:stealToken": (p) => {
        d.agentStealToken(p.from, p.to, p.tokenId);
        return {};
      },
      "agent:getAll": (_) => JSON.parse(d.agentGetAll()),
      // Token
      "token:transform": (p) => JSON.parse(d.tokenTransform(JSON.stringify(p.token), JSON.stringify(p.properties ?? {}))),
      "token:attach": (p) => JSON.parse(d.tokenAttach(JSON.stringify(p.host), JSON.stringify(p.attachment), p.attachmentType ?? "default")),
      "token:detach": (p) => JSON.parse(d.tokenDetach(JSON.stringify(p.host), p.attachmentId)),
      "token:merge": (p) => JSON.parse(d.tokenMerge(JSON.stringify(p.tokens), p.properties ? JSON.stringify(p.properties) : void 0, p.keepOriginals ?? false)),
      "token:split": (p) => JSON.parse(d.tokenSplit(JSON.stringify(p.token), p.count ?? 2, p.propertiesArray ? JSON.stringify(p.propertiesArray) : void 0)),
      // GameLoop
      "game:loopInit": (p) => {
        d.gameLoopInit(p.maxTurns ?? 100);
      },
      "game:loopStart": (_) => {
        d.gameLoopStart();
      },
      "game:loopStop": (p) => {
        d.gameLoopStop(p.phase ?? "stopped");
      },
      "game:nextTurn": (p) => {
        d.gameLoopNextTurn(p.agentCount ?? 0);
      },
      "game:setPhase": (p) => {
        d.gameLoopSetPhase(p.phase);
      },
      "game:setMaxTurns": (p) => {
        d.gameLoopInit(p.maxTurns ?? 100);
      },
      // GameState
      "game:start": (_) => {
        const r = d.gameStart();
        return r ? JSON.parse(r) : {};
      },
      "game:end": (p) => {
        const r = d.gameEnd(p.winner ? String(p.winner) : void 0, p.reason ? String(p.reason) : void 0);
        return r ? JSON.parse(r) : {};
      },
      "game:pause": (_) => {
        d.gamePause();
        return {};
      },
      "game:resume": (_) => {
        d.gameResume();
        return {};
      },
      "game:nextPhase": (p) => {
        d.gameNextPhase(p.phase ? String(p.phase) : void 0);
        return {};
      },
      "game:setProperty": (p) => {
        d.gameSetProperty(p.key, JSON.stringify(p.value));
        return {};
      },
      "game:mergeState": (p) => {
        d.gameMergeState(JSON.stringify(p.state));
        return {};
      },
      "game:getState": (_) => JSON.parse(d.gameGetState()),
      // Rules
      "rule:markFired": (p) => {
        d.ruleMarkFired(p.name, p.timestamp ?? Date.now());
      },
      // Batch
      "tokens:shuffle": (p) => JSON.parse(d.batchShuffle(JSON.stringify(p.decks), p.seed ? String(p.seed) : void 0)),
      "tokens:draw": (p) => JSON.parse(d.batchDraw(JSON.stringify(p.decks), JSON.stringify(p.counts))),
      "tokens:filter": (p) => JSON.parse(d.batchFilter(JSON.stringify(p.tokens), p.predicate ?? "reversed")),
      "tokens:map": (p) => JSON.parse(d.batchMap(JSON.stringify(p.tokens), p.operation ?? "flip"))
    };
  }
  /** Dispatch via WASM dispatch table (sync). Throws if dispatcher not available or action unknown. */
  dispatch(type, payload) {
    if (!this._dispatchTable) throw new Error("WASM ActionDispatcher not available");
    const handler = this._dispatchTable[type];
    if (!handler) throw new Error(`Unknown WASM action type: ${type}`);
    return handler(payload);
  }
  /** Dispatch via worker (async). Throws if worker not ready. */
  async dispatchWorker(type, payload) {
    if (!this._worker?.ready) throw new Error("Worker not ready");
    return this._worker.dispatch(type, payload);
  }
  async terminate() {
    if (this._worker) {
      await this._worker.terminate();
      this._worker = null;
    }
    this._useWorker = false;
  }
};
__publicField(WasmManager, "WASM_ACTIONS", /* @__PURE__ */ new Set([
  // Stack actions (10)
  "stack:draw",
  "stack:peek",
  "stack:shuffle",
  "stack:burn",
  "stack:reset",
  "stack:cut",
  "stack:insertAt",
  "stack:removeAt",
  "stack:swap",
  "stack:reverse",
  // Space actions (14)
  "space:place",
  "space:remove",
  "space:move",
  "space:flip",
  "space:createZone",
  "space:deleteZone",
  "space:clearZone",
  "space:lockZone",
  "space:shuffleZone",
  "space:fanZone",
  "space:spreadZone",
  "space:stackZone",
  "space:transferZone",
  "space:clear",
  // Source actions (7)
  "source:draw",
  "source:shuffle",
  "source:burn",
  "source:addStack",
  "source:removeStack",
  "source:reset",
  "source:inspect",
  // Agent actions (17)
  "agent:create",
  "agent:remove",
  "agent:setActive",
  "agent:setMeta",
  "agent:giveResource",
  "agent:takeResource",
  "agent:addToken",
  "agent:removeToken",
  "agent:get",
  "agent:transferResource",
  "agent:transferToken",
  "agent:stealResource",
  "agent:stealToken",
  "agent:getAll",
  "agent:trade",
  "agent:drawCards",
  "agent:discardCards",
  // Token operations (5)
  "token:transform",
  "token:attach",
  "token:detach",
  "token:merge",
  "token:split",
  // GameLoop actions (6)
  "game:loopInit",
  "game:loopStart",
  "game:loopStop",
  "game:nextTurn",
  "game:setPhase",
  "game:setMaxTurns",
  // GameState actions (8)
  "game:start",
  "game:end",
  "game:pause",
  "game:resume",
  "game:nextPhase",
  "game:setProperty",
  "game:mergeState",
  "game:getState",
  // Rules actions (1)
  "rule:markFired",
  // Batch operations (8)
  "tokens:shuffle",
  "tokens:draw",
  "tokens:filter",
  "tokens:map",
  "tokens:find",
  "tokens:count",
  "tokens:collect",
  "tokens:forEach",
  // Debug
  "debug:log"
]));

// network/PeerConnection.ts
init_events();

// node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs
function utf8Count(str) {
  const strLength = str.length;
  let byteLength = 0;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      byteLength++;
      continue;
    } else if ((value & 4294965248) === 0) {
      byteLength += 2;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        byteLength += 3;
      } else {
        byteLength += 4;
      }
    }
  }
  return byteLength;
}
function utf8EncodeJs(str, output, outputOffset) {
  const strLength = str.length;
  let offset = outputOffset;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      output[offset++] = value;
      continue;
    } else if ((value & 4294965248) === 0) {
      output[offset++] = value >> 6 & 31 | 192;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        output[offset++] = value >> 12 & 15 | 224;
        output[offset++] = value >> 6 & 63 | 128;
      } else {
        output[offset++] = value >> 18 & 7 | 240;
        output[offset++] = value >> 12 & 63 | 128;
        output[offset++] = value >> 6 & 63 | 128;
      }
    }
    output[offset++] = value & 63 | 128;
  }
}
var sharedTextEncoder = new TextEncoder();
var TEXT_ENCODER_THRESHOLD = 50;
function utf8EncodeTE(str, output, outputOffset) {
  sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
}
function utf8Encode(str, output, outputOffset) {
  if (str.length > TEXT_ENCODER_THRESHOLD) {
    utf8EncodeTE(str, output, outputOffset);
  } else {
    utf8EncodeJs(str, output, outputOffset);
  }
}
var CHUNK_SIZE = 4096;
function utf8DecodeJs(bytes, inputOffset, byteLength) {
  let offset = inputOffset;
  const end = offset + byteLength;
  const units = [];
  let result = "";
  while (offset < end) {
    const byte1 = bytes[offset++];
    if ((byte1 & 128) === 0) {
      units.push(byte1);
    } else if ((byte1 & 224) === 192) {
      const byte2 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 6 | byte2);
    } else if ((byte1 & 240) === 224) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
    } else if ((byte1 & 248) === 240) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      const byte4 = bytes[offset++] & 63;
      let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
      if (unit > 65535) {
        unit -= 65536;
        units.push(unit >>> 10 & 1023 | 55296);
        unit = 56320 | unit & 1023;
      }
      units.push(unit);
    } else {
      units.push(byte1);
    }
    if (units.length >= CHUNK_SIZE) {
      result += String.fromCharCode(...units);
      units.length = 0;
    }
  }
  if (units.length > 0) {
    result += String.fromCharCode(...units);
  }
  return result;
}
var sharedTextDecoder = new TextDecoder();
var TEXT_DECODER_THRESHOLD = 200;
function utf8DecodeTD(bytes, inputOffset, byteLength) {
  const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
  return sharedTextDecoder.decode(stringBytes);
}
function utf8Decode(bytes, inputOffset, byteLength) {
  if (byteLength > TEXT_DECODER_THRESHOLD) {
    return utf8DecodeTD(bytes, inputOffset, byteLength);
  } else {
    return utf8DecodeJs(bytes, inputOffset, byteLength);
  }
}

// node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs
var ExtData = class {
  constructor(type, data) {
    __publicField(this, "type");
    __publicField(this, "data");
    this.type = type;
    this.data = data;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs
var DecodeError = class _DecodeError extends Error {
  constructor(message) {
    super(message);
    const proto = Object.create(_DecodeError.prototype);
    Object.setPrototypeOf(this, proto);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: _DecodeError.name
    });
  }
};

// node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs
var UINT32_MAX = 4294967295;
function setUint64(view, offset, value) {
  const high = value / 4294967296;
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function setInt64(view, offset, value) {
  const high = Math.floor(value / 4294967296);
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function getInt64(view, offset) {
  const high = view.getInt32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}
function getUint64(view, offset) {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}

// node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs
var EXT_TIMESTAMP = -1;
var TIMESTAMP32_MAX_SEC = 4294967296 - 1;
var TIMESTAMP64_MAX_SEC = 17179869184 - 1;
function encodeTimeSpecToTimestamp({ sec, nsec }) {
  if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
    if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
      const rv = new Uint8Array(4);
      const view = new DataView(rv.buffer);
      view.setUint32(0, sec);
      return rv;
    } else {
      const secHigh = sec / 4294967296;
      const secLow = sec & 4294967295;
      const rv = new Uint8Array(8);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec << 2 | secHigh & 3);
      view.setUint32(4, secLow);
      return rv;
    }
  } else {
    const rv = new Uint8Array(12);
    const view = new DataView(rv.buffer);
    view.setUint32(0, nsec);
    setInt64(view, 4, sec);
    return rv;
  }
}
function encodeDateToTimeSpec(date) {
  const msec = date.getTime();
  const sec = Math.floor(msec / 1e3);
  const nsec = (msec - sec * 1e3) * 1e6;
  const nsecInSec = Math.floor(nsec / 1e9);
  return {
    sec: sec + nsecInSec,
    nsec: nsec - nsecInSec * 1e9
  };
}
function encodeTimestampExtension(object) {
  if (object instanceof Date) {
    const timeSpec = encodeDateToTimeSpec(object);
    return encodeTimeSpecToTimestamp(timeSpec);
  } else {
    return null;
  }
}
function decodeTimestampToTimeSpec(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (data.byteLength) {
    case 4: {
      const sec = view.getUint32(0);
      const nsec = 0;
      return { sec, nsec };
    }
    case 8: {
      const nsec30AndSecHigh2 = view.getUint32(0);
      const secLow32 = view.getUint32(4);
      const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
      const nsec = nsec30AndSecHigh2 >>> 2;
      return { sec, nsec };
    }
    case 12: {
      const sec = getInt64(view, 4);
      const nsec = view.getUint32(0);
      return { sec, nsec };
    }
    default:
      throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
  }
}
function decodeTimestampExtension(data) {
  const timeSpec = decodeTimestampToTimeSpec(data);
  return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
}
var timestampExtension = {
  type: EXT_TIMESTAMP,
  encode: encodeTimestampExtension,
  decode: decodeTimestampExtension
};

// node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs
var _ExtensionCodec = class _ExtensionCodec {
  constructor() {
    // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
    // this will make type errors a lot more clear
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __publicField(this, "__brand");
    // built-in extensions
    __publicField(this, "builtInEncoders", []);
    __publicField(this, "builtInDecoders", []);
    // custom extensions
    __publicField(this, "encoders", []);
    __publicField(this, "decoders", []);
    this.register(timestampExtension);
  }
  register({ type, encode: encode2, decode: decode2 }) {
    if (type >= 0) {
      this.encoders[type] = encode2;
      this.decoders[type] = decode2;
    } else {
      const index = -1 - type;
      this.builtInEncoders[index] = encode2;
      this.builtInDecoders[index] = decode2;
    }
  }
  tryToEncode(object, context) {
    for (let i = 0; i < this.builtInEncoders.length; i++) {
      const encodeExt = this.builtInEncoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = -1 - i;
          return new ExtData(type, data);
        }
      }
    }
    for (let i = 0; i < this.encoders.length; i++) {
      const encodeExt = this.encoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = i;
          return new ExtData(type, data);
        }
      }
    }
    if (object instanceof ExtData) {
      return object;
    }
    return null;
  }
  decode(data, type, context) {
    const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
    if (decodeExt) {
      return decodeExt(data, type, context);
    } else {
      return new ExtData(type, data);
    }
  }
};
__publicField(_ExtensionCodec, "defaultCodec", new _ExtensionCodec());
var ExtensionCodec = _ExtensionCodec;

// node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs
function isArrayBufferLike(buffer) {
  return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}
function ensureUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (isArrayBufferLike(buffer)) {
    return new Uint8Array(buffer);
  } else {
    return Uint8Array.from(buffer);
  }
}

// node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs
var DEFAULT_MAX_DEPTH = 100;
var DEFAULT_INITIAL_BUFFER_SIZE = 2048;
var Encoder = class _Encoder {
  constructor(options) {
    __publicField(this, "extensionCodec");
    __publicField(this, "context");
    __publicField(this, "useBigInt64");
    __publicField(this, "maxDepth");
    __publicField(this, "initialBufferSize");
    __publicField(this, "sortKeys");
    __publicField(this, "forceFloat32");
    __publicField(this, "ignoreUndefined");
    __publicField(this, "forceIntegerToFloat");
    __publicField(this, "pos");
    __publicField(this, "view");
    __publicField(this, "bytes");
    __publicField(this, "entered", false);
    this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
    this.context = options?.context;
    this.useBigInt64 = options?.useBigInt64 ?? false;
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
    this.sortKeys = options?.sortKeys ?? false;
    this.forceFloat32 = options?.forceFloat32 ?? false;
    this.ignoreUndefined = options?.ignoreUndefined ?? false;
    this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
    this.pos = 0;
    this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
    this.bytes = new Uint8Array(this.view.buffer);
  }
  clone() {
    return new _Encoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      maxDepth: this.maxDepth,
      initialBufferSize: this.initialBufferSize,
      sortKeys: this.sortKeys,
      forceFloat32: this.forceFloat32,
      ignoreUndefined: this.ignoreUndefined,
      forceIntegerToFloat: this.forceIntegerToFloat
    });
  }
  reinitializeState() {
    this.pos = 0;
  }
  /**
   * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
   *
   * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
   */
  encodeSharedRef(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encodeSharedRef(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.subarray(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  /**
   * @returns Encodes the object and returns a copy of the encoder's internal buffer.
   */
  encode(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encode(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.slice(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  doEncode(object, depth) {
    if (depth > this.maxDepth) {
      throw new Error(`Too deep objects in depth ${depth}`);
    }
    if (object == null) {
      this.encodeNil();
    } else if (typeof object === "boolean") {
      this.encodeBoolean(object);
    } else if (typeof object === "number") {
      if (!this.forceIntegerToFloat) {
        this.encodeNumber(object);
      } else {
        this.encodeNumberAsFloat(object);
      }
    } else if (typeof object === "string") {
      this.encodeString(object);
    } else if (this.useBigInt64 && typeof object === "bigint") {
      this.encodeBigInt64(object);
    } else {
      this.encodeObject(object, depth);
    }
  }
  ensureBufferSizeToWrite(sizeToWrite) {
    const requiredSize = this.pos + sizeToWrite;
    if (this.view.byteLength < requiredSize) {
      this.resizeBuffer(requiredSize * 2);
    }
  }
  resizeBuffer(newSize) {
    const newBuffer = new ArrayBuffer(newSize);
    const newBytes = new Uint8Array(newBuffer);
    const newView = new DataView(newBuffer);
    newBytes.set(this.bytes);
    this.view = newView;
    this.bytes = newBytes;
  }
  encodeNil() {
    this.writeU8(192);
  }
  encodeBoolean(object) {
    if (object === false) {
      this.writeU8(194);
    } else {
      this.writeU8(195);
    }
  }
  encodeNumber(object) {
    if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
      if (object >= 0) {
        if (object < 128) {
          this.writeU8(object);
        } else if (object < 256) {
          this.writeU8(204);
          this.writeU8(object);
        } else if (object < 65536) {
          this.writeU8(205);
          this.writeU16(object);
        } else if (object < 4294967296) {
          this.writeU8(206);
          this.writeU32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(207);
          this.writeU64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      } else {
        if (object >= -32) {
          this.writeU8(224 | object + 32);
        } else if (object >= -128) {
          this.writeU8(208);
          this.writeI8(object);
        } else if (object >= -32768) {
          this.writeU8(209);
          this.writeI16(object);
        } else if (object >= -2147483648) {
          this.writeU8(210);
          this.writeI32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(211);
          this.writeI64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      }
    } else {
      this.encodeNumberAsFloat(object);
    }
  }
  encodeNumberAsFloat(object) {
    if (this.forceFloat32) {
      this.writeU8(202);
      this.writeF32(object);
    } else {
      this.writeU8(203);
      this.writeF64(object);
    }
  }
  encodeBigInt64(object) {
    if (object >= BigInt(0)) {
      this.writeU8(207);
      this.writeBigUint64(object);
    } else {
      this.writeU8(211);
      this.writeBigInt64(object);
    }
  }
  writeStringHeader(byteLength) {
    if (byteLength < 32) {
      this.writeU8(160 + byteLength);
    } else if (byteLength < 256) {
      this.writeU8(217);
      this.writeU8(byteLength);
    } else if (byteLength < 65536) {
      this.writeU8(218);
      this.writeU16(byteLength);
    } else if (byteLength < 4294967296) {
      this.writeU8(219);
      this.writeU32(byteLength);
    } else {
      throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
    }
  }
  encodeString(object) {
    const maxHeaderSize = 1 + 4;
    const byteLength = utf8Count(object);
    this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
    this.writeStringHeader(byteLength);
    utf8Encode(object, this.bytes, this.pos);
    this.pos += byteLength;
  }
  encodeObject(object, depth) {
    const ext = this.extensionCodec.tryToEncode(object, this.context);
    if (ext != null) {
      this.encodeExtension(ext);
    } else if (Array.isArray(object)) {
      this.encodeArray(object, depth);
    } else if (ArrayBuffer.isView(object)) {
      this.encodeBinary(object);
    } else if (typeof object === "object") {
      this.encodeMap(object, depth);
    } else {
      throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
    }
  }
  encodeBinary(object) {
    const size = object.byteLength;
    if (size < 256) {
      this.writeU8(196);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(197);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(198);
      this.writeU32(size);
    } else {
      throw new Error(`Too large binary: ${size}`);
    }
    const bytes = ensureUint8Array(object);
    this.writeU8a(bytes);
  }
  encodeArray(object, depth) {
    const size = object.length;
    if (size < 16) {
      this.writeU8(144 + size);
    } else if (size < 65536) {
      this.writeU8(220);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(221);
      this.writeU32(size);
    } else {
      throw new Error(`Too large array: ${size}`);
    }
    for (const item of object) {
      this.doEncode(item, depth + 1);
    }
  }
  countWithoutUndefined(object, keys) {
    let count = 0;
    for (const key of keys) {
      if (object[key] !== void 0) {
        count++;
      }
    }
    return count;
  }
  encodeMap(object, depth) {
    const keys = Object.keys(object);
    if (this.sortKeys) {
      keys.sort();
    }
    const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
    if (size < 16) {
      this.writeU8(128 + size);
    } else if (size < 65536) {
      this.writeU8(222);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(223);
      this.writeU32(size);
    } else {
      throw new Error(`Too large map object: ${size}`);
    }
    for (const key of keys) {
      const value = object[key];
      if (!(this.ignoreUndefined && value === void 0)) {
        this.encodeString(key);
        this.doEncode(value, depth + 1);
      }
    }
  }
  encodeExtension(ext) {
    if (typeof ext.data === "function") {
      const data = ext.data(this.pos + 6);
      const size2 = data.length;
      if (size2 >= 4294967296) {
        throw new Error(`Too large extension object: ${size2}`);
      }
      this.writeU8(201);
      this.writeU32(size2);
      this.writeI8(ext.type);
      this.writeU8a(data);
      return;
    }
    const size = ext.data.length;
    if (size === 1) {
      this.writeU8(212);
    } else if (size === 2) {
      this.writeU8(213);
    } else if (size === 4) {
      this.writeU8(214);
    } else if (size === 8) {
      this.writeU8(215);
    } else if (size === 16) {
      this.writeU8(216);
    } else if (size < 256) {
      this.writeU8(199);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(200);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(201);
      this.writeU32(size);
    } else {
      throw new Error(`Too large extension object: ${size}`);
    }
    this.writeI8(ext.type);
    this.writeU8a(ext.data);
  }
  writeU8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setUint8(this.pos, value);
    this.pos++;
  }
  writeU8a(values) {
    const size = values.length;
    this.ensureBufferSizeToWrite(size);
    this.bytes.set(values, this.pos);
    this.pos += size;
  }
  writeI8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setInt8(this.pos, value);
    this.pos++;
  }
  writeU16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  writeI16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setInt16(this.pos, value);
    this.pos += 2;
  }
  writeU32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setUint32(this.pos, value);
    this.pos += 4;
  }
  writeI32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setInt32(this.pos, value);
    this.pos += 4;
  }
  writeF32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setFloat32(this.pos, value);
    this.pos += 4;
  }
  writeF64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setFloat64(this.pos, value);
    this.pos += 8;
  }
  writeU64(value) {
    this.ensureBufferSizeToWrite(8);
    setUint64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeI64(value) {
    this.ensureBufferSizeToWrite(8);
    setInt64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeBigUint64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigUint64(this.pos, value);
    this.pos += 8;
  }
  writeBigInt64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigInt64(this.pos, value);
    this.pos += 8;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/encode.mjs
function encode(value, options) {
  const encoder = new Encoder(options);
  return encoder.encodeSharedRef(value);
}

// node_modules/@msgpack/msgpack/dist.esm/utils/prettyByte.mjs
function prettyByte(byte) {
  return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
}

// node_modules/@msgpack/msgpack/dist.esm/CachedKeyDecoder.mjs
var DEFAULT_MAX_KEY_LENGTH = 16;
var DEFAULT_MAX_LENGTH_PER_KEY = 16;
var CachedKeyDecoder = class {
  constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
    __publicField(this, "hit", 0);
    __publicField(this, "miss", 0);
    __publicField(this, "caches");
    __publicField(this, "maxKeyLength");
    __publicField(this, "maxLengthPerKey");
    this.maxKeyLength = maxKeyLength;
    this.maxLengthPerKey = maxLengthPerKey;
    this.caches = [];
    for (let i = 0; i < this.maxKeyLength; i++) {
      this.caches.push([]);
    }
  }
  canBeCached(byteLength) {
    return byteLength > 0 && byteLength <= this.maxKeyLength;
  }
  find(bytes, inputOffset, byteLength) {
    const records = this.caches[byteLength - 1];
    FIND_CHUNK: for (const record of records) {
      const recordBytes = record.bytes;
      for (let j = 0; j < byteLength; j++) {
        if (recordBytes[j] !== bytes[inputOffset + j]) {
          continue FIND_CHUNK;
        }
      }
      return record.str;
    }
    return null;
  }
  store(bytes, value) {
    const records = this.caches[bytes.length - 1];
    const record = { bytes, str: value };
    if (records.length >= this.maxLengthPerKey) {
      records[Math.random() * records.length | 0] = record;
    } else {
      records.push(record);
    }
  }
  decode(bytes, inputOffset, byteLength) {
    const cachedValue = this.find(bytes, inputOffset, byteLength);
    if (cachedValue != null) {
      this.hit++;
      return cachedValue;
    }
    this.miss++;
    const str = utf8DecodeJs(bytes, inputOffset, byteLength);
    const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
    this.store(slicedCopyOfBytes, str);
    return str;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/Decoder.mjs
var STATE_ARRAY = "array";
var STATE_MAP_KEY = "map_key";
var STATE_MAP_VALUE = "map_value";
var mapKeyConverter = (key) => {
  if (typeof key === "string" || typeof key === "number") {
    return key;
  }
  throw new DecodeError("The type of key must be string or number but " + typeof key);
};
var StackPool = class {
  constructor() {
    __publicField(this, "stack", []);
    __publicField(this, "stackHeadPosition", -1);
  }
  get length() {
    return this.stackHeadPosition + 1;
  }
  top() {
    return this.stack[this.stackHeadPosition];
  }
  pushArrayState(size) {
    const state2 = this.getUninitializedStateFromPool();
    state2.type = STATE_ARRAY;
    state2.position = 0;
    state2.size = size;
    state2.array = new Array(size);
  }
  pushMapState(size) {
    const state2 = this.getUninitializedStateFromPool();
    state2.type = STATE_MAP_KEY;
    state2.readCount = 0;
    state2.size = size;
    state2.map = {};
  }
  getUninitializedStateFromPool() {
    this.stackHeadPosition++;
    if (this.stackHeadPosition === this.stack.length) {
      const partialState = {
        type: void 0,
        size: 0,
        array: void 0,
        position: 0,
        readCount: 0,
        map: void 0,
        key: null
      };
      this.stack.push(partialState);
    }
    return this.stack[this.stackHeadPosition];
  }
  release(state2) {
    const topStackState = this.stack[this.stackHeadPosition];
    if (topStackState !== state2) {
      throw new Error("Invalid stack state. Released state is not on top of the stack.");
    }
    if (state2.type === STATE_ARRAY) {
      const partialState = state2;
      partialState.size = 0;
      partialState.array = void 0;
      partialState.position = 0;
      partialState.type = void 0;
    }
    if (state2.type === STATE_MAP_KEY || state2.type === STATE_MAP_VALUE) {
      const partialState = state2;
      partialState.size = 0;
      partialState.map = void 0;
      partialState.readCount = 0;
      partialState.type = void 0;
    }
    this.stackHeadPosition--;
  }
  reset() {
    this.stack.length = 0;
    this.stackHeadPosition = -1;
  }
};
var HEAD_BYTE_REQUIRED = -1;
var EMPTY_VIEW = new DataView(new ArrayBuffer(0));
var EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
try {
  EMPTY_VIEW.getInt8(0);
} catch (e) {
  if (!(e instanceof RangeError)) {
    throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
  }
}
var MORE_DATA = new RangeError("Insufficient data");
var sharedCachedKeyDecoder = new CachedKeyDecoder();
var Decoder = class _Decoder {
  constructor(options) {
    __publicField(this, "extensionCodec");
    __publicField(this, "context");
    __publicField(this, "useBigInt64");
    __publicField(this, "rawStrings");
    __publicField(this, "maxStrLength");
    __publicField(this, "maxBinLength");
    __publicField(this, "maxArrayLength");
    __publicField(this, "maxMapLength");
    __publicField(this, "maxExtLength");
    __publicField(this, "keyDecoder");
    __publicField(this, "mapKeyConverter");
    __publicField(this, "totalPos", 0);
    __publicField(this, "pos", 0);
    __publicField(this, "view", EMPTY_VIEW);
    __publicField(this, "bytes", EMPTY_BYTES);
    __publicField(this, "headByte", HEAD_BYTE_REQUIRED);
    __publicField(this, "stack", new StackPool());
    __publicField(this, "entered", false);
    this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
    this.context = options?.context;
    this.useBigInt64 = options?.useBigInt64 ?? false;
    this.rawStrings = options?.rawStrings ?? false;
    this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
    this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
    this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
    this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
    this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
    this.keyDecoder = options?.keyDecoder !== void 0 ? options.keyDecoder : sharedCachedKeyDecoder;
    this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
  }
  clone() {
    return new _Decoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      rawStrings: this.rawStrings,
      maxStrLength: this.maxStrLength,
      maxBinLength: this.maxBinLength,
      maxArrayLength: this.maxArrayLength,
      maxMapLength: this.maxMapLength,
      maxExtLength: this.maxExtLength,
      keyDecoder: this.keyDecoder
    });
  }
  reinitializeState() {
    this.totalPos = 0;
    this.headByte = HEAD_BYTE_REQUIRED;
    this.stack.reset();
  }
  setBuffer(buffer) {
    const bytes = ensureUint8Array(buffer);
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  appendBuffer(buffer) {
    if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
      this.setBuffer(buffer);
    } else {
      const remainingData = this.bytes.subarray(this.pos);
      const newData = ensureUint8Array(buffer);
      const newBuffer = new Uint8Array(remainingData.length + newData.length);
      newBuffer.set(remainingData);
      newBuffer.set(newData, remainingData.length);
      this.setBuffer(newBuffer);
    }
  }
  hasRemaining(size) {
    return this.view.byteLength - this.pos >= size;
  }
  createExtraByteError(posToShow) {
    const { view, pos } = this;
    return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
  }
  /**
   * @throws {@link DecodeError}
   * @throws {@link RangeError}
   */
  decode(buffer) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decode(buffer);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      const object = this.doDecodeSync();
      if (this.hasRemaining(1)) {
        throw this.createExtraByteError(this.pos);
      }
      return object;
    } finally {
      this.entered = false;
    }
  }
  *decodeMulti(buffer) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMulti(buffer);
      return;
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      while (this.hasRemaining(1)) {
        yield this.doDecodeSync();
      }
    } finally {
      this.entered = false;
    }
  }
  async decodeAsync(stream) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decodeAsync(stream);
    }
    try {
      this.entered = true;
      let decoded = false;
      let object;
      for await (const buffer of stream) {
        if (decoded) {
          this.entered = false;
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        try {
          object = this.doDecodeSync();
          decoded = true;
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
      if (decoded) {
        if (this.hasRemaining(1)) {
          throw this.createExtraByteError(this.totalPos);
        }
        return object;
      }
      const { headByte, pos, totalPos } = this;
      throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
    } finally {
      this.entered = false;
    }
  }
  decodeArrayStream(stream) {
    return this.decodeMultiAsync(stream, true);
  }
  decodeStream(stream) {
    return this.decodeMultiAsync(stream, false);
  }
  async *decodeMultiAsync(stream, isArray) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMultiAsync(stream, isArray);
      return;
    }
    try {
      this.entered = true;
      let isArrayHeaderRequired = isArray;
      let arrayItemsLeft = -1;
      for await (const buffer of stream) {
        if (isArray && arrayItemsLeft === 0) {
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        if (isArrayHeaderRequired) {
          arrayItemsLeft = this.readArraySize();
          isArrayHeaderRequired = false;
          this.complete();
        }
        try {
          while (true) {
            yield this.doDecodeSync();
            if (--arrayItemsLeft === 0) {
              break;
            }
          }
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
    } finally {
      this.entered = false;
    }
  }
  doDecodeSync() {
    DECODE: while (true) {
      const headByte = this.readHeadByte();
      let object;
      if (headByte >= 224) {
        object = headByte - 256;
      } else if (headByte < 192) {
        if (headByte < 128) {
          object = headByte;
        } else if (headByte < 144) {
          const size = headByte - 128;
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte < 160) {
          const size = headByte - 144;
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else {
          const byteLength = headByte - 160;
          object = this.decodeString(byteLength, 0);
        }
      } else if (headByte === 192) {
        object = null;
      } else if (headByte === 194) {
        object = false;
      } else if (headByte === 195) {
        object = true;
      } else if (headByte === 202) {
        object = this.readF32();
      } else if (headByte === 203) {
        object = this.readF64();
      } else if (headByte === 204) {
        object = this.readU8();
      } else if (headByte === 205) {
        object = this.readU16();
      } else if (headByte === 206) {
        object = this.readU32();
      } else if (headByte === 207) {
        if (this.useBigInt64) {
          object = this.readU64AsBigInt();
        } else {
          object = this.readU64();
        }
      } else if (headByte === 208) {
        object = this.readI8();
      } else if (headByte === 209) {
        object = this.readI16();
      } else if (headByte === 210) {
        object = this.readI32();
      } else if (headByte === 211) {
        if (this.useBigInt64) {
          object = this.readI64AsBigInt();
        } else {
          object = this.readI64();
        }
      } else if (headByte === 217) {
        const byteLength = this.lookU8();
        object = this.decodeString(byteLength, 1);
      } else if (headByte === 218) {
        const byteLength = this.lookU16();
        object = this.decodeString(byteLength, 2);
      } else if (headByte === 219) {
        const byteLength = this.lookU32();
        object = this.decodeString(byteLength, 4);
      } else if (headByte === 220) {
        const size = this.readU16();
        if (size !== 0) {
          this.pushArrayState(size);
          this.complete();
          continue DECODE;
        } else {
          object = [];
        }
      } else if (headByte === 221) {
        const size = this.readU32();
        if (size !== 0) {
          this.pushArrayState(size);
          this.complete();
          continue DECODE;
        } else {
          object = [];
        }
      } else if (headByte === 222) {
        const size = this.readU16();
        if (size !== 0) {
          this.pushMapState(size);
          this.complete();
          continue DECODE;
        } else {
          object = {};
        }
      } else if (headByte === 223) {
        const size = this.readU32();
        if (size !== 0) {
          this.pushMapState(size);
          this.complete();
          continue DECODE;
        } else {
          object = {};
        }
      } else if (headByte === 196) {
        const size = this.lookU8();
        object = this.decodeBinary(size, 1);
      } else if (headByte === 197) {
        const size = this.lookU16();
        object = this.decodeBinary(size, 2);
      } else if (headByte === 198) {
        const size = this.lookU32();
        object = this.decodeBinary(size, 4);
      } else if (headByte === 212) {
        object = this.decodeExtension(1, 0);
      } else if (headByte === 213) {
        object = this.decodeExtension(2, 0);
      } else if (headByte === 214) {
        object = this.decodeExtension(4, 0);
      } else if (headByte === 215) {
        object = this.decodeExtension(8, 0);
      } else if (headByte === 216) {
        object = this.decodeExtension(16, 0);
      } else if (headByte === 199) {
        const size = this.lookU8();
        object = this.decodeExtension(size, 1);
      } else if (headByte === 200) {
        const size = this.lookU16();
        object = this.decodeExtension(size, 2);
      } else if (headByte === 201) {
        const size = this.lookU32();
        object = this.decodeExtension(size, 4);
      } else {
        throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
      }
      this.complete();
      const stack = this.stack;
      while (stack.length > 0) {
        const state2 = stack.top();
        if (state2.type === STATE_ARRAY) {
          state2.array[state2.position] = object;
          state2.position++;
          if (state2.position === state2.size) {
            object = state2.array;
            stack.release(state2);
          } else {
            continue DECODE;
          }
        } else if (state2.type === STATE_MAP_KEY) {
          if (object === "__proto__") {
            throw new DecodeError("The key __proto__ is not allowed");
          }
          state2.key = this.mapKeyConverter(object);
          state2.type = STATE_MAP_VALUE;
          continue DECODE;
        } else {
          state2.map[state2.key] = object;
          state2.readCount++;
          if (state2.readCount === state2.size) {
            object = state2.map;
            stack.release(state2);
          } else {
            state2.key = null;
            state2.type = STATE_MAP_KEY;
            continue DECODE;
          }
        }
      }
      return object;
    }
  }
  readHeadByte() {
    if (this.headByte === HEAD_BYTE_REQUIRED) {
      this.headByte = this.readU8();
    }
    return this.headByte;
  }
  complete() {
    this.headByte = HEAD_BYTE_REQUIRED;
  }
  readArraySize() {
    const headByte = this.readHeadByte();
    switch (headByte) {
      case 220:
        return this.readU16();
      case 221:
        return this.readU32();
      default: {
        if (headByte < 160) {
          return headByte - 144;
        } else {
          throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
        }
      }
    }
  }
  pushMapState(size) {
    if (size > this.maxMapLength) {
      throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
    }
    this.stack.pushMapState(size);
  }
  pushArrayState(size) {
    if (size > this.maxArrayLength) {
      throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
    }
    this.stack.pushArrayState(size);
  }
  decodeString(byteLength, headerOffset) {
    if (!this.rawStrings || this.stateIsMapKey()) {
      return this.decodeUtf8String(byteLength, headerOffset);
    }
    return this.decodeBinary(byteLength, headerOffset);
  }
  /**
   * @throws {@link RangeError}
   */
  decodeUtf8String(byteLength, headerOffset) {
    if (byteLength > this.maxStrLength) {
      throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
    }
    if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
      throw MORE_DATA;
    }
    const offset = this.pos + headerOffset;
    let object;
    if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
      object = this.keyDecoder.decode(this.bytes, offset, byteLength);
    } else {
      object = utf8Decode(this.bytes, offset, byteLength);
    }
    this.pos += headerOffset + byteLength;
    return object;
  }
  stateIsMapKey() {
    if (this.stack.length > 0) {
      const state2 = this.stack.top();
      return state2.type === STATE_MAP_KEY;
    }
    return false;
  }
  /**
   * @throws {@link RangeError}
   */
  decodeBinary(byteLength, headOffset) {
    if (byteLength > this.maxBinLength) {
      throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
    }
    if (!this.hasRemaining(byteLength + headOffset)) {
      throw MORE_DATA;
    }
    const offset = this.pos + headOffset;
    const object = this.bytes.subarray(offset, offset + byteLength);
    this.pos += headOffset + byteLength;
    return object;
  }
  decodeExtension(size, headOffset) {
    if (size > this.maxExtLength) {
      throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
    }
    const extType = this.view.getInt8(this.pos + headOffset);
    const data = this.decodeBinary(
      size,
      headOffset + 1
      /* extType */
    );
    return this.extensionCodec.decode(data, extType, this.context);
  }
  lookU8() {
    return this.view.getUint8(this.pos);
  }
  lookU16() {
    return this.view.getUint16(this.pos);
  }
  lookU32() {
    return this.view.getUint32(this.pos);
  }
  readU8() {
    const value = this.view.getUint8(this.pos);
    this.pos++;
    return value;
  }
  readI8() {
    const value = this.view.getInt8(this.pos);
    this.pos++;
    return value;
  }
  readU16() {
    const value = this.view.getUint16(this.pos);
    this.pos += 2;
    return value;
  }
  readI16() {
    const value = this.view.getInt16(this.pos);
    this.pos += 2;
    return value;
  }
  readU32() {
    const value = this.view.getUint32(this.pos);
    this.pos += 4;
    return value;
  }
  readI32() {
    const value = this.view.getInt32(this.pos);
    this.pos += 4;
    return value;
  }
  readU64() {
    const value = getUint64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readI64() {
    const value = getInt64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readU64AsBigInt() {
    const value = this.view.getBigUint64(this.pos);
    this.pos += 8;
    return value;
  }
  readI64AsBigInt() {
    const value = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return value;
  }
  readF32() {
    const value = this.view.getFloat32(this.pos);
    this.pos += 4;
    return value;
  }
  readF64() {
    const value = this.view.getFloat64(this.pos);
    this.pos += 8;
    return value;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/decode.mjs
function decode(buffer, options) {
  const decoder = new Decoder(options);
  return decoder.decode(buffer);
}

// node_modules/pako/dist/pako.esm.mjs
var Z_FIXED$1 = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN$1 = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = (
  /* extra bits for each length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
);
var extra_dbits = (
  /* extra bits for each distance code */
  new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
);
var extra_blbits = (
  /* extra bits for each bit length code */
  new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
);
var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
var base_dist = new Array(D_CODES$1);
zero$1(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
var static_l_desc;
var static_d_desc;
var static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits = (s, value, length) => {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
var send_code = (s, c, tree) => {
  send_bits(
    s,
    tree[c * 2],
    tree[c * 2 + 1]
    /*.Len*/
  );
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
};
var gen_bitlen = (s, desc) => {
  const tree = desc.dyn_tree;
  const max_code = desc.max_code;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const extra = desc.stat_desc.extra_bits;
  const base = desc.stat_desc.extra_base;
  const max_length = desc.stat_desc.max_length;
  let h;
  let n, m;
  let bits;
  let xbits;
  let f;
  let overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
};
var gen_codes = (tree, max_code, bl_count) => {
  const next_code = new Array(MAX_BITS$1 + 1);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
};
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
};
var init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) {
    do {
      dist = s.pending_buf[s.sym_buf + sx++] & 255;
      dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
      lc = s.pending_buf[s.sym_buf + sx++];
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (sx < s.sym_next);
  }
  send_code(s, END_BLOCK, ltree);
};
var build_tree = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node = elems;
  do {
    n = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[
      1
      /*SMALLEST*/
    ] = s.heap[s.heap_len--];
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
    m = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[
      1
      /*SMALLEST*/
    ] = node++;
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
};
var scan_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var send_tree = (s, tree, max_code) => {
  let n;
  let prevlen = -1;
  let curlen;
  let nextlen = tree[0 * 2 + 1];
  let count = 0;
  let max_count = 7;
  let min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
};
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) {
    if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init$1 = (s) => {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
};
var _tr_stored_block$1 = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) {
    s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  }
  s.pending += stored_len;
};
var _tr_align$1 = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block$1 = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block$1(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
};
var _tr_tally$1 = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var _tr_init_1 = _tr_init$1;
var _tr_stored_block_1 = _tr_stored_block$1;
var _tr_flush_block_1 = _tr_flush_block$1;
var _tr_tally_1 = _tr_tally$1;
var _tr_align_1 = _tr_align$1;
var trees = {
  _tr_init: _tr_init_1,
  _tr_stored_block: _tr_stored_block_1,
  _tr_flush_block: _tr_flush_block_1,
  _tr_tally: _tr_tally_1,
  _tr_align: _tr_align_1
};
var adler32 = (adler, buf, len, pos) => {
  let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
};
var adler32_1 = adler32;
var makeTable = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) {
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  }
  return crc ^ -1;
};
var crc32_1 = crc32;
var messages = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
};
var constants$2 = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  Z_MEM_ERROR: -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$2,
  Z_PARTIAL_FLUSH,
  Z_FULL_FLUSH: Z_FULL_FLUSH$1,
  Z_FINISH: Z_FINISH$3,
  Z_BLOCK: Z_BLOCK$1,
  Z_OK: Z_OK$3,
  Z_STREAM_END: Z_STREAM_END$3,
  Z_STREAM_ERROR: Z_STREAM_ERROR$2,
  Z_DATA_ERROR: Z_DATA_ERROR$2,
  Z_BUF_ERROR: Z_BUF_ERROR$1,
  Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
  Z_FILTERED,
  Z_HUFFMAN_ONLY,
  Z_RLE,
  Z_FIXED,
  Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
  Z_UNKNOWN,
  Z_DEFLATED: Z_DEFLATED$2
} = constants$2;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS$1 = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
};
var slide_hash = (s) => {
  let n, m;
  let p;
  let wsize = s.w_size;
  n = s.hash_size;
  p = n;
  do {
    m = s.head[--p];
    s.head[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
  n = wsize;
  p = n;
  do {
    m = s.prev[--p];
    s.prev[p] = m >= wsize ? m - wsize : 0;
  } while (--n);
};
var HASH_ZLIB = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var HASH = HASH_ZLIB;
var flush_pending = (strm) => {
  const s = strm.state;
  let len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
};
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32_1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32_1(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH;
  let scan_end1 = _win[scan + best_len - 1];
  let scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
};
var fill_window = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
      slide_hash(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
};
var deflate_stored = (s, flush) => {
  let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
  let len, left, have, last = 0;
  let used = s.strm.avail_in;
  do {
    len = 65535;
    have = s.bi_valid + 42 >> 3;
    if (s.strm.avail_out < have) {
      break;
    }
    have = s.strm.avail_out - have;
    left = s.strstart - s.block_start;
    if (len > left + s.strm.avail_in) {
      len = left + s.strm.avail_in;
    }
    if (len > have) {
      len = have;
    }
    if (len < min_block && (len === 0 && flush !== Z_FINISH$3 || flush === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
      break;
    }
    last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
    _tr_stored_block(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending(s.strm);
    if (left) {
      if (left > len) {
        left = len;
      }
      s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
      s.strm.next_out += left;
      s.strm.avail_out -= left;
      s.strm.total_out += left;
      s.block_start += left;
      len -= left;
    }
    if (len) {
      read_buf(s.strm, s.strm.output, s.strm.next_out, len);
      s.strm.next_out += len;
      s.strm.avail_out -= len;
      s.strm.total_out += len;
    }
  } while (last === 0);
  used -= s.strm.avail_in;
  if (used) {
    if (used >= s.w_size) {
      s.matches = 2;
      s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
      s.strstart = s.w_size;
      s.insert = s.strstart;
    } else {
      if (s.window_size - s.strstart <= used) {
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) {
          s.matches++;
        }
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
      }
      s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
      s.strstart += used;
      s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
    }
    s.block_start = s.strstart;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  if (last) {
    return BS_FINISH_DONE;
  }
  if (flush !== Z_NO_FLUSH$2 && flush !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
    return BS_BLOCK_DONE;
  }
  have = s.window_size - s.strstart;
  if (s.strm.avail_in > have && s.block_start >= s.w_size) {
    s.block_start -= s.w_size;
    s.strstart -= s.w_size;
    s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
    if (s.matches < 2) {
      s.matches++;
    }
    have += s.w_size;
    if (s.insert > s.strstart) {
      s.insert = s.strstart;
    }
  }
  if (have > s.strm.avail_in) {
    have = s.strm.avail_in;
  }
  if (have) {
    read_buf(s.strm, s.window, s.strstart, have);
    s.strstart += have;
    s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
  }
  if (s.high_water < s.strstart) {
    s.high_water = s.strstart;
  }
  have = s.bi_valid + 42 >> 3;
  have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
  min_block = have > s.w_size ? s.w_size : have;
  left = s.strstart - s.block_start;
  if (left >= min_block || (left || flush === Z_FINISH$3) && flush !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have) {
    len = left > have ? have : left;
    last = flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
    _tr_stored_block(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending(s.strm);
  }
  return last ? BS_FINISH_STARTED : BS_NEED_MORE;
};
var deflate_fast = (s, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
      }
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_slow = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
var deflate_huff = (s, flush) => {
  let bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$3) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.sym_next) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
};
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
var configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
};
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
  this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
  this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new Uint16Array(MAX_BITS + 1);
  this.heap = new Uint16Array(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new Uint16Array(2 * L_CODES + 1);
  zero(this.depth);
  this.sym_buf = 0;
  this.lit_bufsize = 0;
  this.sym_next = 0;
  this.sym_end = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
var deflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && //#ifdef GZIP
  s.status !== GZIP_STATE && //#endif
  s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) {
    return 1;
  }
  return 0;
};
var deflateResetKeep = (strm) => {
  if (deflateStateCheck(strm)) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  const s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = //#ifdef GZIP
  s.wrap === 2 ? GZIP_STATE : (
    //#endif
    s.wrap ? INIT_STATE : BUSY_STATE
  );
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = -2;
  _tr_init(s);
  return Z_OK$3;
};
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === Z_OK$3) {
    lm_init(strm.state);
  }
  return ret;
};
var deflateSetHeader = (strm, head) => {
  if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$2;
  }
  strm.state.gzhead = head;
  return Z_OK$3;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
  if (!strm) {
    return Z_STREAM_ERROR$2;
  }
  let wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || windowBits === 8 && wrap !== 1) {
    return err(strm, Z_STREAM_ERROR$2);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  const s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.status = INIT_STATE;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new Uint8Array(s.w_size * 2);
  s.head = new Uint16Array(s.hash_size);
  s.prev = new Uint16Array(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new Uint8Array(s.pending_buf_size);
  s.sym_buf = s.lit_bufsize;
  s.sym_end = (s.lit_bufsize - 1) * 3;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
};
var deflateInit = (strm, level) => {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
};
var deflate$2 = (strm, flush) => {
  if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== Z_FINISH$3) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
  }
  const old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$3) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === INIT_STATE && s.wrap === 0) {
    s.status = BUSY_STATE;
  }
  if (s.status === INIT_STATE) {
    let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
    let level_flags = -1;
    if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
      level_flags = 0;
    } else if (s.level < 6) {
      level_flags = 1;
    } else if (s.level === 6) {
      level_flags = 2;
    } else {
      level_flags = 3;
    }
    header |= level_flags << 6;
    if (s.strstart !== 0) {
      header |= PRESET_DICT;
    }
    header += 31 - header % 31;
    putShortMSB(s, header);
    if (s.strstart !== 0) {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    strm.adler = 1;
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (s.status === GZIP_STATE) {
    strm.adler = 0;
    put_byte(s, 31);
    put_byte(s, 139);
    put_byte(s, 8);
    if (!s.gzhead) {
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, 0);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, OS_CODE);
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else {
      put_byte(
        s,
        (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
      );
      put_byte(s, s.gzhead.time & 255);
      put_byte(s, s.gzhead.time >> 8 & 255);
      put_byte(s, s.gzhead.time >> 16 & 255);
      put_byte(s, s.gzhead.time >> 24 & 255);
      put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
      put_byte(s, s.gzhead.os & 255);
      if (s.gzhead.extra && s.gzhead.extra.length) {
        put_byte(s, s.gzhead.extra.length & 255);
        put_byte(s, s.gzhead.extra.length >> 8 & 255);
      }
      if (s.gzhead.hcrc) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
      }
      s.gzindex = 0;
      s.status = EXTRA_STATE;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      let beg = s.pending;
      let left = (s.gzhead.extra.length & 65535) - s.gzindex;
      while (s.pending + left > s.pending_buf_size) {
        let copy = s.pending_buf_size - s.pending;
        s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
        s.pending = s.pending_buf_size;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex += copy;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
        beg = 0;
        left -= copy;
      }
      let gzhead_extra = new Uint8Array(s.gzhead.extra);
      s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
      s.pending += left;
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = NAME_STATE;
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      s.gzindex = 0;
    }
    s.status = COMMENT_STATE;
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      let beg = s.pending;
      let val;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      strm.adler = 0;
    }
    s.status = BUSY_STATE;
    flush_pending(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return Z_OK$3;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$3;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        _tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        _tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH$1) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
  }
  if (flush !== Z_FINISH$3) {
    return Z_OK$3;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$3;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
};
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
};
var deflateSetDictionary = (strm, dictionary) => {
  let dictLength = dictionary.length;
  if (deflateStateCheck(strm)) {
    return Z_STREAM_ERROR$2;
  }
  const s = strm.state;
  const wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR$2;
  }
  if (wrap === 1) {
    strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    let tmpDict = new Uint8Array(s.w_size);
    tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  const avail = strm.avail_in;
  const next = strm.next_in;
  const input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH - 1);
    do {
      s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
      s.prev[str & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$3;
};
var deflateInit_1 = deflateInit;
var deflateInit2_1 = deflateInit2;
var deflateReset_1 = deflateReset;
var deflateResetKeep_1 = deflateResetKeep;
var deflateSetHeader_1 = deflateSetHeader;
var deflate_2$1 = deflate$2;
var deflateEnd_1 = deflateEnd;
var deflateSetDictionary_1 = deflateSetDictionary;
var deflateInfo = "pako deflate (from Nodeca project)";
var deflate_1$2 = {
  deflateInit: deflateInit_1,
  deflateInit2: deflateInit2_1,
  deflateReset: deflateReset_1,
  deflateResetKeep: deflateResetKeep_1,
  deflateSetHeader: deflateSetHeader_1,
  deflate: deflate_2$1,
  deflateEnd: deflateEnd_1,
  deflateSetDictionary: deflateSetDictionary_1,
  deflateInfo
};
var _has = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
var assign = function(obj) {
  const sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    const source = sources.shift();
    if (!source) {
      continue;
    }
    if (typeof source !== "object") {
      throw new TypeError(source + "must be non-object");
    }
    for (const p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }
  return obj;
};
var flattenChunks = (chunks) => {
  let len = 0;
  for (let i = 0, l = chunks.length; i < l; i++) {
    len += chunks[i].length;
  }
  const result = new Uint8Array(len);
  for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
    let chunk = chunks[i];
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var common = {
  assign,
  flattenChunks
};
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new Uint8Array(256);
for (let q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
var string2buf = (str) => {
  if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
    return new TextEncoder().encode(str);
  }
  let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
  }
  buf = new Uint8Array(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 64512) === 56320) {
        c = 65536 + (c - 55296 << 10) + (c2 - 56320);
        m_pos++;
      }
    }
    if (c < 128) {
      buf[i++] = c;
    } else if (c < 2048) {
      buf[i++] = 192 | c >>> 6;
      buf[i++] = 128 | c & 63;
    } else if (c < 65536) {
      buf[i++] = 224 | c >>> 12;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    } else {
      buf[i++] = 240 | c >>> 18;
      buf[i++] = 128 | c >>> 12 & 63;
      buf[i++] = 128 | c >>> 6 & 63;
      buf[i++] = 128 | c & 63;
    }
  }
  return buf;
};
var buf2binstring = (buf, len) => {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK) {
      return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
    }
  }
  let result = "";
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
};
var buf2string = (buf, max) => {
  const len = max || buf.length;
  if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
    return new TextDecoder().decode(buf.subarray(0, max));
  }
  let i, out;
  const utf16buf = new Array(len * 2);
  for (out = 0, i = 0; i < len; ) {
    let c = buf[i++];
    if (c < 128) {
      utf16buf[out++] = c;
      continue;
    }
    let c_len = _utf8len[c];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i += c_len - 1;
      continue;
    }
    c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c = c << 6 | buf[i++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c < 65536) {
      utf16buf[out++] = c;
    } else {
      c -= 65536;
      utf16buf[out++] = 55296 | c >> 10 & 1023;
      utf16buf[out++] = 56320 | c & 1023;
    }
  }
  return buf2binstring(utf16buf, out);
};
var utf8border = (buf, max) => {
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  let pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
var strings = {
  string2buf,
  buf2string,
  utf8border
};
function ZStream() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream;
var toString$1 = Object.prototype.toString;
var {
  Z_NO_FLUSH: Z_NO_FLUSH$1,
  Z_SYNC_FLUSH,
  Z_FULL_FLUSH,
  Z_FINISH: Z_FINISH$2,
  Z_OK: Z_OK$2,
  Z_STREAM_END: Z_STREAM_END$2,
  Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY,
  Z_DEFLATED: Z_DEFLATED$1
} = constants$2;
function Deflate$1(options) {
  this.options = common.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY
  }, options || {});
  let opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = deflate_1$2.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );
  if (status !== Z_OK$2) {
    throw new Error(messages[status]);
  }
  if (opt.header) {
    deflate_1$2.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    let dict;
    if (typeof opt.dictionary === "string") {
      dict = strings.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = deflate_1$2.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    this._dict_set = true;
  }
}
Deflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  let status, _flush_mode;
  if (this.ended) {
    return false;
  }
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
  if (typeof data === "string") {
    strm.input = strings.string2buf(data);
  } else if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    status = deflate_1$2.deflate(strm, _flush_mode);
    if (status === Z_STREAM_END$2) {
      if (strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
      }
      status = deflate_1$2.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK$2;
    }
    if (strm.avail_out === 0) {
      this.onData(strm.output);
      continue;
    }
    if (_flush_mode > 0 && strm.next_out > 0) {
      this.onData(strm.output.subarray(0, strm.next_out));
      strm.avail_out = 0;
      continue;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Deflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK$2) {
    this.result = common.flattenChunks(this.chunks);
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function deflate$1(input, options) {
  const deflator = new Deflate$1(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || messages[deflator.err];
  }
  return deflator.result;
}
function deflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}
function gzip$1(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}
var Deflate_1$1 = Deflate$1;
var deflate_2 = deflate$1;
var deflateRaw_1$1 = deflateRaw$1;
var gzip_1$1 = gzip$1;
var constants$1 = constants$2;
var deflate_1$1 = {
  Deflate: Deflate_1$1,
  deflate: deflate_2,
  deflateRaw: deflateRaw_1$1,
  gzip: gzip_1$1,
  constants: constants$1
};
var BAD$1 = 16209;
var TYPE$1 = 16191;
var inffast = function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op;
  let len;
  let dist;
  let from2;
  let from_source;
  let input, output;
  const state2 = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state2.dmax;
  wsize = state2.wsize;
  whave = state2.whave;
  wnext = state2.wnext;
  s_window = state2.window;
  hold = state2.hold;
  bits = state2.bits;
  lcode = state2.lencode;
  dcode = state2.distcode;
  lmask = (1 << state2.lenbits) - 1;
  dmask = (1 << state2.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0) {
            output[_out++] = here & 65535;
          } else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state2.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state2.sane) {
                        strm.msg = "invalid distance too far back";
                        state2.mode = BAD$1;
                        break top;
                      }
                    }
                    from2 = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from2 += wsize - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from2++];
                        } while (--op);
                        from2 = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from2 += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from2++];
                        } while (--op);
                        from2 = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from2 += wnext - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from2++];
                        } while (--op);
                        from2 = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from2++];
                      output[_out++] = from_source[from2++];
                      output[_out++] = from_source[from2++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from2++];
                      if (len > 1) {
                        output[_out++] = from_source[from2++];
                      }
                    }
                  } else {
                    from2 = _out - dist;
                    do {
                      output[_out++] = output[from2++];
                      output[_out++] = output[from2++];
                      output[_out++] = output[from2++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from2++];
                      if (len > 1) {
                        output[_out++] = output[from2++];
                      }
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state2.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state2.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state2.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state2.hold = hold;
  state2.bits = bits;
  return;
};
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
]);
var lext = new Uint8Array([
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
]);
var dbase = new Uint16Array([
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
]);
var dext = new Uint8Array([
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
]);
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
  const bits = opts.bits;
  let len = 0;
  let sym = 0;
  let min = 0, max = 0;
  let root = 0;
  let curr = 0;
  let drop = 0;
  let left = 0;
  let used = 0;
  let huff = 0;
  let incr;
  let fill;
  let low;
  let mask;
  let next;
  let base = null;
  let match;
  const count = new Uint16Array(MAXBITS + 1);
  const offs = new Uint16Array(MAXBITS + 1);
  let extra = null;
  let here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES$1) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$1) {
    base = lbase;
    extra = lext;
    match = 257;
  } else {
    base = dbase;
    extra = dext;
    match = 0;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] + 1 < match) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] >= match) {
      here_op = extra[work[sym] - match];
      here_val = base[work[sym] - match];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var inftrees = inflate_table;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var {
  Z_FINISH: Z_FINISH$1,
  Z_BLOCK,
  Z_TREES,
  Z_OK: Z_OK$1,
  Z_STREAM_END: Z_STREAM_END$1,
  Z_NEED_DICT: Z_NEED_DICT$1,
  Z_STREAM_ERROR: Z_STREAM_ERROR$1,
  Z_DATA_ERROR: Z_DATA_ERROR$1,
  Z_MEM_ERROR: Z_MEM_ERROR$1,
  Z_BUF_ERROR,
  Z_DEFLATED
} = constants$2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var MAX_WBITS = 15;
var DEF_WBITS = MAX_WBITS;
var zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
function InflateState() {
  this.strm = null;
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new Uint16Array(320);
  this.work = new Uint16Array(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
var inflateStateCheck = (strm) => {
  if (!strm) {
    return 1;
  }
  const state2 = strm.state;
  if (!state2 || state2.strm !== strm || state2.mode < HEAD || state2.mode > SYNC) {
    return 1;
  }
  return 0;
};
var inflateResetKeep = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state2 = strm.state;
  strm.total_in = strm.total_out = state2.total = 0;
  strm.msg = "";
  if (state2.wrap) {
    strm.adler = state2.wrap & 1;
  }
  state2.mode = HEAD;
  state2.last = 0;
  state2.havedict = 0;
  state2.flags = -1;
  state2.dmax = 32768;
  state2.head = null;
  state2.hold = 0;
  state2.bits = 0;
  state2.lencode = state2.lendyn = new Int32Array(ENOUGH_LENS);
  state2.distcode = state2.distdyn = new Int32Array(ENOUGH_DISTS);
  state2.sane = 1;
  state2.back = -1;
  return Z_OK$1;
};
var inflateReset = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state2 = strm.state;
  state2.wsize = 0;
  state2.whave = 0;
  state2.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state2 = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 5;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR$1;
  }
  if (state2.window !== null && state2.wbits !== windowBits) {
    state2.window = null;
  }
  state2.wrap = wrap;
  state2.wbits = windowBits;
  return inflateReset(strm);
};
var inflateInit2 = (strm, windowBits) => {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  const state2 = new InflateState();
  strm.state = state2;
  state2.strm = strm;
  state2.window = null;
  state2.mode = HEAD;
  const ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK$1) {
    strm.state = null;
  }
  return ret;
};
var inflateInit = (strm) => {
  return inflateInit2(strm, DEF_WBITS);
};
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state2) => {
  if (virgin) {
    lenfix = new Int32Array(512);
    distfix = new Int32Array(32);
    let sym = 0;
    while (sym < 144) {
      state2.lens[sym++] = 8;
    }
    while (sym < 256) {
      state2.lens[sym++] = 9;
    }
    while (sym < 280) {
      state2.lens[sym++] = 7;
    }
    while (sym < 288) {
      state2.lens[sym++] = 8;
    }
    inftrees(LENS, state2.lens, 0, 288, lenfix, 0, state2.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state2.lens[sym++] = 5;
    }
    inftrees(DISTS, state2.lens, 0, 32, distfix, 0, state2.work, { bits: 5 });
    virgin = false;
  }
  state2.lencode = lenfix;
  state2.lenbits = 9;
  state2.distcode = distfix;
  state2.distbits = 5;
};
var updatewindow = (strm, src, end, copy) => {
  let dist;
  const state2 = strm.state;
  if (state2.window === null) {
    state2.wsize = 1 << state2.wbits;
    state2.wnext = 0;
    state2.whave = 0;
    state2.window = new Uint8Array(state2.wsize);
  }
  if (copy >= state2.wsize) {
    state2.window.set(src.subarray(end - state2.wsize, end), 0);
    state2.wnext = 0;
    state2.whave = state2.wsize;
  } else {
    dist = state2.wsize - state2.wnext;
    if (dist > copy) {
      dist = copy;
    }
    state2.window.set(src.subarray(end - copy, end - copy + dist), state2.wnext);
    copy -= dist;
    if (copy) {
      state2.window.set(src.subarray(end - copy, end), 0);
      state2.wnext = copy;
      state2.whave = state2.wsize;
    } else {
      state2.wnext += dist;
      if (state2.wnext === state2.wsize) {
        state2.wnext = 0;
      }
      if (state2.whave < state2.wsize) {
        state2.whave += dist;
      }
    }
  }
  return 0;
};
var inflate$2 = (strm, flush) => {
  let state2;
  let input, output;
  let next;
  let put;
  let have, left;
  let hold;
  let bits;
  let _in, _out;
  let copy;
  let from2;
  let from_source;
  let here = 0;
  let here_bits, here_op, here_val;
  let last_bits, last_op, last_val;
  let len;
  let ret;
  const hbuf = new Uint8Array(4);
  let opts;
  let n;
  const order = (
    /* permutation of code lengths */
    new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
  );
  if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR$1;
  }
  state2 = strm.state;
  if (state2.mode === TYPE) {
    state2.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state2.hold;
  bits = state2.bits;
  _in = have;
  _out = left;
  ret = Z_OK$1;
  inf_leave:
    for (; ; ) {
      switch (state2.mode) {
        case HEAD:
          if (state2.wrap === 0) {
            state2.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state2.wrap & 2 && hold === 35615) {
            if (state2.wbits === 0) {
              state2.wbits = 15;
            }
            state2.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state2.check = crc32_1(state2.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state2.mode = FLAGS;
            break;
          }
          if (state2.head) {
            state2.head.done = false;
          }
          if (!(state2.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state2.mode = BAD;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state2.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state2.wbits === 0) {
            state2.wbits = len;
          }
          if (len > 15 || len > state2.wbits) {
            strm.msg = "invalid window size";
            state2.mode = BAD;
            break;
          }
          state2.dmax = 1 << state2.wbits;
          state2.flags = 0;
          strm.adler = state2.check = 1;
          state2.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state2.flags = hold;
          if ((state2.flags & 255) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state2.mode = BAD;
            break;
          }
          if (state2.flags & 57344) {
            strm.msg = "unknown header flags set";
            state2.mode = BAD;
            break;
          }
          if (state2.head) {
            state2.head.text = hold >> 8 & 1;
          }
          if (state2.flags & 512 && state2.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state2.check = crc32_1(state2.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state2.mode = TIME;
        /* falls through */
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state2.head) {
            state2.head.time = hold;
          }
          if (state2.flags & 512 && state2.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state2.check = crc32_1(state2.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state2.mode = OS;
        /* falls through */
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state2.head) {
            state2.head.xflags = hold & 255;
            state2.head.os = hold >> 8;
          }
          if (state2.flags & 512 && state2.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state2.check = crc32_1(state2.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state2.mode = EXLEN;
        /* falls through */
        case EXLEN:
          if (state2.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state2.length = hold;
            if (state2.head) {
              state2.head.extra_len = hold;
            }
            if (state2.flags & 512 && state2.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state2.check = crc32_1(state2.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state2.head) {
            state2.head.extra = null;
          }
          state2.mode = EXTRA;
        /* falls through */
        case EXTRA:
          if (state2.flags & 1024) {
            copy = state2.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state2.head) {
                len = state2.head.extra_len - state2.length;
                if (!state2.head.extra) {
                  state2.head.extra = new Uint8Array(state2.head.extra_len);
                }
                state2.head.extra.set(
                  input.subarray(
                    next,
                    // extra field is limited to 65536 bytes
                    // - no need for additional size check
                    next + copy
                  ),
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state2.flags & 512 && state2.wrap & 4) {
                state2.check = crc32_1(state2.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state2.length -= copy;
            }
            if (state2.length) {
              break inf_leave;
            }
          }
          state2.length = 0;
          state2.mode = NAME;
        /* falls through */
        case NAME:
          if (state2.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state2.head && len && state2.length < 65536) {
                state2.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state2.flags & 512 && state2.wrap & 4) {
              state2.check = crc32_1(state2.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state2.head) {
            state2.head.name = null;
          }
          state2.length = 0;
          state2.mode = COMMENT;
        /* falls through */
        case COMMENT:
          if (state2.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state2.head && len && state2.length < 65536) {
                state2.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state2.flags & 512 && state2.wrap & 4) {
              state2.check = crc32_1(state2.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state2.head) {
            state2.head.comment = null;
          }
          state2.mode = HCRC;
        /* falls through */
        case HCRC:
          if (state2.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state2.wrap & 4 && hold !== (state2.check & 65535)) {
              strm.msg = "header crc mismatch";
              state2.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state2.head) {
            state2.head.hcrc = state2.flags >> 9 & 1;
            state2.head.done = true;
          }
          strm.adler = state2.check = 0;
          state2.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state2.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state2.mode = DICT;
        /* falls through */
        case DICT:
          if (state2.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state2.hold = hold;
            state2.bits = bits;
            return Z_NEED_DICT$1;
          }
          strm.adler = state2.check = 1;
          state2.mode = TYPE;
        /* falls through */
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case TYPEDO:
          if (state2.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state2.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state2.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state2.mode = STORED;
              break;
            case 1:
              fixedtables(state2);
              state2.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state2.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state2.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state2.mode = BAD;
            break;
          }
          state2.length = hold & 65535;
          hold = 0;
          bits = 0;
          state2.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case COPY_:
          state2.mode = COPY;
        /* falls through */
        case COPY:
          copy = state2.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state2.length -= copy;
            break;
          }
          state2.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state2.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state2.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state2.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state2.nlen > 286 || state2.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state2.mode = BAD;
            break;
          }
          state2.have = 0;
          state2.mode = LENLENS;
        /* falls through */
        case LENLENS:
          while (state2.have < state2.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state2.lens[order[state2.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state2.have < 19) {
            state2.lens[order[state2.have++]] = 0;
          }
          state2.lencode = state2.lendyn;
          state2.lenbits = 7;
          opts = { bits: state2.lenbits };
          ret = inftrees(CODES, state2.lens, 0, 19, state2.lencode, 0, state2.work, opts);
          state2.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state2.mode = BAD;
            break;
          }
          state2.have = 0;
          state2.mode = CODELENS;
        /* falls through */
        case CODELENS:
          while (state2.have < state2.nlen + state2.ndist) {
            for (; ; ) {
              here = state2.lencode[hold & (1 << state2.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state2.lens[state2.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state2.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state2.mode = BAD;
                  break;
                }
                len = state2.lens[state2.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state2.have + copy > state2.nlen + state2.ndist) {
                strm.msg = "invalid bit length repeat";
                state2.mode = BAD;
                break;
              }
              while (copy--) {
                state2.lens[state2.have++] = len;
              }
            }
          }
          if (state2.mode === BAD) {
            break;
          }
          if (state2.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state2.mode = BAD;
            break;
          }
          state2.lenbits = 9;
          opts = { bits: state2.lenbits };
          ret = inftrees(LENS, state2.lens, 0, state2.nlen, state2.lencode, 0, state2.work, opts);
          state2.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state2.mode = BAD;
            break;
          }
          state2.distbits = 6;
          state2.distcode = state2.distdyn;
          opts = { bits: state2.distbits };
          ret = inftrees(DISTS, state2.lens, state2.nlen, state2.ndist, state2.distcode, 0, state2.work, opts);
          state2.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state2.mode = BAD;
            break;
          }
          state2.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        /* falls through */
        case LEN_:
          state2.mode = LEN;
        /* falls through */
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state2.hold = hold;
            state2.bits = bits;
            inffast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state2.hold;
            bits = state2.bits;
            if (state2.mode === TYPE) {
              state2.back = -1;
            }
            break;
          }
          state2.back = 0;
          for (; ; ) {
            here = state2.lencode[hold & (1 << state2.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state2.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state2.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state2.back += here_bits;
          state2.length = here_val;
          if (here_op === 0) {
            state2.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state2.back = -1;
            state2.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state2.mode = BAD;
            break;
          }
          state2.extra = here_op & 15;
          state2.mode = LENEXT;
        /* falls through */
        case LENEXT:
          if (state2.extra) {
            n = state2.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state2.length += hold & (1 << state2.extra) - 1;
            hold >>>= state2.extra;
            bits -= state2.extra;
            state2.back += state2.extra;
          }
          state2.was = state2.length;
          state2.mode = DIST;
        /* falls through */
        case DIST:
          for (; ; ) {
            here = state2.distcode[hold & (1 << state2.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state2.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state2.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state2.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state2.mode = BAD;
            break;
          }
          state2.offset = here_val;
          state2.extra = here_op & 15;
          state2.mode = DISTEXT;
        /* falls through */
        case DISTEXT:
          if (state2.extra) {
            n = state2.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state2.offset += hold & (1 << state2.extra) - 1;
            hold >>>= state2.extra;
            bits -= state2.extra;
            state2.back += state2.extra;
          }
          if (state2.offset > state2.dmax) {
            strm.msg = "invalid distance too far back";
            state2.mode = BAD;
            break;
          }
          state2.mode = MATCH;
        /* falls through */
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state2.offset > copy) {
            copy = state2.offset - copy;
            if (copy > state2.whave) {
              if (state2.sane) {
                strm.msg = "invalid distance too far back";
                state2.mode = BAD;
                break;
              }
            }
            if (copy > state2.wnext) {
              copy -= state2.wnext;
              from2 = state2.wsize - copy;
            } else {
              from2 = state2.wnext - copy;
            }
            if (copy > state2.length) {
              copy = state2.length;
            }
            from_source = state2.window;
          } else {
            from_source = output;
            from2 = put - state2.offset;
            copy = state2.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state2.length -= copy;
          do {
            output[put++] = from_source[from2++];
          } while (--copy);
          if (state2.length === 0) {
            state2.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state2.length;
          left--;
          state2.mode = LEN;
          break;
        case CHECK:
          if (state2.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state2.total += _out;
            if (state2.wrap & 4 && _out) {
              strm.adler = state2.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
              state2.flags ? crc32_1(state2.check, output, _out, put - _out) : adler32_1(state2.check, output, _out, put - _out);
            }
            _out = left;
            if (state2.wrap & 4 && (state2.flags ? hold : zswap32(hold)) !== state2.check) {
              strm.msg = "incorrect data check";
              state2.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state2.mode = LENGTH;
        /* falls through */
        case LENGTH:
          if (state2.wrap && state2.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state2.wrap & 4 && hold !== (state2.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state2.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state2.mode = DONE;
        /* falls through */
        case DONE:
          ret = Z_STREAM_END$1;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR$1;
        case SYNC:
        /* falls through */
        default:
          return Z_STREAM_ERROR$1;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state2.hold = hold;
  state2.bits = bits;
  if (state2.wsize || _out !== strm.avail_out && state2.mode < BAD && (state2.mode < CHECK || flush !== Z_FINISH$1)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state2.total += _out;
  if (state2.wrap & 4 && _out) {
    strm.adler = state2.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
    state2.flags ? crc32_1(state2.check, output, _out, strm.next_out - _out) : adler32_1(state2.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state2.bits + (state2.last ? 64 : 0) + (state2.mode === TYPE ? 128 : 0) + (state2.mode === LEN_ || state2.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH$1) && ret === Z_OK$1) {
    ret = Z_BUF_ERROR;
  }
  return ret;
};
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  let state2 = strm.state;
  if (state2.window) {
    state2.window = null;
  }
  strm.state = null;
  return Z_OK$1;
};
var inflateGetHeader = (strm, head) => {
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  const state2 = strm.state;
  if ((state2.wrap & 2) === 0) {
    return Z_STREAM_ERROR$1;
  }
  state2.head = head;
  head.done = false;
  return Z_OK$1;
};
var inflateSetDictionary = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state2;
  let dictid;
  let ret;
  if (inflateStateCheck(strm)) {
    return Z_STREAM_ERROR$1;
  }
  state2 = strm.state;
  if (state2.wrap !== 0 && state2.mode !== DICT) {
    return Z_STREAM_ERROR$1;
  }
  if (state2.mode === DICT) {
    dictid = 1;
    dictid = adler32_1(dictid, dictionary, dictLength, 0);
    if (dictid !== state2.check) {
      return Z_DATA_ERROR$1;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state2.mode = MEM;
    return Z_MEM_ERROR$1;
  }
  state2.havedict = 1;
  return Z_OK$1;
};
var inflateReset_1 = inflateReset;
var inflateReset2_1 = inflateReset2;
var inflateResetKeep_1 = inflateResetKeep;
var inflateInit_1 = inflateInit;
var inflateInit2_1 = inflateInit2;
var inflate_2$1 = inflate$2;
var inflateEnd_1 = inflateEnd;
var inflateGetHeader_1 = inflateGetHeader;
var inflateSetDictionary_1 = inflateSetDictionary;
var inflateInfo = "pako inflate (from Nodeca project)";
var inflate_1$2 = {
  inflateReset: inflateReset_1,
  inflateReset2: inflateReset2_1,
  inflateResetKeep: inflateResetKeep_1,
  inflateInit: inflateInit_1,
  inflateInit2: inflateInit2_1,
  inflate: inflate_2$1,
  inflateEnd: inflateEnd_1,
  inflateGetHeader: inflateGetHeader_1,
  inflateSetDictionary: inflateSetDictionary_1,
  inflateInfo
};
function GZheader() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader;
var toString2 = Object.prototype.toString;
var {
  Z_NO_FLUSH,
  Z_FINISH,
  Z_OK,
  Z_STREAM_END,
  Z_NEED_DICT,
  Z_STREAM_ERROR,
  Z_DATA_ERROR,
  Z_MEM_ERROR
} = constants$2;
function Inflate$1(options) {
  this.options = common.assign({
    chunkSize: 1024 * 64,
    windowBits: 15,
    to: ""
  }, options || {});
  const opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new zstream();
  this.strm.avail_out = 0;
  let status = inflate_1$2.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status !== Z_OK) {
    throw new Error(messages[status]);
  }
  this.header = new gzheader();
  inflate_1$2.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString2.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== Z_OK) {
        throw new Error(messages[status]);
      }
    }
  }
}
Inflate$1.prototype.push = function(data, flush_mode) {
  const strm = this.strm;
  const chunkSize = this.options.chunkSize;
  const dictionary = this.options.dictionary;
  let status, _flush_mode, last_avail_out;
  if (this.ended) return false;
  if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
  else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
  if (toString2.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  for (; ; ) {
    if (strm.avail_out === 0) {
      strm.output = new Uint8Array(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = inflate_1$2.inflate(strm, _flush_mode);
    if (status === Z_NEED_DICT && dictionary) {
      status = inflate_1$2.inflateSetDictionary(strm, dictionary);
      if (status === Z_OK) {
        status = inflate_1$2.inflate(strm, _flush_mode);
      } else if (status === Z_DATA_ERROR) {
        status = Z_NEED_DICT;
      }
    }
    while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
      inflate_1$2.inflateReset(strm);
      status = inflate_1$2.inflate(strm, _flush_mode);
    }
    switch (status) {
      case Z_STREAM_ERROR:
      case Z_DATA_ERROR:
      case Z_NEED_DICT:
      case Z_MEM_ERROR:
        this.onEnd(status);
        this.ended = true;
        return false;
    }
    last_avail_out = strm.avail_out;
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === Z_STREAM_END) {
        if (this.options.to === "string") {
          let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          let tail = strm.next_out - next_out_utf8;
          let utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
          this.onData(utf8str);
        } else {
          this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
        }
      }
    }
    if (status === Z_OK && last_avail_out === 0) continue;
    if (status === Z_STREAM_END) {
      status = inflate_1$2.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return true;
    }
    if (strm.avail_in === 0) break;
  }
  return true;
};
Inflate$1.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate$1.prototype.onEnd = function(status) {
  if (status === Z_OK) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = common.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function inflate$1(input, options) {
  const inflator = new Inflate$1(options);
  inflator.push(input);
  if (inflator.err) throw inflator.msg || messages[inflator.err];
  return inflator.result;
}
function inflateRaw$1(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}
var Inflate_1$1 = Inflate$1;
var inflate_2 = inflate$1;
var inflateRaw_1$1 = inflateRaw$1;
var ungzip$1 = inflate$1;
var constants = constants$2;
var inflate_1$1 = {
  Inflate: Inflate_1$1,
  inflate: inflate_2,
  inflateRaw: inflateRaw_1$1,
  ungzip: ungzip$1,
  constants
};
var { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;
var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
var deflate_1 = deflate;
var inflate_1 = inflate;

// network/MessageCodec.ts
var DEFAULT_COMPRESSION = {
  enabled: true,
  threshold: 1024,
  level: 6
};
var DEFAULT_CODEC_CONFIG = {
  format: "msgpack",
  compression: DEFAULT_COMPRESSION
};
var FLAG_COMPRESSED = 1;
var FLAG_ENCRYPTED = 2;
var MessageCodec = class _MessageCodec {
  constructor(config = {}) {
    __publicField(this, "config");
    this.config = {
      format: config.format ?? DEFAULT_CODEC_CONFIG.format,
      compression: {
        ...DEFAULT_COMPRESSION,
        ...config.compression
      }
    };
  }
  /**
   * Get current codec configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update codec configuration
   */
  setConfig(config) {
    if (config.format !== void 0) {
      this.config.format = config.format;
    }
    if (config.compression !== void 0) {
      this.config.compression = {
        ...this.config.compression,
        ...config.compression
      };
    }
  }
  /**
   * Encode a message for transmission
   *
   * @param message - Any JSON-serializable object
   * @returns Encoded data (Uint8Array for msgpack, string for JSON)
   */
  encode(message) {
    if (this.config.format === "json") {
      return this.encodeJSON(message);
    }
    return this.encodeBinary(message);
  }
  /**
   * Decode received data back to a message object
   *
   * @param data - Encoded data (Uint8Array, ArrayBuffer, or string)
   * @returns Decoded message object
   */
  decode(data) {
    if (typeof data === "string") {
      return this.decodeJSON(data);
    }
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    if (bytes.length > 0 && (bytes[0] === 123 || bytes[0] === 91)) {
      const str = new TextDecoder().decode(bytes);
      return this.decodeJSON(str);
    }
    return this.decodeBinary(bytes);
  }
  /**
   * Check if data appears to be binary encoded
   */
  isBinaryEncoded(data) {
    if (typeof data === "string") {
      return false;
    }
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    return bytes.length > 0 && bytes[0] !== 123 && bytes[0] !== 91;
  }
  // ─────────────────────────────────────────────────────────────
  // JSON Encoding (fallback/compatibility)
  // ─────────────────────────────────────────────────────────────
  encodeJSON(message) {
    return JSON.stringify(message);
  }
  decodeJSON(data) {
    return JSON.parse(data);
  }
  // ─────────────────────────────────────────────────────────────
  // Binary Encoding (MessagePack + Compression)
  // ─────────────────────────────────────────────────────────────
  encodeBinary(message) {
    let payload = encode(message);
    let flags = 0;
    if (this.config.compression.enabled && payload.length > this.config.compression.threshold) {
      const compressed = deflate_1(payload, {
        level: this.config.compression.level
      });
      if (compressed.length < payload.length) {
        payload = compressed;
        flags |= FLAG_COMPRESSED;
      }
    }
    const result = new Uint8Array(1 + payload.length);
    result[0] = flags;
    result.set(payload, 1);
    return result;
  }
  decodeBinary(data) {
    if (data.length < 1) {
      throw new Error("MessageCodec: Empty binary data");
    }
    const flags = data[0];
    let payload = data.slice(1);
    if (flags & FLAG_COMPRESSED) {
      payload = inflate_1(payload);
    }
    if (flags & FLAG_ENCRYPTED) {
      throw new Error("MessageCodec: Encryption not yet implemented");
    }
    return decode(payload);
  }
  // ─────────────────────────────────────────────────────────────
  // Static Utilities
  // ─────────────────────────────────────────────────────────────
  /**
   * Create a codec with JSON format (for compatibility)
   */
  static json() {
    return new _MessageCodec({ format: "json" });
  }
  /**
   * Create a codec with MessagePack format (default)
   */
  static msgpack(compression) {
    return new _MessageCodec({
      format: "msgpack",
      compression: compression ? { ...DEFAULT_COMPRESSION, ...compression } : void 0
    });
  }
  /**
   * Create a codec with compression disabled
   */
  static uncompressed(format = "msgpack") {
    return new _MessageCodec({
      format,
      compression: { enabled: false, threshold: 0, level: 6 }
    });
  }
};
var defaultCodec = new MessageCodec();
var jsonCodec = MessageCodec.json();

// examples/confluence/web/ws-shim.js
var WebSocket = class extends globalThis.WebSocket {
  constructor(url, protocols) {
    super(url, protocols);
  }
};
var originalAddEventListener = globalThis.WebSocket.prototype.addEventListener;
globalThis.WebSocket.prototype.addEventListener = function(type, listener, options) {
  if (type === "message") {
    const wrapped = (event) => listener.call(this, event.data);
    wrapped._original = listener;
    return originalAddEventListener.call(this, type, wrapped, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// network/PeerConnection.ts
var DEFAULT_RECONNECT_CONFIG = {
  enabled: true,
  initialDelay: 1e3,
  maxDelay: 3e4,
  multiplier: 2,
  maxAttempts: Infinity,
  jitter: true
};
var PeerConnection = class extends Emitter {
  constructor(url, engine = null, options = {}) {
    super();
    __publicField(this, "url");
    __publicField(this, "engine");
    __publicField(this, "socket");
    __publicField(this, "connected");
    __publicField(this, "peerId", null);
    __publicField(this, "peers", /* @__PURE__ */ new Set());
    __publicField(this, "codec");
    __publicField(this, "binaryMode");
    // Reconnection state
    __publicField(this, "reconnectConfig");
    __publicField(this, "connectionState", "disconnected" /* Disconnected */);
    __publicField(this, "reconnectAttempts", 0);
    __publicField(this, "reconnectTimer", null);
    __publicField(this, "intentionalClose", false);
    __publicField(this, "messageBuffer", []);
    __publicField(this, "messageBufferSize");
    this.url = url;
    this.engine = engine;
    this.socket = null;
    this.connected = false;
    if (options.codec instanceof MessageCodec) {
      this.codec = options.codec;
    } else if (options.codec) {
      this.codec = new MessageCodec(options.codec);
    } else {
      this.codec = jsonCodec;
    }
    this.binaryMode = options.binaryMode ?? this.codec.getConfig().format === "msgpack";
    if (options.reconnect === false) {
      this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, enabled: false };
    } else {
      this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...options.reconnect };
    }
    this.messageBufferSize = options.messageBufferSize ?? 100;
  }
  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState;
  }
  /**
   * Get number of reconnection attempts
   */
  getReconnectAttempts() {
    return this.reconnectAttempts;
  }
  /**
   * Get the current message codec
   */
  getCodec() {
    return this.codec;
  }
  /**
   * Set a new message codec
   */
  setCodec(codec) {
    this.codec = codec;
    this.binaryMode = codec.getConfig().format === "msgpack";
  }
  connect() {
    this.intentionalClose = false;
    this._connect();
  }
  /**
   * Internal connect implementation
   */
  _connect() {
    this._cancelReconnect();
    this.connectionState = this.reconnectAttempts > 0 ? "reconnecting" /* Reconnecting */ : "connecting" /* Connecting */;
    const WS = typeof WebSocket !== "undefined" ? WebSocket : globalThis.WebSocket;
    try {
      this.socket = new WS(this.url);
    } catch (err2) {
      console.error("[PeerConnection] Failed to create WebSocket:", err2);
      this._scheduleReconnect();
      return;
    }
    if (!this.socket) return;
    if (this.binaryMode && this.socket.binaryType !== void 0) {
      this.socket.binaryType = "arraybuffer";
    }
    if (typeof this.socket.on === "function") {
      this.socket.on("open", () => this._onOpen());
      this.socket.on("message", (data) => this._handleMessageData(data));
      this.socket.on("close", (code, reason) => this._onClose(code, reason));
      this.socket.on("error", (err2) => this._onError(err2));
    } else {
      this.socket.addEventListener("open", () => this._onOpen());
      this.socket.addEventListener("message", (ev) => this._handleMessageEvent(ev));
      this.socket.addEventListener("close", (ev) => this._onClose(ev.code, ev.reason));
      this.socket.addEventListener("error", (err2) => this._onError(err2));
    }
  }
  /**
   * Disconnect and don't reconnect
   */
  disconnect() {
    this.intentionalClose = true;
    this._cancelReconnect();
    if (this.socket) {
      this.socket.close(1e3, "Client disconnect");
    }
    this.connectionState = "disconnected" /* Disconnected */;
  }
  /**
   * Reset reconnection state (call before re-connecting after intentional disconnect)
   */
  resetReconnection() {
    this.reconnectAttempts = 0;
    this.intentionalClose = false;
  }
  sendToPeer(targetPeerId, payload) {
    this._send({ type: "p2p", targetPeerId, payload });
  }
  broadcast(type, payload = {}) {
    this._send({ type, payload });
  }
  _send(msg) {
    if (this.connectionState === "reconnecting" /* Reconnecting */) {
      if (this.messageBuffer.length < this.messageBufferSize) {
        this.messageBuffer.push(msg);
      }
      return;
    }
    if (!this.socket || this.socket.readyState !== 1) return;
    const encoded = this.codec.encode(msg);
    this.socket.send(encoded);
  }
  /**
   * Flush buffered messages after reconnection
   */
  _flushMessageBuffer() {
    const buffered = this.messageBuffer.splice(0);
    for (const msg of buffered) {
      this._send(msg);
    }
  }
  // --- Event Handlers ---
  _onOpen() {
    const wasReconnecting = this.connectionState === "reconnecting" /* Reconnecting */;
    this.connected = true;
    this.connectionState = "connected" /* Connected */;
    if (wasReconnecting) {
      console.log(`[PeerConnection] Reconnected after ${this.reconnectAttempts} attempts`);
      this.emit("net:reconnected", { attempts: this.reconnectAttempts });
      this._flushMessageBuffer();
    } else {
      this.emit("net:connected");
    }
    this.reconnectAttempts = 0;
  }
  _onClose(code, reason) {
    this.connected = false;
    this.socket = null;
    const isNormalClosure = code === 1e3 || code === 1001;
    if (this.intentionalClose || isNormalClosure) {
      this.peers.clear();
      this.connectionState = "disconnected" /* Disconnected */;
      this.emit("net:disconnected", { code, reason, intentional: true });
      return;
    }
    this.connectionState = "reconnecting" /* Reconnecting */;
    this.emit("net:disconnected", { code, reason, intentional: false });
    this._scheduleReconnect();
  }
  _onError(err2) {
    this.emit("net:error", { payload: { error: err2 } });
  }
  // --- Reconnection Logic ---
  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  _scheduleReconnect() {
    if (!this.reconnectConfig.enabled) {
      console.log("[PeerConnection] Reconnection disabled");
      return;
    }
    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      console.error(`[PeerConnection] Max reconnection attempts (${this.reconnectConfig.maxAttempts}) exceeded`);
      this.connectionState = "disconnected" /* Disconnected */;
      this.emit("net:error", {
        payload: { error: new Error("Max reconnection attempts exceeded") }
      });
      return;
    }
    let delay = this.reconnectConfig.initialDelay * Math.pow(this.reconnectConfig.multiplier, this.reconnectAttempts);
    delay = Math.min(delay, this.reconnectConfig.maxDelay);
    if (this.reconnectConfig.jitter) {
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay = Math.round(delay + jitter);
    }
    this.reconnectAttempts++;
    console.log(`[PeerConnection] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.reconnectConfig.maxAttempts === Infinity ? "\u221E" : this.reconnectConfig.maxAttempts})`);
    this.emit("net:reconnecting", {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.reconnectConfig.maxAttempts
    });
    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }
  /**
   * Cancel pending reconnection
   */
  _cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  // Browser-style event wrapper
  _handleMessageEvent(ev) {
    this._handleMessageData(ev.data);
  }
  // Core logic handling raw data string/buffer
  _handleMessageData(data) {
    try {
      const msg = this.codec.decode(data);
      switch (msg.type) {
        case "welcome":
          this.peerId = msg.peerId;
          this.emit("net:ready", { peerId: this.peerId });
          break;
        case "peer:joined":
          if (msg.peerId !== this.peerId) {
            this.peers.add(msg.peerId);
            this.emit("net:peer:connected", { peerId: msg.peerId });
          }
          break;
        case "peer:left":
          this.peers.delete(msg.peerId);
          this.emit("net:peer:disconnected", { peerId: msg.peerId });
          break;
        case "p2p":
          this.emit("net:message", {
            ...msg.payload,
            fromPeerId: msg.fromPeerId
          });
          break;
        case "error":
          this.emit("net:error", msg);
          break;
        default:
          this.emit("net:message", msg);
          break;
      }
    } catch (err2) {
      console.error("Network parse error", err2);
    }
  }
};

// network/HybridPeerManager.ts
init_events();

// network/WebRTCConnection.ts
init_events();
var DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ],
  ordered: true,
  maxRetransmits: 3,
  enableTurnFallback: true,
  connectionTimeout: 15e3,
  // 15 seconds
  maxRetries: 1
};
var DEFAULT_TURN_SERVERS = [
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject"
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];
var WebRTCConnection = class extends Emitter {
  constructor(remotePeerId, config = DEFAULT_RTC_CONFIG) {
    super();
    __publicField(this, "peerConnection");
    // Initialized in initializePeerConnection()
    __publicField(this, "dataChannel", null);
    __publicField(this, "remotePeerId");
    __publicField(this, "config");
    __publicField(this, "connectionState", "new");
    __publicField(this, "connectionTimeout", null);
    __publicField(this, "retryCount", 0);
    __publicField(this, "usingTurn", false);
    __publicField(this, "codec");
    this.remotePeerId = remotePeerId;
    this.config = config;
    this.codec = config.codec ?? defaultCodec;
    this.initializePeerConnection();
  }
  /**
   * Get the current message codec
   */
  getCodec() {
    return this.codec;
  }
  /**
   * Set a new message codec
   */
  setCodec(codec) {
    this.codec = codec;
  }
  /**
   * Initialize or re-initialize the peer connection
   */
  initializePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });
    this.setupConnectionHandlers();
    this.startConnectionTimeout();
  }
  /**
   * Get the remote peer ID
   */
  getRemotePeerId() {
    return this.remotePeerId;
  }
  /**
   * Check if the connection is established and ready
   */
  isConnected() {
    return this.dataChannel?.readyState === "open";
  }
  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.connectionState;
  }
  /**
   * Create an offer to initiate connection (caller side)
   */
  async createOffer() {
    this.dataChannel = this.peerConnection.createDataChannel("hypertoken", {
      ordered: this.config.ordered ?? true,
      maxRetransmits: this.config.maxRetransmits ?? 3
    });
    this.setupDataChannelHandlers();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }
  /**
   * Handle an incoming offer and create an answer (receiver side)
   */
  async handleOffer(offer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }
  /**
   * Handle an incoming answer (caller side)
   */
  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
  /**
   * Add an ICE candidate received from the remote peer
   */
  async addIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err2) {
      console.error("[WebRTC] Error adding ICE candidate:", err2);
    }
  }
  /**
   * Send data to the remote peer via DataChannel
   */
  send(data) {
    if (!this.isConnected()) {
      console.warn("[WebRTC] Cannot send: DataChannel not open");
      return false;
    }
    try {
      const encoded = this.codec.encode(data);
      this.dataChannel.send(encoded);
      return true;
    } catch (err2) {
      console.error("[WebRTC] Send error:", err2);
      this.emit("rtc:error", { error: err2 });
      return false;
    }
  }
  /**
   * Close the connection
   */
  close() {
    this.clearConnectionTimeout();
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.peerConnection.close();
    this.emit("rtc:disconnected", { peerId: this.remotePeerId });
  }
  /**
   * Check if currently using TURN servers
   */
  isUsingTurn() {
    return this.usingTurn;
  }
  /**
   * Get current retry count
   */
  getRetryCount() {
    return this.retryCount;
  }
  /**
   * Start connection timeout
   */
  startConnectionTimeout() {
    this.clearConnectionTimeout();
    const timeout = this.config.connectionTimeout || 15e3;
    this.connectionTimeout = setTimeout(() => {
      if (!this.isConnected()) {
        console.warn(`[WebRTC] Connection timeout after ${timeout}ms with ${this.remotePeerId}`);
        this.handleConnectionFailure();
      }
    }, timeout);
  }
  /**
   * Clear connection timeout
   */
  clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
  /**
   * Handle connection failure and retry with TURN if enabled
   */
  handleConnectionFailure() {
    const maxRetries = this.config.maxRetries || 1;
    const enableTurnFallback = this.config.enableTurnFallback !== false;
    this.emit("rtc:connection-failed", {
      peerId: this.remotePeerId,
      retryCount: this.retryCount,
      willRetry: enableTurnFallback && this.retryCount < maxRetries
    });
    if (enableTurnFallback && this.retryCount < maxRetries && !this.usingTurn) {
      this.retryCount++;
      this.retryWithTurn();
    } else {
      console.error(`[WebRTC] Connection failed permanently with ${this.remotePeerId}`);
      this.emit("rtc:error", {
        error: "Connection failed after retries",
        peerId: this.remotePeerId
      });
    }
  }
  /**
   * Retry connection with TURN servers
   */
  retryWithTurn() {
    console.log(`[WebRTC] Retrying connection with TURN servers (attempt ${this.retryCount}/${this.config.maxRetries})`);
    this.usingTurn = true;
    const turnConfig = [...this.config.iceServers, ...DEFAULT_TURN_SERVERS];
    this.config = {
      ...this.config,
      iceServers: turnConfig
    };
    this.emit("rtc:retrying", {
      peerId: this.remotePeerId,
      retryCount: this.retryCount,
      usingTurn: true
    });
    this.initializePeerConnection();
  }
  /**
   * Setup handlers for peer connection events
   */
  setupConnectionHandlers() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit("rtc:ice-candidate", {
          peerId: this.remotePeerId,
          candidate: event.candidate.toJSON()
        });
      }
    };
    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;
      console.log(`[WebRTC] Connection state with ${this.remotePeerId}: ${this.connectionState}`);
      if (this.connectionState === "connected") {
        this.clearConnectionTimeout();
      } else if (this.connectionState === "failed") {
        this.handleConnectionFailure();
      } else if (this.connectionState === "closed") {
        this.emit("rtc:disconnected", { peerId: this.remotePeerId });
      }
    };
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      console.log(`[WebRTC] ICE state with ${this.remotePeerId}: ${iceState}`);
      if (iceState === "connected" || iceState === "completed") {
        this.clearConnectionTimeout();
      } else if (iceState === "failed") {
        console.warn(`[WebRTC] ICE connection failed with ${this.remotePeerId}`);
        this.handleConnectionFailure();
      }
    };
    this.peerConnection.ondatachannel = (event) => {
      console.log(`[WebRTC] Received data channel from ${this.remotePeerId}`);
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };
  }
  /**
   * Setup handlers for data channel events
   */
  setupDataChannelHandlers() {
    if (!this.dataChannel) return;
    this.dataChannel.binaryType = "arraybuffer";
    this.dataChannel.onopen = () => {
      console.log(`[WebRTC] DataChannel opened with ${this.remotePeerId}`);
      this.clearConnectionTimeout();
      const turnStatus = this.usingTurn ? " (via TURN)" : "";
      console.log(`[WebRTC] \u2705 Connection established${turnStatus}`);
      this.emit("rtc:connected", {
        peerId: this.remotePeerId,
        usingTurn: this.usingTurn,
        retryCount: this.retryCount
      });
    };
    this.dataChannel.onclose = () => {
      console.log(`[WebRTC] DataChannel closed with ${this.remotePeerId}`);
      this.emit("rtc:disconnected", { peerId: this.remotePeerId });
    };
    this.dataChannel.onerror = (error) => {
      console.error(`[WebRTC] DataChannel error with ${this.remotePeerId}:`, error);
      this.emit("rtc:error", { error, peerId: this.remotePeerId });
    };
    this.dataChannel.onmessage = (event) => {
      try {
        const data = this.codec.decode(event.data);
        this.emit("rtc:data", {
          payload: data,
          fromPeerId: this.remotePeerId
        });
      } catch (err2) {
        console.error("[WebRTC] Error parsing message:", err2);
      }
    };
  }
  /**
   * Get connection statistics (useful for debugging)
   */
  async getStats() {
    return await this.peerConnection.getStats();
  }
};

// network/SignalingService.ts
init_events();
var SignalingService = class extends Emitter {
  constructor(wsConnection) {
    super();
    __publicField(this, "wsConnection");
    this.wsConnection = wsConnection;
    this.setupSignalingHandlers();
  }
  /**
   * Send a WebRTC offer to a remote peer
   */
  sendOffer(targetPeerId, offer) {
    this.wsConnection.sendToPeer(targetPeerId, {
      type: "webrtc-offer",
      offer
    });
    console.log(`[Signaling] Sent offer to ${targetPeerId}`);
  }
  /**
   * Send a WebRTC answer to a remote peer
   */
  sendAnswer(targetPeerId, answer) {
    this.wsConnection.sendToPeer(targetPeerId, {
      type: "webrtc-answer",
      answer
    });
    console.log(`[Signaling] Sent answer to ${targetPeerId}`);
  }
  /**
   * Send an ICE candidate to a remote peer
   */
  sendIceCandidate(targetPeerId, candidate) {
    this.wsConnection.sendToPeer(targetPeerId, {
      type: "webrtc-ice-candidate",
      candidate
    });
  }
  /**
   * Setup handlers for incoming signaling messages
   */
  setupSignalingHandlers() {
    this.wsConnection.on("net:message", (evt) => {
      const msg = evt.payload;
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case "webrtc-offer":
          this.handleOffer(msg);
          break;
        case "webrtc-answer":
          this.handleAnswer(msg);
          break;
        case "webrtc-ice-candidate":
          this.handleIceCandidate(msg);
          break;
      }
    });
  }
  /**
   * Handle incoming offer
   */
  handleOffer(msg) {
    if (!msg.offer || !msg.fromPeerId) {
      console.warn("[Signaling] Received malformed offer:", msg);
      return;
    }
    console.log(`[Signaling] Received offer from ${msg.fromPeerId}`);
    this.emit("signal:offer", {
      fromPeerId: msg.fromPeerId,
      offer: msg.offer
    });
  }
  /**
   * Handle incoming answer
   */
  handleAnswer(msg) {
    if (!msg.answer || !msg.fromPeerId) {
      console.warn("[Signaling] Received malformed answer:", msg);
      return;
    }
    console.log(`[Signaling] Received answer from ${msg.fromPeerId}`);
    this.emit("signal:answer", {
      fromPeerId: msg.fromPeerId,
      answer: msg.answer
    });
  }
  /**
   * Handle incoming ICE candidate
   */
  handleIceCandidate(msg) {
    if (!msg.candidate || !msg.fromPeerId) {
      console.warn("[Signaling] Received malformed ICE candidate:", msg);
      return;
    }
    this.emit("signal:ice-candidate", {
      fromPeerId: msg.fromPeerId,
      candidate: msg.candidate
    });
  }
  /**
   * Get the underlying WebSocket connection
   */
  getWebSocketConnection() {
    return this.wsConnection;
  }
  /**
   * Check if the WebSocket connection is ready
   */
  isReady() {
    return this.wsConnection.connected && this.wsConnection.peerId !== null;
  }
};

// network/HybridPeerManager.ts
var HybridPeerManager = class extends Emitter {
  constructor(options) {
    super();
    __publicField(this, "wsConnection");
    __publicField(this, "signalingService");
    __publicField(this, "rtcConnections");
    __publicField(this, "rtcConfig");
    __publicField(this, "autoUpgrade");
    __publicField(this, "upgradeDelay");
    // Track which peers we've initiated WebRTC with to avoid duplicates
    __publicField(this, "initiatedRTC");
    this.rtcConfig = options.rtcConfig || DEFAULT_RTC_CONFIG;
    this.autoUpgrade = options.autoUpgrade !== false;
    this.upgradeDelay = options.upgradeDelay || 500;
    this.rtcConnections = /* @__PURE__ */ new Map();
    this.initiatedRTC = /* @__PURE__ */ new Set();
    const peerOptions = {
      ...options.peerConnectionOptions,
      reconnect: options.reconnect
    };
    this.wsConnection = new PeerConnection(options.url, null, peerOptions);
    this.signalingService = new SignalingService(this.wsConnection);
    this.setupWebSocketHandlers();
    this.setupSignalingHandlers();
  }
  /**
   * Get the WebSocket connection state
   */
  getConnectionState() {
    return this.wsConnection.getConnectionState();
  }
  /**
   * Get the number of reconnection attempts
   */
  getReconnectAttempts() {
    return this.wsConnection.getReconnectAttempts();
  }
  /**
   * Connect to the server via WebSocket
   */
  connect() {
    this.wsConnection.connect();
  }
  /**
   * Disconnect from all peers
   */
  disconnect() {
    for (const [peerId, rtcConn] of this.rtcConnections) {
      rtcConn.close();
    }
    this.rtcConnections.clear();
    this.initiatedRTC.clear();
    this.wsConnection.disconnect();
  }
  /**
   * Send data to a specific peer
   * Prefers WebRTC if available, falls back to WebSocket
   */
  sendToPeer(targetPeerId, payload) {
    const rtcConn = this.rtcConnections.get(targetPeerId);
    if (rtcConn && rtcConn.isConnected()) {
      const success = rtcConn.send(payload);
      if (success) {
        return;
      }
      console.warn(`[Hybrid] WebRTC send failed to ${targetPeerId}, using WebSocket fallback`);
    }
    this.wsConnection.sendToPeer(targetPeerId, payload);
  }
  /**
   * Broadcast data to all connected peers
   */
  broadcast(type, payload = {}) {
    const rtcSent = /* @__PURE__ */ new Set();
    for (const [peerId, rtcConn] of this.rtcConnections) {
      if (rtcConn.isConnected()) {
        rtcConn.send({ type, payload });
        rtcSent.add(peerId);
      }
    }
    if (rtcSent.size === 0) {
      this.wsConnection.broadcast(type, payload);
    } else {
      for (const peerId of this.wsConnection.peers) {
        if (!rtcSent.has(peerId)) {
          this.wsConnection.sendToPeer(peerId, { type, payload });
        }
      }
    }
  }
  /**
   * Get the local peer ID
   */
  getPeerId() {
    return this.wsConnection.peerId;
  }
  /**
   * Get list of connected peers (via WebSocket)
   */
  getPeers() {
    return this.wsConnection.peers;
  }
  /**
   * Check if a peer is connected via WebRTC
   */
  isWebRTCConnected(peerId) {
    const rtcConn = this.rtcConnections.get(peerId);
    return rtcConn ? rtcConn.isConnected() : false;
  }
  /**
   * Get WebSocket connection (for advanced use)
   */
  getWebSocketConnection() {
    return this.wsConnection;
  }
  /**
   * Manually initiate WebRTC connection to a peer
   */
  async upgradeToWebRTC(peerId) {
    if (this.rtcConnections.has(peerId)) {
      console.warn(`[Hybrid] WebRTC connection to ${peerId} already exists`);
      return;
    }
    if (this.initiatedRTC.has(peerId)) {
      console.log(`[Hybrid] WebRTC connection to ${peerId} already initiated`);
      return;
    }
    this.initiatedRTC.add(peerId);
    console.log(`[Hybrid] Initiating WebRTC connection to ${peerId}`);
    const rtcConn = new WebRTCConnection(peerId, this.rtcConfig);
    this.rtcConnections.set(peerId, rtcConn);
    this.setupWebRTCHandlers(rtcConn, peerId);
    const offer = await rtcConn.createOffer();
    this.signalingService.sendOffer(peerId, offer);
  }
  /**
   * Setup handlers for WebSocket events
   */
  setupWebSocketHandlers() {
    this.wsConnection.on("net:connected", (evt) => {
      this.emit("net:connected", evt);
    });
    this.wsConnection.on("net:ready", (evt) => {
      this.emit("net:ready", evt);
    });
    this.wsConnection.on("net:peer:connected", (evt) => {
      const { peerId } = evt.payload;
      this.emit("net:peer:connected", evt);
      const myPeerId = this.getPeerId();
      const shouldInitiate = myPeerId && peerId && myPeerId < peerId;
      if (this.autoUpgrade && peerId) {
        if (shouldInitiate) {
          setTimeout(() => {
            this.upgradeToWebRTC(peerId).catch((err2) => {
              console.error(`[Hybrid] Failed to upgrade to WebRTC for ${peerId}:`, err2);
            });
          }, this.upgradeDelay);
        } else {
          console.log(`[Hybrid] Skipping WebRTC initiation for ${peerId} (waiting for remote peer to initiate)`);
        }
      }
    });
    this.wsConnection.on("net:peer:disconnected", (evt) => {
      const { peerId } = evt.payload;
      const rtcConn = this.rtcConnections.get(peerId);
      if (rtcConn) {
        rtcConn.close();
        this.rtcConnections.delete(peerId);
      }
      this.initiatedRTC.delete(peerId);
      this.emit("net:peer:disconnected", evt);
    });
    this.wsConnection.on("net:message", (evt) => {
      const payload = evt.payload;
      if (!payload || !["webrtc-offer", "webrtc-answer", "webrtc-ice-candidate"].includes(payload.type)) {
        this.emit("net:message", evt);
      }
    });
    this.wsConnection.on("net:error", (evt) => {
      this.emit("net:error", evt);
    });
    this.wsConnection.on("net:disconnected", (evt) => {
      for (const rtcConn of this.rtcConnections.values()) {
        rtcConn.close();
      }
      this.rtcConnections.clear();
      this.initiatedRTC.clear();
      this.emit("net:disconnected", evt);
    });
    this.wsConnection.on("net:reconnecting", (evt) => {
      this.emit("net:reconnecting", evt);
    });
    this.wsConnection.on("net:reconnected", (evt) => {
      this.emit("net:reconnected", evt);
    });
  }
  /**
   * Setup handlers for WebRTC signaling
   */
  setupSignalingHandlers() {
    this.signalingService.on("signal:offer", async (evt) => {
      const { fromPeerId, offer } = evt.payload;
      console.log(`[Hybrid] Received WebRTC offer from ${fromPeerId}`);
      let rtcConn = this.rtcConnections.get(fromPeerId);
      if (!rtcConn) {
        rtcConn = new WebRTCConnection(fromPeerId, this.rtcConfig);
        this.rtcConnections.set(fromPeerId, rtcConn);
        this.setupWebRTCHandlers(rtcConn, fromPeerId);
      }
      const answer = await rtcConn.handleOffer(offer);
      this.signalingService.sendAnswer(fromPeerId, answer);
    });
    this.signalingService.on("signal:answer", async (evt) => {
      const { fromPeerId, answer } = evt.payload;
      console.log(`[Hybrid] Received WebRTC answer from ${fromPeerId}`);
      const rtcConn = this.rtcConnections.get(fromPeerId);
      if (rtcConn) {
        await rtcConn.handleAnswer(answer);
      } else {
        console.warn(`[Hybrid] Received answer from ${fromPeerId} but no connection exists`);
      }
    });
    this.signalingService.on("signal:ice-candidate", async (evt) => {
      const { fromPeerId, candidate } = evt.payload;
      const rtcConn = this.rtcConnections.get(fromPeerId);
      if (rtcConn) {
        await rtcConn.addIceCandidate(candidate);
      } else {
        console.warn(`[Hybrid] Received ICE candidate from ${fromPeerId} but no connection exists`);
      }
    });
  }
  /**
   * Setup handlers for a specific WebRTC connection
   */
  setupWebRTCHandlers(rtcConn, peerId) {
    rtcConn.on("rtc:ice-candidate", (evt) => {
      this.signalingService.sendIceCandidate(peerId, evt.payload.candidate);
    });
    rtcConn.on("rtc:connected", (evt) => {
      const { usingTurn, retryCount } = evt.payload;
      const turnInfo = usingTurn ? " (via TURN relay)" : "";
      const retryInfo = retryCount > 0 ? ` after ${retryCount} retries` : "";
      console.log(`[Hybrid] \u2705 WebRTC connection established with ${peerId}${turnInfo}${retryInfo}`);
      this.emit("rtc:upgraded", {
        peerId,
        usingTurn,
        retryCount
      });
    });
    rtcConn.on("rtc:disconnected", () => {
      console.log(`[Hybrid] WebRTC connection closed with ${peerId}, falling back to WebSocket`);
      this.rtcConnections.delete(peerId);
      this.initiatedRTC.delete(peerId);
      this.emit("rtc:downgraded", { peerId });
    });
    rtcConn.on("rtc:connection-failed", (evt) => {
      const { retryCount, willRetry } = evt.payload;
      console.warn(`[Hybrid] WebRTC connection failed with ${peerId} (attempt ${retryCount})`);
      if (!willRetry) {
        console.log(`[Hybrid] No more retries, using WebSocket fallback for ${peerId}`);
      }
      this.emit("rtc:connection-failed", evt.payload);
    });
    rtcConn.on("rtc:retrying", (evt) => {
      const { retryCount, usingTurn } = evt.payload;
      console.log(`[Hybrid] \u{1F504} Retrying WebRTC connection with ${peerId} (attempt ${retryCount}, TURN: ${usingTurn})`);
      this.emit("rtc:retrying", evt.payload);
    });
    rtcConn.on("rtc:data", (evt) => {
      this.emit("net:message", {
        payload: evt.payload.payload,
        fromPeerId: peerId
      });
    });
    rtcConn.on("rtc:error", (evt) => {
      console.error(`[Hybrid] WebRTC error with ${peerId}:`, evt.payload.error);
      this.emit("net:error", evt);
    });
  }
};

// core/ConsensusCore.ts
init_events();
var import_node_buffer2 = __toESM(require_buffer(), 1);
var ConsensusCore = class extends Emitter {
  constructor(session, network) {
    super();
    __publicField(this, "session");
    __publicField(this, "network");
    __publicField(this, "_syncStates", /* @__PURE__ */ new Map());
    this.session = session;
    this.network = network;
    this.session.on("state:changed", (evt) => {
      const source = evt.source || "local";
      this.updatePeers(source);
    });
    this.network.on("net:peer:connected", (evt) => {
      const { peerId } = evt.payload;
      console.log(`[Sync] Connected to peer: ${peerId}`);
      this.addPeer(peerId);
    });
    this.network.on("net:peer:disconnected", (evt) => {
      const { peerId } = evt.payload;
      console.log(`[Sync] Disconnected from peer: ${peerId}`);
      this.removePeer(peerId);
    });
    this.network.on("net:message", (evt) => {
      this.processMessage(evt.payload);
    });
  }
  addPeer(peerId) {
    if (this._syncStates.has(peerId)) return;
    this._syncStates.set(peerId, this.session.initSyncState());
    this.updatePeer(peerId);
  }
  removePeer(peerId) {
    this._syncStates.delete(peerId);
  }
  // FIX: Don't send updates back to the peer that generated them
  updatePeers(excludePeerId = "local") {
    for (const peerId of this._syncStates.keys()) {
      if (peerId !== excludePeerId) {
        this.updatePeer(peerId);
      }
    }
  }
  updatePeer(peerId) {
    const syncState = this._syncStates.get(peerId);
    if (!syncState) return;
    const { nextSyncState, message } = this.session.generateSyncMessage(syncState);
    this._syncStates.set(peerId, nextSyncState);
    if (message) {
      this.network.sendToPeer(peerId, {
        type: "sync",
        data: this.arrayBufferToBase64(message)
      });
    }
  }
  processMessage(payload) {
    if (!payload || payload.type !== "sync") return;
    if (!payload.data || !payload.fromPeerId) {
      console.warn("[Sync] Received malformed sync message", payload);
      return;
    }
    const peerId = payload.fromPeerId;
    let syncState = this._syncStates.get(peerId);
    if (!syncState) {
      syncState = this.session.initSyncState();
      this._syncStates.set(peerId, syncState);
    }
    const message = this.base64ToUint8Array(payload.data);
    try {
      const { nextSyncState } = this.session.receiveSyncMessage(syncState, message, peerId);
      this._syncStates.set(peerId, nextSyncState);
      this.updatePeer(peerId);
    } catch (err2) {
      console.error("[Sync] Error applying sync message:", err2);
    }
  }
  arrayBufferToBase64(buffer) {
    return import_node_buffer2.Buffer.from(buffer).toString("base64");
  }
  base64ToUint8Array(base64) {
    return new Uint8Array(import_node_buffer2.Buffer.from(base64, "base64"));
  }
};

// engine/NetworkManager.ts
var NetworkManager = class {
  constructor() {
    __publicField(this, "_network");
    __publicField(this, "_sync");
  }
  get network() {
    return this._network;
  }
  get sync() {
    return this._sync;
  }
  connect(url, session, engine, options) {
    if (this._network) return;
    const peerOptions = {
      codec: options.codec,
      reconnect: options.reconnect,
      messageBufferSize: options.messageBufferSize
    };
    if (options.useWebRTC) {
      console.log(`[Engine] Connecting to ${url} with WebRTC support...`);
      this._network = new HybridPeerManager({
        url,
        autoUpgrade: true,
        upgradeDelay: 1e3,
        reconnect: options.reconnect,
        peerConnectionOptions: peerOptions
      });
    } else {
      console.log(`[Engine] Connecting to ${url} (WebSocket only)...`);
      this._network = new PeerConnection(url, engine, peerOptions);
    }
    this._sync = new ConsensusCore(session, this._network);
    this._network.connect();
    this._network.on("net:ready", (e) => engine.emit("net:ready", e));
    this._network.on("net:peer:connected", (e) => engine.emit("net:peer:connected", e));
    this._network.on("net:peer:disconnected", (e) => engine.emit("net:peer:disconnected", e));
    this._network.on("net:disconnected", (e) => engine.emit("net:disconnected", e));
    this._network.on("net:error", (e) => engine.emit("net:error", e));
    this._network.on("net:reconnecting", (e) => {
      console.log(`[Engine] Reconnecting... (attempt ${e.payload?.attempt || 1})`);
      engine.emit("net:reconnecting", e);
    });
    this._network.on("net:reconnected", (e) => {
      console.log(`[Engine] Reconnected successfully`);
      engine.emit("net:reconnected", e);
    });
    if (options.useWebRTC) {
      this._network.on("rtc:upgraded", (e) => {
        console.log(`[Engine] WebRTC connection established with peer`);
        engine.emit("rtc:upgraded", e);
      });
      this._network.on("rtc:downgraded", (e) => {
        console.log(`[Engine] WebRTC connection lost, using WebSocket`);
        engine.emit("rtc:downgraded", e);
      });
      this._network.on("rtc:connection-failed", (e) => engine.emit("rtc:connection-failed", e));
      this._network.on("rtc:retrying", (e) => engine.emit("rtc:retrying", e));
    }
  }
  disconnect() {
    this._network?.disconnect();
    this._network = void 0;
    this._sync = void 0;
  }
};

// engine/Engine.ts
var _Engine = class _Engine extends Emitter {
  constructor({ stack = null, space = null, source = null, autoConnect, useWebRTC = false, useWorker = false, disableWasm = false, workerOptions = {}, networkOptions = {} } = {}) {
    super();
    __publicField(this, "stack");
    __publicField(this, "space");
    __publicField(this, "source");
    __publicField(this, "session");
    __publicField(this, "loop");
    __publicField(this, "eventBus");
    __publicField(this, "ruleEngine");
    __publicField(this, "_policies");
    __publicField(this, "debug");
    __publicField(this, "historyManager");
    __publicField(this, "wasm");
    __publicField(this, "net");
    __publicField(this, "_useWebRTC");
    __publicField(this, "_networkOptions");
    this.session = new Chronicle();
    this.space = space ?? new Space(this.session, "main-space");
    this.stack = stack;
    this.source = source;
    this.eventBus = new Emitter();
    this._useWebRTC = useWebRTC;
    this._networkOptions = networkOptions;
    this._policies = /* @__PURE__ */ new Map();
    this.debug = false;
    this.historyManager = new HistoryManager();
    this.wasm = new WasmManager();
    this.net = new NetworkManager();
    this.loop = new GameLoop(this);
    this.session.on("state:changed", (e) => this.emit("state:updated", e));
    if (!disableWasm) {
      if (useWorker) {
        this.wasm.initWorker(
          workerOptions,
          this.debug,
          (payload) => this.emit("state:updated", payload),
          (payload) => this.emit("engine:action", { payload }),
          (error) => this.emit("engine:error", { payload: { error } }),
          () => {
            this._initWasm();
          }
        );
      } else {
        this._initWasm();
      }
    }
    if (autoConnect) {
      this.connect(autoConnect);
    }
  }
  _initWasm() {
    this.wasm.initDispatcher(
      () => JSON.stringify(this.session.state),
      this.debug,
      (newSession) => {
        this.session = newSession;
        this.session.on("state:changed", (e) => this.emit("state:updated", e));
      },
      (e) => this.emit("state:updated", e)
    );
  }
  // ── Public API compat getters ──────────────────────────────────────────────
  get history() {
    return this.historyManager.history;
  }
  set history(v) {
    this.historyManager.restoreHistory(v);
  }
  get future() {
    return this.historyManager.future;
  }
  get network() {
    return this.net.network;
  }
  get sync() {
    return this.net.sync;
  }
  /** Test compatibility: get/set _wasmDispatcher via WasmManager. */
  get _wasmDispatcher() {
    return this.wasm.dispatcher;
  }
  set _wasmDispatcher(v) {
    this.wasm.setDispatcher(v);
  }
  // ── State getters ──────────────────────────────────────────────────────────
  get _gameState() {
    return this.session.state.gameState ?? {};
  }
  get _agents() {
    return Object.values(this.session.state.agents ?? {});
  }
  get _transactions() {
    return this.session.state.transactions ?? [];
  }
  // ── RuleEngine ─────────────────────────────────────────────────────────────
  useRuleEngine(ruleEngine) {
    this.ruleEngine = ruleEngine;
  }
  // ── Network ────────────────────────────────────────────────────────────────
  connect(url) {
    if (this.wasm.dispatcher) {
      console.warn("[Engine] Network sync is not yet supported with WASM Chronicle backend");
      return;
    }
    this.net.connect(url, this.session, this, {
      useWebRTC: this._useWebRTC,
      codec: this._networkOptions.codec,
      reconnect: this._networkOptions.reconnect,
      messageBufferSize: this._networkOptions.messageBufferSize
    });
  }
  disconnect() {
    this.net.disconnect();
  }
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async shutdown() {
    this.net.disconnect();
    await this.wasm.terminate();
    this._policies.clear();
    this.historyManager.clear();
    this.emit("engine:shutdown");
  }
  // ── Policies ───────────────────────────────────────────────────────────────
  registerPolicy(name, policy) {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }
  unregisterPolicy(name) {
    this._policies.delete(name);
    this.emit("engine:policy:removed", { payload: { name } });
    return this;
  }
  clearPolicies() {
    this._policies.clear();
    this.emit("engine:policy:cleared");
    return this;
  }
  // ── Dispatch ───────────────────────────────────────────────────────────────
  async dispatch(type, payload = {}, opts = {}) {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("\u{1F9E9} dispatch:", type, payload);
    const snapshot = this.session.saveToBase64();
    let result;
    if (this.wasm.useWorker && this.wasm.worker?.ready) {
      try {
        result = await this.wasm.dispatchWorker(type, payload);
        action.result = result;
      } catch (error) {
        if (this.debug) console.log("\u26A0\uFE0F  Worker dispatch failed, falling back to sync:", error);
        result = this.apply(action);
      }
    } else {
      result = this.apply(action);
    }
    if (result !== _Engine.ACTION_FAILED) {
      this.historyManager.recordAction(action, snapshot);
      this.emit("engine:action", { payload: action });
      for (const [, policy] of this._policies) {
        try {
          policy.evaluate(this);
        } catch (err2) {
          this.emit("engine:error", { payload: { policy, err: err2 } });
        }
      }
    }
    return result === _Engine.ACTION_FAILED ? void 0 : result;
  }
  apply(action) {
    if (this.wasm.dispatcher && WasmManager.WASM_ACTIONS.has(action.type)) {
      try {
        const result = this.wasm.dispatch(action.type, action.payload);
        action.result = result;
        this.session.emit("state:changed", { source: "dispatch" });
        return result;
      } catch (err2) {
        if (this.debug) console.log(`\u26A0\uFE0F  WASM dispatch failed for ${action.type}, falling back to TypeScript:`, err2);
      }
    }
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = fn(this, action.payload);
        action.result = result;
        return result;
      } catch (err2) {
        this.emit("engine:error", { payload: { action, err: err2 } });
        return _Engine.ACTION_FAILED;
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
      return _Engine.ACTION_FAILED;
    }
  }
  // ── Undo / Redo ────────────────────────────────────────────────────────────
  undo() {
    const action = this.historyManager.undo(this.session);
    if (!action) return null;
    this.emit("engine:undo", { payload: action });
    return action;
  }
  redo() {
    const next = this.historyManager.popRedo();
    if (!next) return null;
    this.historyManager.pushSnapshot(this.session.saveToBase64());
    this.apply(next);
    this.historyManager.pushHistory(next);
    this.emit("engine:redo", { payload: next });
    return next;
  }
  // ── Snapshot / Restore ─────────────────────────────────────────────────────
  snapshot() {
    return {
      stack: this.stack?.toJSON?.() ?? null,
      space: this.space.snapshot(),
      source: this.source?.toJSON?.() ?? null,
      history: this.historyManager.history.map((a) => a.toJSON()),
      policies: Array.from(this._policies.keys()),
      crdt: this.session.saveToBase64()
    };
  }
  toJSON() {
    return this.snapshot();
  }
  restore(snapshot) {
    if (!snapshot) return this;
    if (snapshot.crdt) {
      this.session.loadFromBase64(snapshot.crdt);
    }
    this.history = snapshot.history ?? [];
    this.emit("engine:restored", { payload: { history: this.historyManager.history.length } });
    return this;
  }
  // ── State / Describe ───────────────────────────────────────────────────────
  get state() {
    return {
      version: "2.0.0-crdt",
      turn: this._gameState.turn ?? null,
      agents: this._agents,
      stack: this.stack,
      space: this.space,
      source: this.source
    };
  }
  describe({ detail = false } = {}) {
    const { stack, space, source } = this;
    const agents = this.state.agents?.map((p) => ({
      name: p.name,
      inventoryCount: p.inventory?.length ?? 0,
      discardCount: p.discard?.length ?? 0,
      turns: p.turns ?? 0,
      active: p.active ?? false
    })) ?? [];
    const summary = {
      version: this.state.version,
      turn: this.state.turn ?? null,
      agents,
      stack: stack ? { remaining: stack.size, drawn: stack.drawn?.length ?? 0 } : null,
      space: space ? { zones: space.zones, totalPlacements: space.cards().length } : null,
      source: source ? { remaining: source.tokens?.length ?? 0, burned: source.burned?.length ?? 0, policy: source.policy ?? null } : null
    };
    if (!detail) return summary;
    return {
      ...summary,
      stackState: stack?.toJSON?.() ?? null,
      spaceState: space?.snapshot?.() ?? null,
      sourceState: source?.inspect?.() ?? null
    };
  }
  availableActions() {
    const actions = [];
    if (this.state.stack) {
      actions.push(
        { type: "stack:draw", payload: { count: 1 } },
        { type: "stack:shuffle", payload: {} },
        { type: "stack:reset", payload: {} }
      );
    }
    if (this.state.space) {
      actions.push(
        { type: "space:place", payload: { zone: "altar" } },
        { type: "space:clear", payload: {} }
      );
    }
    if (this.state.source) {
      actions.push(
        { type: "source:draw", payload: { count: 1 } },
        { type: "source:shuffle", payload: {} }
      );
    }
    actions.push(
      { type: "loop:start", payload: {} },
      { type: "loop:stop", payload: {} }
    );
    return actions;
  }
};
__publicField(_Engine, "ACTION_FAILED", /* @__PURE__ */ Symbol("ACTION_FAILED"));
var Engine = _Engine;

// examples/confluence/ConfluenceGame.ts
function isTokenConsumed(state2, tokenId) {
  const consumed = state2.consumed[tokenId];
  return consumed !== void 0 && Object.keys(consumed).length > 0;
}
function getActiveTokens(state2) {
  return Object.values(state2.tokens).filter((t) => !isTokenConsumed(state2, t.id));
}
function deriveBoard(state2) {
  const { width, height } = state2.config;
  const activeTokens = getActiveTokens(state2);
  const cellMap = {};
  for (const token of activeTokens) {
    const key = `${token.x},${token.y}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(token);
  }
  const cells = [];
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const tokens = cellMap[key] || [];
      const playerIds = new Set(tokens.map((t) => t.playerId));
      const contested = playerIds.size > 1;
      const controller = contested ? null : tokens[0]?.playerId ?? null;
      cells[y][x] = { x, y, tokens, contested, controller };
    }
  }
  return { width, height, cells };
}
function deriveScores(state2) {
  const board = deriveBoard(state2);
  const playerMap = state2.players;
  const scores = {};
  for (const [peerId, player] of Object.entries(playerMap)) {
    scores[peerId] = {
      playerId: peerId,
      name: player.name,
      color: player.color,
      tokenCount: 0,
      controlledCells: 0,
      contestedCells: 0
    };
  }
  for (const token of getActiveTokens(state2)) {
    if (scores[token.playerId]) {
      scores[token.playerId].tokenCount++;
    }
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length === 0) continue;
      if (cell.contested) {
        for (const token of cell.tokens) {
          if (scores[token.playerId]) {
            scores[token.playerId].contestedCells++;
          }
        }
      } else if (cell.controller && scores[cell.controller]) {
        scores[cell.controller].controlledCells++;
      }
    }
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length > 0) continue;
      const adjacentPlayers = /* @__PURE__ */ new Set();
      const neighbors = getNeighbors(x, y, board.width, board.height);
      for (const [nx, ny] of neighbors) {
        const ncell = board.cells[ny][nx];
        if (ncell.tokens.length > 0 && !ncell.contested) {
          adjacentPlayers.add(ncell.controller);
        }
      }
      if (adjacentPlayers.size === 1) {
        const controller = adjacentPlayers.values().next().value;
        if (controller && scores[controller]) {
          scores[controller].controlledCells++;
        }
      }
    }
  }
  return Object.values(scores);
}
function deriveResult(state2) {
  const scores = deriveScores(state2);
  const board = deriveBoard(state2);
  let contestedCount = 0;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y][x].contested) contestedCount++;
    }
  }
  let winner = null;
  if (state2.phase === "ended") {
    let maxScore = -1;
    for (const score of scores) {
      if (score.controlledCells > maxScore) {
        maxScore = score.controlledCells;
        winner = score.playerId;
      } else if (score.controlledCells === maxScore && maxScore > 0) {
        winner = null;
      }
    }
  }
  return {
    scores,
    winner,
    totalCells: board.width * board.height,
    contestedCells: contestedCount
  };
}
function getNeighbors(x, y, width, height) {
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push([nx, ny]);
      }
    }
  }
  return neighbors;
}
function getTimeRemaining(state2) {
  if (state2.phase === "ended") return 0;
  return Math.max(0, state2.config.durationMs - (Date.now() - state2.startTime));
}

// examples/confluence/crdt-actions.js
function loadFromChronicle(engine) {
  const confluenceState = engine.session.state?.confluence;
  if (!confluenceState) return;
  if (!engine._confluenceReady) {
    engine._confluenceReady = true;
    engine.emit("confluence:ready", {});
  }
}
function setupConfluenceSync(engine) {
  engine.on("state:updated", (e) => {
    const source = e?.source || e?.payload?.source;
    if (source !== "local" && source !== void 0) {
      loadFromChronicle(engine);
    }
    if (engine.session.state?.confluence) {
      engine.emit("confluence:updated", {
        state: engine.session.state.confluence,
        source
      });
    }
  });
}
function generateOpId(peerId, seq) {
  return `${peerId}-${seq}`;
}
Object.assign(ActionRegistry, {
  /**
   * Initialize a new Confluence game.
   */
  "confluence:init": (engine, { width, height, durationMs } = {}) => {
    const config = { width: width ?? 10, height: height ?? 10, durationMs: durationMs ?? 3e4 };
    engine.session.change("confluence:init", (doc) => {
      doc.confluence = {
        config: { width: config.width, height: config.height, durationMs: config.durationMs },
        players: {},
        tokens: {},
        consumed: {},
        ops: {},
        phase: "playing",
        startTime: Date.now(),
        winner: null
      };
    });
    if (!engine._confluenceSyncSetup) {
      setupConfluenceSync(engine);
      engine._confluenceSyncSetup = true;
    }
    engine.emit("confluence:ready", {});
  },
  /**
   * Register a player.
   */
  "confluence:register": (engine, { peerId, name } = {}) => {
    if (!peerId) throw new Error("peerId required");
    const state2 = engine.session.state?.confluence;
    if (!state2) throw new Error("Game not initialized");
    if (state2.players[peerId]) return;
    const colors = ["#e94560", "#00d4ff", "#4ade80", "#fbbf24"];
    const colorIndex = Object.keys(state2.players).length % colors.length;
    engine.session.change("confluence:register", (doc) => {
      doc.confluence.players[peerId] = {
        peerId,
        name: name || `Player ${Object.keys(doc.confluence.players).length + 1}`,
        color: colors[colorIndex],
        joinedAt: Date.now()
      };
    });
    engine.emit("confluence:playerJoined", { peerId });
  },
  /**
   * Place a token on the board.
   * Uses field-level write: only adds to doc.confluence.tokens[tokenId]
   * and doc.confluence.ops[opId]. Does NOT replace the entire state.
   */
  "confluence:place": (engine, { x, y, peerId } = {}) => {
    if (x === void 0 || y === void 0) throw new Error("x and y required");
    if (!peerId) throw new Error("peerId required");
    const state2 = engine.session.state?.confluence;
    if (!state2) throw new Error("Game not initialized");
    if (state2.phase !== "playing") throw new Error("Game not in progress");
    if (!state2.players[peerId]) throw new Error(`Player ${peerId} not registered`);
    if (x < 0 || x >= state2.config.width) throw new Error(`x out of bounds: ${x}`);
    if (y < 0 || y >= state2.config.height) throw new Error(`y out of bounds: ${y}`);
    const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const tokenId = `tok-${opId}`;
    engine.session.change(`confluence:place ${peerId} (${x},${y})`, (doc) => {
      doc.confluence.tokens[tokenId] = {
        id: tokenId,
        playerId: peerId,
        strength: 1,
        x,
        y,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: null,
        placedAt: Date.now()
      };
      doc.confluence.ops[opId] = {
        type: "place",
        actor: peerId,
        seq,
        timestamp: Date.now()
      };
    });
    engine.emit("confluence:placed", { tokenId, x, y, peerId });
  },
  /**
   * Merge two adjacent same-player tokens into a stronger one.
   * Marks parents as consumed, creates new token with _mergedFrom.
   */
  "confluence:merge": (engine, { tokenIdA, tokenIdB, peerId } = {}) => {
    if (!tokenIdA || !tokenIdB) throw new Error("tokenIdA and tokenIdB required");
    if (!peerId) throw new Error("peerId required");
    const state2 = engine.session.state?.confluence;
    if (!state2) throw new Error("Game not initialized");
    if (state2.phase !== "playing") throw new Error("Game not in progress");
    const tokenA = state2.tokens[tokenIdA];
    const tokenB = state2.tokens[tokenIdB];
    if (!tokenA || !tokenB) throw new Error("Token(s) not found");
    if (tokenA.playerId !== peerId || tokenB.playerId !== peerId) throw new Error("Not your tokens");
    const consumedA = state2.consumed[tokenIdA];
    const consumedB = state2.consumed[tokenIdB];
    if (consumedA && Object.keys(consumedA).length > 0) throw new Error(`${tokenIdA} already consumed`);
    if (consumedB && Object.keys(consumedB).length > 0) throw new Error(`${tokenIdB} already consumed`);
    if (tokenA.strength >= 3 || tokenB.strength >= 3) throw new Error("Tokens already at max strength");
    const dx = Math.abs(tokenA.x - tokenB.x);
    const dy = Math.abs(tokenA.y - tokenB.y);
    if (dx > 1 || dy > 1 || dx === 0 && dy === 0) throw new Error("Tokens not adjacent");
    const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const newTokenId = `tok-${opId}`;
    const newStrength = Math.min(3, tokenA.strength + tokenB.strength);
    engine.session.change(`confluence:merge ${peerId}`, (doc) => {
      if (!doc.confluence.consumed[tokenIdA]) doc.confluence.consumed[tokenIdA] = {};
      doc.confluence.consumed[tokenIdA][opId] = true;
      if (!doc.confluence.consumed[tokenIdB]) doc.confluence.consumed[tokenIdB] = {};
      doc.confluence.consumed[tokenIdB][opId] = true;
      doc.confluence.tokens[newTokenId] = {
        id: newTokenId,
        playerId: peerId,
        strength: newStrength,
        x: tokenA.x,
        y: tokenA.y,
        createdByOp: opId,
        _mergedFrom: [tokenIdA, tokenIdB],
        _splitFrom: null,
        placedAt: Date.now()
      };
      doc.confluence.ops[opId] = {
        type: "merge",
        actor: peerId,
        seq,
        timestamp: Date.now()
      };
    });
    engine.emit("confluence:merged", { newTokenId, tokenIdA, tokenIdB, peerId });
  },
  /**
   * Split a strength-2+ token into two strength-1 tokens.
   * Marks parent as consumed, creates two new tokens with _splitFrom.
   */
  "confluence:split": (engine, { tokenId, targetX, targetY, peerId } = {}) => {
    if (!tokenId) throw new Error("tokenId required");
    if (targetX === void 0 || targetY === void 0) throw new Error("targetX and targetY required");
    if (!peerId) throw new Error("peerId required");
    const state2 = engine.session.state?.confluence;
    if (!state2) throw new Error("Game not initialized");
    if (state2.phase !== "playing") throw new Error("Game not in progress");
    const token = state2.tokens[tokenId];
    if (!token) throw new Error("Token not found");
    if (token.playerId !== peerId) throw new Error("Not your token");
    const consumed = state2.consumed[tokenId];
    if (consumed && Object.keys(consumed).length > 0) throw new Error("Token already consumed");
    if (token.strength < 2) throw new Error("Token must be strength 2+ to split");
    const dx = Math.abs(token.x - targetX);
    const dy = Math.abs(token.y - targetY);
    if (dx > 1 || dy > 1) throw new Error("Target not adjacent");
    if (targetX < 0 || targetX >= state2.config.width) throw new Error("targetX out of bounds");
    if (targetY < 0 || targetY >= state2.config.height) throw new Error("targetY out of bounds");
    const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const newTokenId1 = `tok-${opId}-a`;
    const newTokenId2 = `tok-${opId}-b`;
    engine.session.change(`confluence:split ${peerId}`, (doc) => {
      if (!doc.confluence.consumed[tokenId]) doc.confluence.consumed[tokenId] = {};
      doc.confluence.consumed[tokenId][opId] = true;
      doc.confluence.tokens[newTokenId1] = {
        id: newTokenId1,
        playerId: peerId,
        strength: 1,
        x: token.x,
        y: token.y,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: tokenId,
        placedAt: Date.now()
      };
      doc.confluence.tokens[newTokenId2] = {
        id: newTokenId2,
        playerId: peerId,
        strength: 1,
        x: targetX,
        y: targetY,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: tokenId,
        placedAt: Date.now()
      };
      doc.confluence.ops[opId] = {
        type: "split",
        actor: peerId,
        seq,
        timestamp: Date.now()
      };
    });
    engine.emit("confluence:split", { newTokenId1, newTokenId2, tokenId, peerId });
  },
  /**
   * End the game and compute final scores.
   */
  "confluence:end": (engine, { peerId } = {}) => {
    const state2 = engine.session.state?.confluence;
    if (!state2) throw new Error("Game not initialized");
    if (state2.phase === "ended") throw new Error("Game already ended");
    engine.session.change("confluence:end", (doc) => {
      doc.confluence.phase = "ended";
      const result = deriveResult(doc.confluence);
      doc.confluence.winner = result.winner;
    });
    engine.emit("confluence:ended", { winner: state2.winner });
  }
});
function getBoard(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return null;
  const plainState = JSON.parse(JSON.stringify(state2));
  return deriveBoard(plainState);
}
function getScores(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return [];
  const plainState = JSON.parse(JSON.stringify(state2));
  return deriveScores(plainState);
}
function getTimeRemainingSec(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return 0;
  return Math.ceil(getTimeRemaining(state2) / 1e3);
}

// examples/confluence/web/confluence-web.js
console.log("[Confluence] Modules loaded successfully");
var state = {
  // Engine
  engine: null,
  connected: false,
  offlineMode: false,
  // Player
  peerId: null,
  playerName: "",
  serverUrl: "ws://localhost:3000",
  // Game
  gameStarted: false,
  gameEnded: false,
  lastPeerId: 0,
  // Interaction
  selectedTokenId: null,
  interactionMode: null,
  // 'select', 'merge', 'split'
  hoveredTokenId: null,
  // Timer
  timerInterval: null,
  lastTimeUpdate: 0,
  // UI
  showOfflineBanner: true
};
var elements = {
  // Screens
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  gameOverScreen: document.getElementById("game-over-screen"),
  // Forms
  startForm: document.getElementById("start-form"),
  playerNameInput: document.getElementById("player-name"),
  serverUrlInput: document.getElementById("server-url"),
  // Buttons
  btnJoin: document.getElementById("btn-join"),
  btnRules: document.getElementById("btn-rules"),
  btnRulesInline: document.getElementById("btn-rules-inline"),
  btnScan: document.getElementById("btn-scan"),
  btnEnd: document.getElementById("btn-end"),
  btnOffline: document.getElementById("btn-offline"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  btnNewLobby: document.getElementById("btn-new-lobby"),
  btnCloseRules: document.getElementById("btn-close-rules"),
  // Modals
  rulesOverlay: document.getElementById("rules-overlay"),
  // Game UI
  gameBoard: document.getElementById("game-board"),
  scorePanel: document.getElementById("score-panel"),
  mobileScorePanel: document.getElementById("mobile-score-panel"),
  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timer-value"),
  syncIndicator: document.getElementById("sync-indicator"),
  syncText: document.getElementById("sync-text"),
  peerCount: document.getElementById("peer-count"),
  instructionText: document.getElementById("instruction-text"),
  offlineBanner: document.getElementById("offline-banner"),
  offlineTitle: document.getElementById("offline-title"),
  offlineDesc: document.getElementById("offline-desc"),
  // Game over
  winnerDisplay: document.getElementById("winner-display"),
  gameOverTitle: document.getElementById("game-over-title"),
  gameOverSubtitle: document.getElementById("game-over-subtitle"),
  finalScores: document.getElementById("final-scores"),
  // Provenance
  provenanceTooltip: document.getElementById("provenance-tooltip"),
  provenanceTree: document.getElementById("provenance-tree"),
  // Accessibility
  srAnnouncements: document.getElementById("sr-announcements")
};
function initApp() {
  const savedName = localStorage.getItem("confluence playerName");
  const savedServer = localStorage.getItem("confluence serverUrl");
  if (savedName) elements.playerNameInput.value = savedName;
  if (savedServer) elements.serverUrlInput.value = savedServer;
  bindEvents();
  state.peerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log("[Confluence] App initialized, temp peerId:", state.peerId);
}
function bindEvents() {
  elements.startForm.addEventListener("submit", handleStart);
  elements.btnRules.addEventListener("click", () => showRules());
  elements.btnCloseRules.addEventListener("click", () => hideRules());
  elements.rulesOverlay.addEventListener("click", (e) => {
    if (e.target === elements.rulesOverlay) hideRules();
  });
  elements.btnRulesInline.addEventListener("click", () => showRules());
  elements.btnEnd.addEventListener("click", handleEndGame);
  elements.btnOffline.addEventListener("click", toggleOfflineMode);
  elements.btnPlayAgain.addEventListener("click", handlePlayAgain);
  elements.btnNewLobby.addEventListener("click", handleNewLobby);
  elements.gameBoard.addEventListener("click", handleBoardClick);
  elements.gameBoard.addEventListener("mouseover", handleBoardHover);
  elements.gameBoard.addEventListener("mouseout", handleBoardHoverOut);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("resize", handleResize);
}
async function handleStart(e) {
  e.preventDefault();
  const name = elements.playerNameInput.value.trim() || "Player";
  const serverUrl = elements.serverUrlInput.value.trim() || "ws://localhost:3000";
  localStorage.setItem("confluence playerName", name);
  localStorage.setItem("confluence serverUrl", serverUrl);
  state.playerName = name;
  state.serverUrl = serverUrl;
  elements.btnJoin.disabled = true;
  elements.btnJoin.textContent = "Connecting...";
  try {
    state.engine = new Engine({ disableWasm: true });
    setupConfluenceSync(state.engine);
    state.engine.on("confluence:updated", handleStateUpdate);
    state.engine.on("confluence:ready", handleGameReady);
    state.engine.on("confluence:ended", handleGameEnded);
    state.engine.on("net:ready", handleConnected);
    state.engine.on("net:disconnected", handleDisconnected);
    state.engine.on("net:peer:connected", handlePeerJoined);
    state.engine.on("net:peer:disconnected", handlePeerLeft);
    await state.engine.dispatch("confluence:init", {
      width: 10,
      height: 10,
      durationMs: 3e4
    });
    state.engine.connect(state.serverUrl);
    state.engine.dispatch("confluence:register", {
      peerId: state.peerId,
      name: state.playerName
    });
    announce("Connected to game. Place your tokens!");
  } catch (error) {
    console.error("[Confluence] Start error:", error);
    showError(`Failed to connect: ${error.message}`);
    elements.btnJoin.disabled = false;
    elements.btnJoin.textContent = "Join Game";
  }
}
function handleGameReady() {
  console.log("[Confluence] Game ready");
  state.gameStarted = true;
  elements.startScreen.classList.add("hidden");
  elements.gameScreen.classList.add("active");
  startTimer();
  render();
}
function handleStateUpdate(event) {
  requestAnimationFrame(render);
}
function handleConnected(event) {
  state.connected = true;
  const networkPeerId = event?.peerId || state.engine?.network?.peerId;
  if (networkPeerId) {
    state.peerId = networkPeerId;
    console.log("[Confluence] Assigned peerId:", state.peerId);
  }
  updateSyncStatus("connected", "Connected");
  updatePeerCount();
  console.log("[Confluence] Connected to relay");
}
function handleDisconnected(event) {
  state.connected = false;
  updateSyncStatus("offline", "Offline");
  if (!state.offlineMode) {
    showOfflineBanner("Disconnected", 'Click "Reconnect" to sync with other players');
    elements.btnOffline.textContent = "Reconnect";
  }
}
function handlePeerJoined(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log("[Confluence] Peer joined:", peerId);
  updatePeerCount();
  announce("A player joined the game");
}
function handlePeerLeft(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log("[Confluence] Peer left:", peerId);
  updatePeerCount();
  announce("A player left the game");
}
function updatePeerCount() {
  const confluenceState = state.engine?.session?.state?.confluence;
  const playerCount = confluenceState?.players ? Object.keys(confluenceState.players).length : 1;
  elements.peerCount.textContent = `${playerCount} player${playerCount !== 1 ? "s" : ""}`;
}
function handleGameEnded(event) {
  state.gameEnded = true;
  stopTimer();
  showGameOver();
}
function startTimer() {
  stopTimer();
  const updateTimer = () => {
    const seconds = getTimeRemainingSec(state.engine);
    elements.timerValue.textContent = seconds;
    elements.timer.classList.remove("warning", "critical");
    if (seconds <= 10 && seconds > 5) {
      elements.timer.classList.add("warning");
    } else if (seconds <= 5) {
      elements.timer.classList.add("critical");
    }
    if (seconds <= 0 && !state.gameEnded) {
      handleGameEnded();
    }
  };
  updateTimer();
  state.timerInterval = setInterval(updateTimer, 100);
}
function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}
function render() {
  if (!state.engine?.session?.state?.confluence) return;
  const board = getBoard(state.engine);
  const scores = getScores(state.engine);
  renderBoard(board);
  renderScores(scores);
  renderInstructions();
}
function renderBoard(board) {
  if (!board) return;
  elements.gameBoard.innerHTML = "";
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      const cellEl = document.createElement("div");
      cellEl.className = "cell";
      cellEl.dataset.x = x;
      cellEl.dataset.y = y;
      cellEl.setAttribute("role", "gridcell");
      cellEl.setAttribute("aria-label", `Cell ${x}, ${y}${cell.contested ? ", contested" : ""}`);
      cellEl.setAttribute("tabindex", "0");
      if (cell.contested) {
        cellEl.classList.add("contested");
      }
      if (state.interactionMode === "split" && cell.tokens.length === 0) {
        const selectedToken = getTokenById(state.selectedTokenId);
        if (selectedToken && isAdjacent(selectedToken, x, y)) {
          cellEl.classList.add("highlighted");
          cellEl.classList.add("targetable");
        }
      }
      if (cell.tokens.length > 0) {
        const container = document.createElement("div");
        container.className = "token-container";
        for (const token of cell.tokens) {
          const tokenEl = createTokenElement(token);
          container.appendChild(tokenEl);
        }
        cellEl.appendChild(container);
      }
      elements.gameBoard.appendChild(cellEl);
    }
  }
}
function createTokenElement(token) {
  const tokenEl = document.createElement("div");
  tokenEl.className = `token strength-${token.strength}`;
  tokenEl.dataset.tokenId = token.id;
  tokenEl.textContent = token.strength;
  tokenEl.setAttribute("role", "button");
  tokenEl.setAttribute("tabindex", "0");
  tokenEl.setAttribute("aria-label", `Your token, strength ${token.strength}`);
  const playerState = state.engine.session.state.confluence.players[token.playerId];
  const color = playerState?.color || "#888888";
  tokenEl.style.color = color;
  tokenEl.style.setProperty("--player-color", color);
  if (token.playerId === state.peerId) {
    tokenEl.setAttribute("aria-label", `Your token, strength ${token.strength}`);
  } else {
    tokenEl.setAttribute("aria-label", `Opponent token, strength ${token.strength}`);
  }
  if (state.selectedTokenId === token.id) {
    tokenEl.classList.add("selected");
  }
  if (state.interactionMode === "merge" && state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken && selectedToken.playerId === token.playerId && selectedToken.id !== token.id && isAdjacent(selectedToken, token.x, token.y)) {
      tokenEl.classList.add("merge-target");
    }
  }
  tokenEl.addEventListener("click", (e) => {
    e.stopPropagation();
    handleTokenClick(token);
  });
  tokenEl.addEventListener("mouseenter", () => {
    state.hoveredTokenId = token.id;
    showProvenance(token);
  });
  tokenEl.addEventListener("mouseleave", () => {
    state.hoveredTokenId = null;
    hideProvenance();
  });
  return tokenEl;
}
function renderScores(scores) {
  if (!scores) return;
  const createScoreCard = (score, isMobile = false) => {
    const card = document.createElement("div");
    card.className = "player-score";
    card.style.setProperty("--player-color", score.color);
    const isCurrentPlayer = score.playerId === state.peerId;
    if (isCurrentPlayer) {
      card.classList.add("current-player");
    }
    const maxTerritory = 100;
    const territoryPercent = Math.min(100, score.controlledCells / maxTerritory * 100);
    card.innerHTML = `
      <div class="player-score-header">
        <span class="player-name">
          <span class="player-color-dot" style="background: ${score.color}"></span>
          ${escapeHtml(score.name)}${isCurrentPlayer ? " (You)" : ""}
        </span>
      </div>
      <div class="player-stats">
        <div class="stat">
          <div class="stat-value">${score.controlledCells}</div>
          <div class="stat-label">Controlled</div>
        </div>
        <div class="stat">
          <div class="stat-value">${score.contestedCells}</div>
          <div class="stat-label">Contested</div>
        </div>
      </div>
      <div class="territory-bar">
        <div class="territory-fill" style="width: ${territoryPercent}%; background: ${score.color}"></div>
      </div>
    `;
    return card;
  };
  elements.scorePanel.innerHTML = "";
  for (const score of scores) {
    elements.scorePanel.appendChild(createScoreCard(score));
  }
  elements.mobileScorePanel.innerHTML = "";
  for (const score of scores) {
    const mobileCard = createScoreCard(score, true);
    mobileCard.style.flex = "0 0 120px";
    mobileCard.style.padding = "12px";
    elements.mobileScorePanel.appendChild(mobileCard);
  }
}
function renderInstructions() {
  let text = "Click an empty cell to place a token";
  if (state.selectedTokenId) {
    const token = getTokenById(state.selectedTokenId);
    if (token) {
      if (token.strength >= 2) {
        text = "Click adjacent empty cell to SPLIT, or another token to MERGE";
      } else {
        text = "Click adjacent token to MERGE, or ESC to deselect";
      }
    }
  }
  if (state.offlineMode) {
    text += " [OFFLINE MODE - changes will sync on reconnect]";
  }
  elements.instructionText.textContent = text;
}
function handleBoardClick(e) {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  if (state.selectedTokenId) {
    const token = getTokenById(state.selectedTokenId);
    if (token && token.strength >= 2) {
      handleSplit(token, x, y);
    }
    clearSelection();
  } else {
    handlePlace(x, y);
  }
}
function handleTokenClick(token) {
  if (token.playerId !== state.peerId) {
    return;
  }
  if (state.selectedTokenId === token.id) {
    clearSelection();
  } else if (state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken && selectedToken.playerId === token.playerId) {
      handleMerge(selectedToken, token);
      clearSelection();
    } else {
      selectToken(token.id);
    }
  } else {
    selectToken(token.id);
  }
}
function handlePlace(x, y) {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:place", {
      x,
      y,
      peerId: state.peerId
    });
    announce("Token placed");
  } catch (error) {
    console.warn("[Confluence] Place failed:", error.message);
  }
}
function handleMerge(tokenA, tokenB) {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:merge", {
      tokenIdA: tokenA.id,
      tokenIdB: tokenB.id,
      peerId: state.peerId
    });
    announce("Tokens merged");
  } catch (error) {
    console.warn("[Confluence] Merge failed:", error.message);
    showError(`Cannot merge: ${error.message}`);
  }
}
function handleSplit(token, targetX, targetY) {
  if (!state.engine || state.gameEnded) return;
  const board = getBoard(state.engine);
  if (!board) return;
  const targetCell = board.cells[targetY][targetX];
  if (targetCell.tokens.length > 0) {
    showError("Target cell is not empty");
    return;
  }
  if (!isAdjacent(token, targetX, targetY)) {
    showError("Target must be adjacent");
    return;
  }
  try {
    state.engine.dispatch("confluence:split", {
      tokenId: token.id,
      targetX,
      targetY,
      peerId: state.peerId
    });
    announce("Token split");
  } catch (error) {
    console.warn("[Confluence] Split failed:", error.message);
    showError(`Cannot split: ${error.message}`);
  }
}
function selectToken(tokenId) {
  state.selectedTokenId = tokenId;
  const token = getTokenById(tokenId);
  if (token && token.strength >= 2) {
    state.interactionMode = "split";
    announce("Token selected. Click adjacent empty cell to split.");
  } else {
    state.interactionMode = "merge";
    announce("Token selected. Click adjacent token to merge.");
  }
  render();
}
function clearSelection() {
  state.selectedTokenId = null;
  state.interactionMode = null;
  render();
  renderInstructions();
}
function handleBoardHover(e) {
}
function handleBoardHoverOut(e) {
}
function handleKeyboard(e) {
  if (e.key === "Escape") {
    clearSelection();
    hideProvenance();
  }
}
function showProvenance(token) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;
  const tree = buildProvenanceTree(confluenceState, token.id);
  if (!tree || !tree.parents && !token._mergedFrom && !token._splitFrom) {
    hideProvenance();
    return;
  }
  elements.provenanceTree.innerHTML = "";
  const currentNode = document.createElement("div");
  currentNode.className = "provenance-node";
  const player = confluenceState.players[token.playerId];
  currentNode.innerHTML = `
    <span class="dot" style="background: ${player?.color || "#888"}"></span>
    <span>Strength ${token.strength}</span>
    <span class="type">Current</span>
    <span class="coords">(${token.x}, ${token.y})</span>
  `;
  elements.provenanceTree.appendChild(currentNode);
  if (tree.parents && tree.parents.length > 0) {
    for (const parent of tree.parents) {
      const parentNode = document.createElement("div");
      parentNode.className = "provenance-node";
      const parentPlayer = confluenceState.players[parent.token.playerId];
      const parentType = parent.token._mergedFrom ? "Merged" : "Split";
      parentNode.innerHTML = `
        <span class="dot" style="background: ${parentPlayer?.color || "#888"}"></span>
        <span>Strength ${parent.token.strength}</span>
        <span class="type">${parentType}</span>
        <span class="coords">(${parent.token.x}, ${parent.token.y})</span>
      `;
      elements.provenanceTree.appendChild(parentNode);
    }
  }
  elements.provenanceTooltip.classList.add("visible");
  elements.provenanceTooltip.setAttribute("aria-hidden", "false");
}
function hideProvenance() {
  elements.provenanceTooltip.classList.remove("visible");
  elements.provenanceTooltip.setAttribute("aria-hidden", "true");
}
function buildProvenanceTree(confluenceState, tokenId, visited = /* @__PURE__ */ new Set()) {
  if (visited.has(tokenId)) return null;
  visited.add(tokenId);
  const token = confluenceState.tokens[tokenId];
  if (!token) return null;
  const parents = [];
  if (token._mergedFrom) {
    for (const parentId of token._mergedFrom) {
      const parent = buildProvenanceTree(confluenceState, parentId, visited);
      if (parent) parents.push(parent);
    }
  }
  if (token._splitFrom) {
    const parent = buildProvenanceTree(confluenceState, token._splitFrom, visited);
    if (parent) parents.push(parent);
  }
  return { token, parents };
}
function toggleOfflineMode() {
  if (!state.engine) return;
  if (state.offlineMode) {
    state.engine.connect(state.serverUrl);
    state.offlineMode = false;
    elements.btnOffline.textContent = "Go Offline";
    elements.btnOffline.setAttribute("aria-pressed", "false");
    elements.offlineBanner.classList.remove("offline-mode");
    elements.offlineTitle.textContent = "Reconnected!";
    elements.offlineDesc.textContent = "CRDT merged your offline changes with the network state";
    setTimeout(() => {
      hideOfflineBanner();
    }, 3e3);
  } else {
    state.engine.disconnect();
    state.offlineMode = true;
    elements.btnOffline.textContent = "Reconnect";
    elements.btnOffline.setAttribute("aria-pressed", "true");
    elements.offlineBanner.classList.add("offline-mode");
    elements.offlineTitle.textContent = "Offline Mode";
    elements.offlineDesc.textContent = "Place tokens locally. They will sync when you reconnect.";
    showOfflineBanner("Offline Mode Active", "Place tokens locally - they will merge on reconnect");
  }
  renderInstructions();
}
function showOfflineBanner(title, desc) {
  if (!state.showOfflineBanner) return;
  elements.offlineTitle.textContent = title;
  elements.offlineDesc.textContent = desc;
  elements.offlineBanner.classList.add("visible");
}
function hideOfflineBanner() {
  elements.offlineBanner.classList.remove("visible");
}
function showGameOver() {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;
  const scores = getScores(state.engine);
  const winner = confluenceState.winner;
  const winnerPlayer = winner ? confluenceState.players[winner] : null;
  const isTie = !winner && scores.length > 0;
  elements.winnerDisplay.classList.toggle("tie", isTie);
  if (winnerPlayer) {
    elements.gameOverTitle.textContent = "Victory!";
    elements.gameOverSubtitle.textContent = `${winnerPlayer.name} controls the most territory!`;
  } else if (isTie) {
    elements.gameOverTitle.textContent = "Draw!";
    elements.gameOverSubtitle.textContent = "Multiple players tied for first place";
  } else {
    elements.gameOverTitle.textContent = "Game Over";
    elements.gameOverSubtitle.textContent = "Final scores:";
  }
  elements.finalScores.innerHTML = "";
  const sortedScores = [...scores].sort((a, b) => b.controlledCells - a.controlledCells);
  for (const score of sortedScores) {
    const card = document.createElement("div");
    card.className = "final-score-card";
    if (score.playerId === winner) {
      card.classList.add("winner");
    }
    card.innerHTML = `
      <span class="player-color-dot" style="background: ${score.color}"></span>
      <div class="player-name">${escapeHtml(score.name)}${score.playerId === state.peerId ? " (You)" : ""}</div>
      <div class="score-value">${score.controlledCells}</div>
      <div class="score-label">Territory</div>
    `;
    elements.finalScores.appendChild(card);
  }
  elements.gameOverScreen.classList.add("active");
  announce(`Game over! ${winnerPlayer ? winnerPlayer.name + " wins!" : "It's a tie!"}`);
}
function handleEndGame() {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:end", {
      peerId: state.peerId
    });
  } catch (error) {
    console.warn("[Confluence] End game failed:", error.message);
  }
}
function handlePlayAgain() {
  state.gameEnded = false;
  state.gameStarted = false;
  state.selectedTokenId = null;
  state.interactionMode = null;
  elements.gameOverScreen.classList.remove("active");
  state.engine.dispatch("confluence:init", {
    width: 10,
    height: 10,
    durationMs: 3e4
  });
  state.engine.dispatch("confluence:register", {
    peerId: state.peerId,
    name: state.playerName
  });
  startTimer();
  announce("New game started!");
}
function handleNewLobby() {
  if (state.engine) {
    state.engine.disconnect();
  }
  state.gameEnded = false;
  state.gameStarted = false;
  state.connected = false;
  state.selectedTokenId = null;
  state.interactionMode = null;
  elements.gameOverScreen.classList.remove("active");
  elements.gameScreen.classList.remove("active");
  elements.startScreen.classList.remove("hidden");
  elements.btnJoin.disabled = false;
  elements.btnJoin.textContent = "Join Game";
  announce("Returned to lobby");
}
function showRules() {
  elements.rulesOverlay.classList.add("active");
  trapFocus(elements.rulesOverlay);
}
function hideRules() {
  elements.rulesOverlay.classList.remove("active");
  releaseFocusTrap(elements.rulesOverlay);
}
function getTokenById(tokenId) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return null;
  const token = confluenceState.tokens[tokenId];
  if (!token) return null;
  const consumed = confluenceState.consumed[tokenId];
  if (consumed && Object.keys(consumed).length > 0) return null;
  return token;
}
function isAdjacent(token, x, y) {
  const dx = Math.abs(token.x - x);
  const dy = Math.abs(token.y - y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}
function updateSyncStatus(status, text) {
  elements.syncIndicator.className = `sync-indicator ${status}`;
  elements.syncText.textContent = text;
  if (status === "connected") {
    updatePeerCount();
  }
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function announce(message) {
  elements.srAnnouncements.textContent = message;
  setTimeout(() => {
    elements.srAnnouncements.textContent = "";
  }, 1e3);
}
function showError(message) {
  console.error("[Confluence]", message);
  announce(`Error: ${message}`);
}
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusableElements.length === 0) return;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  firstElement.focus();
  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  modal._focusTrapHandler = handleKeyDown;
  modal.addEventListener("keydown", handleKeyDown);
}
function releaseFocusTrap(modal) {
  if (modal._focusTrapHandler) {
    modal.removeEventListener("keydown", modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
}
function handleUnload() {
  if (state.engine) {
    state.engine.disconnect();
  }
}
function handleResize() {
}
window.confluence = {
  getState: () => state,
  getEngine: () => state.engine,
  render,
  showRules,
  hideRules
};
console.log("[Confluence] Client module loaded. Use window.confluence for debugging.");
initApp();
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
//# sourceMappingURL=confluence.bundle.js.map
