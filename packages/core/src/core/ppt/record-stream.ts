/**
 * Record framing for the MS-PPT binary format.
 *
 * Every record starts with an 8-byte header ([MS-PPT] 2.3.1 RecordHeader):
 *   - recVer (4 bits) / recInstance (12 bits) packed into a UInt16
 *   - recType (UInt16)
 *   - recLen  (UInt32): length of the record data that follows
 *
 * Container records (recVer === 0xF) hold a sequence of child records in
 * their data. OfficeArt records share the exact same framing.
 *
 * @module ppt/record-stream
 */

/** Error thrown when the PPT record stream is malformed. */
export class PptParseError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'PptParseError';
	}
}

/** A parsed record header plus the location of its data. */
export interface PptRecord {
	/** Record version nibble; 0xF marks a container record. */
	recVer: number;
	/** Record instance (12 bits). */
	recInstance: number;
	/** Record type identifier. */
	recType: number;
	/** Length in bytes of the record data. */
	recLen: number;
	/** Absolute offset of the record header within the stream. */
	headerOffset: number;
	/** Absolute offset of the record data within the stream. */
	dataOffset: number;
}

/** Size in bytes of a record header. */
export const RECORD_HEADER_SIZE = 8;

/**
 * Read a single record header at `offset`.
 *
 * @param view - DataView over the whole stream.
 * @param offset - Byte offset of the header.
 * @returns The parsed record, or undefined when fewer than 8 bytes remain.
 */
export function readRecord(view: DataView, offset: number): PptRecord | undefined {
	if (offset < 0 || offset + RECORD_HEADER_SIZE > view.byteLength) {
		return undefined;
	}
	const verAndInstance = view.getUint16(offset, true);
	const recVer = verAndInstance & 0x0f;
	const recInstance = (verAndInstance >>> 4) & 0x0fff;
	const recType = view.getUint16(offset + 2, true);
	const recLen = view.getUint32(offset + 4, true);
	return {
		recVer,
		recInstance,
		recType,
		recLen,
		headerOffset: offset,
		dataOffset: offset + RECORD_HEADER_SIZE,
	};
}

/**
 * Read the record at `offset`, throwing when out of bounds.
 */
export function readRecordOrThrow(view: DataView, offset: number): PptRecord {
	const rec = readRecord(view, offset);
	if (!rec) {
		throw new PptParseError(`Record header out of bounds at offset ${offset}`);
	}
	return rec;
}

/** True when the record is a container (holds child records). */
export function isContainer(rec: PptRecord): boolean {
	return rec.recVer === 0x0f;
}

/**
 * Iterate the sibling records in the byte range [start, end).
 *
 * Stops cleanly when a header would overrun the range; a record whose data
 * exceeds the range is clamped out (skipped) to tolerate mild corruption.
 */
export function* iterateRecords(view: DataView, start: number, end: number): Generator<PptRecord> {
	let offset = start;
	const limit = Math.min(end, view.byteLength);
	while (offset + RECORD_HEADER_SIZE <= limit) {
		const rec = readRecord(view, offset);
		if (!rec) {
			return;
		}
		if (rec.dataOffset + rec.recLen > limit) {
			return;
		}
		yield rec;
		offset = rec.dataOffset + rec.recLen;
	}
}

/** Iterate the direct children of a container record. */
export function* iterateChildren(view: DataView, container: PptRecord): Generator<PptRecord> {
	yield* iterateRecords(view, container.dataOffset, container.dataOffset + container.recLen);
}

/**
 * Find the first direct child with the given record type (and optional
 * instance).
 */
export function findChild(
	view: DataView,
	container: PptRecord,
	recType: number,
	recInstance?: number,
): PptRecord | undefined {
	for (const child of iterateChildren(view, container)) {
		if (
			child.recType === recType &&
			(recInstance === undefined || child.recInstance === recInstance)
		) {
			return child;
		}
	}
	return undefined;
}

/** Find every direct child with the given record type. */
export function findChildren(view: DataView, container: PptRecord, recType: number): PptRecord[] {
	const result: PptRecord[] = [];
	for (const child of iterateChildren(view, container)) {
		if (child.recType === recType) {
			result.push(child);
		}
	}
	return result;
}

/**
 * Depth-first search for the first descendant with the given record type.
 */
export function findDescendant(
	view: DataView,
	container: PptRecord,
	recType: number,
	recInstance?: number,
): PptRecord | undefined {
	for (const child of iterateChildren(view, container)) {
		if (
			child.recType === recType &&
			(recInstance === undefined || child.recInstance === recInstance)
		) {
			return child;
		}
		if (isContainer(child)) {
			const found = findDescendant(view, child, recType, recInstance);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

/** Copy the data bytes of a record out of the underlying buffer. */
export function recordBytes(data: Uint8Array, rec: PptRecord): Uint8Array {
	return data.subarray(rec.dataOffset, rec.dataOffset + rec.recLen);
}
