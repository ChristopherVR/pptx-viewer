/**
 * The `pptx-viewer-json` document format: a portable, versioned,
 * self-contained JSON representation of a parsed presentation
 * ({@link PptxData}). Binary payloads are embedded (base64), so a document
 * round-trips standalone without the original `.pptx` archive.
 *
 * Top-level shape (version 1):
 *
 * ```json
 * {
 *   "format": "pptx-viewer-json",
 *   "version": 1,
 *   "generator": "pptx-viewer-core",
 *   "createdAt": "2026-01-01T00:00:00.000Z",
 *   "slideCount": 3,
 *   "assets": { "count": 2, "totalBytes": 51234 },
 *   "presentation": { "width": 960, "height": 540, ... },
 *   "slides": [ { "id": "...", "elements": [ ... ] }, ... ]
 * }
 * ```
 *
 * Field coverage mirrors the canonical inventories
 * (`SLIDE_FIELD_KIND` / `ELEMENT_FIELD_KIND`) plus a TypeScript-enforced
 * presentation-level key list, so no model field is silently dropped.
 */

/** Discriminating marker stored in the top-level `format` field. */
export const PPTX_JSON_FORMAT = 'pptx-viewer-json';

/** Current (and only) supported document version. */
export const PPTX_JSON_VERSION = 1;

/** Suggested file extension for exported documents. */
export const PPTX_JSON_FILE_EXTENSION = '.json';

/** MIME type used when downloading an exported document. */
export const PPTX_JSON_MIME_TYPE = 'application/json';

/** Size accounting for binary assets embedded in the document. */
export interface PptxJsonAssetStats {
	/** Number of embedded binary assets (base64 data URLs + raw byte fields). */
	count: number;
	/** Total decoded byte size of all embedded binary assets. */
	totalBytes: number;
}

/** A parsed and shape-validated `pptx-viewer-json` document. */
export interface PptxJsonDocument {
	format: typeof PPTX_JSON_FORMAT;
	version: typeof PPTX_JSON_VERSION;
	/** Producer identifier (informational, ignored on import). */
	generator?: string;
	/** ISO-8601 export timestamp (informational, ignored on import). */
	createdAt?: string;
	/** Convenience copy of `slides.length`; validated on import. */
	slideCount: number;
	/** Embedded-asset size accounting computed at export time. */
	assets: PptxJsonAssetStats;
	/** Presentation-level fields of `PptxData` (everything except `slides`). */
	presentation: Record<string, unknown>;
	/** JSON-encoded slides (see `SLIDE_FIELD_KIND` / `ELEMENT_FIELD_KIND`). */
	slides: Array<Record<string, unknown>>;
}

/** Matches the `format` marker anywhere in a candidate JSON text. */
const FORMAT_MARKER_PATTERN = /"format"\s*:\s*"pptx-viewer-json"/;

/**
 * Cheap text-level sniff: the text is a JSON object (leading `{` after
 * optional whitespace) and carries the `pptx-viewer-json` format marker.
 * Full validation happens in `parsePptxJsonDocument`.
 */
export function isPptxJsonText(text: string): boolean {
	let index = 0;
	// Skip a BOM plus any leading whitespace.
	if (text.charCodeAt(0) === 0xfeff) {
		index = 1;
	}
	while (index < text.length && /\s/.test(text[index])) {
		index++;
	}
	if (text[index] !== '{') {
		return false;
	}
	return FORMAT_MARKER_PATTERN.test(text);
}

/**
 * Byte-level sniff + decode: returns the decoded text when the buffer looks
 * like a `pptx-viewer-json` document, or `null` for anything else (e.g. a
 * ZIP/OLE2 `.pptx`). Safe to call on arbitrary binary input.
 */
export function decodePptxJsonText(data: ArrayBuffer | Uint8Array): string | null {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	if (bytes.length === 0) {
		return null;
	}
	let offset = 0;
	// Skip a UTF-8 BOM if present.
	if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
		offset = 3;
	}
	// Skip ASCII whitespace, then require a leading `{`.
	while (offset < bytes.length && isAsciiWhitespace(bytes[offset])) {
		offset++;
	}
	if (offset >= bytes.length || bytes[offset] !== 0x7b /* '{' */) {
		return null;
	}
	const text = new TextDecoder('utf-8').decode(bytes);
	return isPptxJsonText(text) ? text : null;
}

function isAsciiWhitespace(byte: number): boolean {
	return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}
