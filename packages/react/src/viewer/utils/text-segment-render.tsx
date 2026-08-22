import { getSubstituteFontFamily, parsePanoseString } from 'pptx-viewer-core';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import {
	hollowTextFillStyle,
	nestedTextDecorationStyle,
	pieceLetterSpacing,
	resolveAutoFitFontScale,
	resolveFontKerning,
	resolveMetricTrackingPx,
	resolveScriptFontSet,
} from 'pptx-viewer-shared';
import type { ParagraphRun } from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_FONT_FAMILY, HYPERLINK_COLOR } from '../constants';
import { normalizeHexColor } from './color';
import { renderSegmentContent, renderEquationSegment } from './text-segment-helpers';
import type { ElementFindHighlights } from './text-segment-helpers';
import { renderHyperlink } from './text-segment-hyperlink';
import { wrapWithTextReflection } from './text-segment-reflection';
import { buildTabContext } from './text-tab-layout';
import { hasDistinctScriptFonts } from './unicode-script-detection';

/** Super/subscript glyphs render at ~65% of the run font size (matches shared). */
const BASELINE_FONT_SCALE = 0.65;

/** What a run needs from its surroundings to render. */
export interface RunRenderContext {
	element: PptxElement & Partial<{ textStyle: TextStyle }>;
	/** Colour a run with no resolved colour of its own falls back to. */
	fallbackColor: string;
	/** Find & Replace matches, keyed by source segment index. */
	findHighlights?: ElementFindHighlights;
	/** Handler for a followed link; without it a link renders as plain text. */
	onHyperlinkClick?: (url: string) => void;
	/** The paragraph's resolved BiDi direction, for per-run overrides. */
	paragraphRtl?: boolean;
	/** When true, hyperlinks require Ctrl+Click (editing mode). */
	requireCtrlClick?: boolean;
}

/**
 * Render one run of a paragraph as a styled `<span>`.
 *
 * The run and its CSS come from shared `buildParagraphs`, which is where every
 * decision the five bindings share now lives (paragraph grouping, bullets,
 * spacing, run splitting, hyperlink, inline equation, and the whole
 * `a:rPr` -> CSS map). This function layers on ONLY the properties React
 * resolves more precisely than the neutral builder, plus the content-level
 * rendering that has no equivalent in the other four bindings (find-match
 * highlights, per-script font spans, real tab stops, ruby).
 *
 * The residual overrides, and why each is still here rather than in shared:
 *
 *  - `color` / `fontSize` / `fontFamily`: React resolves the run's own value
 *    against the TEXT BODY's before falling back, and substitutes the font
 *    through its PANOSE descriptor. Shared declares each only when the run
 *    authored it and lets the block declaration cascade instead.
 *  - `verticalAlign`: `a:rPr/@baseline` is a percentage, so React shifts by
 *    that fraction of the font size; shared emits the `super` / `sub` keyword.
 *  - `fontKerning`: `@kern` is a THRESHOLD (kern at or above this size), which
 *    React honours and shared reduces to on/off.
 *  - `letterSpacing`: measured against the PANOSE-substituted family above, so
 *    it has to be re-derived from the same font this span will paint with.
 *  - per-run `direction` / `unicodeBidi`: no shared equivalent yet.
 *
 * Each is a shared GAP, not a React preference; closing them is the next step
 * and would delete the corresponding branch here.
 */
export function renderParagraphRun(
	run: ParagraphRun,
	segment: TextSegment | undefined,
	ctx: RunRenderContext,
	/** Disambiguates the key when one run is re-rendered in pieces (text build). */
	keySuffix = '',
): React.ReactNode {
	const { element, fallbackColor, findHighlights, onHyperlinkClick } = ctx;
	const segmentIndex = run.segmentIndex ?? 0;
	const key = `${element.id}-seg-${segmentIndex}${keySuffix}`;

	// Inline equation (`m:oMath`): the run has no text, the maths is the content.
	if (run.equation) {
		return renderEquationSegment(element.id, segmentIndex, run.equation.xml, run.equation.number);
	}

	const segmentStyle = segment?.style ?? {};
	const textValue = run.text;
	const lines = textValue.split('\n');

	// A link with no colour of its own paints in PowerPoint's `hlink` blue; the
	// same fallback shared applies to `run.style.color`.
	const resolvedSegmentColor = normalizeHexColor(
		segmentStyle.color || element.textStyle?.color,
		run.hyperlink ? HYPERLINK_COLOR : fallbackColor,
	);

	// Superscript / subscript via baseline shift.
	// OOXML `a:rPr/@baseline` (ST_Percentage) authors the shift magnitude. It is
	// typically stored in thousandths of a percent (30000 = 30%) but some
	// producers emit a bare percent (30). Honour the authored magnitude rather
	// than snapping every shift to a fixed super/sub amount.
	const rawBaseline = typeof segmentStyle.baseline === 'number' ? segmentStyle.baseline : 0;
	const baselineFraction =
		rawBaseline === 0
			? 0
			: Math.abs(rawBaseline) >= 1000
				? rawBaseline / 100000
				: rawBaseline / 100;
	const baselineFontScale = baselineFraction !== 0 ? BASELINE_FONT_SCALE : 1;

	const rawFontSize = (segmentStyle.fontSize ||
		element.textStyle?.fontSize ||
		DEFAULT_TEXT_FONT_SIZE) as number;
	// `a:normAutofit/@fontScale` (e.g. 0.9 = 90%), resolved by the shared helper
	// all five bindings use, so a body that shrinks its text shrinks it alike.
	const baseFontSize = rawFontSize * resolveAutoFitFontScale(element.textStyle);
	const baselineShift = baselineFraction !== 0 ? `${baselineFraction * baseFontSize}px` : undefined;

	// Kerning → CSS font-kerning. OOXML `@kern` is a threshold: kerning applies
	// only at or above the given font size (hundredths of a point); `0` disables
	// kerning outright. Shared now owns the formula (`resolveFontKerning`) so
	// Vue/Angular/Svelte/Vanilla read the threshold too, instead of treating
	// `@kern` as an on/off flag; checked against the run's own unshrunk size
	// (matching this component's pre-existing behaviour), not the super/subscript
	// glyph's visually-reduced size.
	const fontKerning = resolveFontKerning(segmentStyle.kerning, baseFontSize) as
		| React.CSSProperties['fontKerning']
		| undefined;

	const rawFontFamily = segmentStyle.fontFamily || element.textStyle?.fontFamily;
	// PANOSE-based font substitution with fallback chain.
	const baseFontFamily = rawFontFamily
		? getSubstituteFontFamily(
				rawFontFamily,
				parsePanoseString(segmentStyle.latinFontPanose ?? element.textStyle?.latinFontPanose),
			)
		: DEFAULT_FONT_FAMILY;

	// Per-script font info for Unicode font fallback, resolved by shared's
	// `resolveScriptFontSet` (extracted from this file so all five bindings
	// share the SAME substitution + fallback-chain rules). Every entry goes
	// through the SAME substitution as `latin`, for two reasons. The obvious
	// one: a bare `a:ea` name emitted on the inner script span overrides the
	// parent's fallback chain, so a deck whose east-asian font is not installed
	// drops to the browser's default - which for CJK is a serif, where
	// PowerPoint substitutes a sans. The subtle one: the comparison below is by
	// string, so leaving `ea` bare while `latin` carries a chain made an
	// identical typeface look distinct and emitted that clobbering span in the
	// first place.
	const scriptFonts = resolveScriptFontSet(segmentStyle, element.textStyle, baseFontFamily);
	const needsScriptFonts = hasDistinctScriptFonts(scriptFonts);

	// Advance-width compensation on top of any authored spacing, so the browser
	// breaks this run's lines where PowerPoint breaks them (issue #149). Both the
	// split and the per-piece tracking come from shared `splitRunForMetrics`; the
	// value below is the run-level fallback and `metricContext` gives each word
	// its own, which is what makes a LINE exact rather than just the whole run.
	const authoredLetterSpacing =
		typeof segmentStyle.characterSpacing === 'number' && segmentStyle.characterSpacing !== 0
			? (segmentStyle.characterSpacing / 100) * (96 / 72)
			: 0;
	const metricFont = {
		fontFamily: baseFontFamily,
		fontSizePx: baseFontSize * baselineFontScale,
		bold: Boolean(segmentStyle.bold),
		italic: Boolean(segmentStyle.italic),
	};
	// A run's decoration has to be repeated on every span React nests inside it
	// (per-word metric pieces, per-script font spans, find-match marks): CSS draws
	// an ancestor's underline THROUGH its descendants but does not inherit it, so
	// the element that directly parents the text - the one a reader's browser and
	// our parity harness both read - declared `text-decoration-line: none`.
	const nestedStyle = nestedTextDecorationStyle(run.style) as React.CSSProperties | undefined;
	const metricContext = { font: metricFont, authoredPx: authoredLetterSpacing, nestedStyle };

	// Shared owns the run's paint: decorations, caps, highlight, outline stroke,
	// gradient/pattern fill, shadow, filter chain, opacity, reflection and the
	// hollow (`a:noFill`) decision. Only the properties listed in this function's
	// doc comment are re-resolved on top.
	const spanStyle: React.CSSProperties = { ...(run.style as React.CSSProperties) };
	spanStyle.color = resolvedSegmentColor;
	spanStyle.fontSize = baseFontSize * baselineFontScale;
	spanStyle.fontFamily = baseFontFamily;
	spanStyle.verticalAlign = baselineShift;
	spanStyle.fontKerning = fontKerning;
	spanStyle.letterSpacing = pieceLetterSpacing(
		authoredLetterSpacing,
		resolveMetricTrackingPx(textValue, metricFont),
	);

	// Re-apply the shared hollow (`a:rPr > a:noFill`) decision OVER the colour
	// just resolved. Shared already merged it into `run.style`, but the `color`
	// assignment above is unconditional, so it put the inherited colour back and
	// React painted a hollow run blue-with-a-transparent-fill while the other four
	// bindings painted it hollow. The decision function is called with React's own
	// (more precisely resolved) colour, which is also what the outline falls back
	// to when the `a:ln` declared no colour of its own.
	const hollow = hollowTextFillStyle(segmentStyle, {
		color: resolvedSegmentColor,
		textStroke:
			typeof spanStyle.WebkitTextStroke === 'string' ? spanStyle.WebkitTextStroke : undefined,
	});
	if (hollow) {
		Object.assign(spanStyle, hollow);
	}

	// Per-run BiDi direction override. When a run's direction differs from the
	// paragraph's, `bidi-override` forces its characters to follow the run (an
	// LTR brand name inside an RTL paragraph); when it matches but is explicit,
	// `embed` reinforces the level so numbers still render LTR.
	const runRtl = segmentStyle.rtl;
	if (runRtl !== undefined) {
		spanStyle.direction = runRtl ? 'rtl' : 'ltr';
		spanStyle.unicodeBidi = runRtl !== ctx.paragraphRtl ? 'bidi-override' : 'embed';
	}

	const baseContent = renderSegmentContent(
		element.id,
		segmentIndex,
		textValue,
		lines,
		needsScriptFonts,
		scriptFonts,
		baseFontFamily,
		findHighlights,
		buildTabContext(
			element.textStyle?.tabStops,
			element.textStyle?.defaultTabSize,
			baseFontSize,
			baseFontFamily,
			Boolean(segmentStyle.bold),
			Boolean(segmentStyle.italic),
		),
		metricContext,
	);

	const spanNode = (
		<span key={key} data-seg-idx={segmentIndex} style={spanStyle}>
			{renderRubyOrText(run, baseContent)}
		</span>
	);

	const reflectedNode = wrapWithTextReflection(run, key, spanNode, spanStyle, baseContent);

	return run.hyperlink && onHyperlinkClick
		? renderHyperlink(run, reflectedNode, key, ctx)
		: reflectedNode;
}

/**
 * Wrap the run's content in `<ruby>` when it carries a phonetic guide
 * (`a:ruby`, furigana / pinyin), or return it unchanged.
 *
 * The annotation and its style are resolved by shared `resolveRunRuby` and ride
 * the run, so all five bindings render the same markup. This used to read the
 * SEGMENT here, which also meant the reading was repeated over every piece a
 * multi-word segment was split into for metric tracking; shared emits a ruby run
 * whole, so it now appears once.
 */
function renderRubyOrText(run: ParagraphRun, baseContent: React.ReactNode): React.ReactNode {
	if (!run.ruby) {
		return baseContent;
	}
	return (
		<ruby>
			{baseContent}
			<rp>(</rp>
			<rt style={run.ruby.style as React.CSSProperties}>{run.ruby.text}</rt>
			<rp>)</rp>
		</ruby>
	);
}
