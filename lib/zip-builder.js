// lib/zip-builder.js — Lightweight stored ZIP builder (no external deps)
// Uses stored mode (method=0) — PNG/JSON files are already small/compressed.

const ZipBuilder = (() => {
  // ── CRC32 lookup table ──
  const _crc32Table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  function _crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = _crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function _encodeStr(str) {
    return new TextEncoder().encode(str);
  }

  function _dosDateTime(date) {
    const d = date || new Date();
    const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
    const dt   = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
    return { time, date: dt };
  }

  class ZipFile {
    constructor() {
      this._entries = [];
    }

    /** @param {string} name @param {Uint8Array|string} data @param {Date} [date] */
    add(name, data, date) {
      if (typeof data === "string") data = _encodeStr(data);
      if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
      this._entries.push({ name, data, date: date || new Date() });
    }

    /** @returns {Blob} */
    build() {
      const localParts  = [];
      const centralParts = [];
      let offset = 0;

      for (const entry of this._entries) {
        const nameBytes  = _encodeStr(entry.name);
        const { data }   = entry;
        const crc        = _crc32(data);
        const size       = data.length;
        const { time, date: dosDate } = _dosDateTime(entry.date);

        // ── Local file header (30 bytes + filename) ──
        const lhBuf = new ArrayBuffer(30 + nameBytes.length);
        const lh    = new DataView(lhBuf);
        lh.setUint32(  0, 0x04034B50, true); // signature
        lh.setUint16(  4, 20,         true); // version needed
        lh.setUint16(  6, 0,          true); // flags
        lh.setUint16(  8, 0,          true); // compression: stored
        lh.setUint16( 10, time,       true); // mod time
        lh.setUint16( 12, dosDate,    true); // mod date
        lh.setUint32( 14, crc,        true); // crc32
        lh.setUint32( 18, size,       true); // compressed size
        lh.setUint32( 22, size,       true); // uncompressed size
        lh.setUint16( 26, nameBytes.length, true);
        lh.setUint16( 28, 0,          true); // extra field length
        new Uint8Array(lhBuf, 30).set(nameBytes);

        // ── Central directory entry (46 bytes + filename) ──
        const ceBuf = new ArrayBuffer(46 + nameBytes.length);
        const ce    = new DataView(ceBuf);
        ce.setUint32(  0, 0x02014B50, true); // signature
        ce.setUint16(  4, 20,         true); // version made
        ce.setUint16(  6, 20,         true); // version needed
        ce.setUint16(  8, 0,          true); // flags
        ce.setUint16( 10, 0,          true); // compression: stored
        ce.setUint16( 12, time,       true);
        ce.setUint16( 14, dosDate,    true);
        ce.setUint32( 16, crc,        true);
        ce.setUint32( 20, size,       true); // compressed size
        ce.setUint32( 24, size,       true); // uncompressed size
        ce.setUint16( 28, nameBytes.length, true);
        ce.setUint16( 30, 0,          true); // extra
        ce.setUint16( 32, 0,          true); // comment
        ce.setUint16( 34, 0,          true); // disk start
        ce.setUint16( 36, 0,          true); // internal attrs
        ce.setUint32( 38, 0,          true); // external attrs
        ce.setUint32( 42, offset,     true); // local header offset
        new Uint8Array(ceBuf, 46).set(nameBytes);

        localParts.push(new Uint8Array(lhBuf), data);
        centralParts.push(new Uint8Array(ceBuf));
        offset += 30 + nameBytes.length + size;
      }

      // ── End of central directory (22 bytes) ──
      const cdSize   = centralParts.reduce((acc, c) => acc + c.length, 0);
      const eocdBuf  = new ArrayBuffer(22);
      const eocd     = new DataView(eocdBuf);
      eocd.setUint32(  0, 0x06054B50,          true); // signature
      eocd.setUint16(  4, 0,                   true); // disk number
      eocd.setUint16(  6, 0,                   true); // cd disk
      eocd.setUint16(  8, this._entries.length,true); // disk entries
      eocd.setUint16( 10, this._entries.length,true); // total entries
      eocd.setUint32( 12, cdSize,              true); // cd size
      eocd.setUint32( 16, offset,              true); // cd offset
      eocd.setUint16( 20, 0,                   true); // comment length

      return new Blob(
        [...localParts, ...centralParts, new Uint8Array(eocdBuf)],
        { type: "application/zip" }
      );
    }
  }

  return { ZipFile };
})();

window.ZipBuilder = ZipBuilder;
