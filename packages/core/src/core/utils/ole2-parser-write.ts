/**
 * OLE2 compound binary file writer.
 *
 * Creates a minimal v3 OLE2 container from named streams,
 * suitable for encrypted OOXML packages.
 *
 * Reference: [MS-CFB] Compound Binary File Format
 * @see https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb
 *
 * @module ole2-parser-write
 */

import {
	OLE_MAGIC,
	ENDOFCHAIN,
	FREESECT,
	FATSECT,
	ENTRY_TYPE_STREAM,
	ENTRY_TYPE_ROOT,
	DIR_ENTRY_SIZE,
} from './ole2-parser-types';

/** Internal type for a directory entry before serialization. */
interface DirEntry {
	name: string;
	type: number;
	startSector: number;
	size: number;
}

/** Internal type for a sector chain allocation. */
interface SectorChain {
	start: number;
	sectors: number[];
}

/**
 * Compare two directory-entry names using the [MS-CFB] §2.6.4 ordering.
 *
 * The compound-file directory is a red-black tree keyed by name, and
 * conformant readers (including Microsoft Office / PowerPoint) locate a
 * stream by performing a binary search over that tree rather than a linear
 * scan. The ordering rule is:
 *
 *   1. Shorter names (by UTF-16 code-unit count) sort before longer ones.
 *   2. For equal-length names, compare by uppercased UTF-16 code units.
 *
 * If sibling entries are not stored in this order the binary search walks
 * the wrong branch and reports the stream as missing — which is why an
 * incorrectly ordered container round-trips through a linear-scan reader yet
 * fails to open in PowerPoint.
 *
 * @param a - First name.
 * @param b - Second name.
 * @returns Negative if `a < b`, positive if `a > b`, zero if equal.
 */
function compareDirEntryNames(a: string, b: string): number {
	if (a.length !== b.length) {
		return a.length - b.length;
	}
	const ua = a.toUpperCase();
	const ub = b.toUpperCase();
	for (let i = 0; i < ua.length; i++) {
		const diff = ua.charCodeAt(i) - ub.charCodeAt(i);
		if (diff !== 0) {
			return diff;
		}
	}
	return 0;
}

/**
 * Encode a name as UTF-16LE bytes (including null terminator).
 *
 * @param name - The string to encode.
 * @returns UTF-16LE encoded byte array.
 */
function encodeName(name: string): Uint8Array {
	const bytes = new Uint8Array((name.length + 1) * 2);
	for (let i = 0; i < name.length; i++) {
		bytes[i * 2] = name.charCodeAt(i) & 0xff;
		bytes[i * 2 + 1] = (name.charCodeAt(i) >> 8) & 0xff;
	}
	return bytes;
}

/**
 * Write a sector chain into a FAT (or mini-FAT) array.
 * Each sector in the chain points to the next; the last is marked ENDOFCHAIN.
 *
 * @param fat - The FAT Int32Array to populate.
 * @param chain - The sector chain to write.
 */
function writeFatChain(fat: Int32Array, chain: SectorChain): void {
	for (let i = 0; i < chain.sectors.length; i++) {
		fat[chain.sectors[i]!] = i < chain.sectors.length - 1 ? chain.sectors[i + 1]! : ENDOFCHAIN;
	}
}

/**
 * Write a consecutive run of sectors into a FAT array as a chain.
 *
 * @param fat - The FAT Int32Array to populate.
 * @param firstSector - The first sector index of the run.
 * @param count - The number of consecutive sectors.
 */
function writeFatRun(fat: Int32Array, firstSector: number, count: number): void {
	for (let i = 0; i < count; i++) {
		const sector = firstSector + i;
		fat[sector] = i < count - 1 ? sector + 1 : ENDOFCHAIN;
	}
}

/**
 * Copy an Int32Array to the output buffer at the given sector positions.
 *
 * @param outBytes - The output byte array.
 * @param int32Data - The Int32Array to write.
 * @param firstSector - First sector index for the data.
 * @param numSectors - Number of sectors to write.
 * @param sectorSize - Size of each sector in bytes.
 */
function writeInt32Sectors(
	outBytes: Uint8Array,
	int32Data: Int32Array,
	firstSector: number,
	numSectors: number,
	sectorSize: number,
): void {
	const entriesPerSector = sectorSize / 4;
	for (let i = 0; i < numSectors; i++) {
		const sectorOff = (firstSector + i + 1) * sectorSize;
		const start = i * entriesPerSector;
		const end = start + entriesPerSector;
		const chunk = int32Data.subarray(start, end);
		const chunkBytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
		outBytes.set(chunkBytes, sectorOff);
	}
}

/**
 * Write the OLE2 v3 file header.
 *
 * @param outView - DataView over the output buffer.
 * @param outBytes - Uint8Array view of the output buffer.
 * @param params - Header field values.
 */
function writeHeader(
	outView: DataView,
	outBytes: Uint8Array,
	params: {
		numFATSectors: number;
		firstDirSector: number;
		miniStreamCutoff: number;
		firstMiniFATSector: number;
		numMiniFATSectors: number;
		firstFATSector: number;
	},
): void {
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
	outView.setUint32(0x2c, params.numFATSectors, true);
	// First directory sector
	outView.setUint32(0x30, params.firstDirSector, true);
	// Transaction signature (0)
	outView.setUint32(0x34, 0, true);
	// Mini stream cutoff
	outView.setUint32(0x38, params.miniStreamCutoff, true);
	// First mini FAT sector
	outView.setUint32(
		0x3c,
		params.numMiniFATSectors > 0 ? params.firstMiniFATSector : ENDOFCHAIN,
		true,
	);
	// Total mini FAT sectors
	outView.setUint32(0x40, params.numMiniFATSectors, true);
	// First DIFAT sector (none needed if <= 109 FAT sectors)
	outView.setUint32(0x44, ENDOFCHAIN, true);
	// Total DIFAT sectors
	outView.setUint32(0x48, 0, true);

	// DIFAT entries in header (up to 109)
	for (let i = 0; i < 109; i++) {
		if (i < params.numFATSectors) {
			outView.setUint32(0x4c + i * 4, params.firstFATSector + i, true);
		} else {
			outView.setUint32(0x4c + i * 4, FREESECT, true);
		}
	}
}

/**
 * Serialize directory entries into sector-aligned binary data.
 *
 * @param dirEntries - The directory entries to serialize.
 * @param numDirSectors - Number of sectors allocated for directory data.
 * @param sectorSize - Size of each sector in bytes.
 * @returns The serialized directory data.
 */
function serializeDirectoryEntries(
	dirEntries: DirEntry[],
	numDirSectors: number,
	sectorSize: number,
): Uint8Array {
	const dirData = new Uint8Array(numDirSectors * sectorSize);
	const dirView = new DataView(dirData.buffer);

	for (let i = 0; i < dirEntries.length; i++) {
		const entry = dirEntries[i]!;
		const entryOffset = i * DIR_ENTRY_SIZE;

		// Name (UTF-16LE)
		const nameBytes = encodeName(entry.name);
		dirData.set(nameBytes.subarray(0, Math.min(nameBytes.length, 64)), entryOffset);

		// Name size in bytes (including null terminator)
		dirView.setUint16(entryOffset + 64, Math.min((entry.name.length + 1) * 2, 64), true);

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
			dirView.setUint32(entryOffset + 76, dirEntries.length > 1 ? 1 : 0xffffffff, true); // child
		} else {
			dirView.setUint32(entryOffset + 68, 0xffffffff, true); // no left sibling
			dirView.setUint32(entryOffset + 72, i + 1 < dirEntries.length ? i + 1 : 0xffffffff, true); // right sibling
			dirView.setUint32(entryOffset + 76, 0xffffffff, true); // no child
		}

		// Start sector
		dirView.setUint32(entryOffset + 116, entry.startSector, true);

		// Size (low 32 bits)
		dirView.setUint32(entryOffset + 120, entry.size, true);
	}

	return dirData;
}

/**
 * Write stream data sectors to the output buffer.
 *
 * @param outBytes - The output byte array.
 * @param streamData - The stream's raw data.
 * @param chain - The sector chain for this stream.
 * @param sectorSize - Size of each sector in bytes.
 */
function writeStreamSectors(
	outBytes: Uint8Array,
	streamData: Uint8Array,
	chain: SectorChain,
	sectorSize: number,
): void {
	for (let i = 0; i < chain.sectors.length; i++) {
		const sectorOffset = (chain.sectors[i]! + 1) * sectorSize;
		const srcOffset = i * sectorSize;
		const srcEnd = Math.min(srcOffset + sectorSize, streamData.length);
		outBytes.set(streamData.subarray(srcOffset, srcEnd), sectorOffset);
	}
}

/**
 * Build an OLE2 compound binary file from named streams.
 *
 * Creates a minimal v3 OLE2 container suitable for encrypted OOXML packages.
 *
 * @param streams - Map of stream names to their binary data.
 * @returns ArrayBuffer of the complete OLE2 file.
 */
export function buildOle2(streams: Map<string, Uint8Array>): ArrayBuffer {
	const sectorSize = 512;
	const miniSectorSize = 64;
	const miniStreamCutoff = 0x1000;

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

	// Allocate sectors for regular streams
	let nextSector = 0;
	const fatChains: Map<string, SectorChain> = new Map();

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
	const miniFatChains: Map<string, SectorChain> = new Map();
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
				miniStreamContainer.set(stream.data.subarray(srcOffset, srcEnd), miniOffset);
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

	// Build directory entries: Root + all streams
	const dirEntries: DirEntry[] = [];

	dirEntries.push({
		name: 'Root Entry',
		type: ENTRY_TYPE_ROOT,
		startSector: rootStartSector === -1 ? ENDOFCHAIN : rootStartSector,
		size: miniStreamContainer.length,
	});

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

	// Sort the non-root entries into [MS-CFB] directory order. Each DirEntry is
	// self-contained (it already carries its own start sector + size), so the
	// stream/mini-FAT allocations above are unaffected by the reorder. Sorting
	// here lets serializeDirectoryEntries emit an ascending right-sibling chain,
	// which is a valid binary search tree that conformant readers (PowerPoint)
	// can traverse to find every stream by name.
	const [rootEntry, ...streamEntries] = dirEntries;
	streamEntries.sort((a, b) => compareDirEntryNames(a.name, b.name));
	const sortedDirEntries = [rootEntry!, ...streamEntries];

	// Allocate directory sectors
	const numDirSectors = Math.ceil((dirEntries.length * DIR_ENTRY_SIZE) / sectorSize);
	const firstDirSector = nextSector;
	nextSector += numDirSectors;

	// Allocate mini FAT sectors
	let firstMiniFATSector = ENDOFCHAIN;
	let numMiniFATSectors = 0;
	if (miniStreams.length > 0) {
		numMiniFATSectors = Math.ceil((nextMiniSector * 4) / sectorSize);
		firstMiniFATSector = nextSector;
		nextSector += numMiniFATSectors;
	}

	// Allocate FAT sectors
	// Total sectors so far + FAT sectors must be coverable by FAT
	let numFATSectors = 1;
	while (true) {
		const totalSectors = nextSector + numFATSectors;
		const entriesPerFAT = sectorSize / 4;
		const neededFATSectors = Math.ceil(totalSectors / entriesPerFAT);
		if (neededFATSectors <= numFATSectors) {
			break;
		}
		numFATSectors = neededFATSectors;
	}
	const firstFATSector = nextSector;
	nextSector += numFATSectors;

	const totalSectors = nextSector;

	// Build FAT
	const fat = new Int32Array(numFATSectors * (sectorSize / 4));
	fat.fill(-1); // FREESECT

	for (const [, chain] of fatChains) {
		writeFatChain(fat, chain);
	}
	writeFatChain(fat, { start: rootSectors[0] ?? 0, sectors: rootSectors });
	writeFatRun(fat, firstDirSector, numDirSectors);
	if (numMiniFATSectors > 0) {
		writeFatRun(fat, firstMiniFATSector, numMiniFATSectors);
	}
	for (let i = 0; i < numFATSectors; i++) {
		fat[firstFATSector + i] = FATSECT;
	}

	// Build mini FAT
	let miniFat: Int32Array | undefined;
	if (miniStreams.length > 0) {
		miniFat = new Int32Array(numMiniFATSectors * (sectorSize / 4));
		miniFat.fill(-1); // FREESECT
		for (const [, chain] of miniFatChains) {
			writeFatChain(miniFat, chain);
		}
	}

	// Build the output file
	const fileSize = (totalSectors + 1) * sectorSize; // +1 for header
	const output = new ArrayBuffer(fileSize);
	const outView = new DataView(output);
	const outBytes = new Uint8Array(output);

	// Write header
	writeHeader(outView, outBytes, {
		numFATSectors,
		firstDirSector,
		miniStreamCutoff,
		firstMiniFATSector,
		numMiniFATSectors,
		firstFATSector,
	});

	// Write regular stream data
	for (const stream of regularStreams) {
		writeStreamSectors(outBytes, stream.data, fatChains.get(stream.name)!, sectorSize);
	}

	// Write mini stream container
	if (miniStreamContainer.length > 0) {
		writeStreamSectors(
			outBytes,
			miniStreamContainer,
			{ start: rootSectors[0] ?? 0, sectors: rootSectors },
			sectorSize,
		);
	}

	// Write directory entries
	const dirData = serializeDirectoryEntries(sortedDirEntries, numDirSectors, sectorSize);
	for (let i = 0; i < numDirSectors; i++) {
		const sectorOff = (firstDirSector + i + 1) * sectorSize;
		outBytes.set(dirData.subarray(i * sectorSize, (i + 1) * sectorSize), sectorOff);
	}

	// Write mini FAT
	if (miniFat) {
		writeInt32Sectors(outBytes, miniFat, firstMiniFATSector, numMiniFATSectors, sectorSize);
	}

	// Write FAT sectors
	writeInt32Sectors(outBytes, fat, firstFATSector, numFATSectors, sectorSize);

	return output;
}
