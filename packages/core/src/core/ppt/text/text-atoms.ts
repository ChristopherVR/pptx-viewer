/**
 * Text atom parsing ([MS-PPT] 2.9): TextHeaderAtom, TextCharsAtom,
 * TextBytesAtom and assembly of a text body from an atom sequence, either
 * inside an OfficeArtClientTextbox or in a SlideListWithText container.
 *
 * @module ppt/text/text-atoms
 */

import type { PptColorScheme } from '../color-scheme';
import { iterateRecords } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { RT } from '../record-types';
import { parseStyleTextPropAtom } from './style-props';
import type { PptStyleRuns } from './style-props';

/** A raw text body: header type, text content and style runs. */
export interface PptRawText {
	/** TextTypeEnum value from the TextHeaderAtom. */
	textType: number;
	/** Text with \r paragraph marks and \x0B line breaks. */
	text: string;
	/** Style runs, when a StyleTextPropAtom followed the text. */
	styles?: PptStyleRuns;
}

/** Windows-1252 high range (0x80-0x9F) to Unicode. */
const CP1252_HIGH: Record<number, number> = {
	0x80: 0x20ac,
	0x82: 0x201a,
	0x83: 0x0192,
	0x84: 0x201e,
	0x85: 0x2026,
	0x86: 0x2020,
	0x87: 0x2021,
	0x88: 0x02c6,
	0x89: 0x2030,
	0x8a: 0x0160,
	0x8b: 0x2039,
	0x8c: 0x0152,
	0x8e: 0x017d,
	0x91: 0x2018,
	0x92: 0x2019,
	0x93: 0x201c,
	0x94: 0x201d,
	0x95: 0x2022,
	0x96: 0x2013,
	0x97: 0x2014,
	0x98: 0x02dc,
	0x99: 0x2122,
	0x9a: 0x0161,
	0x9b: 0x203a,
	0x9c: 0x0153,
	0x9e: 0x017e,
	0x9f: 0x0178,
};

/** Decode a TextBytesAtom payload (single-byte, Windows-1252-like). */
export function decodeTextBytes(view: DataView, offset: number, length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		const b = view.getUint8(offset + i);
		out += String.fromCharCode(CP1252_HIGH[b] ?? b);
	}
	return out;
}

/** Decode a TextCharsAtom payload (UTF-16LE). */
export function decodeTextChars(view: DataView, offset: number, length: number): string {
	let out = '';
	for (let i = 0; i + 1 < length; i += 2) {
		out += String.fromCharCode(view.getUint16(offset + i, true));
	}
	return out;
}

/**
 * Assemble text bodies from a flat record range.
 *
 * Groups records into bodies starting at each TextHeaderAtom: the following
 * TextCharsAtom/TextBytesAtom contributes the content and an optional
 * StyleTextPropAtom the formatting.
 *
 * @param view - DataView over the stream.
 * @param start - Range start offset.
 * @param end - Range end offset.
 * @param scheme - Color scheme for style color resolution.
 */
export function collectTextBodies(
	view: DataView,
	start: number,
	end: number,
	scheme: PptColorScheme,
): PptRawText[] {
	const bodies: PptRawText[] = [];
	let current: PptRawText | undefined;

	for (const rec of iterateRecords(view, start, end)) {
		if (rec.recType === RT.TextHeaderAtom) {
			current = { textType: rec.recLen >= 4 ? view.getUint32(rec.dataOffset, true) : 0, text: '' };
			bodies.push(current);
		} else if (rec.recType === RT.TextCharsAtom && current) {
			current.text = decodeTextChars(view, rec.dataOffset, rec.recLen);
		} else if (rec.recType === RT.TextBytesAtom && current) {
			current.text = decodeTextBytes(view, rec.dataOffset, rec.recLen);
		} else if (rec.recType === RT.StyleTextPropAtom && current) {
			current.styles = parseStyleTextPropAtom(
				view,
				rec.dataOffset,
				rec.recLen,
				current.text.length,
				scheme,
			);
		}
	}

	return bodies;
}

/**
 * Read the OutlineTextRefAtom index inside a client textbox, if present.
 */
export function findOutlineTextRef(view: DataView, start: number, end: number): number | undefined {
	for (const rec of iterateRecords(view, start, end)) {
		if (rec.recType === RT.OutlineTextRefAtom && rec.recLen >= 4) {
			return view.getInt32(rec.dataOffset, true);
		}
	}
	return undefined;
}

/**
 * Harvest outline text from a SlideListWithText container, keyed by the
 * slide persist id each text body belongs to.
 *
 * The container holds SlidePersistAtom records; the text records that
 * follow one belong to the referenced slide until the next SlidePersistAtom.
 */
export function collectOutlineText(
	view: DataView,
	slideListWithText: PptRecord,
	scheme: PptColorScheme,
): Map<number, PptRawText[]> {
	const result = new Map<number, PptRawText[]>();
	let currentPersistId: number | undefined;
	let segmentStart: number | undefined;

	const flush = (segmentEnd: number): void => {
		if (currentPersistId !== undefined && segmentStart !== undefined) {
			result.set(currentPersistId, collectTextBodies(view, segmentStart, segmentEnd, scheme));
		}
	};

	const rangeEnd = slideListWithText.dataOffset + slideListWithText.recLen;
	for (const rec of iterateRecords(view, slideListWithText.dataOffset, rangeEnd)) {
		if (rec.recType === RT.SlidePersistAtom && rec.recLen >= 4) {
			flush(rec.headerOffset);
			currentPersistId = view.getUint32(rec.dataOffset, true);
			segmentStart = rec.dataOffset + rec.recLen;
		}
	}
	flush(rangeEnd);

	return result;
}
