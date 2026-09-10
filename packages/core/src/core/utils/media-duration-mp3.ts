/**
 * MP3 (MPEG-1/2/2.5 Layer III) duration: skips an ID3v2 tag if present,
 * locates the first frame sync, and prefers an embedded Xing/Info or VBRI
 * VBR header's exact frame count over a CBR bitrate * remaining-bytes
 * estimate.
 *
 * @module media-duration-mp3
 */

const BITRATE_TABLE: Record<string, number[]> = {
	// MPEG version 1, Layer III (kbps), index 0 = "free", 15 = "bad".
	'1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
	// MPEG version 2/2.5, Layer III.
	'2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const SAMPLE_RATE_TABLE: Record<number, number[]> = {
	0: [11025, 12000, 8000], // MPEG 2.5
	2: [22050, 24000, 16000], // MPEG 2
	3: [44100, 48000, 32000], // MPEG 1
};

function skipId3v2(bytes: Uint8Array): number {
	if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
		return 0;
	}
	const size =
		(bytes[6]! & 0x7f) * 0x200000 +
		(bytes[7]! & 0x7f) * 0x4000 +
		(bytes[8]! & 0x7f) * 0x80 +
		(bytes[9]! & 0x7f);
	return 10 + size;
}

interface FrameHeader {
	offset: number;
	versionId: number; // 0=2.5, 2=2, 3=1
	bitrateKbps: number;
	sampleRate: number;
	channelMode: number; // 3 = mono
	padding: number;
	frameLength: number;
}

function findFirstFrame(bytes: Uint8Array, start: number): FrameHeader | undefined {
	for (let i = start; i + 4 <= bytes.length; i++) {
		if (bytes[i] !== 0xff || (bytes[i + 1]! & 0xe0) !== 0xe0) {
			continue;
		}
		const b1 = bytes[i + 1]!;
		const b2 = bytes[i + 2]!;
		const b3 = bytes[i + 3]!;
		const versionId = (b1 >> 3) & 0x03;
		const layerId = (b1 >> 1) & 0x03;
		if (versionId === 1 || layerId !== 1) {
			continue; // reserved version, or not Layer III
		}
		const bitrateIndex = (b2 >> 4) & 0x0f;
		const sampleRateIndex = (b2 >> 2) & 0x03;
		if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
			continue;
		}
		const table = versionId === 3 ? BITRATE_TABLE['1-3']! : BITRATE_TABLE['2-3']!;
		const bitrateKbps = table[bitrateIndex]!;
		const sampleRate = SAMPLE_RATE_TABLE[versionId]?.[sampleRateIndex];
		if (!sampleRate) {
			continue;
		}
		const padding = (b2 >> 1) & 0x01;
		const channelMode = (b3 >> 6) & 0x03;
		const samplesPerFrame = versionId === 3 ? 1152 : 576;
		const frameLength =
			Math.floor((samplesPerFrame / 8) * (bitrateKbps * 1000)) / sampleRate + padding;
		return {
			offset: i,
			versionId,
			bitrateKbps,
			sampleRate,
			channelMode,
			padding,
			frameLength: Math.floor(frameLength),
		};
	}
	return undefined;
}

/** Read a Xing/Info VBR header's frame count, if the frame carries one. */
function readXingFrameCount(bytes: Uint8Array, frame: FrameHeader): number | undefined {
	const sideInfoSize =
		frame.versionId === 3 ? (frame.channelMode === 3 ? 17 : 32) : frame.channelMode === 3 ? 9 : 17;
	const tagStart = frame.offset + 4 + sideInfoSize;
	if (tagStart + 8 > bytes.length) {
		return undefined;
	}
	const tag = String.fromCharCode(
		bytes[tagStart]!,
		bytes[tagStart + 1]!,
		bytes[tagStart + 2]!,
		bytes[tagStart + 3]!,
	);
	if (tag !== 'Xing' && tag !== 'Info') {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const flags = view.getUint32(tagStart + 4, false);
	if ((flags & 0x01) === 0) {
		return undefined; // frame count field absent
	}
	return view.getUint32(tagStart + 8, false);
}

/** Read a VBRI VBR header's frame count (Fraunhofer encoders), at its fixed offset. */
function readVbriFrameCount(bytes: Uint8Array, frame: FrameHeader): number | undefined {
	const tagStart = frame.offset + 4 + 32;
	if (tagStart + 14 > bytes.length) {
		return undefined;
	}
	const tag = String.fromCharCode(
		bytes[tagStart]!,
		bytes[tagStart + 1]!,
		bytes[tagStart + 2]!,
		bytes[tagStart + 3]!,
	);
	if (tag !== 'VBRI') {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return view.getUint32(tagStart + 14, false);
}

export function estimateMp3DurationMs(bytes: Uint8Array): number | undefined {
	const start = skipId3v2(bytes);
	const frame = findFirstFrame(bytes, start);
	if (!frame) {
		return undefined;
	}
	const samplesPerFrame = frame.versionId === 3 ? 1152 : 576;

	const xingFrames = readXingFrameCount(bytes, frame);
	if (xingFrames !== undefined) {
		return ((xingFrames * samplesPerFrame) / frame.sampleRate) * 1000;
	}
	const vbriFrames = readVbriFrameCount(bytes, frame);
	if (vbriFrames !== undefined) {
		return ((vbriFrames * samplesPerFrame) / frame.sampleRate) * 1000;
	}

	// CBR fallback: remaining audio bytes / bitrate.
	const audioBytes = bytes.length - frame.offset;
	if (frame.bitrateKbps <= 0) {
		return undefined;
	}
	return ((audioBytes * 8) / (frame.bitrateKbps * 1000)) * 1000;
}
