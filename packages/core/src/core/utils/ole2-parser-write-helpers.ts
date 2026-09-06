/**
 * Small pure helpers for `ole2-parser-write.ts`: directory-entry name
 * comparison/encoding and FAT/mini-FAT sector-chain bookkeeping. Split out
 * to keep that file under the repo's ~300 LOC convention.
 *
 * @module ole2-parser-write-helpers
 */

import { ENDOFCHAIN } from './ole2-parser-types';

/** Internal type for a directory entry before serialization. */
export interface DirEntry {
	name: string;
	type: number;
	startSector: number;
	size: number;
	/**
	 * Storage CLSID (16 bytes), written at directory-entry offset 80. Left
	 * undefined (all-zero, [MS-CFB]'s "no CLSID" value) for every stream
	 * entry and for a root entry with no application-specific identity.
	 *
	 * Some host applications' own OLE2 readers use the ROOT ENTRY's CLSID to
	 * identify the storage's document type independently of its stream
	 * names: a legacy binary `.ppt` (`ppt/writer/write-ppt.ts`) sets it to
	 * PowerPoint 97-2003's well-known CLSID
	 * `{64818D10-4F9B-11CF-86EA-00AA00B929E8}` via `buildOle2`'s
	 * `rootClsid` parameter; encrypted-OOXML callers leave it unset, matching
	 * their previously-working all-zero behaviour.
	 */
	clsid?: Uint8Array;
}

/** Internal type for a sector chain allocation. */
export interface SectorChain {
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
 * the wrong branch and reports the stream as missing - which is why an
 * incorrectly ordered container round-trips through a linear-scan reader yet
 * fails to open in PowerPoint.
 *
 * @param a - First name.
 * @param b - Second name.
 * @returns Negative if `a < b`, positive if `a > b`, zero if equal.
 */
export function compareDirEntryNames(a: string, b: string): number {
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
export function encodeName(name: string): Uint8Array {
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
export function writeFatChain(fat: Int32Array, chain: SectorChain): void {
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
export function writeFatRun(fat: Int32Array, firstSector: number, count: number): void {
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
export function writeInt32Sectors(
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
