import type { PptxElement, PptxElementWithText, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties, getSubstituteFontFamily } from 'pptx-viewer-core';
import type { EnvelopeGlyphPlacement, EnvelopeSegmentInput } from 'pptx-viewer-shared';
import {
	buildGlyphEnvelope,
	groupIntoParagraphs as sharedGroupIntoParagraphs,
	hasGlyphEnvelope,
} from 'pptx-viewer-shared';
/**
 * SVG textPath-based text warp (WordArt) React component.
 *
 * Uses path generators from `warp-path-generators.ts` to render warped
 * text along SVG paths for presets that require it. Envelope presets
 * (inflate/deflate/can, see `hasGlyphEnvelope`) instead render one `<text>`
 * per glyph via `buildGlyphEnvelope`, so glyph HEIGHT varies between the
 * preset's top and bottom curves the way PowerPoint's own text warp does;
 * `<textPath>` can only bend a shared baseline, never per-glyph height.
 */
import React from 'react';

import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_FONT_FAMILY, HYPERLINK_COLOR } from '../constants';
import { normalizeHexColor } from './color';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import type { ElementFindHighlights } from './text-segment-helpers';
import { shouldUseSvgWarp, getWarpPath } from './warp-path-generators';

// Paragraph grouping helper. The pure splitter now lives in pptx-viewer-shared
// (render/text-warp `groupIntoParagraphs`); React keeps its field-substitution
// concern by passing a per-segment transform that resolves field text.

/**
 * Group an element's text segments into paragraphs (delimited by
 * `isParagraphBreak` segments), substituting field values when provided.
 */
function groupIntoParagraphs(
	element: PptxElementWithText,
	fieldContext?: FieldSubstitutionContext,
): Array<{ segments: TextSegment[] }> {
	return sharedGroupIntoParagraphs(
		element,
		fieldContext
			? (seg) => {
					if (seg.fieldType) {
						const substituted = substituteFieldText(seg.text, seg.fieldType, fieldContext);
						if (substituted !== seg.text) {
							return { ...seg, text: substituted };
						}
					}
					return seg;
				}
			: undefined,
	);
}

// ── SVG text-styling helpers ───────────────────────────────────────────

/** Map paragraph alignment to SVG textPath properties. */
function getAlignmentProps(align: TextStyle['align']): {
	startOffset: string;
	textAnchor: 'start' | 'middle' | 'end';
} {
	switch (align) {
		case 'center':
			return { startOffset: '50%', textAnchor: 'middle' };
		case 'right':
			return { startOffset: '100%', textAnchor: 'end' };
		case 'left':
		case 'justify':
		default:
			return { startOffset: '0%', textAnchor: 'start' };
	}
}

/** Build SVG-compatible attribute props for a single text segment `<tspan>`. */
function getSegmentTspanProps(
	segment: TextSegment,
	element: PptxElementWithText,
	fallbackColor: string,
): React.SVGProps<SVGTSpanElement> {
	const s = segment.style || ({} as TextStyle);
	const decos: string[] = [];
	if (s.underline || s.hyperlink) {
		decos.push('underline');
	}
	if (s.strikethrough) {
		decos.push('line-through');
	}

	const fill = s.hyperlink
		? normalizeHexColor(s.color || element.textStyle?.color, HYPERLINK_COLOR)
		: normalizeHexColor(s.color || element.textStyle?.color, fallbackColor);

	return {
		fill,
		fontSize: (s.fontSize ?? element.textStyle?.fontSize ?? DEFAULT_TEXT_FONT_SIZE) as
			| number
			| undefined,
		fontWeight: s.bold ? 700 : 400,
		fontStyle: s.italic ? 'italic' : undefined,
		fontFamily:
			s.fontFamily || element.textStyle?.fontFamily
				? getSubstituteFontFamily(s.fontFamily || element.textStyle?.fontFamily || '')
				: DEFAULT_FONT_FAMILY,
		textDecoration: decos.length > 0 ? decos.join(' ') : undefined,
	};
}

/** Resolve the plain (measurement-ready) font a segment renders with. */
function resolveSegmentFont(
	segment: TextSegment,
	element: PptxElementWithText,
): EnvelopeSegmentInput['font'] {
	const s = segment.style || ({} as TextStyle);
	const family = s.fontFamily || element.textStyle?.fontFamily;
	return {
		fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
		fontSizePx: (s.fontSize ?? element.textStyle?.fontSize ?? DEFAULT_TEXT_FONT_SIZE) as number,
		bold: s.bold ?? element.textStyle?.bold,
		italic: s.italic ?? element.textStyle?.italic,
	};
}

/**
 * Render one glyph. Most glyphs have no `slices` (a single affine already
 * fits them within tolerance): one `<text transform>`, unchanged from before
 * per-glyph slicing existed. A glyph on a strongly-curved envelope wide
 * enough to need it (see `chooseGlyphSliceCount` in `pptx-viewer-shared`)
 * instead renders `slices.length` copies of the SAME glyph, each clipped to
 * its own x-band and carrying its own affine, so the pieces tile across the
 * glyph the way PowerPoint's per-point outline warp would.
 */
function EnvelopeGlyph({
	glyphKey,
	glyph,
	tspanProps,
}: {
	glyphKey: string;
	glyph: EnvelopeGlyphPlacement;
	tspanProps: React.SVGProps<SVGTSpanElement>;
}): React.ReactElement {
	if (!glyph.slices || glyph.slices.length <= 1) {
		return (
			<text x={glyph.x} y={glyph.y} transform={glyph.transform} {...tspanProps}>
				{glyph.char}
			</text>
		);
	}
	// A REAL `<g>` (not a `<>`), so a sliced glyph's `<text>`s are `svg > g >
	// text`, never `svg > text` - keeping the single-slice DOM shape (a bare
	// `<text>` as a direct `<svg>` child) exactly as it was before slicing
	// existed, which every "one `<text>` per glyph" test/selector assumes.
	return (
		<g data-glyph-slices={glyph.slices.length}>
			{glyph.slices.map((slice, si) => {
				const clipId = `${glyphKey}-s${si}`;
				return (
					<React.Fragment key={clipId}>
						<clipPath id={clipId} clipPathUnits='userSpaceOnUse'>
							<rect
								x={slice.clipX0}
								y={-100000}
								width={Math.max(0, slice.clipX1 - slice.clipX0)}
								height={200000}
							/>
						</clipPath>
						<text
							x={glyph.x}
							y={glyph.y}
							transform={slice.transform}
							clipPath={`url(#${clipId})`}
							{...tspanProps}
						>
							{glyph.char}
						</text>
					</React.Fragment>
				);
			})}
		</g>
	);
}

/** Render one envelope-warped line as one `<text>` per glyph (or more, for a sliced glyph). */
function EnvelopeLine({
	paraSegments,
	glyphs,
	element,
	fallbackColor,
	lineIdPrefix,
}: {
	paraSegments: TextSegment[];
	glyphs: EnvelopeGlyphPlacement[];
	element: PptxElementWithText;
	fallbackColor: string;
	lineIdPrefix: string;
}): React.ReactElement {
	return (
		<>
			{glyphs.map((g, i) => (
				<EnvelopeGlyph
					key={i}
					glyphKey={`${lineIdPrefix}-g${i}`}
					glyph={g}
					tspanProps={getSegmentTspanProps(paraSegments[g.segmentIndex], element, fallbackColor)}
				/>
			))}
		</>
	);
}

// ── Public API - React component ───────────────────────────────────────

/** Props for the `WarpedText` SVG renderer. */
export interface WarpedTextProps {
	element: PptxElement;
	width: number;
	height: number;
	fallbackColor: string;
	findHighlights?: ElementFindHighlights;
	fieldContext?: FieldSubstitutionContext;
}

/**
 * Render warped (WordArt) text using SVG `<textPath>`.
 *
 * Call `shouldUseSvgWarp(preset)` first to determine if this component
 * should be used. For presets that return `false`, the existing HTML +
 * CSS transform approach in `getTextWarpStyle()` is used instead.
 */
export function WarpedText({
	element,
	width,
	height,
	fallbackColor,
	fieldContext,
}: WarpedTextProps): React.ReactElement | null {
	if (!hasTextProperties(element)) {
		return null;
	}
	const textEl = element as PptxElementWithText;
	const preset = textEl.textStyle?.textWarpPreset;
	if (!preset || !shouldUseSvgWarp(preset)) {
		return null;
	}

	const paragraphs = groupIntoParagraphs(textEl, fieldContext);
	if (paragraphs.length === 0) {
		return null;
	}

	const lineCount = paragraphs.length;
	const pathIdPrefix = `warp-${element.id}`;

	// Warp adjustment values
	const warpAdj = textEl.textStyle?.textWarpAdj;
	const warpAdj2 = textEl.textStyle?.textWarpAdj2;

	// Alignment
	const align = textEl.textStyle?.align ?? 'center';
	const { startOffset, textAnchor } = getAlignmentProps(align);

	// Base font properties from element-level text style
	const baseFontSize = (textEl.textStyle?.fontSize ?? DEFAULT_TEXT_FONT_SIZE) as number;
	const baseFontFamily = textEl.textStyle?.fontFamily
		? getSubstituteFontFamily(textEl.textStyle.fontFamily)
		: DEFAULT_FONT_FAMILY;
	const baseFill = normalizeHexColor(textEl.textStyle?.color, fallbackColor);

	// Envelope presets (inflate/deflate/can) get a true per-glyph height warp
	// instead of a shared-baseline `<textPath>`. Every paragraph renders this
	// way: paragraph `i` of `lineCount` occupies the `[i/lineCount,
	// (i+1)/lineCount]` vertical slice of the envelope curve's local band (see
	// `buildGlyphEnvelope` in pptx-viewer-shared), so a multi-paragraph block
	// bends within the same overall envelope shape instead of falling back to
	// a shared-baseline `<textPath>` per line.
	if (hasGlyphEnvelope(preset)) {
		return (
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				xmlns='http://www.w3.org/2000/svg'
				style={{ overflow: 'visible', position: 'absolute', inset: 0, pointerEvents: 'none' }}
				aria-hidden='true'
			>
				{paragraphs.map((para, paraIdx) => {
					const segsInput: EnvelopeSegmentInput[] = para.segments.map((seg, i) => ({
						text: seg.text,
						font: resolveSegmentFont(seg, textEl),
						segmentIndex: i,
					}));
					const glyphs = buildGlyphEnvelope(
						preset,
						segsInput,
						width,
						height,
						align,
						warpAdj,
						warpAdj2,
						paraIdx,
						lineCount,
					);
					return (
						<EnvelopeLine
							key={`envelope-line-${paraIdx}`}
							paraSegments={para.segments}
							glyphs={glyphs}
							element={textEl}
							fallbackColor={fallbackColor}
							lineIdPrefix={`warp-${element.id}-l${paraIdx}`}
						/>
					);
				})}
			</svg>
		);
	}

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			xmlns='http://www.w3.org/2000/svg'
			style={{
				overflow: 'visible',
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
			}}
			aria-hidden='true'
		>
			<defs>
				{paragraphs.map((_para, i) => (
					<path
						key={`${pathIdPrefix}-def-${i}`}
						id={`${pathIdPrefix}-${i}`}
						d={getWarpPath(preset, width, height, i, lineCount, warpAdj, warpAdj2)}
						fill='none'
					/>
				))}
			</defs>
			{paragraphs.map((para, paraIdx) => (
				<text
					key={`${pathIdPrefix}-txt-${paraIdx}`}
					fontSize={baseFontSize}
					fontFamily={baseFontFamily}
					fill={baseFill}
					fontWeight={textEl.textStyle?.bold ? 700 : 400}
					fontStyle={textEl.textStyle?.italic ? 'italic' : 'normal'}
				>
					<textPath
						href={`#${pathIdPrefix}-${paraIdx}`}
						startOffset={startOffset}
						textAnchor={textAnchor}
					>
						{para.segments.map((seg, segIdx) => (
							<tspan
								key={`${pathIdPrefix}-ts-${paraIdx}-${segIdx}`}
								{...getSegmentTspanProps(seg, textEl, fallbackColor)}
							>
								{seg.text}
							</tspan>
						))}
					</textPath>
				</text>
			))}
		</svg>
	);
}
