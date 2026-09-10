/**
 * Ogg (Vorbis or Opus) duration: reads the sample rate from the first page's
 * codec identification header, and the total sample count from the LAST
 * page's granule position (a running decoded-sample count per the Ogg
 * spec), found by scanning backward for the final `OggS` capture pattern
 * rather than walking every page from the start.
 *
 * @module media-duration-ogg
 */

const OGG_CAPTURE = [0x4f, 0x67, 0x67, 0x53]; // "OggS"

function matchesAt(bytes: Uint8Array, offset: number, pattern: readonly number[]): boolean {
	if (offset + pattern.length > bytes.length) {
		return false;
	}
	for (let i = 0; i < pattern.length; i++) {
		if (bytes[offset + i] !== pattern[i]) {
			return false;
		}
	}
	return true;
}

interface OggPage {
	granulePosition: number;
	dataStart: number;
	dataEnd: number;
}

function readPageAt(bytes: Uint8Array, offset: number): OggPage | undefined {
	if (!matchesAt(bytes, offset, OGG_CAPTURE)) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// granule_position is a signed 64-bit LE at byte offset 6; JS numbers lose
	// precision above 2^53, irrelevant for any real audio duration.
	const lo = view.getUint32(offset + 6, true);
	const hi = view.getUint32(offset + 10, true);
	const granulePosition = hi * 2 ** 32 + lo;
	const pageSegments = bytes[offset + 26]!;
	const segmentTableStart = offset + 27;
	let dataLength = 0;
	for (let i = 0; i < pageSegments; i++) {
		dataLength += bytes[segmentTableStart + i]!;
	}
	const dataStart = segmentTableStart + pageSegments;
	return { granulePosition, dataStart, dataEnd: dataStart + dataLength };
}

function detectCodecSampleRate(
	bytes: Uint8Array,
	page: OggPage,
): { opus: boolean; sampleRate: number } | undefined {
	const start = page.dataStart;
	if (matchesAt(bytes, start, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
		// "OpusHead": Opus granule positions are always counted at 48kHz.
		return { opus: true, sampleRate: 48000 };
	}
	if (matchesAt(bytes, start + 1, [0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) {
		// packet type byte (1) + "vorbis", then version(4), channels(1), sampleRate(4 LE).
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const sampleRate = view.getUint32(start + 1 + 6 + 4 + 1, true);
		return { opus: false, sampleRate };
	}
	return undefined;
}

export function estimateOggDurationMs(bytes: Uint8Array): number | undefined {
	if (!matchesAt(bytes, 0, OGG_CAPTURE)) {
		return undefined;
	}
	const firstPage = readPageAt(bytes, 0);
	if (!firstPage) {
		return undefined;
	}
	const codec = detectCodecSampleRate(bytes, firstPage);
	if (!codec || !codec.sampleRate) {
		return undefined;
	}

	// Scan backward for the last page's capture pattern.
	let lastPageOffset: number | undefined;
	for (let i = bytes.length - OGG_CAPTURE.length; i >= 0; i--) {
		if (matchesAt(bytes, i, OGG_CAPTURE)) {
			lastPageOffset = i;
			break;
		}
	}
	if (lastPageOffset === undefined) {
		return undefined;
	}
	const lastPage = readPageAt(bytes, lastPageOffset);
	if (!lastPage || lastPage.granulePosition <= 0) {
		return undefined;
	}
	return (lastPage.granulePosition / codec.sampleRate) * 1000;
}
