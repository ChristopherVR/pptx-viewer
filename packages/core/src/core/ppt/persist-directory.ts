/**
 * UserEditAtom chain + PersistDirectoryAtom handling ([MS-PPT] 2.3.3-2.3.6).
 *
 * A .ppt file supports incremental saves: each save appends a user edit
 * (records + a PersistDirectoryAtom + a UserEditAtom). The live persist
 * object directory is built by walking the UserEditAtom chain from the most
 * recent edit backwards, then applying the persist directories from oldest
 * to newest so newer entries override older ones.
 *
 * @module ppt/persist-directory
 */

import { PptParseError, readRecordOrThrow } from './record-stream';
import type { PptRecord } from './record-stream';
import { RT } from './record-types';

/** Parsed UserEditAtom. */
export interface UserEditAtom {
	/** Offset of the previous UserEditAtom, 0 when none. */
	offsetLastEdit: number;
	/** Offset of the PersistDirectoryAtom for this edit. */
	offsetPersistDirectory: number;
	/** Persist id of the DocumentContainer (must be 1). */
	docPersistIdRef: number;
	/** Persist id of the CryptSession10Container when the file is encrypted. */
	encryptSessionPersistIdRef: number | undefined;
}

/** Persist object directory: persist id -> stream offset. */
export type PersistDirectory = Map<number, number>;

/** Result of walking the user edit chain. */
export interface UserEditChain {
	/** Most recent UserEditAtom (the live one). */
	currentEdit: UserEditAtom;
	/** Live persist object directory. */
	directory: PersistDirectory;
}

/** Parse a UserEditAtom record at the given offset. */
export function parseUserEditAtom(view: DataView, offset: number): UserEditAtom {
	const rec = readRecordOrThrow(view, offset);
	if (rec.recType !== RT.UserEditAtom) {
		throw new PptParseError(
			`Expected UserEditAtom at offset ${offset}, found recType 0x${rec.recType.toString(16)}`,
		);
	}
	if (rec.recLen !== 0x1c && rec.recLen !== 0x20) {
		throw new PptParseError(`UserEditAtom has invalid length ${rec.recLen}`);
	}
	const d = rec.dataOffset;
	return {
		offsetLastEdit: view.getUint32(d + 8, true),
		offsetPersistDirectory: view.getUint32(d + 12, true),
		docPersistIdRef: view.getUint32(d + 16, true),
		encryptSessionPersistIdRef: rec.recLen === 0x20 ? view.getUint32(d + 28, true) : undefined,
	};
}

/**
 * Parse a PersistDirectoryAtom record into (persistId, offset) pairs.
 *
 * Each PersistDirectoryEntry is a packed UInt32 (persistId in the low
 * 20 bits, cPersist in the high 12 bits) followed by cPersist UInt32
 * stream offsets for persistId, persistId+1, ...
 */
export function parsePersistDirectoryAtom(view: DataView, offset: number): Array<[number, number]> {
	const rec = readRecordOrThrow(view, offset);
	if (rec.recType !== RT.PersistDirectoryAtom) {
		throw new PptParseError(
			`Expected PersistDirectoryAtom at offset ${offset}, found recType 0x${rec.recType.toString(16)}`,
		);
	}
	const pairs: Array<[number, number]> = [];
	let pos = rec.dataOffset;
	const end = rec.dataOffset + rec.recLen;
	while (pos + 4 <= end) {
		const packed = view.getUint32(pos, true);
		const persistId = packed & 0xfffff;
		const cPersist = (packed >>> 20) & 0xfff;
		pos += 4;
		for (let i = 0; i < cPersist && pos + 4 <= end; i++, pos += 4) {
			pairs.push([persistId + i, view.getUint32(pos, true)]);
		}
	}
	return pairs;
}

/**
 * Walk the UserEditAtom chain starting from `offsetToCurrentEdit` and build
 * the live persist object directory (newest entries win).
 *
 * @param view - DataView over the PowerPoint Document stream.
 * @param offsetToCurrentEdit - From the CurrentUserAtom.
 */
export function buildPersistDirectory(view: DataView, offsetToCurrentEdit: number): UserEditChain {
	const edits: UserEditAtom[] = [];
	const seen = new Set<number>();
	let offset = offsetToCurrentEdit;

	while (offset !== 0) {
		if (seen.has(offset)) {
			throw new PptParseError(`Circular UserEditAtom chain at offset ${offset}`);
		}
		seen.add(offset);
		const edit = parseUserEditAtom(view, offset);
		edits.push(edit);
		offset = edit.offsetLastEdit;
	}

	if (edits.length === 0) {
		throw new PptParseError('No UserEditAtom found');
	}

	// Apply persist directories oldest-first so newer entries override.
	const directory: PersistDirectory = new Map();
	for (let i = edits.length - 1; i >= 0; i--) {
		for (const [id, off] of parsePersistDirectoryAtom(view, edits[i].offsetPersistDirectory)) {
			directory.set(id, off);
		}
	}

	return { currentEdit: edits[0], directory };
}

/**
 * Resolve a persist id to the record at its stream offset.
 */
export function readPersistRecord(
	view: DataView,
	directory: PersistDirectory,
	persistId: number,
): PptRecord | undefined {
	const offset = directory.get(persistId);
	if (offset === undefined) {
		return undefined;
	}
	return readRecordOrThrow(view, offset);
}
