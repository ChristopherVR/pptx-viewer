/**
 * Deep value codec for the `pptx-viewer-json` format.
 *
 * `PptxData` is almost entirely JSON-native, but a handful of fields carry
 * raw bytes (`Uint8Array`: presentation thumbnails, embedded font binaries,
 * embedded chart workbooks). This codec walks a value tree and:
 *
 * - encodes every `Uint8Array` as a tagged object `{ "$bytes": "<base64>" }`
 *   so the document stays valid, self-contained JSON,
 * - escapes original object keys starting with `$` (prefixing one extra `$`)
 *   so a coincidental `{ $bytes: ... }` in source data can never be
 *   mis-decoded, and
 * - accounts embedded binary assets (tagged byte fields plus base64
 *   `data:` URLs already stored as strings, e.g. `imageData`/`mediaData`).
 */

/** Tag key used for encoded byte arrays. */
const BYTES_TAG = '$bytes';

/** Mutable accumulator for embedded-asset size accounting. */
export interface JsonAssetAccumulator {
	count: number;
	totalBytes: number;
}

interface BufferLike {
	from: (
		value: string | Uint8Array,
		encoding?: string,
	) => Uint8Array & { toString: (encoding: string) => string };
}

function getNodeBuffer(): BufferLike | undefined {
	return (globalThis as { Buffer?: BufferLike }).Buffer;
}

/** Encode raw bytes to base64 (Node `Buffer` when available, else `btoa`). */
export function bytesToBase64(bytes: Uint8Array): string {
	const bufferCtor = getNodeBuffer();
	if (bufferCtor) {
		return bufferCtor.from(bytes).toString('base64');
	}
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

/** Decode base64 text to raw bytes (Node `Buffer` when available, else `atob`). */
export function base64ToBytes(base64: string): Uint8Array {
	const bufferCtor = getNodeBuffer();
	if (bufferCtor) {
		return new Uint8Array(bufferCtor.from(base64, 'base64'));
	}
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const BASE64_DATA_URL_PATTERN = /^data:[^;,]+;base64,/;

/**
 * Approximate decoded byte size of a base64 payload of `length` characters.
 */
function base64PayloadBytes(length: number): number {
	return Math.floor((length * 3) / 4);
}

/** Record a string in the asset stats when it is a base64 `data:` URL. */
function accountString(value: string, stats: JsonAssetAccumulator | undefined): void {
	if (!stats) {
		return;
	}
	const match = BASE64_DATA_URL_PATTERN.exec(value);
	if (match) {
		stats.count += 1;
		stats.totalBytes += base64PayloadBytes(value.length - match[0].length);
	}
}

/**
 * Recursively encode a model value into a JSON-safe value.
 * `undefined` entries inside objects are dropped (matching `JSON.stringify`).
 */
export function encodeJsonValue(value: unknown, stats?: JsonAssetAccumulator): unknown {
	if (value === null || value === undefined) {
		return value;
	}
	if (typeof value === 'string') {
		accountString(value, stats);
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (value instanceof Uint8Array) {
		if (stats) {
			stats.count += 1;
			stats.totalBytes += value.byteLength;
		}
		return { [BYTES_TAG]: bytesToBase64(value) };
	}
	if (Array.isArray(value)) {
		return value.map((entry) => encodeJsonValue(entry, stats));
	}
	if (typeof value === 'object') {
		const source = value as Record<string, unknown>;
		const encoded: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(source)) {
			if (entry === undefined) {
				continue;
			}
			const safeKey = key.startsWith('$') ? `$${key}` : key;
			encoded[safeKey] = encodeJsonValue(entry, stats);
		}
		return encoded;
	}
	// Functions/symbols/bigints have no place in the model; drop them the same
	// way JSON.stringify would.
	return undefined;
}

function isBytesTag(value: Record<string, unknown>): boolean {
	const keys = Object.keys(value);
	return keys.length === 1 && keys[0] === BYTES_TAG && typeof value[BYTES_TAG] === 'string';
}

/** Recursively decode a JSON value produced by {@link encodeJsonValue}. */
export function decodeJsonValue(value: unknown): unknown {
	if (value === null || typeof value !== 'object') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => decodeJsonValue(entry));
	}
	const source = value as Record<string, unknown>;
	if (isBytesTag(source)) {
		return base64ToBytes(source[BYTES_TAG] as string);
	}
	const decoded: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(source)) {
		const originalKey = key.startsWith('$$') ? key.slice(1) : key;
		decoded[originalKey] = decodeJsonValue(entry);
	}
	return decoded;
}
