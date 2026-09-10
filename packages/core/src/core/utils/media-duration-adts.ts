/**
 * Raw AAC (ADTS-framed) duration ESTIMATE: counts frames by walking each
 * frame's 13-bit length field and multiplies by 1024 samples/frame (the
 * overwhelmingly common case; a frame carrying multiple raw data blocks
 * would under-count, hence "estimate" - ADTS carries no exact duration
 * field the way WAV/MP4/Ogg do).
 *
 * @module media-duration-adts
 */

const SAMPLE_RATES = [
	96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

interface AdtsFrame {
	length: number;
	sampleRate: number;
}

function readFrameAt(bytes: Uint8Array, offset: number): AdtsFrame | undefined {
	if (offset + 7 > bytes.length) {
		return undefined;
	}
	if (bytes[offset] !== 0xff || (bytes[offset + 1]! & 0xf0) !== 0xf0) {
		return undefined;
	}
	const freqIndex = (bytes[offset + 2]! >> 2) & 0x0f;
	const sampleRate = SAMPLE_RATES[freqIndex];
	if (!sampleRate) {
		return undefined;
	}
	const length =
		((bytes[offset + 3]! & 0x03) << 11) |
		(bytes[offset + 4]! << 3) |
		((bytes[offset + 5]! >> 5) & 0x07);
	if (length < 7) {
		return undefined;
	}
	return { length, sampleRate };
}

export function estimateAdtsDurationMs(bytes: Uint8Array): number | undefined {
	const first = readFrameAt(bytes, 0);
	if (!first) {
		return undefined;
	}
	let offset = 0;
	let frameCount = 0;
	while (offset < bytes.length) {
		const frame = readFrameAt(bytes, offset);
		if (!frame) {
			break;
		}
		frameCount++;
		offset += frame.length;
	}
	if (frameCount === 0) {
		return undefined;
	}
	return ((frameCount * 1024) / first.sampleRate) * 1000;
}
