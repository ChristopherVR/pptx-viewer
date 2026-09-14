/**
 * Which `TextStyle` keys belong to the text BODY and which to a RUN.
 *
 * `TextStyle` is one bag for three OOXML levels (`a:bodyPr`, `a:pPr`, `a:rPr`).
 * The block builder (`text-block-style.ts`, `text-body-layout.ts`) reads the
 * body-level keys from `element.textStyle` only; a run's style never carries
 * them anywhere the renderer looks. So when an inline selection is active and
 * a binding routes the WHOLE update through the selected runs, an Increase
 * Indent (`paragraphMarginLeft`) or a vertical-alignment change lands on run
 * styles nobody reads and nothing happens on screen.
 *
 * `splitTextStyleUpdate` partitions an update so a binding can merge the body
 * half into `element.textStyle` regardless of selection and scope only the
 * run half to the selected characters. `reconcileDecorationFlags` keeps the
 * body-level decoration honest after a run-scoped edit, so the block's CSS
 * `text-decoration` cannot keep painting underline over a run that was just
 * un-underlined.
 */

import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import type { TextDecorationFlag } from './selection-format-state';
import { isContentSegment } from './selection-format-state';

/**
 * Keys read from `element.textStyle` only: `a:bodyPr` attributes, the text
 * warp / 3D scene, autofit, and the paragraph geometry the block builder
 * folds in as the body-wide fallback (indent, margins, spacing).
 */
export const BODY_TEXT_STYLE_KEYS: ReadonlySet<keyof TextStyle> = new Set<keyof TextStyle>([
	// autofit (`a:normAutofit` / `a:spAutoFit`)
	'autoFit',
	'autoFitMode',
	'autoFitFontScale',
	'autoFitLineSpacingReduction',
	// `a:bodyPr` anchoring, direction, rotation
	'vAlign',
	'anchorCenter',
	'textDirection',
	'textBodyRotation',
	'upright',
	// `a:bodyPr` columns, overflow, wrap
	'columnCount',
	'columnSpacing',
	'rtlColumns',
	'hOverflow',
	'vertOverflow',
	'textWrap',
	// `a:bodyPr` insets
	'bodyInsetLeft',
	'bodyInsetTop',
	'bodyInsetRight',
	'bodyInsetBottom',
	// paragraph geometry the block applies body-wide
	'paragraphMarginLeft',
	'paragraphMarginRight',
	'paragraphIndent',
	'paragraphSpacingBefore',
	'paragraphSpacingAfter',
	'lineSpacing',
	'lineSpacingExactPt',
	'tabStops',
	'defaultTabSize',
	'eaLineBreak',
	'latinLineBreak',
	'fontAlignment',
	'hangingPunctuation',
	// `a:bodyPr` flags
	'spaceFirstLastParagraph',
	'fromWordArt',
	'forceAntiAlias',
	'compatibleLineSpacing',
	// warp and 3D scene on the body
	'textWarpPreset',
	'textWarpAdj',
	'textWarpAdj2',
	'text3d',
	'textBodyScene3d',
	'textBodyScene3dXml',
	'flatText',
	'bodyPropertiesExtLstXml',
]);

/** Whether `key` is read from the element body rather than a run. */
export function isBodyTextStyleKey(key: string): boolean {
	return BODY_TEXT_STYLE_KEYS.has(key as keyof TextStyle);
}

/** An update partitioned by the level the renderer reads each key from. */
export interface TextStyleUpdateSplit {
	/** Keys to merge into `element.textStyle` regardless of any selection. */
	body: Partial<TextStyle>;
	/** Keys to scope to the selected runs (or every run without a selection). */
	run: Partial<TextStyle>;
}

/** Partition `updates` into its body-level and run-level halves. Keys set to `undefined` (clears) are kept. */
export function splitTextStyleUpdate(updates: Partial<TextStyle>): TextStyleUpdateSplit {
	const body: Record<string, unknown> = {};
	const run: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(updates)) {
		(isBodyTextStyleKey(key) ? body : run)[key] = value;
	}
	return { body: body as Partial<TextStyle>, run: run as Partial<TextStyle> };
}

/**
 * Recompute the body-level value of each `flag` from the runs after a
 * run-scoped edit: `true` only when every content run is effectively on;
 * otherwise the body flag is dropped, and any run that was only inheriting it
 * gets it written explicitly so its own look does not change.
 */
export function reconcileDecorationFlags(
	segments: readonly TextSegment[],
	textStyle: TextStyle | undefined,
	flags: readonly TextDecorationFlag[],
): { textStyle: TextStyle; textSegments: TextSegment[] } {
	const nextStyle: TextStyle = { ...(textStyle ?? {}) };
	let nextSegments: TextSegment[] = [...segments];
	for (const flag of flags) {
		const body = nextStyle[flag] ?? false;
		const content = nextSegments.filter(isContentSegment);
		if (content.length === 0) {
			continue;
		}
		if (content.every((segment) => segment.style?.[flag] ?? body)) {
			nextStyle[flag] = true;
			continue;
		}
		if (!body) {
			continue;
		}
		delete nextStyle[flag];
		nextSegments = nextSegments.map((segment) =>
			isContentSegment(segment) && segment.style?.[flag] === undefined
				? { ...segment, style: { ...segment.style, [flag]: true } }
				: segment,
		);
	}
	return { textStyle: nextStyle, textSegments: nextSegments };
}
