/**
 * notes-style-cascade.ts: pure resolver that turns a notes master's
 * `<p:notesStyle>` (parsed by core into {@link PptxTextStyleLevels}) into a
 * framework-neutral descriptor the notes-rendering surfaces can apply.
 *
 * `<p:notesStyle>` is a `CT_TextListStyle` (ECMA-376 SS19.3.1.34): the same
 * `a:defPPr` + `a:lvl1pPr`..`a:lvl9pPr` shape `p:titleStyle` / `p:bodyStyle` /
 * `p:otherStyle` use on a slide master, keyed 0-8 with the paragraph default
 * at level -1. Every binding's notes surfaces (the docked speaker-notes
 * editor, "Print Notes Pages", the Notes Master schematic canvas) share this
 * one cascade instead of re-deriving it, so an authored deck's notes-text
 * defaults reach all five without duplicating the lookup.
 *
 * `PlaceholderTextLevelStyle.fontSize` is stored in CSS pixels (the
 * convention every other consumer of that type uses); {@link TextStyle}
 * expects points, so {@link resolveNotesLevelStyle} converts once here rather
 * than leaving every call site to remember the unit mismatch.
 */

import type { PptxTextStyleLevels, TextSegment, TextStyle } from 'pptx-viewer-core';

/** CSS pixels per point (96 px/in / 72 pt/in), inverted. */
const PX_TO_PT = 0.75;

/**
 * Fallback notes-text font size (points) used when the deck has no authored
 * `<p:notesStyle>` (or the resolved level omits a font size). Shared by the
 * print builder ({@link "./notes-print"}) and the Notes Master schematic
 * preview ({@link resolveNotesSchematicBodyFontSizePx}) so both surfaces fall
 * back to the same default instead of drifting independently.
 */
export const DEFAULT_NOTES_FONT_SIZE_PT = 9;

/**
 * The subset of a notes-style level's authored defaults the notes-rendering
 * surfaces understand. Fields are omitted (not `undefined`-valued) when the
 * deck's `<p:notesStyle>` does not define them at the resolved level, so a
 * caller can spread this directly without clobbering an explicit value with
 * `undefined`.
 */
export interface NotesLevelStyleDescriptor {
	fontFamily?: string;
	/** In points, matching {@link TextStyle.fontSize}. */
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	/** Paragraph left margin in CSS pixels, matching {@link TextStyle.paragraphMarginLeft}. */
	marginLeft?: number;
}

function definedEntries(
	descriptor: NotesLevelStyleDescriptor,
): Array<[keyof NotesLevelStyleDescriptor, unknown]> {
	return (Object.entries(descriptor) as Array<[keyof NotesLevelStyleDescriptor, unknown]>).filter(
		([, value]) => value !== undefined,
	);
}

/**
 * Resolve the notes-text defaults for one outline level (0-8), falling back
 * to the list's own paragraph default (`a:defPPr`, stored at level -1) for
 * any field the level itself does not set.
 *
 * Returns `{}` when `notesStyle` is absent (no authored `<p:notesStyle>`, the
 * common case), so callers can apply the result unconditionally without a
 * presence check of their own.
 */
export function resolveNotesLevelStyle(
	notesStyle: PptxTextStyleLevels | undefined,
	level = 0,
): NotesLevelStyleDescriptor {
	if (!notesStyle) {
		return {};
	}
	const own = notesStyle[level];
	const fallback = notesStyle[-1];
	const descriptor: NotesLevelStyleDescriptor = {
		fontFamily: own?.fontFamily ?? fallback?.fontFamily,
		fontSize:
			own?.fontSize !== undefined
				? own.fontSize * PX_TO_PT
				: fallback?.fontSize !== undefined
					? fallback.fontSize * PX_TO_PT
					: undefined,
		bold: own?.bold ?? fallback?.bold,
		italic: own?.italic ?? fallback?.italic,
		color: own?.color ?? fallback?.color,
		marginLeft: own?.marginLeft ?? fallback?.marginLeft,
	};
	// Drop `undefined`-valued keys rather than returning them: callers spread
	// this object onto a style record for gap-filling only.
	return Object.fromEntries(definedEntries(descriptor)) as NotesLevelStyleDescriptor;
}

/**
 * Fill the gaps in a run's style with the resolved notes-style descriptor,
 * without ever overriding a value the run (or an earlier merge) already set.
 */
function mergeStyleDefaults(style: TextStyle, descriptor: NotesLevelStyleDescriptor): TextStyle {
	if (Object.keys(descriptor).length === 0) {
		return style;
	}
	const merged: TextStyle = { ...style };
	if (merged.fontSize === undefined && descriptor.fontSize !== undefined) {
		merged.fontSize = descriptor.fontSize;
	}
	if (merged.fontFamily === undefined && descriptor.fontFamily !== undefined) {
		merged.fontFamily = descriptor.fontFamily;
	}
	if (merged.bold === undefined && descriptor.bold !== undefined) {
		merged.bold = descriptor.bold;
	}
	if (merged.italic === undefined && descriptor.italic !== undefined) {
		merged.italic = descriptor.italic;
	}
	if (merged.color === undefined && descriptor.color !== undefined) {
		merged.color = descriptor.color;
	}
	if (merged.paragraphMarginLeft === undefined && descriptor.marginLeft !== undefined) {
		merged.paragraphMarginLeft = descriptor.marginLeft;
	}
	return merged;
}

/**
 * Apply the deck's notes-style level-0 defaults to every non-break segment
 * that does not already carry an explicit value for a given field.
 *
 * The notes editor's simplified paragraph model does not currently retain
 * each paragraph's authored `@lvl` (only a UI indent level unrelated to the
 * OOXML outline level), so every paragraph in the notes body resolves
 * against level 0 - the level PowerPoint's own Notes Page uses for
 * unindented speaker notes, and the level almost every authored deck sets.
 * `resolveNotesLevelStyle` still resolves any of the nine levels; wiring a
 * genuine per-paragraph level through the segment model is future work.
 */
export function applyNotesLevelDefaults(
	segments: TextSegment[],
	descriptor: NotesLevelStyleDescriptor,
): TextSegment[] {
	if (Object.keys(descriptor).length === 0) {
		return segments;
	}
	return segments.map((segment) =>
		segment.isParagraphBreak
			? segment
			: { ...segment, style: mergeStyleDefaults(segment.style, descriptor) },
	);
}

/**
 * Resolve the font size (CSS px) for the Notes Master schematic preview's
 * body-placeholder label, honouring the deck's authored `<p:notesStyle>`
 * level-0 default instead of a fixed clamp untethered from it.
 *
 * Every binding's Notes Master schematic (`NotesMasterCanvas` / equivalent)
 * draws the notes page shrunk to fit a sidebar preview. `scale` is that
 * preview's ratio to the page's real CSS-px dimensions (e.g. the same `scale`
 * each canvas already computes from `canvasSize` vs. the authored page size).
 * This resolves the *real* body font size in px at 1:1 first
 * (`resolveNotesLevelStyle` -> pt -> px), THEN multiplies by `scale` - the
 * schematic zoom is applied on top of the resolved style, never as a
 * replacement for it, so a deck authoring a large or small notes default
 * visibly differs in the preview.
 *
 * `minPx` is a legibility floor only (default 6): at very small preview
 * scales even a normally-sized authored font would round to an illegible
 * sub-pixel value, so the floor guarantees a readable label. It never
 * overrides a resolved size that is already larger.
 */
export function resolveNotesSchematicBodyFontSizePx(
	notesStyle: PptxTextStyleLevels | undefined,
	scale: number,
	minPx = 6,
): number {
	const descriptor = resolveNotesLevelStyle(notesStyle, 0);
	const fontSizePt = descriptor.fontSize ?? DEFAULT_NOTES_FONT_SIZE_PT;
	const fullSizePx = fontSizePt / PX_TO_PT;
	return Math.max(minPx, fullSizePx * scale);
}
