/**
 * Windows-1252 <-> Unicode code point conversion for legacy binary `.doc`
 * (Word 97-2003) "compressed" (single-byte-per-character) text pieces.
 *
 * [MS-DOC] piece table entries (`Pcd.fc`'s `fCompressed` bit, see
 * `ole-document-doc-pieces.ts`) store text as either UTF-16LE (2 bytes per
 * character) or as single Windows-1252 bytes when every character in the
 * piece fits that code page. Bytes 0x00-0x7F and 0xA0-0xFF map directly onto
 * the same Unicode code point (ASCII / Latin-1 supplement); bytes 0x80-0x9F
 * are the code page's distinguishing block (curly quotes, dashes, the Euro
 * sign, etc.) and need an explicit table. Values are stored as bare code
 * points (numbers), never as literal characters, so no source file here
 * carries the punctuation glyphs themselves.
 *
 * @module ole-document-doc-cp1252
 */

/** Unicode code points for Windows-1252 bytes 0x80-0x9F, in order. Undefined slots keep the C1 control identity (WHATWG windows-1252 index). */
const CP1252_HIGH_BLOCK: readonly number[] = [
	0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
	0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
	0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

/** Reverse lookup: Unicode code point -> Windows-1252 byte, for the 0x80-0x9F block only. */
const CP1252_HIGH_BLOCK_REVERSE: ReadonlyMap<number, number> = new Map(
	CP1252_HIGH_BLOCK.map((codePoint, i) => [codePoint, 0x80 + i]),
);

/** Decode one Windows-1252 byte to its Unicode code point. */
export function decodeCp1252Byte(byte: number): number {
	if (byte >= 0x80 && byte <= 0x9f) {
		return CP1252_HIGH_BLOCK[byte - 0x80]!;
	}
	return byte;
}

/** Decode a run of Windows-1252 bytes to a string. */
export function decodeCp1252(bytes: Uint8Array): string {
	let out = '';
	for (const byte of bytes) {
		out += String.fromCodePoint(decodeCp1252Byte(byte));
	}
	return out;
}

/**
 * Encode a Unicode code point to a Windows-1252 byte, or `undefined` if the
 * code point has no representation in that code page (the caller must then
 * fall back to an uncompressed UTF-16LE piece for the whole run).
 */
export function encodeCp1252Char(codePoint: number): number | undefined {
	if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) {
		return codePoint;
	}
	return CP1252_HIGH_BLOCK_REVERSE.get(codePoint);
}

/**
 * Encode a string to Windows-1252 bytes, or `undefined` if any character is
 * not representable (surrogate pairs are read as their combined code point,
 * which is always outside the 1-byte range and so always fails).
 */
export function encodeCp1252(text: string): Uint8Array | undefined {
	const bytes: number[] = [];
	for (const char of text) {
		const codePoint = char.codePointAt(0)!;
		const byte = encodeCp1252Char(codePoint);
		if (byte === undefined) {
			return undefined;
		}
		bytes.push(byte);
	}
	return Uint8Array.from(bytes);
}
