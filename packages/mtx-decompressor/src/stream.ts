/**
 * Binary stream reader/writer for big-endian data.
 * Ported from libeot (MPL 2.0) util/stream.c
 */
export class Stream {
  buf: Uint8Array;
  size: number;     // how much data has been written or is valid
  reserved: number; // allocated capacity
  pos: number;      // current byte position
  bitPos: number;   // current bit position within the byte at `pos`

  constructor(buf: Uint8Array | null, size: number) {
    if (buf) {
      this.buf = buf;
      this.size = size;
      this.reserved = buf.length;
    } else {
      this.buf = new Uint8Array(0);
      this.size = 0;
      this.reserved = 0;
    }
    this.pos = 0;
    this.bitPos = 0;
  }

  static fromExisting(buf: Uint8Array, size: number, reserved: number): Stream {
    const s = new Stream(null, 0);
    s.buf = buf;
    s.size = size;
    s.reserved = reserved;
    return s;
  }

  reserve(n: number): void {
    if (this.reserved >= n) return;
    const newBuf = new Uint8Array(n);
    newBuf.set(this.buf.subarray(0, this.size));
    this.buf = newBuf;
    this.reserved = n;
  }

  private ensureWrite(n: number): void {
    const needed = this.pos + n;
    if (needed > this.reserved) {
      this.reserve(Math.max(needed, this.reserved * 2 || 256));
    }
    if (needed > this.size) {
      this.size = needed;
    }
  }

  private ensureRead(n: number): void {
    if (this.pos + n > this.size) {
      throw new Error(`Stream: not enough data (need ${n} bytes at pos ${this.pos}, size ${this.size})`);
    }
  }

  // --- Seek ---
  seekAbsolute(pos: number): void {
    if (pos > this.size) throw new Error(`Stream: seek past end (${pos} > ${this.size})`);
    this.pos = pos;
    this.bitPos = 0;
  }

  seekRelative(offset: number): void {
    const newPos = this.pos + offset;
    if (newPos < 0) throw new Error("Stream: negative seek");
    if (newPos > this.size) throw new Error("Stream: seek past end");
    this.pos = newPos;
    this.bitPos = 0;
  }

  seekAbsoluteThroughReserve(pos: number): void {
    if (pos > this.reserved) {
      this.reserve(pos);
    }
    if (pos > this.size) {
      this.size = pos;
    }
    this.pos = pos;
    this.bitPos = 0;
  }

  seekRelativeThroughReserve(offset: number): void {
    this.seekAbsoluteThroughReserve(this.pos + offset);
  }

  // --- Read (Big-Endian) ---
  readU8(): number {
    this.ensureRead(1);
    return this.buf[this.pos++];
  }

  peekU8(): number {
    this.ensureRead(1);
    return this.buf[this.pos];
  }

  readU16(): number {
    this.ensureRead(2);
    const v = (this.buf[this.pos] << 8) | this.buf[this.pos + 1];
    this.pos += 2;
    return v;
  }

  readU24(): number {
    this.ensureRead(3);
    const v = (this.buf[this.pos] << 16) | (this.buf[this.pos + 1] << 8) | this.buf[this.pos + 2];
    this.pos += 3;
    return v;
  }

  readU32(): number {
    this.ensureRead(4);
    const v = ((this.buf[this.pos] << 24) | (this.buf[this.pos + 1] << 16) |
               (this.buf[this.pos + 2] << 8) | this.buf[this.pos + 3]) >>> 0;
    this.pos += 4;
    return v;
  }

  readS16(): number {
    const v = this.readU16();
    return v >= 0x8000 ? v - 0x10000 : v;
  }

  readS8(): number {
    const v = this.readU8();
    return v >= 0x80 ? v - 0x100 : v;
  }

  readChar(): string {
    return String.fromCharCode(this.readU8());
  }

  // --- Write (Big-Endian) ---
  writeU8(v: number): void {
    this.ensureWrite(1);
    this.buf[this.pos++] = v & 0xFF;
  }

  writeU16(v: number): void {
    this.ensureWrite(2);
    this.buf[this.pos++] = (v >> 8) & 0xFF;
    this.buf[this.pos++] = v & 0xFF;
  }

  writeU24(v: number): void {
    this.ensureWrite(3);
    this.buf[this.pos++] = (v >> 16) & 0xFF;
    this.buf[this.pos++] = (v >> 8) & 0xFF;
    this.buf[this.pos++] = v & 0xFF;
  }

  writeU32(v: number): void {
    this.ensureWrite(4);
    this.buf[this.pos++] = (v >>> 24) & 0xFF;
    this.buf[this.pos++] = (v >> 16) & 0xFF;
    this.buf[this.pos++] = (v >> 8) & 0xFF;
    this.buf[this.pos++] = v & 0xFF;
  }

  writeS16(v: number): void {
    this.writeU16(v < 0 ? v + 0x10000 : v);
  }

  writeS8(v: number): void {
    this.writeU8(v < 0 ? v + 0x100 : v);
  }

  // --- Bit-level reading (for triplet coordinate decoding) ---
  readNBits(n: number): number {
    if (n === 0) return 0;
    let value = 0;
    let bitsRemaining = n;
    while (bitsRemaining > 0) {
      if (this.pos >= this.size && this.bitPos === 0) {
        throw new Error("Stream: not enough data for bit read");
      }
      const bitsAvailableInByte = 8 - this.bitPos;
      const bitsToRead = Math.min(bitsRemaining, bitsAvailableInByte);
      const shift = bitsAvailableInByte - bitsToRead;
      const mask = ((1 << bitsToRead) - 1) << shift;
      value = (value << bitsToRead) | ((this.buf[this.pos] & mask) >> shift);
      this.bitPos += bitsToRead;
      if (this.bitPos >= 8) {
        this.bitPos = 0;
        this.pos++;
      }
      bitsRemaining -= bitsToRead;
    }
    return value;
  }

  // --- Copy ---
  /** Copy `length` bytes from this stream to `dest`. */
  copyTo(dest: Stream, length: number): void {
    if (this.pos + length > this.size) {
      throw new Error("Stream: not enough data for copy");
    }
    dest.ensureWrite(length);
    dest.buf.set(this.buf.subarray(this.pos, this.pos + length), dest.pos);
    this.pos += length;
    dest.pos += length;
  }

  /** Read rest of data as 4-byte-aligned U32 values. Returns 0 on incomplete read. */
  readRestAsU32(): number | null {
    if (this.pos + 4 > this.size) {
      // Pad remaining bytes
      if (this.pos >= this.size) return null;
      let val = 0;
      const remaining = this.size - this.pos;
      for (let i = 0; i < 4; i++) {
        val <<= 8;
        if (i < remaining) {
          val |= this.buf[this.pos + i];
        }
      }
      this.pos = this.size;
      return val >>> 0;
    }
    return this.readU32();
  }

  /** Compute checksum of bytes from beginPos to endPos as 4-byte aligned U32 sum. */
  checksumU32(beginPos: number, endPos: number): number {
    let sum = 0;
    const savedPos = this.pos;
    this.pos = beginPos;
    while (this.pos < endPos) {
      const chunk = this.readRestAsU32();
      if (chunk === null) break;
      sum = (sum + chunk) >>> 0;
    }
    this.pos = savedPos;
    return sum;
  }

  /** Get a copy of the written data. */
  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.size);
  }
}
