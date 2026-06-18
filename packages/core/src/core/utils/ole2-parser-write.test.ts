/**
 * Tests for the OLE2 / compound-file writer's directory ordering.
 *
 * The library's own {@link parseOle2} reader locates streams with a linear
 * scan, so it will find a stream regardless of how the directory tree is
 * ordered. Microsoft Office / PowerPoint instead treat the directory as a
 * red-black tree keyed by name and locate streams via a **binary search**
 * over that tree ([MS-CFB] §2.6.4). If the writer emits sibling entries in
 * the wrong order the binary search walks the wrong branch and reports the
 * stream as missing — the file then "cannot be opened" in PowerPoint even
 * though this library round-trips it fine.
 *
 * These tests walk the directory the same way a conformant reader does, so
 * they catch the ordering bug that a linear-scan round-trip cannot.
 *
 * @module ole2-parser-write.test
 */

import { describe, it, expect } from 'vitest';

import { buildOle2, parseOle2 } from './ole2-parser';

const NOSTREAM = 0xffffffff;
const DIR_ENTRY_SIZE = 128;

/** A raw directory entry, indexed by its slot in the directory stream. */
interface RawDirEntry {
	name: string;
	type: number;
	leftSiblingId: number;
	rightSiblingId: number;
	childId: number;
}

/**
 * Read every directory entry from a compound file, indexed by slot id.
 *
 * Unlike {@link parseOle2} (which filters out empty entries and so loses the
 * slot indexing the sibling/child pointers refer to), this preserves slot
 * positions so the tree pointers can be followed faithfully.
 */
function readRawDirectory(buffer: ArrayBuffer): RawDirEntry[] {
	const view = new DataView(buffer);
	const sectorSize = 1 << view.getUint16(0x1e, true);
	const totalFATSectors = view.getUint32(0x2c, true);
	const firstDirSector = view.getUint32(0x30, true);

	// Build the FAT from the in-header DIFAT (109 entries is ample for the
	// small fixtures these tests build).
	const fat: number[] = [];
	const fatSectors: number[] = [];
	for (let i = 0; i < 109 && fatSectors.length < totalFATSectors; i++) {
		fatSectors.push(view.getUint32(0x4c + i * 4, true));
	}
	for (const fatSector of fatSectors) {
		const base = (fatSector + 1) * sectorSize;
		for (let i = 0; i < sectorSize / 4; i++) {
			fat.push(view.getUint32(base + i * 4, true));
		}
	}

	// Follow the directory sector chain.
	const dirBytes: number[] = [];
	let sector = firstDirSector;
	const seen = new Set<number>();
	while (sector <= 0xfffffffa && !seen.has(sector)) {
		seen.add(sector);
		const base = (sector + 1) * sectorSize;
		for (let i = 0; i < sectorSize; i++) {
			dirBytes.push(view.getUint8(base + i));
		}
		sector = fat[sector] ?? 0xfffffffe;
	}

	const dir = new Uint8Array(dirBytes);
	const dirView = new DataView(dir.buffer);
	const entries: RawDirEntry[] = [];
	const count = Math.floor(dir.length / DIR_ENTRY_SIZE);
	for (let i = 0; i < count; i++) {
		const off = i * DIR_ENTRY_SIZE;
		const nameLen = dirView.getUint16(off + 64, true);
		const type = dir[off + 66]!;
		const chars = Math.max(0, nameLen - 2) / 2;
		let name = '';
		for (let j = 0; j < chars; j++) {
			name += String.fromCharCode(dirView.getUint16(off + j * 2, true));
		}
		entries.push({
			name,
			type,
			leftSiblingId: dirView.getUint32(off + 68, true),
			rightSiblingId: dirView.getUint32(off + 72, true),
			childId: dirView.getUint32(off + 76, true),
		});
	}
	return entries;
}

/** [MS-CFB] §2.6.4 name comparison: by length, then uppercased code units. */
function cfbCompare(a: string, b: string): number {
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
 * Locate a stream the way a conformant CFB reader (PowerPoint) does: start at
 * the root entry's child and binary-search the sibling tree by name.
 *
 * @returns true if the stream is reachable via the tree, false otherwise.
 */
function findStreamViaTree(buffer: ArrayBuffer, target: string): boolean {
	const entries = readRawDirectory(buffer);
	const root = entries.find((e) => e.type === 5); // ENTRY_TYPE_ROOT
	if (!root) {
		return false;
	}

	let nodeId = root.childId;
	const guard = new Set<number>();
	while (nodeId !== NOSTREAM && nodeId < entries.length) {
		if (guard.has(nodeId)) {
			throw new Error('Cycle while walking directory tree');
		}
		guard.add(nodeId);
		const node = entries[nodeId]!;
		const cmp = cfbCompare(target, node.name);
		if (cmp === 0) {
			return true;
		}
		nodeId = cmp < 0 ? node.leftSiblingId : node.rightSiblingId;
	}
	return false;
}

/**
 * Collect the directory entry names in the order a left-to-right in-order
 * traversal of the sibling tree visits them. For a correctly ordered tree
 * this is strictly ascending per the CFB comparison.
 */
function inOrderNames(buffer: ArrayBuffer): string[] {
	const entries = readRawDirectory(buffer);
	const root = entries.find((e) => e.type === 5);
	const out: string[] = [];
	const guard = new Set<number>();
	function walk(id: number): void {
		if (id === NOSTREAM || id >= entries.length || guard.has(id)) {
			return;
		}
		guard.add(id);
		const node = entries[id]!;
		walk(node.leftSiblingId);
		out.push(node.name);
		walk(node.rightSiblingId);
	}
	if (root) {
		walk(root.childId);
	}
	return out;
}

describe('buildOle2 directory ordering (CFB / PowerPoint compatibility)', () => {
	it('emits streams that a PowerPoint-style binary tree search can find', () => {
		// Reproduces the encryption layout exactly: a small EncryptionInfo
		// stream (mini-stream) inserted *before* a large EncryptedPackage
		// stream (regular stream). Per CFB ordering "EncryptionInfo" (14) <
		// "EncryptedPackage" (16), so an unsorted writer puts them in the
		// wrong tree order and the binary search for EncryptionInfo fails.
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptionInfo', new Uint8Array(1024).fill(0x11));
		streams.set('EncryptedPackage', new Uint8Array(8192).fill(0x22));

		const ole2 = buildOle2(streams);

		expect(findStreamViaTree(ole2, 'EncryptionInfo')).toBeTruthy();
		expect(findStreamViaTree(ole2, 'EncryptedPackage')).toBeTruthy();
	});

	it('stores directory siblings in ascending CFB order', () => {
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptionInfo', new Uint8Array(1024).fill(0x11));
		streams.set('EncryptedPackage', new Uint8Array(8192).fill(0x22));

		const names = inOrderNames(buildOle2(streams));

		// Shorter name sorts first: EncryptionInfo (14) before EncryptedPackage (16).
		expect(names).toStrictEqual(['EncryptionInfo', 'EncryptedPackage']);
	});

	it('orders many streams of mixed lengths correctly for tree lookup', () => {
		const names = ['Zeta', 'alpha', 'EncryptedPackage', 'EncryptionInfo', 'b', 'AAAA'];
		const streams = new Map<string, Uint8Array>();
		for (const name of names) {
			streams.set(name, new Uint8Array(32).fill(0x7f));
		}

		const ole2 = buildOle2(streams);

		// Every stream must be reachable through the binary tree, not just a scan.
		for (const name of names) {
			expect(findStreamViaTree(ole2, name)).toBeTruthy();
		}

		// And the in-order traversal must be sorted: by length, then uppercase.
		const traversal = inOrderNames(ole2);
		const expected = [...names].sort(cfbCompare);
		expect(traversal).toStrictEqual(expected);
	});

	it('still round-trips through the linear-scan reader after sorting', () => {
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptionInfo', new Uint8Array(1024).fill(0x11));
		streams.set('EncryptedPackage', new Uint8Array(8192).fill(0x22));

		const parsed = parseOle2(buildOle2(streams));

		expect(parsed.getStream('EncryptionInfo')).toHaveLength(1024);
		expect(parsed.getStream('EncryptedPackage')).toHaveLength(8192);
	});

	it('keeps the root entry at slot 0 with the stream tree as its child', () => {
		const streams = new Map<string, Uint8Array>();
		streams.set('EncryptionInfo', new Uint8Array(1024).fill(0x11));
		streams.set('EncryptedPackage', new Uint8Array(8192).fill(0x22));

		const entries = readRawDirectory(buildOle2(streams));

		expect(entries[0]!.type).toBe(5); // ENTRY_TYPE_ROOT
		expect(entries[0]!.name).toBe('Root Entry');
		expect(entries[0]!.childId).not.toBe(NOSTREAM);
	});
});
