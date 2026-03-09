import { describe, it, expect } from "vitest";
import { Stream } from "./stream";

describe("Stream", () => {
  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------
  describe("constructor", () => {
    it("creates a stream from an existing Uint8Array", () => {
      const buf = new Uint8Array([1, 2, 3]);
      const s = new Stream(buf, 3);
      expect(s.size).toBe(3);
      expect(s.pos).toBe(0);
      expect(s.bitPos).toBe(0);
      expect(s.reserved).toBe(3);
    });

    it("creates an empty stream when buf is null", () => {
      const s = new Stream(null, 0);
      expect(s.size).toBe(0);
      expect(s.pos).toBe(0);
      expect(s.buf.length).toBe(0);
    });

    it("creates a stream via fromExisting", () => {
      const buf = new Uint8Array(64);
      const s = Stream.fromExisting(buf, 10, 64);
      expect(s.size).toBe(10);
      expect(s.reserved).toBe(64);
      expect(s.pos).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Read operations (Big-Endian)
  // -----------------------------------------------------------------------
  describe("reading", () => {
    it("readU8 reads a single byte and advances position", () => {
      const s = new Stream(new Uint8Array([0x42, 0xff]), 2);
      expect(s.readU8()).toBe(0x42);
      expect(s.pos).toBe(1);
      expect(s.readU8()).toBe(0xff);
      expect(s.pos).toBe(2);
    });

    it("peekU8 reads without advancing position", () => {
      const s = new Stream(new Uint8Array([0xab]), 1);
      expect(s.peekU8()).toBe(0xab);
      expect(s.pos).toBe(0);
    });

    it("readU16 reads big-endian 16-bit unsigned", () => {
      const s = new Stream(new Uint8Array([0x01, 0x02]), 2);
      expect(s.readU16()).toBe(0x0102);
    });

    it("readU24 reads big-endian 24-bit unsigned", () => {
      const s = new Stream(new Uint8Array([0x01, 0x02, 0x03]), 3);
      expect(s.readU24()).toBe(0x010203);
    });

    it("readU32 reads big-endian 32-bit unsigned", () => {
      const s = new Stream(new Uint8Array([0x80, 0x00, 0x00, 0x01]), 4);
      // 0x80000001 as unsigned = 2147483649
      expect(s.readU32()).toBe(0x80000001);
    });

    it("readS16 reads big-endian 16-bit signed (positive)", () => {
      const s = new Stream(new Uint8Array([0x00, 0x7f]), 2);
      expect(s.readS16()).toBe(127);
    });

    it("readS16 reads big-endian 16-bit signed (negative)", () => {
      const s = new Stream(new Uint8Array([0xff, 0xfe]), 2);
      expect(s.readS16()).toBe(-2);
    });

    it("readS8 reads signed 8-bit (positive)", () => {
      const s = new Stream(new Uint8Array([0x7f]), 1);
      expect(s.readS8()).toBe(127);
    });

    it("readS8 reads signed 8-bit (negative)", () => {
      const s = new Stream(new Uint8Array([0x80]), 1);
      expect(s.readS8()).toBe(-128);
    });

    it("readChar returns a character", () => {
      const s = new Stream(new Uint8Array([0x41]), 1);
      expect(s.readChar()).toBe("A");
    });

    it("throws on reading past end of stream", () => {
      const s = new Stream(new Uint8Array([0x01]), 1);
      s.readU8();
      expect(() => s.readU8()).toThrow("not enough data");
    });

    it("throws on readU16 when only 1 byte remains", () => {
      const s = new Stream(new Uint8Array([0x01]), 1);
      expect(() => s.readU16()).toThrow("not enough data");
    });
  });

  // -----------------------------------------------------------------------
  // Write operations (Big-Endian)
  // -----------------------------------------------------------------------
  describe("writing", () => {
    it("writeU8 writes a byte and grows buffer as needed", () => {
      const s = new Stream(null, 0);
      s.writeU8(0xab);
      expect(s.size).toBe(1);
      expect(s.buf[0]).toBe(0xab);
    });

    it("writeU16 writes big-endian 16-bit", () => {
      const s = new Stream(null, 0);
      s.writeU16(0x1234);
      expect(s.buf[0]).toBe(0x12);
      expect(s.buf[1]).toBe(0x34);
    });

    it("writeU24 writes big-endian 24-bit", () => {
      const s = new Stream(null, 0);
      s.writeU24(0xabcdef);
      expect(s.buf[0]).toBe(0xab);
      expect(s.buf[1]).toBe(0xcd);
      expect(s.buf[2]).toBe(0xef);
    });

    it("writeU32 writes big-endian 32-bit", () => {
      const s = new Stream(null, 0);
      s.writeU32(0xdeadbeef);
      expect(s.buf[0]).toBe(0xde);
      expect(s.buf[1]).toBe(0xad);
      expect(s.buf[2]).toBe(0xbe);
      expect(s.buf[3]).toBe(0xef);
    });

    it("writeS16 writes negative values correctly", () => {
      const s = new Stream(null, 0);
      s.writeS16(-1);
      // -1 in signed 16 = 0xFFFF
      expect(s.buf[0]).toBe(0xff);
      expect(s.buf[1]).toBe(0xff);
    });

    it("writeS8 writes negative values correctly", () => {
      const s = new Stream(null, 0);
      s.writeS8(-128);
      expect(s.buf[0]).toBe(0x80);
    });

    it("roundtrips write then read for U32", () => {
      const s = new Stream(null, 0);
      s.writeU32(0xcafebabe);
      s.seekAbsolute(0);
      expect(s.readU32()).toBe(0xcafebabe);
    });

    it("roundtrips write then read for S16", () => {
      const s = new Stream(null, 0);
      s.writeS16(-12345);
      s.seekAbsolute(0);
      expect(s.readS16()).toBe(-12345);
    });
  });

  // -----------------------------------------------------------------------
  // Seek operations
  // -----------------------------------------------------------------------
  describe("seeking", () => {
    it("seekAbsolute sets position and resets bitPos", () => {
      const s = new Stream(new Uint8Array(10), 10);
      s.pos = 5;
      s.bitPos = 3;
      s.seekAbsolute(2);
      expect(s.pos).toBe(2);
      expect(s.bitPos).toBe(0);
    });

    it("seekAbsolute throws when seeking past end", () => {
      const s = new Stream(new Uint8Array(5), 5);
      expect(() => s.seekAbsolute(6)).toThrow("seek past end");
    });

    it("seekRelative moves position by offset", () => {
      const s = new Stream(new Uint8Array(10), 10);
      s.pos = 3;
      s.seekRelative(4);
      expect(s.pos).toBe(7);
    });

    it("seekRelative throws on negative result", () => {
      const s = new Stream(new Uint8Array(10), 10);
      s.pos = 2;
      expect(() => s.seekRelative(-3)).toThrow("negative seek");
    });

    it("seekAbsoluteThroughReserve grows buffer when needed", () => {
      const s = new Stream(null, 0);
      s.seekAbsoluteThroughReserve(100);
      expect(s.pos).toBe(100);
      expect(s.size).toBe(100);
      expect(s.reserved).toBeGreaterThanOrEqual(100);
    });

    it("seekRelativeThroughReserve grows from current position", () => {
      const s = new Stream(null, 0);
      s.seekAbsoluteThroughReserve(10);
      s.seekRelativeThroughReserve(50);
      expect(s.pos).toBe(60);
      expect(s.size).toBe(60);
    });
  });

  // -----------------------------------------------------------------------
  // Bit-level reading
  // -----------------------------------------------------------------------
  describe("readNBits", () => {
    it("reads 0 bits and returns 0", () => {
      const s = new Stream(new Uint8Array([0xff]), 1);
      expect(s.readNBits(0)).toBe(0);
    });

    it("reads 8 bits from a single byte", () => {
      const s = new Stream(new Uint8Array([0b10110011]), 1);
      expect(s.readNBits(8)).toBe(0b10110011);
    });

    it("reads bits spanning two bytes", () => {
      // 0xAB = 10101011, 0xCD = 11001101
      // reading 12 bits: 10101011 1100 = 0xABC
      const s = new Stream(new Uint8Array([0xab, 0xcd]), 2);
      expect(s.readNBits(12)).toBe(0xabc);
    });

    it("reads 4 bits at a time from one byte", () => {
      const s = new Stream(new Uint8Array([0xf3]), 1);
      expect(s.readNBits(4)).toBe(0x0f); // high nibble
      expect(s.readNBits(4)).toBe(0x03); // low nibble
    });

    it("reads 1 bit at a time", () => {
      const s = new Stream(new Uint8Array([0b10100000]), 1);
      expect(s.readNBits(1)).toBe(1);
      expect(s.readNBits(1)).toBe(0);
      expect(s.readNBits(1)).toBe(1);
      expect(s.readNBits(1)).toBe(0);
    });

    it("throws when not enough data for bit read", () => {
      const s = new Stream(new Uint8Array([0xff]), 1);
      s.readNBits(8);
      expect(() => s.readNBits(1)).toThrow("not enough data for bit read");
    });
  });

  // -----------------------------------------------------------------------
  // copyTo
  // -----------------------------------------------------------------------
  describe("copyTo", () => {
    it("copies bytes from one stream to another", () => {
      const src = new Stream(new Uint8Array([10, 20, 30, 40]), 4);
      const dest = new Stream(null, 0);
      src.copyTo(dest, 3);
      expect(src.pos).toBe(3);
      expect(dest.pos).toBe(3);
      expect(dest.buf[0]).toBe(10);
      expect(dest.buf[1]).toBe(20);
      expect(dest.buf[2]).toBe(30);
    });

    it("throws when source does not have enough data", () => {
      const src = new Stream(new Uint8Array([1, 2]), 2);
      const dest = new Stream(null, 0);
      expect(() => src.copyTo(dest, 5)).toThrow("not enough data for copy");
    });
  });

  // -----------------------------------------------------------------------
  // checksumU32
  // -----------------------------------------------------------------------
  describe("checksumU32", () => {
    it("computes checksum over aligned data", () => {
      const s = new Stream(null, 0);
      s.writeU32(0x00000001);
      s.writeU32(0x00000002);
      // checksum = 1 + 2 = 3
      expect(s.checksumU32(0, 8)).toBe(3);
    });

    it("computes checksum with zero-padded remainder", () => {
      // 5 bytes: [0x01, 0x00, 0x00, 0x00, 0x02]
      const s = new Stream(new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x02]), 5);
      // First U32: 0x01000000, Second (padded): 0x02000000
      const expected = (0x01000000 + 0x02000000) >>> 0;
      expect(s.checksumU32(0, 5)).toBe(expected);
    });

    it("does not change stream position after checksum", () => {
      const s = new Stream(new Uint8Array(8), 8);
      s.pos = 3;
      s.checksumU32(0, 8);
      expect(s.pos).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // toUint8Array
  // -----------------------------------------------------------------------
  describe("toUint8Array", () => {
    it("returns a copy of the written data", () => {
      const s = new Stream(null, 0);
      s.writeU8(0x01);
      s.writeU8(0x02);
      s.writeU8(0x03);
      const result = s.toUint8Array();
      expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
      // Verify it's a copy (mutating result doesn't affect stream)
      result[0] = 0xff;
      expect(s.buf[0]).toBe(0x01);
    });
  });

  // -----------------------------------------------------------------------
  // reserve
  // -----------------------------------------------------------------------
  describe("reserve", () => {
    it("grows buffer capacity while preserving data", () => {
      const s = new Stream(null, 0);
      s.writeU8(0xaa);
      s.writeU8(0xbb);
      s.reserve(1024);
      expect(s.reserved).toBeGreaterThanOrEqual(1024);
      expect(s.buf[0]).toBe(0xaa);
      expect(s.buf[1]).toBe(0xbb);
    });

    it("does nothing when already has enough capacity", () => {
      const buf = new Uint8Array(100);
      const s = new Stream(buf, 0);
      const originalReserved = s.reserved;
      s.reserve(50);
      expect(s.reserved).toBe(originalReserved);
    });
  });

  // -----------------------------------------------------------------------
  // readRestAsU32
  // -----------------------------------------------------------------------
  describe("readRestAsU32", () => {
    it("returns null when no data remains", () => {
      const s = new Stream(new Uint8Array(4), 4);
      s.pos = 4;
      expect(s.readRestAsU32()).toBeNull();
    });

    it("reads a full U32 when 4+ bytes remain", () => {
      const s = new Stream(new Uint8Array([0x00, 0x00, 0x00, 0x01]), 4);
      expect(s.readRestAsU32()).toBe(1);
    });

    it("pads with zeros when fewer than 4 bytes remain", () => {
      // 2 bytes: [0x01, 0x02] -> padded to 0x01020000
      const s = new Stream(new Uint8Array([0x01, 0x02]), 2);
      expect(s.readRestAsU32()).toBe(0x01020000);
    });
  });
});
