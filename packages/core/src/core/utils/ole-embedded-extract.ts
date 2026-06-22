/**
 * Recover the real embedded payload from an OLE object's binary.
 *
 * PowerPoint stores an embedded OLE object's bytes in the package, usually as
 * either a plain modern file (e.g. an `.xlsx`/`.docx` saved straight into
 * `ppt/embeddings/`) or an OLE2 compound file (`oleObject*.bin`). When the
 * object is a generic "Package" (ProgID `Package`, the form Insert > Object >
 * Create from File produces for arbitrary files), the original file is wrapped
 * inside the compound file using one of two MS-OLEDS structures:
 *
 *   - `Ole10Native`: a length-prefixed legacy wrapper that carries the
 *     original file name, a working path, and the raw file bytes.
 *   - a `CONTENTS` / native data stream (used by some hosts, e.g. PDF).
 *
 * This module unwraps those forms so callers can offer the real inner file for
 * download / open, falling back to the raw compound-file bytes when the payload
 * cannot be identified. It never throws: malformed input yields a best-effort
 * result (often just the raw bytes) so the loader can stay lazy and safe.
 *
 * Reference: [MS-OLEDS] Object Linking and Embedding Data Structures,
 * sections 2.2 (OLEStream) and 2.3.1 (Ole10Native).
 * @see https://learn.microsoft.com/openspecs/windows_protocols/ms-oleds
 *
 * @module ole-embedded-extract
 */

import { parseOle2 } from './ole2-parser-read';
import { OLE_MAGIC } from './ole2-parser-types';

/**
 * Build a base64 `data:` URL from raw bytes. Used for embedded OLE payloads
 * (download / open-in-new-tab) where a stable, serialization-safe string is
 * preferable to a revocable Blob URL. Chunks the encode to avoid blowing the
 * argument limit of `String.fromCharCode` on large buffers.
 */
export function oleBytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode.apply(null, Array.from(chunk));
	}
	return `data:${mimeType};base64,${btoa(binary)}`;
}

/** The result of unwrapping an OLE embedding to its real inner file. */
export interface OleUnwrapResult {
	/** Original file name when recoverable (e.g. from an Ole10Native header). */
	fileName?: string;
	/** The recovered inner file bytes (or the raw input when not unwrappable). */
	data: Uint8Array;
}

/**
 * Candidate stream names for the legacy length-prefixed native wrapper.
 * Per MS-OLEDS the canonical name is prefixed with a U+0001 control character;
 * some writers omit it, so both forms are tried.
 */
const OLE10_NATIVE_STREAM_NAMES = [`${String.fromCharCode(1)}Ole10Native`, 'Ole10Native'] as const;
/** Stream name used by some hosts (e.g. Acrobat) for the native payload. */
const CONTENTS_STREAM = 'CONTENTS';

/** Whether the given bytes start with the OLE2 compound-file magic signature. */
export function isOle2CompoundFile(bytes: Uint8Array): boolean {
	if (bytes.length < OLE_MAGIC.length) {
		return false;
	}
	for (let i = 0; i < OLE_MAGIC.length; i++) {
		if (bytes[i] !== OLE_MAGIC[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Extract a trailing file name from a NUL-terminated path stored in the
 * Ole10Native header. The header carries the original (absolute) path and a
 * temporary path; we keep just the base name. Returns undefined when empty.
 */
function baseNameFromPath(raw: string): string | undefined {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	const lastSlash = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
	const base = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
	return base.length > 0 ? base : undefined;
}

/** Read a NUL-terminated ASCII string from `bytes` starting at `offset`. */
function readAsciiZ(bytes: Uint8Array, offset: number): { value: string; next: number } {
	let end = offset;
	while (end < bytes.length && bytes[end] !== 0) {
		end++;
	}
	let value = '';
	for (let i = offset; i < end; i++) {
		value += String.fromCharCode(bytes[i]);
	}
	// Skip the terminating NUL when present.
	return { value, next: end < bytes.length ? end + 1 : end };
}

/**
 * Decode an `Ole10Native` stream into its original file name and bytes.
 *
 * Layout (little-endian): 4-byte total size, 2-byte flags (usually 0x0002),
 * NUL-terminated ASCII label, NUL-terminated source path, 4 unknown bytes,
 * 4-byte temp-path length, temp path (ASCII), 4-byte native-data size, then
 * the native data. Older/variant writers omit the flags+label section, so we
 * fall back to treating the body after the size prefix as the native data.
 */
export function decodeOle10Native(stream: Uint8Array): OleUnwrapResult | undefined {
	if (stream.length < 6) {
		return undefined;
	}
	const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
	const declaredSize = view.getUint32(0, true);
	// The native data, if present, lives within `declaredSize` bytes after the
	// 4-byte length prefix. Guard against a bogus length.
	const bodyEnd = Math.min(stream.length, 4 + declaredSize);
	if (bodyEnd <= 4) {
		return undefined;
	}

	// flags (2 bytes) then label, source path.
	let cursor = 6;
	const label = readAsciiZ(stream, cursor);
	cursor = label.next;
	const sourcePath = readAsciiZ(stream, cursor);
	cursor = sourcePath.next;
	// 4 unknown bytes, then a 4-byte temp-path length + temp path.
	if (cursor + 8 > stream.length) {
		return undefined;
	}
	cursor += 4;
	const tempLen = view.getUint32(cursor, true);
	cursor += 4;
	if (tempLen > stream.length) {
		return undefined;
	}
	cursor += tempLen;
	if (cursor + 4 > stream.length) {
		return undefined;
	}
	const nativeSize = view.getUint32(cursor, true);
	cursor += 4;
	const dataEnd = Math.min(stream.length, cursor + nativeSize);
	if (dataEnd <= cursor) {
		return undefined;
	}

	const data = stream.subarray(cursor, dataEnd);
	const fileName = baseNameFromPath(sourcePath.value) ?? baseNameFromPath(label.value) ?? undefined;
	return { fileName, data };
}

/**
 * Unwrap an OLE embedding's raw bytes to the real inner file.
 *
 * - Plain modern files (not OLE2 compound) pass through unchanged.
 * - OLE2 "Package" wrappers are unwrapped via the `Ole10Native` stream
 *   (recovering the original file name) when present.
 * - Otherwise the most useful native stream (`CONTENTS`) is returned when
 *   identifiable; failing that, the raw compound-file bytes are returned.
 *
 * Never throws: any parse failure falls back to the raw input.
 */
export function unwrapOleEmbedding(bytes: Uint8Array): OleUnwrapResult {
	if (bytes.length === 0) {
		return { data: bytes };
	}
	if (!isOle2CompoundFile(bytes)) {
		// Already a plain file (e.g. an embedded .xlsx/.docx). Use as-is.
		return { data: bytes };
	}

	try {
		// parseOle2 expects an ArrayBuffer that owns exactly the file bytes.
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const ole = parseOle2(buffer);

		for (const name of OLE10_NATIVE_STREAM_NAMES) {
			const ole10 = ole.getStream(name);
			if (!ole10) {
				continue;
			}
			const decoded = decodeOle10Native(ole10);
			if (decoded && decoded.data.length > 0) {
				return decoded;
			}
			// Header was unreadable; surface the raw stream rather than nothing.
			return { data: ole10 };
		}

		const contents = ole.getStream(CONTENTS_STREAM);
		if (contents && contents.length > 0) {
			return { data: contents };
		}
	} catch {
		// Fall through to the raw-bytes fallback below.
	}

	// Not unwrappable: keep the raw compound-file bytes for download.
	return { data: bytes };
}
