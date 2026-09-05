/**
 * Per-run extras layered onto a {@link BuiltRun} by `paragraph-run-build.ts`:
 * per-script font spans, measured tab-stop layout, and the `a:reflection`
 * mirrored-sibling wrapper. Split out to keep that module focused on the
 * run-splitting pipeline itself.
 *
 * The script/tab extras were React-only before this module existed
 * (`text-segment-render` / `text-tab-layout.tsx`); they now reach all five
 * bindings through the same `BuiltRun` fields React itself consumes.
 */

import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { ReflectionWrapperStyle } from './reflection';
import { getTextReflectionWrapperStyle } from './reflection';
import type { RunFontSpec } from './text-metric-tracking';
import { nestedTextDecorationStyle } from './text-run-decoration';
import type { RunStyle } from './text-run-style';
import type { ScriptFontFields, ScriptFontPiece } from './text-script-fonts';
import { resolveScriptFontSet, splitRunByScriptFont } from './text-script-fonts';
import type { TabRenderContext, TabStopSpec } from './text-tab-layout';
import { buildTabContext } from './text-tab-layout';
import type { TabbedLineRun } from './text-tab-run-build';
import { buildRunTabLines } from './text-tab-run-build';

/** The two per-run extras a rendered piece may carry. */
export interface RunExtras {
	scriptRuns?: ScriptFontPiece[];
	tabLines?: TabbedLineRun[];
}

/** Everything {@link resolveRunExtrasContext} needs from the paragraph builder. */
export interface RunExtrasInput {
	seg: TextSegment;
	style: RunStyle;
	runFont: RunFontSpec;
	blockFont: RunFontSpec;
	blockScriptStyle: ScriptFontFields | undefined;
	tabStops: TabStopSpec[] | undefined;
	defaultTabSize: number | undefined;
}

/** Per-segment context, resolved once and reused across a run's word pieces. */
export interface RunExtrasContext {
	scriptFonts: ReturnType<typeof resolveScriptFontSet>;
	baseFontFamily: string;
	tabContext: TabRenderContext | undefined;
}

/**
 * Resolve the per-script font set and (when the segment declares tab stops) a
 * measurement context, once per segment rather than once per word-piece.
 */
export function resolveRunExtrasContext(input: RunExtrasInput): RunExtrasContext {
	const { seg, runFont, blockFont, blockScriptStyle, tabStops, defaultTabSize } = input;
	const baseFontFamily = runFont.fontFamily ?? blockFont.fontFamily ?? DEFAULT_FONT_FAMILY;
	const scriptFonts = resolveScriptFontSet(seg.style, blockScriptStyle, baseFontFamily);
	const tabContext =
		tabStops && tabStops.length > 0
			? buildTabContext(
					tabStops,
					defaultTabSize,
					runFont.fontSizePx ?? blockFont.fontSizePx ?? DEFAULT_TEXT_FONT_SIZE,
					baseFontFamily,
					Boolean(seg.style?.bold),
					Boolean(seg.style?.italic),
				)
			: undefined;
	return { scriptFonts, baseFontFamily, tabContext };
}

/**
 * Attach the tab-layout extra for a piece of text that contains `\t`, or
 * `undefined` when the segment authors no tab stops (the common case).
 */
export function buildTabLinesFor(
	text: string,
	ctx: RunExtrasContext,
	style: RunStyle,
	underlineWords = false,
): TabbedLineRun[] | undefined {
	if (!ctx.tabContext || !text.includes('\t')) {
		return undefined;
	}
	return buildRunTabLines(
		text,
		ctx.tabContext,
		nestedTextDecorationStyle(style),
		undefined,
		underlineWords,
	);
}

/**
 * Attach the per-script font split for a piece of text, or `undefined` when
 * the run declares no script font distinct from its own `a:latin` face.
 */
export function buildScriptRunsFor(
	text: string,
	ctx: RunExtrasContext,
	style: RunStyle,
): ScriptFontPiece[] | undefined {
	return splitRunByScriptFont(
		text,
		ctx.scriptFonts,
		ctx.baseFontFamily,
		nestedTextDecorationStyle(style),
	);
}

/**
 * `a:reflection` mirrored-sibling wrapper for a segment's runs, or `undefined`
 * for the common no-reflection case. `-webkit-box-reflect`'s old scope never
 * reached the equation branch above it in `buildParagraphRuns` (it `continue`s
 * before this is even called), so this only ever needs to be attached to a
 * ruby run, a tab-lines run, or a per-word metric-split piece - never an
 * equation.
 *
 * The element-height argument approximates the run's own box with its font
 * size (matching the ruby-annotation fallback size right above this call
 * site): `getTextReflectionWrapperStyle` only uses it for `@endPos`, which
 * core's text-run parser does not extract yet (see `reflection.ts`'s module
 * doc), so it is currently inert for text - kept anyway so a text reflection
 * measures sensibly the day that parser gap closes.
 */
export function resolveRunReflection(
	segStyle: TextStyle | undefined,
	blockFont: RunFontSpec,
): ReflectionWrapperStyle | undefined {
	if (!segStyle) {
		return undefined;
	}
	const height =
		typeof segStyle.fontSize === 'number'
			? segStyle.fontSize
			: (blockFont.fontSizePx ?? DEFAULT_TEXT_FONT_SIZE);
	return getTextReflectionWrapperStyle(segStyle, height);
}

/**
 * Set `run.reflection` on a `BuiltRun`-shaped object when a reflection was
 * resolved by {@link resolveRunReflection}; a one-line no-op otherwise. `T` is
 * `paragraph-run-build.ts`'s `BuiltRun` (kept generic here so this module does
 * not have to import that type back from its own caller).
 */
export function applyRunReflection<T extends { reflection?: ReflectionWrapperStyle }>(
	run: T,
	reflection: ReflectionWrapperStyle | undefined,
): void {
	if (reflection) {
		run.reflection = reflection;
	}
}
