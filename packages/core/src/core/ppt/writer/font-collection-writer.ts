/**
 * Environment / FontCollection writer, the inverse of `document-parser.ts`'s
 * `parseFonts`.
 *
 * @module ppt/writer/font-collection-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';

const LF_FACE_NAME_BYTES = 64;

function buildFontEntityAtom(name: string, index: number): Uint8Array {
	const nameBytes = new ByteWriter().utf16(name.slice(0, 31)).u16(0).toBytes();
	const padded = new Uint8Array(LF_FACE_NAME_BYTES);
	padded.set(nameBytes.subarray(0, Math.min(nameBytes.length, LF_FACE_NAME_BYTES)));
	// lfFaceName comes FIRST (this project's own reader,
	// `document-parser.ts#parseFonts`, already reads the name starting at
	// the atom's very first byte), with lfCharSet/lfClipPrecision/lfQuality/
	// lfPitchAndFamily trailing it -- the reverse of this writer's earlier
	// (wrong) field order, verified against a real COM-written file whose
	// FontEntityAtom put "Calibri" (UTF-16) at byte 0, not byte 4. Getting
	// this backwards was small enough to be invisible to this project's own
	// round-trip tests (which never asserted an exact font name), yet real
	// PowerPoint's Office File Validation hard-rejected the whole file over
	// it, confirmed fixed by COM re-verification.
	const data = new ByteWriter()
		.bytes(padded)
		.u8(0) // lfCharSet
		.u8(0) // lfClipPrecision
		.u8(0) // lfQuality
		.u8(0) // lfPitchAndFamily
		.toBytes();
	// A real (COM-written) FontEntityAtom's recInstance is the font's index
	// within the collection (matching a text run's TextCFException.fontRef),
	// not 0.
	return record(RT.FontEntityAtom, data, index, false, 0);
}

/**
 * Build the five extra sibling records a real (COM-written) `Environment`
 * always carries alongside `FontCollection`: an unidentified container
 * (`0x0fc8`, BEFORE `FontCollection`), three unidentified small atoms
 * (`0x0fa4`, `0x0fa5`, `0x0fa9`, AFTER it), and a document-level
 * `TextMasterStyleAtom` for the "other" text type (`instance = 4`,
 * [MS-PPT] TextTypeEnum). Their exact field semantics are not documented
 * anywhere this writer could find, but their zero-filled presence (matching
 * a real file's sizes and position relative to `FontCollection`) is enough:
 * their total ABSENCE (this writer's earlier behaviour) failed real
 * PowerPoint's Office File Validation outright even though `FontCollection`
 * itself was already byte-correct, confirmed fixed by COM re-verification.
 * Unlike `document-writer.ts`'s optional `List`/`HeadersFooters`/`0x0428`
 * records, these are NOT individually optional for `Environment`.
 */
function buildEnvironmentLeadingRecord(): Uint8Array {
	return record(0x0fc8, new Uint8Array(12), 2, false, 0);
}

function buildEnvironmentTrailingRecords(): Uint8Array {
	const unknown0fa4 = record(0x0fa4, new Uint8Array(8), 0, false, 0);
	const unknown0fa5 = record(0x0fa5, new Uint8Array(12), 0, false, 0);
	const unknown0fa9 = record(0x0fa9, new Uint8Array(10), 0, false, 0);
	const otherTextStyle = record(
		RT.TextMasterStyleAtom,
		new ByteWriter().u16(1).u32(0).u32(0).toBytes(),
		4,
		false,
		0,
	);
	return new ByteWriter()
		.bytes(unknown0fa4)
		.bytes(unknown0fa5)
		.bytes(unknown0fa9)
		.bytes(otherTextStyle)
		.toBytes();
}

/**
 * Build a framed `Environment` container holding the deck's font
 * collection, ready to embed directly inside the `DocumentContainer`.
 *
 * Font index (used by `TextCFException.fontRef`, see `text-atom-writer.ts`)
 * is the entry's ORDER within the collection, not its `recInstance` (which
 * must stay 0 like every other plain atom); the reader agrees, walking
 * `FontEntityAtom` children positionally.
 */
export function buildEnvironment(fonts: string[]): Uint8Array {
	const collectionData = new ByteWriter();
	fonts.forEach((name, i) => collectionData.bytes(buildFontEntityAtom(name, i)));
	const fontCollection = record(RT.FontCollection, collectionData.toBytes(), 0, true);
	const data = new ByteWriter()
		.bytes(buildEnvironmentLeadingRecord())
		.bytes(fontCollection)
		.bytes(buildEnvironmentTrailingRecords())
		.toBytes();
	return record(RT.Environment, data, 0, true);
}
