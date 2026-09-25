/**
 * `PptxMasterTextStyles` (a slide master's parsed `p:txStyles`) ->
 * `WMasterTextStyles` for the `.ppt` writer's main-master
 * `TextMasterStyleAtom`s.
 *
 * Units follow the rest of the typed model: `fontSize`, `marginLeft` and
 * `indent` are CSS px (the `.pptx` save writes `sz` as px * 72 / 96 and
 * `marL` as px * 9525), so they are converted back to points and EMU here.
 *
 * @module ppt/writer/master-style-convert
 */

import { EMU_PER_PX } from '../../constants';
import type { PlaceholderTextLevelStyle } from '../../types/element-base';
import type { PptxMasterTextStyles, PptxTextStyleLevels } from '../../types/masters';
import type { WMasterLevel, WMasterTextStyles, WParagraph } from './write-model';

/** A binary `.ppt` master style holds five indent levels. */
const PPT_MASTER_LEVELS = 5;

/** PowerPoint writes a title master style with one level (COM-measured). */
const TITLE_LEVELS = 1;

const ALIGN_MAP: Record<string, WParagraph['align']> = {
	left: 'l',
	l: 'l',
	center: 'ctr',
	ctr: 'ctr',
	right: 'r',
	r: 'r',
	justify: 'just',
	just: 'just',
	justLow: 'just',
	dist: 'just',
	thaiDist: 'just',
};

function fontNameOf(style: PlaceholderTextLevelStyle): string | undefined {
	const family = style.resolvedFontFamily ?? style.fontFamily;
	// An unresolved theme token (`+mj-lt`) names no real face.
	return family && !family.startsWith('+') ? family : undefined;
}

function hexOf(color: string | undefined): string | undefined {
	const hex = color?.replace(/^#/u, '');
	return hex && /^[0-9a-f]{6}$/iu.test(hex) ? hex.toUpperCase() : undefined;
}

function toLevel(style: PlaceholderTextLevelStyle = {}): WMasterLevel {
	const bulletChar = style.bulletNone ? undefined : style.bulletChar;
	return {
		paragraph: {
			align: style.alignment ? ALIGN_MAP[style.alignment] : undefined,
			hasBullet: style.bulletNone ? false : bulletChar ? true : undefined,
			bulletChar,
			bulletColorRgb: hexOf(style.bulletColor),
			marginLeftEmu: style.marginLeft !== undefined ? style.marginLeft * EMU_PER_PX : undefined,
			indentEmu: style.indent !== undefined ? style.indent * EMU_PER_PX : undefined,
		},
		// Explicit, as PowerPoint's own master levels are (full CF masks): a
		// binary master level otherwise inherits bold/italic from the level
		// above it, unlike an OOXML `a:lvlNpPr`.
		run: {
			bold: style.bold ?? false,
			italic: style.italic ?? false,
			underline: false,
			sizePt: style.fontSize !== undefined ? (style.fontSize * 72) / 96 : undefined,
			colorRgb: hexOf(style.color),
			fontName: fontNameOf(style),
		},
	};
}

/**
 * Levels 0..4 of one category, or `undefined` when it defines none. The
 * `-1` (`a:defPPr`) entry fills in any property a level leaves unset.
 */
function toLevels(
	levels: PptxTextStyleLevels | undefined,
	count: number,
): WMasterLevel[] | undefined {
	if (!levels) {
		return undefined;
	}
	const defined = [0, 1, 2, 3, 4].filter((i) => levels[i] !== undefined);
	if (defined.length === 0) {
		return undefined;
	}
	const base = levels[-1];
	return Array.from({ length: count }, (_, i) =>
		toLevel(base || levels[i] ? { ...base, ...levels[i] } : undefined),
	);
}

/** Convert a master's text styles, or `undefined` when it has none. */
export function convertMasterTextStyles(
	styles: PptxMasterTextStyles | undefined,
): WMasterTextStyles | undefined {
	if (!styles) {
		return undefined;
	}
	const out: WMasterTextStyles = {
		title: toLevels(styles.titleStyle, TITLE_LEVELS),
		body: toLevels(styles.bodyStyle, PPT_MASTER_LEVELS),
		other: toLevels(styles.otherStyle, PPT_MASTER_LEVELS),
	};
	return out.title || out.body || out.other ? out : undefined;
}

/** Every font a master style names, for the document's `FontCollection`. */
export function masterStyleFonts(styles: WMasterTextStyles | undefined): string[] {
	if (!styles) {
		return [];
	}
	return [styles.title, styles.body, styles.other]
		.flatMap((levels) => levels ?? [])
		.map((level) => level.run.fontName)
		.filter((name): name is string => Boolean(name));
}
