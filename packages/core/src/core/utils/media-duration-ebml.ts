/**
 * WebM/MKV (EBML/Matroska) duration: walks `Segment > Info` for the
 * `TimecodeScale` (nanoseconds per tick, default 1,000,000 = 1ms) and
 * `Duration` (in ticks) elements.
 *
 * @module media-duration-ebml
 */

const EBML_ID = 0x1a45dfa3;
const SEGMENT_ID = 0x18538067;
const INFO_ID = 0x1549a966;
const TIMECODE_SCALE_ID = 0x2ad7b1;
const DURATION_ID = 0x4489;

interface VInt {
	value: number;
	length: number;
}

/** Read an EBML variable-length integer's raw bytes (with the length-marker bit still set, for element IDs) or its value (marker bit stripped, for sizes). */
function readVInt(bytes: Uint8Array, offset: number, keepMarker: boolean): VInt | undefined {
	if (offset >= bytes.length) {
		return undefined;
	}
	const first = bytes[offset]!;
	if (first === 0) {
		return undefined;
	}
	let length = 1;
	let mask = 0x80;
	while (length <= 8 && (first & mask) === 0) {
		mask >>= 1;
		length++;
	}
	if (length > 8 || offset + length > bytes.length) {
		return undefined;
	}
	let value = keepMarker ? first : first & (mask - 1);
	for (let i = 1; i < length; i++) {
		value = value * 256 + bytes[offset + i]!;
	}
	return { value, length };
}

interface EbmlElement {
	id: number;
	dataStart: number;
	dataEnd: number;
}

function readElementAt(bytes: Uint8Array, offset: number): EbmlElement | undefined {
	const idVint = readVInt(bytes, offset, true);
	if (!idVint) {
		return undefined;
	}
	const sizeVint = readVInt(bytes, offset + idVint.length, false);
	if (!sizeVint) {
		return undefined;
	}
	const dataStart = offset + idVint.length + sizeVint.length;
	// An "unknown size" VINT (all value bits set) means "runs to the end of its
	// parent"; safe to treat as "rest of the buffer" here since this module
	// only ever needs to find specific children, never to skip past one.
	const allOnes = 2 ** (7 * sizeVint.length) - 1;
	const dataEnd = sizeVint.value === allOnes ? bytes.length : dataStart + sizeVint.value;
	return { id: idVint.value, dataStart, dataEnd: Math.min(dataEnd, bytes.length) };
}

/** Find the first child element with `id` inside `[start, end)`, walking siblings. */
function findChild(
	bytes: Uint8Array,
	start: number,
	end: number,
	id: number,
): EbmlElement | undefined {
	let offset = start;
	while (offset < end) {
		const element = readElementAt(bytes, offset);
		if (!element || element.dataEnd > end || element.dataEnd <= offset) {
			return undefined;
		}
		if (element.id === id) {
			return element;
		}
		offset = element.dataEnd;
	}
	return undefined;
}

function readUint(bytes: Uint8Array, start: number, end: number): number {
	let value = 0;
	for (let i = start; i < end; i++) {
		value = value * 256 + bytes[i]!;
	}
	return value;
}

function readFloat(bytes: Uint8Array, start: number, end: number): number | undefined {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const length = end - start;
	if (length === 4) {
		return view.getFloat32(start, false);
	}
	if (length === 8) {
		return view.getFloat64(start, false);
	}
	return undefined;
}

export function estimateEbmlDurationMs(bytes: Uint8Array): number | undefined {
	const ebml = readElementAt(bytes, 0);
	if (!ebml || ebml.id !== EBML_ID) {
		return undefined;
	}
	const segment = findChild(bytes, ebml.dataEnd, bytes.length, SEGMENT_ID);
	if (!segment) {
		return undefined;
	}
	const info = findChild(bytes, segment.dataStart, segment.dataEnd, INFO_ID);
	if (!info) {
		return undefined;
	}
	const durationEl = findChild(bytes, info.dataStart, info.dataEnd, DURATION_ID);
	if (!durationEl) {
		return undefined;
	}
	const duration = readFloat(bytes, durationEl.dataStart, durationEl.dataEnd);
	if (duration === undefined) {
		return undefined;
	}
	const scaleEl = findChild(bytes, info.dataStart, info.dataEnd, TIMECODE_SCALE_ID);
	const timecodeScaleNs = scaleEl ? readUint(bytes, scaleEl.dataStart, scaleEl.dataEnd) : 1_000_000;
	return (duration * timecodeScaleNs) / 1_000_000;
}
