/**
 * StyleTextPropAtom parsing ([MS-PPT] 2.9.1, 2.9.12 TextPFException,
 * 2.9.14 TextCFException).
 *
 * The atom carries paragraph-level runs (TextPFRun) followed by
 * character-level runs (TextCFRun); each run states how many characters it
 * covers (the terminating paragraph mark counts as one character).
 *
 * @module ppt/text/style-props
 */

import { resolveColorIndex } from '../color-scheme';
import type { PptColorScheme } from '../color-scheme';
import { ByteCursor as Cursor } from './byte-cursor';

/** Parsed paragraph-level formatting exception. */
export interface PptParagraphProps {
	/** Number of characters covered (including terminator). */
	count: number;
	/** Outline indent level 0-4. */
	indentLevel: number;
	/** Bullet suppressed / forced. */
	hasBullet?: boolean;
	/** Bullet character. */
	bulletChar?: string;
	/** Bullet font index into the document font collection. */
	bulletFontRef?: number;
	/** Bullet color as hex RGB. */
	bulletColorRgb?: string;
	/** Paragraph alignment. */
	align?: 'l' | 'ctr' | 'r' | 'just';
	/** Left margin in master units. */
	leftMarginMu?: number;
	/** Indent in master units. */
	indentMu?: number;
}

/** Parsed character-level formatting exception. */
export interface PptCharProps {
	/** Number of characters covered. */
	count: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	shadow?: boolean;
	/** Font index into the document font collection. */
	fontRef?: number;
	/** Font size in points. */
	sizePt?: number;
	/** Text color as hex RGB. */
	colorRgb?: string;
}

/** Result of parsing a StyleTextPropAtom. */
export interface PptStyleRuns {
	paragraphRuns: PptParagraphProps[];
	charRuns: PptCharProps[];
}

const ALIGN_MAP: Record<number, PptParagraphProps['align']> = {
	0: 'l',
	1: 'ctr',
	2: 'r',
	3: 'just',
};

/** Parse one TextPFException at the cursor. */
function parsePfException(c: Cursor, scheme: PptColorScheme, out: PptParagraphProps): boolean {
	if (!c.canRead(4)) {
		return false;
	}
	const masks = c.u32();
	const need = (bit: number): boolean => (masks & bit) !== 0;
	try {
		let bulletFlags = 0;
		if (masks & 0x0000000f) {
			bulletFlags = c.u16();
			if (need(0x0001)) {
				out.hasBullet = (bulletFlags & 0x1) !== 0;
			}
		}
		if (need(0x0080)) {
			out.bulletChar = String.fromCharCode(c.u16());
		}
		if (need(0x0010)) {
			out.bulletFontRef = c.u16();
		}
		if (need(0x0040)) {
			c.i16(); // bulletSize (percent of text size); not used yet
		}
		if (need(0x0020)) {
			const [r, g, b, idx] = c.bytes4();
			out.bulletColorRgb = resolveColorIndex(r, g, b, idx, scheme);
		}
		if (need(0x0800)) {
			out.align = ALIGN_MAP[c.u16()];
		}
		if (need(0x1000)) {
			c.i16(); // lineSpacing
		}
		if (need(0x2000)) {
			c.i16(); // spaceBefore
		}
		if (need(0x4000)) {
			c.i16(); // spaceAfter
		}
		if (need(0x0100)) {
			out.leftMarginMu = c.u16();
		}
		if (need(0x0400)) {
			out.indentMu = c.u16();
		}
		if (need(0x8000)) {
			c.u16(); // defaultTabSize
		}
		if (need(0x100000)) {
			const tabCount = c.u16();
			c.skip(tabCount * 4);
		}
		if (need(0x10000)) {
			c.u16(); // fontAlign
		}
		if (masks & 0x000e0000) {
			c.u16(); // wrapFlags (charWrap | wordWrap | overflow)
		}
		if (need(0x200000)) {
			c.u16(); // textDirection
		}
	} catch {
		return false;
	}
	return true;
}

/** Parse one TextCFException at the cursor. */
function parseCfException(c: Cursor, scheme: PptColorScheme, out: PptCharProps): boolean {
	if (!c.canRead(4)) {
		return false;
	}
	const masks = c.u32();
	const need = (bit: number): boolean => (masks & bit) !== 0;
	try {
		if (masks & 0x0000ffff) {
			const style = c.u16();
			if (need(0x0001)) {
				out.bold = (style & 0x1) !== 0;
			}
			if (need(0x0002)) {
				out.italic = (style & 0x2) !== 0;
			}
			if (need(0x0004)) {
				out.underline = (style & 0x4) !== 0;
			}
			if (need(0x0010)) {
				out.shadow = (style & 0x10) !== 0;
			}
		}
		if (need(0x10000)) {
			out.fontRef = c.u16();
		}
		if (need(0x200000)) {
			c.u16(); // oldEAFontRef
		}
		if (need(0x400000)) {
			const ansiRef = c.u16();
			if (out.fontRef === undefined) {
				out.fontRef = ansiRef;
			}
		}
		if (need(0x800000)) {
			c.u16(); // symbolFontRef
		}
		if (need(0x20000)) {
			out.sizePt = c.i16();
		}
		if (need(0x40000)) {
			const [r, g, b, idx] = c.bytes4();
			out.colorRgb = resolveColorIndex(r, g, b, idx, scheme);
		}
		if (need(0x80000)) {
			c.i16(); // position
		}
	} catch {
		return false;
	}
	return true;
}

/**
 * Parse a single TextPFException at an absolute offset.
 * Used by the TextMasterStyleAtom parser.
 *
 * @returns The parsed props and the offset after the exception, or
 *   undefined on malformed input.
 */
export function parsePfExceptionAt(
	view: DataView,
	pos: number,
	end: number,
	scheme: PptColorScheme,
): { props: PptParagraphProps; next: number } | undefined {
	const c = new Cursor(view, pos, end);
	const props: PptParagraphProps = { count: 0, indentLevel: 0 };
	if (!parsePfException(c, scheme, props)) {
		return undefined;
	}
	return { props, next: c.pos };
}

/**
 * Parse a single TextCFException at an absolute offset.
 * Used by the TextMasterStyleAtom parser.
 */
export function parseCfExceptionAt(
	view: DataView,
	pos: number,
	end: number,
	scheme: PptColorScheme,
): { props: PptCharProps; next: number } | undefined {
	const c = new Cursor(view, pos, end);
	const props: PptCharProps = { count: 0 };
	if (!parseCfException(c, scheme, props)) {
		return undefined;
	}
	return { props, next: c.pos };
}

/**
 * Parse a StyleTextPropAtom's data.
 *
 * @param view - DataView over the stream.
 * @param dataOffset - Offset of the atom's data.
 * @param dataLen - Length of the atom's data.
 * @param textLength - Character count of the associated text (without
 *   the implicit terminator).
 * @param scheme - Active color scheme for resolving indexed colors.
 */
export function parseStyleTextPropAtom(
	view: DataView,
	dataOffset: number,
	dataLen: number,
	textLength: number,
	scheme: PptColorScheme,
): PptStyleRuns {
	const c = new Cursor(view, dataOffset, dataOffset + dataLen);
	const total = textLength + 1;
	const paragraphRuns: PptParagraphProps[] = [];
	const charRuns: PptCharProps[] = [];

	let covered = 0;
	while (covered < total && c.canRead(6)) {
		const count = c.u32();
		const indentLevel = c.u16();
		const props: PptParagraphProps = { count, indentLevel };
		if (!parsePfException(c, scheme, props)) {
			break;
		}
		paragraphRuns.push(props);
		covered += count;
	}

	covered = 0;
	while (covered < total && c.canRead(8)) {
		const count = c.u32();
		const props: PptCharProps = { count };
		if (!parseCfException(c, scheme, props)) {
			break;
		}
		charRuns.push(props);
		covered += count;
	}

	return { paragraphRuns, charRuns };
}
