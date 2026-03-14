/**
 * Minimal OLE2 Compound Binary File (CBFF) parser.
 *
 * Reads the OLE2 container structure used by encrypted OOXML packages
 * to extract named streams (e.g. "EncryptionInfo", "EncryptedPackage").
 *
 * Reference: [MS-CFB] Compound Binary File Format
 * @see https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb
 *
 * @module ole2-parser
 */

/** OLE2 Compound Binary File magic signature. */
const OLE_MAGIC = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0x1b, 0x1a, 0xe1,
]);

/** Special sector indices. */
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;
const MAXREGSECT = 0xfffffffa;

/** Directory entry object types. */
const ENTRY_TYPE_EMPTY = 0;
const ENTRY_TYPE_STORAGE = 1;
const ENTRY_TYPE_STREAM = 2;
const ENTRY_TYPE_ROOT = 5;

/** Directory entry size is always 128 bytes. */
const DIR_ENTRY_SIZE = 128;

/**
 * Parsed OLE2 directory entry.
 */
export interface Ole2DirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
  childId: number;
  leftSiblingId: number;
  rightSiblingId: number;
}

/**
 * Parsed OLE2 compound file.
 */
export interface Ole2File {
  entries: Ole2DirectoryEntry[];
  getStream(name: string): Uint8Array | undefined;
}

/**
 * Error thrown when OLE2 parsing fails.
 */
export class Ole2ParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Ole2ParseError";
  }
}

/**
 * Parse an OLE2 compound binary file from an ArrayBuffer.
 *
 * @param buffer - Raw bytes of the OLE2 file.
 * @returns Parsed OLE2 file with stream access.
 * @throws Ole2ParseError if the file is not a valid OLE2 container.
 */
export function parseOle2(buffer: ArrayBuffer): Ole2File {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Validate magic signature
  for (let i = 0; i < OLE_MAGIC.length; i++) {
    if (data[i] !== OLE_MAGIC[i]) {
      throw new Ole2ParseError("Not a valid OLE2 compound file");
    }
  }

  // Read header fields
  const minorVersion = view.getUint16(0x18, true);
  const majorVersion = view.getUint16(0x1a, true);
  const byteOrder = view.getUint16(0x1c, true);

  if (byteOrder !== 0xfffe) {
    throw new Ole2ParseError("Invalid byte order mark");
  }

  const sectorSizePower = view.getUint16(0x1e, true);
  const miniSectorSizePower = view.getUint16(0x20, true);
  const sectorSize = 1 << sectorSizePower;
  const miniSectorSize = 1 << miniSectorSizePower;

  const totalFATSectors = view.getUint32(0x2c, true);
  const firstDirectorySector = view.getUint32(0x30, true);
  const miniStreamCutoff = view.getUint32(0x38, true);
  const firstMiniFATSector = view.getUint32(0x3c, true);
  const totalMiniFATSectors = view.getUint32(0x40, true);
  const firstDIFATSector = view.getUint32(0x44, true);
  const totalDIFATSectors = view.getUint32(0x48, true);

  // Helper: convert sector index to file offset
  function sectorOffset(sector: number): number {
    return (sector + 1) * sectorSize;
  }

  // Read sector data
  function readSector(sector: number): Uint8Array {
    const offset = sectorOffset(sector);
    if (offset + sectorSize > data.length) {
      throw new Ole2ParseError(
        `Sector ${sector} at offset ${offset} exceeds file size ${data.length}`,
      );
    }
    return data.subarray(offset, offset + sectorSize);
  }

  // Build the FAT (File Allocation Table)
  // First 109 DIFAT entries are in the header at offset 0x4C
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < totalFATSectors; i++) {
    const sector = view.getUint32(0x4c + i * 4, true);
    if (sector <= MAXREGSECT) {
      fatSectors.push(sector);
    }
  }

  // Read additional DIFAT sectors if needed
  let difatSector = firstDIFATSector;
  for (
    let d = 0;
    d < totalDIFATSectors && difatSector <= MAXREGSECT;
    d++
  ) {
    const difatData = readSector(difatSector);
    const difatView = new DataView(
      difatData.buffer,
      difatData.byteOffset,
      difatData.byteLength,
    );
    const entriesPerSector = (sectorSize - 4) / 4;
    for (
      let i = 0;
      i < entriesPerSector && fatSectors.length < totalFATSectors;
      i++
    ) {
      const sector = difatView.getUint32(i * 4, true);
      if (sector <= MAXREGSECT) {
        fatSectors.push(sector);
      }
    }
    // Last 4 bytes of DIFAT sector point to next DIFAT sector
    difatSector = difatView.getUint32(sectorSize - 4, true);
  }

  // Build the full FAT array
  const fatEntries: number[] = [];
  for (const fatSector of fatSectors) {
    const fatData = readSector(fatSector);
    const fatView = new DataView(
      fatData.buffer,
      fatData.byteOffset,
      fatData.byteLength,
    );
    for (let i = 0; i < sectorSize / 4; i++) {
      fatEntries.push(fatView.getUint32(i * 4, true));
    }
  }

  /**
   * Read a chain of sectors following the FAT.
   */
  function readSectorChain(startSector: number): Uint8Array {
    const sectors: Uint8Array[] = [];
    let current = startSector;
    const visited = new Set<number>();

    while (current <= MAXREGSECT) {
      if (visited.has(current)) {
        throw new Ole2ParseError(
          `Circular reference in FAT chain at sector ${current}`,
        );
      }
      visited.add(current);
      sectors.push(readSector(current));
      current = fatEntries[current] ?? ENDOFCHAIN;
    }

    // Concatenate all sectors
    const totalLength = sectors.length * sectorSize;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const sector of sectors) {
      result.set(sector, offset);
      offset += sectorSize;
    }
    return result;
  }

  /**
   * Read a stream, trimming to actual size.
   */
  function readStream(startSector: number, size: number): Uint8Array {
    const raw = readSectorChain(startSector);
    return raw.subarray(0, Math.min(size, raw.length));
  }

  // Build the mini FAT
  let miniFatEntries: number[] = [];
  if (firstMiniFATSector <= MAXREGSECT && totalMiniFATSectors > 0) {
    const miniFatRaw = readSectorChain(firstMiniFATSector);
    const miniFatView = new DataView(
      miniFatRaw.buffer,
      miniFatRaw.byteOffset,
      miniFatRaw.byteLength,
    );
    for (let i = 0; i < miniFatRaw.length / 4; i++) {
      miniFatEntries.push(miniFatView.getUint32(i * 4, true));
    }
  }

  // Read directory entries
  const dirRaw = readSectorChain(firstDirectorySector);
  const numEntries = Math.floor(dirRaw.length / DIR_ENTRY_SIZE);
  const entries: Ole2DirectoryEntry[] = [];

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = i * DIR_ENTRY_SIZE;
    const entryView = new DataView(
      dirRaw.buffer,
      dirRaw.byteOffset + entryOffset,
      DIR_ENTRY_SIZE,
    );

    const nameLen = entryView.getUint16(64, true);
    const objectType = entryView.getUint8(66);

    if (objectType === ENTRY_TYPE_EMPTY) {
      continue;
    }

    // Name is a UTF-16LE string, nameLen includes the null terminator (in bytes)
    const nameBytes = Math.max(0, nameLen - 2);
    let name = "";
    for (let j = 0; j < nameBytes; j += 2) {
      name += String.fromCharCode(entryView.getUint16(j, true));
    }

    const leftSiblingId = entryView.getUint32(68, true);
    const rightSiblingId = entryView.getUint32(72, true);
    const childId = entryView.getUint32(76, true);
    const startSector = entryView.getUint32(116, true);
    const sizeLow = entryView.getUint32(120, true);

    // For v4 files, size can be 64-bit
    let size = sizeLow;
    if (majorVersion === 4) {
      const sizeHigh = entryView.getUint32(124, true);
      // Use only low 32 bits for now (4GB should be enough for any PPTX)
      size = sizeLow;
    }

    entries.push({
      name,
      type: objectType,
      startSector,
      size,
      childId: childId === 0xffffffff ? -1 : childId,
      leftSiblingId: leftSiblingId === 0xffffffff ? -1 : leftSiblingId,
      rightSiblingId: rightSiblingId === 0xffffffff ? -1 : rightSiblingId,
    });
  }

  // The root entry's stream is the mini-stream container
  const rootEntry = entries.find(
    (e) => e.type === ENTRY_TYPE_ROOT,
  );

  let miniStreamData: Uint8Array | undefined;
  if (rootEntry && rootEntry.startSector <= MAXREGSECT) {
    miniStreamData = readSectorChain(rootEntry.startSector);
  }

  /**
   * Read a mini-stream, following the mini FAT chain.
   */
  function readMiniStream(startSector: number, size: number): Uint8Array {
    if (!miniStreamData) {
      throw new Ole2ParseError("Mini stream container not found");
    }

    const sectors: Uint8Array[] = [];
    let current = startSector;
    const visited = new Set<number>();

    while (current <= MAXREGSECT) {
      if (visited.has(current)) {
        throw new Ole2ParseError(
          `Circular reference in mini FAT chain at sector ${current}`,
        );
      }
      visited.add(current);
      const offset = current * miniSectorSize;
      sectors.push(
        miniStreamData.subarray(offset, offset + miniSectorSize),
      );
      current = miniFatEntries[current] ?? ENDOFCHAIN;
    }

    const totalLength = sectors.length * miniSectorSize;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const sector of sectors) {
      result.set(sector, offset);
      offset += miniSectorSize;
    }
    return result.subarray(0, Math.min(size, result.length));
  }

  /**
   * Get a named stream from the OLE2 file.
   */
  function getStream(name: string): Uint8Array | undefined {
    const entry = entries.find(
      (e) =>
        (e.type === ENTRY_TYPE_STREAM || e.type === ENTRY_TYPE_ROOT) &&
        e.name === name,
    );
    if (!entry) return undefined;

    if (entry.size < miniStreamCutoff && entry.type !== ENTRY_TYPE_ROOT) {
      return readMiniStream(entry.startSector, entry.size);
    }
    return readStream(entry.startSector, entry.size);
  }

  return { entries, getStream };
}

/**
 * Build an OLE2 compound binary file from named streams.
 *
 * Creates a minimal v3 OLE2 container suitable for encrypted OOXML packages.
 *
 * @param streams - Map of stream names to their binary data.
 * @returns ArrayBuffer of the complete OLE2 file.
 */
export function buildOle2(
  streams: Map<string, Uint8Array>,
): ArrayBuffer {
  const sectorSize = 512;
  const miniSectorSize = 64;
  const miniStreamCutoff = 0x1000;

  // Encode a name as UTF-16LE bytes (including null terminator)
  function encodeName(name: string): Uint8Array {
    const bytes = new Uint8Array((name.length + 1) * 2);
    for (let i = 0; i < name.length; i++) {
      bytes[i * 2] = name.charCodeAt(i) & 0xff;
      bytes[i * 2 + 1] = (name.charCodeAt(i) >> 8) & 0xff;
    }
    return bytes;
  }

  // Collect all streams and assign sectors
  const streamEntries: Array<{
    name: string;
    data: Uint8Array;
    startSector: number;
    isRoot: boolean;
  }> = [];

  // Separate mini-streams from regular streams
  const regularStreams: Array<{ name: string; data: Uint8Array }> = [];
  const miniStreams: Array<{ name: string; data: Uint8Array }> = [];

  for (const [name, data] of streams) {
    if (data.length < miniStreamCutoff) {
      miniStreams.push({ name, data });
    } else {
      regularStreams.push({ name, data });
    }
  }

  // Calculate sector allocation
  // First, allocate sectors for regular streams
  let nextSector = 0;
  const fatChains: Map<string, { start: number; sectors: number[] }> =
    new Map();

  for (const stream of regularStreams) {
    const numSectors = Math.ceil(stream.data.length / sectorSize);
    const sectors: number[] = [];
    for (let i = 0; i < numSectors; i++) {
      sectors.push(nextSector++);
    }
    fatChains.set(stream.name, { start: sectors[0] ?? 0, sectors });
  }

  // Build mini stream container (concatenated mini streams)
  let miniStreamContainer = new Uint8Array(0);
  const miniFatChains: Map<
    string,
    { start: number; sectors: number[] }
  > = new Map();
  let nextMiniSector = 0;

  if (miniStreams.length > 0) {
    let miniStreamSize = 0;
    for (const s of miniStreams) {
      miniStreamSize += Math.ceil(s.data.length / miniSectorSize) * miniSectorSize;
    }
    miniStreamContainer = new Uint8Array(miniStreamSize);
    let miniOffset = 0;

    for (const stream of miniStreams) {
      const numMiniSectors = Math.ceil(stream.data.length / miniSectorSize);
      const miniSectors: number[] = [];
      for (let i = 0; i < numMiniSectors; i++) {
        miniSectors.push(nextMiniSector++);
        const srcOffset = i * miniSectorSize;
        const srcEnd = Math.min(srcOffset + miniSectorSize, stream.data.length);
        miniStreamContainer.set(
          stream.data.subarray(srcOffset, srcEnd),
          miniOffset,
        );
        miniOffset += miniSectorSize;
      }
      miniFatChains.set(stream.name, {
        start: miniSectors[0] ?? 0,
        sectors: miniSectors,
      });
    }
  }

  // Allocate sectors for mini stream container (root entry data)
  let rootStartSector = -1;
  const rootSectors: number[] = [];
  if (miniStreamContainer.length > 0) {
    const numSectors = Math.ceil(miniStreamContainer.length / sectorSize);
    rootStartSector = nextSector;
    for (let i = 0; i < numSectors; i++) {
      rootSectors.push(nextSector++);
    }
  }

  // Directory entries: Root + all streams
  const dirEntries: Array<{
    name: string;
    type: number;
    startSector: number;
    size: number;
  }> = [];

  // Root entry
  dirEntries.push({
    name: "Root Entry",
    type: ENTRY_TYPE_ROOT,
    startSector: rootStartSector === -1 ? ENDOFCHAIN : rootStartSector,
    size: miniStreamContainer.length,
  });

  // Stream entries
  for (const stream of regularStreams) {
    const chain = fatChains.get(stream.name)!;
    dirEntries.push({
      name: stream.name,
      type: ENTRY_TYPE_STREAM,
      startSector: chain.start,
      size: stream.data.length,
    });
  }

  for (const stream of miniStreams) {
    const chain = miniFatChains.get(stream.name)!;
    dirEntries.push({
      name: stream.name,
      type: ENTRY_TYPE_STREAM,
      startSector: chain.start,
      size: stream.data.length,
    });
  }

  // Allocate directory sectors
  const dirDataSize = dirEntries.length * DIR_ENTRY_SIZE;
  const numDirSectors = Math.ceil(dirDataSize / sectorSize);
  const firstDirSector = nextSector;
  for (let i = 0; i < numDirSectors; i++) {
    nextSector++;
  }

  // Allocate mini FAT sectors
  let firstMiniFATSector = ENDOFCHAIN;
  let numMiniFATSectors = 0;
  if (miniStreams.length > 0) {
    const miniFatSize = nextMiniSector * 4;
    numMiniFATSectors = Math.ceil(miniFatSize / sectorSize);
    firstMiniFATSector = nextSector;
    for (let i = 0; i < numMiniFATSectors; i++) {
      nextSector++;
    }
  }

  // Allocate FAT sectors
  // We need to figure out how many FAT sectors we need
  // Total sectors so far + FAT sectors must be coverable by FAT
  let numFATSectors = 1;
  while (true) {
    const totalSectors = nextSector + numFATSectors;
    const entriesPerFAT = sectorSize / 4;
    const neededFATSectors = Math.ceil(totalSectors / entriesPerFAT);
    if (neededFATSectors <= numFATSectors) break;
    numFATSectors = neededFATSectors;
  }
  const firstFATSector = nextSector;
  for (let i = 0; i < numFATSectors; i++) {
    nextSector++;
  }

  const totalSectors = nextSector;

  // Build FAT
  const fat = new Int32Array(numFATSectors * (sectorSize / 4));
  fat.fill(-1); // FREESECT

  // Regular stream chains
  for (const [, chain] of fatChains) {
    for (let i = 0; i < chain.sectors.length; i++) {
      if (i < chain.sectors.length - 1) {
        fat[chain.sectors[i]!] = chain.sectors[i + 1]!;
      } else {
        fat[chain.sectors[i]!] = ENDOFCHAIN;
      }
    }
  }

  // Root entry (mini stream container) chain
  for (let i = 0; i < rootSectors.length; i++) {
    if (i < rootSectors.length - 1) {
      fat[rootSectors[i]!] = rootSectors[i + 1]!;
    } else {
      fat[rootSectors[i]!] = ENDOFCHAIN;
    }
  }

  // Directory sectors chain
  for (let i = 0; i < numDirSectors; i++) {
    const sector = firstDirSector + i;
    if (i < numDirSectors - 1) {
      fat[sector] = sector + 1;
    } else {
      fat[sector] = ENDOFCHAIN;
    }
  }

  // Mini FAT sectors chain
  if (numMiniFATSectors > 0) {
    for (let i = 0; i < numMiniFATSectors; i++) {
      const sector = firstMiniFATSector + i;
      if (i < numMiniFATSectors - 1) {
        fat[sector] = sector + 1;
      } else {
        fat[sector] = ENDOFCHAIN;
      }
    }
  }

  // FAT sectors are marked as FATSECT
  for (let i = 0; i < numFATSectors; i++) {
    fat[firstFATSector + i] = FATSECT;
  }

  // Build mini FAT
  let miniFat: Int32Array | undefined;
  if (miniStreams.length > 0) {
    miniFat = new Int32Array(
      numMiniFATSectors * (sectorSize / 4),
    );
    miniFat.fill(-1); // FREESECT
    for (const [, chain] of miniFatChains) {
      for (let i = 0; i < chain.sectors.length; i++) {
        if (i < chain.sectors.length - 1) {
          miniFat[chain.sectors[i]!] = chain.sectors[i + 1]!;
        } else {
          miniFat[chain.sectors[i]!] = ENDOFCHAIN;
        }
      }
    }
  }

  // Build the file
  const fileSize = (totalSectors + 1) * sectorSize; // +1 for header
  const output = new ArrayBuffer(fileSize);
  const outView = new DataView(output);
  const outBytes = new Uint8Array(output);

  // Write header
  outBytes.set(OLE_MAGIC, 0);
  // Minor version
  outView.setUint16(0x18, 0x003e, true);
  // Major version (3)
  outView.setUint16(0x1a, 0x0003, true);
  // Byte order (little-endian)
  outView.setUint16(0x1c, 0xfffe, true);
  // Sector size power (9 = 512)
  outView.setUint16(0x1e, 9, true);
  // Mini sector size power (6 = 64)
  outView.setUint16(0x20, 6, true);
  // Total directory sectors (0 for v3)
  outView.setUint32(0x28, 0, true);
  // Total FAT sectors
  outView.setUint32(0x2c, numFATSectors, true);
  // First directory sector
  outView.setUint32(0x30, firstDirSector, true);
  // Transaction signature (0)
  outView.setUint32(0x34, 0, true);
  // Mini stream cutoff
  outView.setUint32(0x38, miniStreamCutoff, true);
  // First mini FAT sector
  outView.setUint32(
    0x3c,
    numMiniFATSectors > 0 ? firstMiniFATSector : ENDOFCHAIN,
    true,
  );
  // Total mini FAT sectors
  outView.setUint32(0x40, numMiniFATSectors, true);
  // First DIFAT sector (none needed if <= 109 FAT sectors)
  outView.setUint32(0x44, ENDOFCHAIN, true);
  // Total DIFAT sectors
  outView.setUint32(0x48, 0, true);

  // DIFAT entries in header (up to 109)
  for (let i = 0; i < 109; i++) {
    if (i < numFATSectors) {
      outView.setUint32(0x4c + i * 4, firstFATSector + i, true);
    } else {
      outView.setUint32(0x4c + i * 4, FREESECT, true);
    }
  }

  // Write regular stream data
  for (const stream of regularStreams) {
    const chain = fatChains.get(stream.name)!;
    for (let i = 0; i < chain.sectors.length; i++) {
      const sectorOffset = (chain.sectors[i]! + 1) * sectorSize;
      const srcOffset = i * sectorSize;
      const srcEnd = Math.min(srcOffset + sectorSize, stream.data.length);
      outBytes.set(stream.data.subarray(srcOffset, srcEnd), sectorOffset);
    }
  }

  // Write mini stream container
  if (miniStreamContainer.length > 0) {
    for (let i = 0; i < rootSectors.length; i++) {
      const sectorOff = (rootSectors[i]! + 1) * sectorSize;
      const srcOffset = i * sectorSize;
      const srcEnd = Math.min(
        srcOffset + sectorSize,
        miniStreamContainer.length,
      );
      outBytes.set(
        miniStreamContainer.subarray(srcOffset, srcEnd),
        sectorOff,
      );
    }
  }

  // Write directory entries
  const dirData = new Uint8Array(numDirSectors * sectorSize);
  const dirView = new DataView(dirData.buffer);

  for (let i = 0; i < dirEntries.length; i++) {
    const entry = dirEntries[i]!;
    const entryOffset = i * DIR_ENTRY_SIZE;

    // Name (UTF-16LE)
    const nameBytes = encodeName(entry.name);
    dirData.set(
      nameBytes.subarray(0, Math.min(nameBytes.length, 64)),
      entryOffset,
    );

    // Name size in bytes (including null terminator)
    dirView.setUint16(
      entryOffset + 64,
      Math.min((entry.name.length + 1) * 2, 64),
      true,
    );

    // Object type
    dirData[entryOffset + 66] = entry.type;

    // Color (1 = black for red-black tree)
    dirData[entryOffset + 67] = 1;

    // Left sibling, right sibling, child
    // Use a simple binary tree layout: root child = 1, entries linked as right siblings
    if (i === 0) {
      // Root entry
      dirView.setUint32(entryOffset + 68, 0xffffffff, true); // no left sibling
      dirView.setUint32(entryOffset + 72, 0xffffffff, true); // no right sibling
      dirView.setUint32(
        entryOffset + 76,
        dirEntries.length > 1 ? 1 : 0xffffffff,
        true,
      ); // child
    } else {
      dirView.setUint32(entryOffset + 68, 0xffffffff, true); // no left sibling
      dirView.setUint32(
        entryOffset + 72,
        i + 1 < dirEntries.length ? i + 1 : 0xffffffff,
        true,
      ); // right sibling
      dirView.setUint32(entryOffset + 76, 0xffffffff, true); // no child
    }

    // Start sector
    dirView.setUint32(entryOffset + 116, entry.startSector, true);

    // Size (low 32 bits)
    dirView.setUint32(entryOffset + 120, entry.size, true);
  }

  // Copy directory data to output
  for (let i = 0; i < numDirSectors; i++) {
    const sectorOff = (firstDirSector + i + 1) * sectorSize;
    outBytes.set(
      dirData.subarray(i * sectorSize, (i + 1) * sectorSize),
      sectorOff,
    );
  }

  // Write mini FAT
  if (miniFat) {
    for (let i = 0; i < numMiniFATSectors; i++) {
      const sectorOff = (firstMiniFATSector + i + 1) * sectorSize;
      const start = i * (sectorSize / 4);
      const end = start + sectorSize / 4;
      const chunk = miniFat.subarray(start, end);
      const chunkBytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      outBytes.set(chunkBytes, sectorOff);
    }
  }

  // Write FAT sectors
  for (let i = 0; i < numFATSectors; i++) {
    const sectorOff = (firstFATSector + i + 1) * sectorSize;
    const start = i * (sectorSize / 4);
    const end = start + sectorSize / 4;
    const chunk = fat.subarray(start, end);
    const chunkBytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    outBytes.set(chunkBytes, sectorOff);
  }

  return output;
}
