/**
 * ISO Base Media File Format (MP4/M4A/MOV/QuickTime) duration: walks the
 * top-level box tree to `moov/mvhd`, which carries the exact overall
 * duration + timescale regardless of codec.
 *
 * @module media-duration-isobmff
 */

interface Box {
	type: string;
	start: number; // start of box payload (after the header)
	end: number; // exclusive end of the whole box (header + payload)
}

function readBoxes(bytes: Uint8Array, rangeStart: number, rangeEnd: number): Box[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const boxes: Box[] = [];
	let offset = rangeStart;
	while (offset + 8 <= rangeEnd) {
		const size32 = view.getUint32(offset, false);
		const type = String.fromCharCode(
			bytes[offset + 4]!,
			bytes[offset + 5]!,
			bytes[offset + 6]!,
			bytes[offset + 7]!,
		);
		let payloadStart = offset + 8;
		let boxEnd: number;
		if (size32 === 1) {
			if (offset + 16 > rangeEnd) {
				break;
			}
			const hi = view.getUint32(offset + 8, false);
			const lo = view.getUint32(offset + 12, false);
			boxEnd = offset + hi * 2 ** 32 + lo;
			payloadStart = offset + 16;
		} else if (size32 === 0) {
			boxEnd = rangeEnd; // extends to end of file/parent
		} else {
			boxEnd = offset + size32;
		}
		if (boxEnd <= offset || boxEnd > rangeEnd) {
			break;
		}
		boxes.push({ type, start: payloadStart, end: boxEnd });
		offset = boxEnd;
	}
	return boxes;
}

function findBox(boxes: Box[], type: string): Box | undefined {
	return boxes.find((b) => b.type === type);
}

/** Returns `true` when `bytes` is plausibly an ISO-BMFF file (has an `ftyp` box near the start). */
export function looksLikeIsoBmff(bytes: Uint8Array): boolean {
	if (bytes.length < 12) {
		return false;
	}
	return (
		bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 // "ftyp"
	);
}

export function estimateIsoBmffDurationMs(bytes: Uint8Array): number | undefined {
	if (!looksLikeIsoBmff(bytes)) {
		return undefined;
	}
	const top = readBoxes(bytes, 0, bytes.length);
	const moov = findBox(top, 'moov');
	if (!moov) {
		return undefined;
	}
	const moovChildren = readBoxes(bytes, moov.start, moov.end);
	const mvhd = findBox(moovChildren, 'mvhd');
	if (!mvhd || mvhd.end - mvhd.start < 1) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const version = bytes[mvhd.start]!;
	let timescale: number;
	let duration: number;
	if (version === 1) {
		if (mvhd.start + 32 > mvhd.end) {
			return undefined;
		}
		timescale = view.getUint32(mvhd.start + 20, false);
		const hi = view.getUint32(mvhd.start + 24, false);
		const lo = view.getUint32(mvhd.start + 28, false);
		duration = hi * 2 ** 32 + lo;
	} else {
		if (mvhd.start + 20 > mvhd.end) {
			return undefined;
		}
		timescale = view.getUint32(mvhd.start + 12, false);
		duration = view.getUint32(mvhd.start + 16, false);
	}
	if (!timescale) {
		return undefined;
	}
	return (duration / timescale) * 1000;
}
