/**
 * Write back an edited OLE embedded payload: the inverse of
 * `unwrapOleEmbedding` (`ole-embedded-extract.ts`).
 *
 * `unwrapOleEmbedding` recovers the real inner file from whatever container
 * PowerPoint used to store it (a plain modern file, an `Ole10Native`-wrapped
 * generic "Package", or a legacy OLE2 document format like `.xls`/`.doc`
 * where the whole compound file IS the payload). This module re-wraps an
 * edited payload back into that SAME container shape, so replacing the
 * bytes of `ppt/embeddings/oleObjectN.*` with the result keeps the part
 * openable the same way it was before the edit.
 *
 * @module ole-embedded-replace
 */
import { isOle2CompoundFile, decodeOle10Native } from './ole-embedded-extract';
import { parseOle2 } from './ole2-parser-read';
import { buildOle2 } from './ole2-parser-write';

const OLE10_NATIVE_NAME = `${String.fromCharCode(1)}Ole10Native`;
const OLE10_NATIVE_NAME_UNPREFIXED = 'Ole10Native';
const CONTENTS_STREAM = 'CONTENTS';

/** Encode an ASCII string with a trailing NUL terminator. */
function asciiZ(value: string): Uint8Array {
	const bytes = new Uint8Array(value.length + 1);
	for (let i = 0; i < value.length; i++) {
		bytes[i] = value.charCodeAt(i) & 0xff;
	}
	bytes[value.length] = 0;
	return bytes;
}

/**
 * Build a fresh `Ole10Native` stream (MS-OLEDS SS2.3.1) wrapping `data` under
 * `fileName`. Mirrors the layout `decodeOle10Native` reads: 4-byte total
 * size, 2-byte flags, NUL-terminated label + source path, 4 unknown bytes, a
 * 4-byte temp-path length + temp path, a 4-byte native-data size, then the
 * native data itself.
 */
export function encodeOle10Native(fileName: string, data: Uint8Array): Uint8Array {
	const label = asciiZ(fileName);
	const sourcePath = asciiZ(fileName);
	const tempPath = asciiZ(fileName);
	const unknown = new Uint8Array(4);

	const bodyLength =
		2 /* flags */ +
		label.length +
		sourcePath.length +
		unknown.length +
		4 /* temp path length field */ +
		tempPath.length +
		4 /* native size field */ +
		data.length;

	const out = new Uint8Array(4 + bodyLength);
	const view = new DataView(out.buffer);
	view.setUint32(0, bodyLength, true);
	view.setUint16(4, 0x0002, true);
	let cursor = 6;
	out.set(label, cursor);
	cursor += label.length;
	out.set(sourcePath, cursor);
	cursor += sourcePath.length;
	out.set(unknown, cursor);
	cursor += unknown.length;
	view.setUint32(cursor, tempPath.length, true);
	cursor += 4;
	out.set(tempPath, cursor);
	cursor += tempPath.length;
	view.setUint32(cursor, data.length, true);
	cursor += 4;
	out.set(data, cursor);
	return out;
}

/** Options for {@link replaceOleEmbedding}. */
export interface ReplaceOleEmbeddingOptions {
	/** File name to record when re-wrapping a generic "Package" (`Ole10Native`). */
	fileName?: string;
}

/**
 * Re-wrap an edited payload into the same container shape `originalBytes`
 * used, so the result can replace the original embedding part in the saved
 * package.
 *
 * - `originalBytes` not an OLE2 compound file (a plain modern file, e.g. an
 *   embedded `.xlsx`): the container itself IS the payload, so the new
 *   payload bytes are returned unchanged.
 * - `originalBytes` is OLE2 and carries an `Ole10Native` or `CONTENTS`
 *   stream (a generic "Package" wrapper): every other stream (`\1CompObj`,
 *   etc.) is preserved verbatim and only the native-data stream is replaced,
 *   rebuilt through the existing `buildOle2` writer.
 * - `originalBytes` is OLE2 but neither stream is present (a native OLE2
 *   document format, e.g. legacy `.xls`/`.doc`, where the compound file IS
 *   the document): the payload editor for that format already produces a
 *   complete replacement compound file, so it is returned unchanged.
 *
 * Never throws: a parse failure on `originalBytes` falls back to returning
 * `newPayloadBytes` as-is, matching `unwrapOleEmbedding`'s own
 * never-throws contract.
 */
export function replaceOleEmbedding(
	originalBytes: Uint8Array,
	newPayloadBytes: Uint8Array,
	options: ReplaceOleEmbeddingOptions = {},
): Uint8Array {
	if (originalBytes.length === 0 || !isOle2CompoundFile(originalBytes)) {
		return newPayloadBytes;
	}

	try {
		const buffer = originalBytes.buffer.slice(
			originalBytes.byteOffset,
			originalBytes.byteOffset + originalBytes.byteLength,
		) as ArrayBuffer;
		const ole = parseOle2(buffer);

		const nativeStreamName = ole.getStream(OLE10_NATIVE_NAME)
			? OLE10_NATIVE_NAME
			: ole.getStream(OLE10_NATIVE_NAME_UNPREFIXED)
				? OLE10_NATIVE_NAME_UNPREFIXED
				: undefined;

		if (nativeStreamName) {
			const existing = ole.getStream(nativeStreamName)!;
			const decoded = decodeOle10Native(existing);
			const fileName = options.fileName ?? decoded?.fileName ?? 'file.bin';
			const streams = new Map<string, Uint8Array>();
			for (const entry of ole.entries) {
				if (entry.name === 'Root Entry' || entry.name === nativeStreamName) {
					continue;
				}
				const data = ole.getStream(entry.name);
				if (data) {
					streams.set(entry.name, data);
				}
			}
			streams.set(nativeStreamName, encodeOle10Native(fileName, newPayloadBytes));
			return new Uint8Array(buildOle2(streams));
		}

		if (ole.getStream(CONTENTS_STREAM)) {
			const streams = new Map<string, Uint8Array>();
			for (const entry of ole.entries) {
				if (entry.name === 'Root Entry' || entry.name === CONTENTS_STREAM) {
					continue;
				}
				const data = ole.getStream(entry.name);
				if (data) {
					streams.set(entry.name, data);
				}
			}
			streams.set(CONTENTS_STREAM, newPayloadBytes);
			return new Uint8Array(buildOle2(streams));
		}

		// Native OLE2 document format (.xls/.doc): the editor already produced
		// a full replacement compound file.
		return newPayloadBytes;
	} catch {
		return newPayloadBytes;
	}
}
