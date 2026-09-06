/**
 * RIFF/WAVE encoder for synthesised effect-sound PCM data, plus a DOM-free
 * base64 encoder so the result can be embedded as a
 * `data:audio/wav;base64,...` URL without `Buffer` or `btoa`: neither is
 * guaranteed in every runtime this module runs in (browser bindings have no
 * `Buffer`; `packages/core`'s Vitest environment should not have to depend on
 * a browser-only global to round-trip a fixture).
 *
 * @module render/effect-sound-wav-encoder
 */
import { SAMPLE_RATE } from './effect-sound-dsp';

const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const HEADER_BYTES = 44;

/** Encode float samples (expected range roughly [-1, 1]) as a 16-bit mono WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
	const blockAlign = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
	const byteRate = sampleRate * blockAlign;
	const dataSize = samples.length * blockAlign;
	const buffer = new ArrayBuffer(HEADER_BYTES + dataSize);
	const view = new DataView(buffer);

	writeAscii(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeAscii(view, 8, 'WAVE');
	writeAscii(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, NUM_CHANNELS, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, BITS_PER_SAMPLE, true);
	writeAscii(view, 36, 'data');
	view.setUint32(40, dataSize, true);

	let offset = HEADER_BYTES;
	for (const sample of samples) {
		const clamped = Math.max(-1, Math.min(1, sample));
		view.setInt16(offset, Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff), true);
		offset += 2;
	}
	return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string): void {
	for (let i = 0; i < text.length; i++) {
		view.setUint8(offset + i, text.charCodeAt(i));
	}
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode bytes as base64 without `Buffer`/`btoa`, for portability across
 * browser bindings and `packages/core`'s Node-based Vitest environment.
 */
export function bytesToBase64(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const b0 = bytes[i];
		const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
		const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
		out += BASE64_CHARS[b0 >> 2];
		out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 !== undefined ? b1 >> 4 : 0)];
		out +=
			b1 !== undefined ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 !== undefined ? b2 >> 6 : 0)] : '=';
		out += b2 !== undefined ? BASE64_CHARS[b2 & 0x3f] : '=';
	}
	return out;
}

/** Wrap WAV bytes in a `data:audio/wav;base64,...` URL. */
export function wavDataUrl(bytes: Uint8Array): string {
	return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
}
