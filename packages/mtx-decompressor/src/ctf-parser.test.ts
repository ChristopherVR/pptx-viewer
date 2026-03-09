import { describe, it, expect } from "vitest";
import { parseCTF, type SFNTContainer, type SFNTTable } from "./ctf-parser";
import { Stream } from "./stream";

/**
 * Build a minimal CTF stream[0] that contains an SFNT header and
 * table directory, plus the raw table data.
 *
 * This is a helper for constructing test inputs for parseCTF.
 */
function buildMinimalCTFStream0(
  tables: { tag: string; data: Uint8Array }[],
): Stream {
  const s = new Stream(null, 0);

  // --- SFNT offset table (12 bytes) ---
  s.writeU32(0x00010000); // scalarType (TrueType)
  s.writeU16(tables.length); // numTables
  s.writeU16(0); // searchRange (not validated by parser)
  s.writeU16(0); // entrySelector
  s.writeU16(0); // rangeShift

  // The table directory follows immediately: 16 bytes per entry.
  // After the directory, we'll place each table's data.
  const dirEnd = 12 + tables.length * 16;
  let currentOffset = dirEnd;

  // --- Table directory entries ---
  for (const t of tables) {
    // 4-byte ASCII tag
    for (let i = 0; i < 4; i++) {
      s.writeU8(t.tag.charCodeAt(i));
    }
    s.writeU32(0); // checksum (skipped by parser)
    s.writeU32(currentOffset); // offset
    s.writeU32(t.data.length); // size
    currentOffset += t.data.length;
  }

  // --- Table data ---
  for (const t of tables) {
    for (let i = 0; i < t.data.length; i++) {
      s.writeU8(t.data[i]);
    }
  }

  s.seekAbsolute(0);
  return s;
}

describe("parseCTF", () => {
  // -----------------------------------------------------------------------
  // Minimal container with no glyf/loca
  // -----------------------------------------------------------------------
  it("parses a minimal CTF with a single table", () => {
    const tableData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const s0 = buildMinimalCTFStream0([{ tag: "name", data: tableData }]);
    const s1 = new Stream(new Uint8Array(0), 0);
    const s2 = new Stream(new Uint8Array(0), 0);

    const container = parseCTF([s0, s1, s2]);

    expect(container.tables.length).toBe(1);
    expect(container.tables[0].tag).toBe("name");
    expect(container.tables[0].bufSize).toBe(4);
    expect(container.tables[0].buf).toEqual(tableData);
  });

  it("parses multiple tables", () => {
    const tables = [
      { tag: "name", data: new Uint8Array([0x01, 0x02]) },
      { tag: "post", data: new Uint8Array([0x03, 0x04, 0x05]) },
      { tag: "OS/2", data: new Uint8Array([0x06]) },
    ];
    const s0 = buildMinimalCTFStream0(tables);
    const s1 = new Stream(new Uint8Array(0), 0);
    const s2 = new Stream(new Uint8Array(0), 0);

    const container = parseCTF([s0, s1, s2]);

    expect(container.tables.length).toBe(3);
    expect(container.tables[0].tag).toBe("name");
    expect(container.tables[1].tag).toBe("post");
    expect(container.tables[2].tag).toBe("OS/2");
  });

  // -----------------------------------------------------------------------
  // hdmx and VDMX table skipping
  // -----------------------------------------------------------------------
  it("skips hdmx tables", () => {
    const s = new Stream(null, 0);
    s.writeU32(0x00010000); // scalarType
    s.writeU16(2); // numTables
    s.writeU16(0);
    s.writeU16(0);
    s.writeU16(0);

    // Table 1: hdmx (should be skipped)
    for (const c of "hdmx") s.writeU8(c.charCodeAt(0));
    s.writeU32(0); // checksum
    s.writeU32(100); // offset
    s.writeU32(50); // size

    // Table 2: name
    const nameOffset = 12 + 2 * 16;
    const nameData = new Uint8Array([0xaa, 0xbb]);
    for (const c of "name") s.writeU8(c.charCodeAt(0));
    s.writeU32(0);
    s.writeU32(nameOffset);
    s.writeU32(nameData.length);

    // Write name data
    s.seekAbsoluteThroughReserve(nameOffset);
    for (let i = 0; i < nameData.length; i++) s.writeU8(nameData[i]);

    s.seekAbsolute(0);
    const container = parseCTF([s, new Stream(null, 0), new Stream(null, 0)]);

    // Only the name table should be present (hdmx skipped)
    expect(container.tables.length).toBe(1);
    expect(container.tables[0].tag).toBe("name");
  });

  it("skips VDMX tables", () => {
    const s = new Stream(null, 0);
    s.writeU32(0x00010000);
    s.writeU16(1); // numTables: just VDMX
    s.writeU16(0);
    s.writeU16(0);
    s.writeU16(0);

    for (const c of "VDMX") s.writeU8(c.charCodeAt(0));
    s.writeU32(0);
    s.writeU32(100);
    s.writeU32(50);

    s.seekAbsolute(0);
    const container = parseCTF([s, new Stream(null, 0), new Stream(null, 0)]);
    expect(container.tables.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // head table zeroing of checksumAdjustment
  // -----------------------------------------------------------------------
  it("zeroes out bytes 8-11 of the head table", () => {
    // A minimal head table (54 bytes minimum for indexToLocFormat at offset 50)
    const headData = new Uint8Array(54);
    // Set bytes 8-11 to non-zero values
    headData[8] = 0xde;
    headData[9] = 0xad;
    headData[10] = 0xbe;
    headData[11] = 0xef;
    // Set indexToLocFormat at offset 50-51
    headData[50] = 0x00;
    headData[51] = 0x00;

    const s0 = buildMinimalCTFStream0([{ tag: "head", data: headData }]);
    const container = parseCTF([s0, new Stream(null, 0), new Stream(null, 0)]);

    const head = container.tables.find((t) => t.tag === "head")!;
    expect(head).toBeDefined();
    // checksumAdjustment (bytes 8-11) should be zeroed
    expect(head.buf[8]).toBe(0);
    expect(head.buf[9]).toBe(0);
    expect(head.buf[10]).toBe(0);
    expect(head.buf[11]).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Container type
  // -----------------------------------------------------------------------
  it("returns an SFNTContainer with a tables array", () => {
    const s0 = buildMinimalCTFStream0([
      { tag: "cmap", data: new Uint8Array(10) },
    ]);
    const container = parseCTF([s0, new Stream(null, 0), new Stream(null, 0)]);
    expect(container).toHaveProperty("tables");
    expect(Array.isArray(container.tables)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Empty container
  // -----------------------------------------------------------------------
  it("handles a container with zero tables", () => {
    const s = new Stream(null, 0);
    s.writeU32(0x00010000);
    s.writeU16(0); // 0 tables
    s.writeU16(0);
    s.writeU16(0);
    s.writeU16(0);
    s.seekAbsolute(0);

    const container = parseCTF([s, new Stream(null, 0), new Stream(null, 0)]);
    expect(container.tables.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Table data integrity
  // -----------------------------------------------------------------------
  it("preserves exact table data bytes", () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;

    const s0 = buildMinimalCTFStream0([{ tag: "cmap", data }]);
    const container = parseCTF([s0, new Stream(null, 0), new Stream(null, 0)]);

    const cmap = container.tables[0];
    expect(cmap.bufSize).toBe(256);
    for (let i = 0; i < 256; i++) {
      expect(cmap.buf[i]).toBe(i);
    }
  });
});
