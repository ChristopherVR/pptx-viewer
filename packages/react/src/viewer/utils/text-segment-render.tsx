import { getSubstituteFontFamily, parsePanoseString } from 'pptx-viewer-core';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import {
	pieceLetterSpacing,
	resolveAutoFitFontScale,
	resolveMetricTrackingPx,
} from 'pptx-viewer-shared';
import type { ParagraphRun } from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_FONT_FAMILY, HYPERLINK_COLOR } from '../constants';
import { normalizeHexColor } from './color';
import { renderSegmentContent, renderEquationSegment } from './text-segment-helpers';
import type { ElementFindHighlights } from './text-segment-helpers';
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
	// kerning outright.
	const baseFontSizePt = baseFontSize * (72 / 96);
	const fontKerning: React.CSSProperties['fontKerning'] =
		typeof segmentStyle.kerning === 'number'
			? segmentStyle.kerning === 0
				? 'none'
				: baseFontSizePt >= segmentStyle.kerning / 100
					? 'normal'
					: 'none'
			: undefined;

	const rawFontFamily = segmentStyle.fontFamily || element.textStyle?.fontFamily;
	// PANOSE-based font substitution with fallback chain.
	const baseFontFamily = rawFontFamily
		? getSubstituteFontFamily(
				rawFontFamily,
				parsePanoseString(segmentStyle.latinFontPanose ?? element.textStyle?.latinFontPanose),
			)
		: DEFAULT_FONT_FAMILY;

	// Per-script font info for Unicode font fallback. Every entry goes through
	// the SAME substitution as `latin`, for two reasons. The obvious one: a bare
	// `a:ea` name emitted on the inner script span overrides the parent's
	// fallback chain, so a deck whose east-asian font is not installed drops to
	// the browser's default - which for CJK is a serif, where PowerPoint
	// substitutes a sans. The subtle one: the comparison below is by string, so
	// leaving `ea` bare while `latin` carries a chain made an identical typeface
	// look distinct and emitted that clobbering span in the first place.
	const scriptFont = (name: string | undefined, panose: string | undefined): string =>
		name ? getSubstituteFontFamily(name, parsePanoseString(panose)) : baseFontFamily;
	const scriptFonts = {
		latin: baseFontFamily,
		eastAsia: scriptFont(
			segmentStyle.eastAsiaFont || element.textStyle?.eastAsiaFont,
			segmentStyle.eastAsiaFontPanose ?? element.textStyle?.eastAsiaFontPanose,
		),
		complexScript: scriptFont(
			segmentStyle.complexScriptFont || element.textStyle?.complexScriptFont,
			segmentStyle.complexScriptFontPanose ?? element.textStyle?.complexScriptFontPanose,
		),
		symbol: scriptFont(
			segmentStyle.symbolFont || element.textStyle?.symbolFont,
			segmentStyle.symbolFontPanose ?? element.textStyle?.symbolFontPanose,
		),
	};
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
	const metricContext = { font: metricFont, authoredPx: authoredLetterSpacing };

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
			{renderRubyOrText(segment, baseContent, baseFontSize, baseFontFamily, resolvedSegmentColor)}
		</span>
	);

	return run.hyperlink && onHyperlinkClick ? renderHyperlink(run, spanNode, key, ctx) : spanNode;
}

/**
 * Wrap the run's content in `<ruby>` when the segment carries a phonetic guide
 * (`a:ruby`, furigana / pinyin), or return it unchanged.
 */
function renderRubyOrText(
	segment: TextSegment | undefined,
	baseContent: React.ReactNode,
	baseFontSize: number,
	baseFontFamily: string,
	resolvedColor: string,
): React.ReactNode {
	const rubyText = segment?.rubyText;
	if (typeof rubyText !== 'string' || rubyText.length === 0) {
		return baseContent;
	}
	// Resolve the annotation size: the explicit `rubyFontSize`, else 50% of the
	// base size (the common default).
	const rubyStyle: React.CSSProperties = {
		fontSize: segment?.rubyFontSize ?? baseFontSize * 0.5,
		fontFamily: segment?.rubyStyle?.fontFamily ?? baseFontFamily,
		textAlign:
			segment?.rubyAlignment === 'l'
				? 'left'
				: segment?.rubyAlignment === 'r'
					? 'right'
					: segment?.rubyAlignment === 'dist' ||
						  segment?.rubyAlignment === 'distCat' ||
						  segment?.rubyAlignment === 'distLetter'
						? 'justify'
						: 'center',
	};
	if (segment?.rubyStyle?.color) {
		rubyStyle.color = normalizeHexColor(segment.rubyStyle.color, resolvedColor);
	}
	return (
		<ruby>
			{baseContent}
			<rp>(</rp>
			<rt style={rubyStyle}>{rubyText}</rt>
			<rp>)</rp>
		</ruby>
	);
}

/**
 * Wrap a linked run in a clickable element. The URL is shared's resolved
 * {@link ParagraphRun.hyperlink} target, which already carries the encoded
 * `slideIndex` for an internal `ppaction://` jump.
 */
function renderHyperlink(
	run: ParagraphRun,
	spanNode: React.ReactNode,
	key: string,
	ctx: RunRenderContext,
): React.ReactNode {
	const url = run.hyperlink?.url;
	const onHyperlinkClick = ctx.onHyperlinkClick;
	if (!url || !onHyperlinkClick) {
		return spanNode;
	}
	const requireCtrlClick = ctx.requireCtrlClick;
	// Strip the `ppaction://` protocol for display; show a clean URL to the user.
	const displayUrl = url.startsWith('ppaction://')
		? url.replace(/^ppaction:\/\//u, '').split('?')[0]
		: url;
	const follow = (modified: boolean): boolean => {
		if (requireCtrlClick && !modified) {
			return false;
		}
		onHyperlinkClick(url);
		return true;
	};

	return (
		<span
			key={`${key}-link`}
			role='link'
			tabIndex={0}
			className={requireCtrlClick ? 'group/link relative' : undefined}
			style={{ cursor: requireCtrlClick ? undefined : 'pointer', pointerEvents: 'auto' }}
			title={run.hyperlink?.tooltip}
			onClick={(e) => {
				if (!follow(e.ctrlKey || e.metaKey)) {
					return;
				}
				e.stopPropagation();
				e.preventDefault();
			}}
			onKeyDown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') {
					return;
				}
				if (!follow(e.ctrlKey || e.metaKey)) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
			}}
		>
			{spanNode}
			{requireCtrlClick && (
				<span className='pointer-events-none absolute left-0 top-full z-[9999] mt-1 max-w-64 opacity-0 transition-opacity duration-150 group-hover/link:opacity-100'>
					<span className='flex flex-col rounded border border-border bg-popover px-2.5 py-1.5 shadow-lg'>
						<span className='truncate text-xs text-foreground'>{displayUrl}</span>
						<span className='mt-0.5 text-[10px] text-muted-foreground'>
							Ctrl+Click to follow link
						</span>
					</span>
				</span>
			)}
		</span>
	);
}
