/**
 * Header, directory, and stream-sector serialization for
 * `ole2-parser-write.ts`. Split out to keep that file under the repo's
 * ~300 LOC convention.
 *
 * @module ole2-parser-write-serialize
 */

import { ENDOFCHAIN, FREESECT, OLE_MAGIC, DIR_ENTRY_SIZE } from './ole2-parser-types';
import { encodeName } from './ole2-parser-write-helpers';
import type { DirEntry, SectorChain } from './ole2-parser-write-helpers';

/**
 * Write the OLE2 v3 file header.
 *
 * @param outView - DataView over the output buffer.
 * @param outBytes - Uint8Array view of the output buffer.
 * @param params - Header field values.
 */
export function writeHeader(
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
export function serializeDirectoryEntries(
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

		// Storage CLSID (16 bytes); zero-filled unless the entry carries one.
		if (entry.clsid) {
			dirData.set(entry.clsid.subarray(0, 16), entryOffset + 80);
		}

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
export function writeStreamSectors(
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
