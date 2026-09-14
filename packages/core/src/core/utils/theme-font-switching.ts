/**
 * Theme font re-resolution: patches the concrete typefaces on already-parsed
 * text when the theme's font scheme changes.
 *
 * Parsing flattens `+mj-lt` / `+mn-lt` style tokens into the concrete face
 * held in `TextStyle.fontFamily` (the token itself survives as
 * `latinFontThemeToken` when it was authored on the run). The renderer reads
 * the flattened face, so swapping `theme.fontScheme` alone leaves every run
 * painted in the previous theme's fonts until the deck is reloaded. This
 * module is the font twin of `theme-switching.ts`'s colour remap: pure
 * functions that return new slide/element objects with the faces re-resolved
 * against the new scheme.
 *
 * Two kinds of run are updated:
 * - a run carrying a theme token is re-resolved from that token, which is
 *   exactly what PowerPoint does;
 * - a run without a token whose face equals the OLD scheme's face for its
 *   role (title placeholders use the major font, everything else the minor
 *   font) is treated as an inherited theme font and moved to the new face.
 *   Explicitly authored faces that differ from the old theme face are left
 *   alone.
 *
 * @module utils/theme-font-switching
 */

import type {
	PptxElement,
	PptxSlide,
	PptxTableData,
	PptxThemeFontScheme,
	TextSegment,
	TextStyle,
} from '../types';

type ThemeFontRole = 'major' | 'minor';
type ThemeFontScript = 'latin' | 'eastAsia' | 'complexScript';

const TOKEN_PATTERN = /^\+(mj|mn)-(lt|ea|cs)$/u;

function normalizeFace(face: string | undefined): string {
	return face?.trim().toLowerCase() ?? '';
}

/** The scheme's face for `role`/`script`, falling back to the Latin face. */
function themeFace(
	scheme: PptxThemeFontScheme | undefined,
	role: ThemeFontRole,
	script: ThemeFontScript,
): string | undefined {
	const group = role === 'major' ? scheme?.majorFont : scheme?.minorFont;
	return group?.[script] || group?.latin;
}

/** Parse a theme font token such as `+mj-lt` into its role and script. */
function parseThemeFontToken(
	token: string | undefined,
): { role: ThemeFontRole; script: ThemeFontScript } | undefined {
	const match = token?.trim().toLowerCase().match(TOKEN_PATTERN);
	if (!match) {
		return undefined;
	}
	const role: ThemeFontRole = match[1] === 'mj' ? 'major' : 'minor';
	const script: ThemeFontScript =
		match[2] === 'ea' ? 'eastAsia' : match[2] === 'cs' ? 'complexScript' : 'latin';
	return { role, script };
}

/**
 * The theme font role a placeholder inherits: title placeholders take the
 * major font, every other placeholder the minor font. Free-standing text
 * boxes return `undefined` so only a run's own token can move their face.
 */
function placeholderFontRole(element: PptxElement): ThemeFontRole | undefined {
	const placeholderType = (element as { placeholderType?: string }).placeholderType
		?.trim()
		.toLowerCase();
	if (!placeholderType) {
		return undefined;
	}
	return placeholderType === 'title' || placeholderType === 'ctrtitle' ? 'major' : 'minor';
}

/**
 * The new face for one script slot, or `undefined` when the slot should keep
 * its current value.
 */
function resolveFace(
	current: string | undefined,
	token: string | undefined,
	script: ThemeFontScript,
	oldScheme: PptxThemeFontScheme | undefined,
	newScheme: PptxThemeFontScheme,
	fallbackRole: ThemeFontRole | undefined,
): string | undefined {
	const parsed = parseThemeFontToken(token);
	if (parsed) {
		const linked = themeFace(newScheme, parsed.role, parsed.script);
		return linked && linked !== current ? linked : undefined;
	}
	if (!fallbackRole || !current) {
		return undefined;
	}
	const oldFace = themeFace(oldScheme, fallbackRole, script);
	const newFace = themeFace(newScheme, fallbackRole, script);
	if (!oldFace || !newFace || normalizeFace(current) !== normalizeFace(oldFace)) {
		return undefined;
	}
	return newFace !== current ? newFace : undefined;
}

/**
 * Re-resolve the Latin, East Asian and complex-script faces of one style.
 * Returns the same object when nothing changes.
 */
function remapTextStyleFonts(
	style: TextStyle,
	oldScheme: PptxThemeFontScheme | undefined,
	newScheme: PptxThemeFontScheme,
	fallbackRole: ThemeFontRole | undefined,
): TextStyle {
	const latin = resolveFace(
		style.fontFamily,
		style.latinFontThemeToken,
		'latin',
		oldScheme,
		newScheme,
		fallbackRole,
	);
	const eastAsia = resolveFace(
		style.eastAsiaFont,
		style.eastAsiaFontThemeToken,
		'eastAsia',
		oldScheme,
		newScheme,
		fallbackRole,
	);
	const complexScript = resolveFace(
		style.complexScriptFont,
		style.complexScriptFontThemeToken,
		'complexScript',
		oldScheme,
		newScheme,
		fallbackRole,
	);
	if (latin === undefined && eastAsia === undefined && complexScript === undefined) {
		return style;
	}
	return {
		...style,
		...(latin !== undefined && { fontFamily: latin }),
		...(eastAsia !== undefined && { eastAsiaFont: eastAsia }),
		...(complexScript !== undefined && { complexScriptFont: complexScript }),
	};
}

function remapSegmentFonts(
	segments: TextSegment[],
	oldScheme: PptxThemeFontScheme | undefined,
	newScheme: PptxThemeFontScheme,
	fallbackRole: ThemeFontRole | undefined,
): TextSegment[] {
	let changed = false;
	const next = segments.map((segment) => {
		if (!segment.style) {
			return segment;
		}
		const style = remapTextStyleFonts(segment.style, oldScheme, newScheme, fallbackRole);
		if (style === segment.style) {
			return segment;
		}
		changed = true;
		return { ...segment, style };
	});
	return changed ? next : segments;
}

function remapTableFonts(
	tableData: PptxTableData,
	oldScheme: PptxThemeFontScheme | undefined,
	newScheme: PptxThemeFontScheme,
): PptxTableData {
	let changed = false;
	const rows = tableData.rows.map((row) => {
		let rowChanged = false;
		const cells = row.cells.map((cell) => {
			const face = resolveFace(
				cell.style?.fontFamily,
				undefined,
				'latin',
				oldScheme,
				newScheme,
				'minor',
			);
			if (face === undefined) {
				return cell;
			}
			rowChanged = true;
			return { ...cell, style: { ...cell.style, fontFamily: face } };
		});
		if (!rowChanged) {
			return row;
		}
		changed = true;
		return { ...row, cells };
	});
	return changed ? { ...tableData, rows } : tableData;
}

function remapElementFonts(
	element: PptxElement,
	oldScheme: PptxThemeFontScheme | undefined,
	newScheme: PptxThemeFontScheme,
): PptxElement {
	const patched = { ...element } as Record<string, unknown>;
	let changed = false;
	const fallbackRole = placeholderFontRole(element);

	if ('textStyle' in element && element.textStyle) {
		const textStyle = remapTextStyleFonts(element.textStyle, oldScheme, newScheme, fallbackRole);
		if (textStyle !== element.textStyle) {
			patched.textStyle = textStyle;
			changed = true;
		}
	}
	if ('textSegments' in element && element.textSegments) {
		const textSegments = remapSegmentFonts(
			element.textSegments,
			oldScheme,
			newScheme,
			fallbackRole,
		);
		if (textSegments !== element.textSegments) {
			patched.textSegments = textSegments;
			changed = true;
		}
	}
	if (element.type === 'group' && element.children) {
		const children = reResolveElementFonts(element.children, oldScheme, newScheme);
		if (children !== element.children) {
			patched.children = children;
			changed = true;
		}
	}
	if (element.type === 'table' && element.tableData) {
		const tableData = remapTableFonts(element.tableData, oldScheme, newScheme);
		if (tableData !== element.tableData) {
			patched.tableData = tableData;
			changed = true;
		}
	}
	return changed ? (patched as unknown as PptxElement) : element;
}

/**
 * Re-resolve theme-linked fonts across a flat element list (a slide's
 * elements, or the separately rendered master/layout layer some bindings keep
 * per slide). Returns the input array when nothing changed.
 */
export function reResolveElementFonts(
	elements: PptxElement[],
	oldFontScheme: PptxThemeFontScheme | undefined,
	newFontScheme: PptxThemeFontScheme,
): PptxElement[] {
	let changed = false;
	const next = elements.map((element) => {
		const remapped = remapElementFonts(element, oldFontScheme, newFontScheme);
		if (remapped !== element) {
			changed = true;
		}
		return remapped;
	});
	return changed ? next : elements;
}

/**
 * Re-resolve theme-linked fonts across all slides (elements, speaker notes
 * and notes shapes) when the font scheme changes. Slides whose fonts are
 * unaffected are returned as the same object.
 */
export function reResolveSlideFonts(
	slides: PptxSlide[],
	oldFontScheme: PptxThemeFontScheme | undefined,
	newFontScheme: PptxThemeFontScheme,
): PptxSlide[] {
	let changed = false;
	const next = slides.map((slide) => {
		const elements = reResolveElementFonts(slide.elements, oldFontScheme, newFontScheme);
		const notesSegments = slide.notesSegments
			? remapSegmentFonts(slide.notesSegments, oldFontScheme, newFontScheme, 'minor')
			: slide.notesSegments;
		const notesShapes = slide.notesShapes
			? reResolveElementFonts(slide.notesShapes, oldFontScheme, newFontScheme)
			: slide.notesShapes;
		if (
			elements === slide.elements &&
			notesSegments === slide.notesSegments &&
			notesShapes === slide.notesShapes
		) {
			return slide;
		}
		changed = true;
		return { ...slide, elements, notesSegments, notesShapes };
	});
	return changed ? next : slides;
}
