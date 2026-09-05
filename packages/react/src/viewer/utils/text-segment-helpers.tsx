import type { RunFontSpec, RunStyle } from 'pptx-viewer-shared';
import {
	pieceLetterSpacing,
	sanitizeMathMl,
	splitRunByScriptFont,
	splitRunForMetrics,
} from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { convertOmmlToMathMl } from './omml-to-mathml';
import type { OmmlNode } from './omml-to-mathml';
import { makeSegmentPieceRenderer } from './text-segment-underline-words';
import { renderTabbedLine } from './text-tab-layout';
import type { TabRenderContext } from './text-tab-layout';

/* Highlight info for a single segment, used by Find & Replace */
export interface TextSegmentHighlight {
	startOffset: number;
	length: number;
	isCurrent: boolean; // true for the currently focused match
}

/* Highlights grouped by segment index for an element */
export type ElementFindHighlights = Map<number, TextSegmentHighlight[]>;

/** Per-script font family set used by script-aware text rendering. */
export interface ScriptFonts {
	latin: string;
	eastAsia: string;
	complexScript: string;
	symbol: string;
}

/**
 * Render text with per-script font spans when fonts differ across Unicode
 * script categories (latin, eastAsia, complexScript, symbol).
 *
 * The segmentation + font-resolution decision is shared's `splitRunByScriptFont`
 * (extracted from this file's former private implementation so all five
 * bindings render the same descriptor); this is now only the JSX mapping over
 * its pieces. When all script fonts are the same (common case), returns the
 * plain text string with zero extra DOM overhead.
 */
export function renderScriptAwareText(
	text: string,
	needsScriptFonts: boolean,
	scriptFonts: ScriptFonts,
	baseFontFamily: string,
	keyPrefix: string,
	/** Decoration the run carries, which a nested span has to repeat (it does not inherit). */
	nestedStyle?: React.CSSProperties,
): React.ReactNode {
	if (!needsScriptFonts || !text) {
		return text;
	}
	const pieces = splitRunByScriptFont(
		text,
		scriptFonts,
		baseFontFamily,
		nestedStyle as RunStyle | undefined,
	);
	if (!pieces) {
		return text;
	}
	return pieces.map((piece, i) =>
		piece.style ? (
			<span key={`${keyPrefix}-r${i}`} style={piece.style as React.CSSProperties}>
				{piece.text}
			</span>
		) : (
			<React.Fragment key={`${keyPrefix}-r${i}`}>{piece.text}</React.Fragment>
		),
	);
}

/** What a caller needs to give a run's pieces their own metric tracking. */
export interface MetricTextContext {
	/** The font the run paints with, for measuring each piece. */
	font: RunFontSpec;
	/** Authored `a:rPr/@spc` in px; each piece's tracking layers on top. */
	authoredPx: number;
	/**
	 * The run's own decoration, which every span nested inside the run has to
	 * repeat: `text-decoration-*` does not inherit, so a piece span reports
	 * `none` of its own even while the run's underline is drawn through it.
	 * Shared `nestedTextDecorationStyle` decides the subset.
	 */
	nestedStyle?: React.CSSProperties;
}

/**
 * Wrap each word (and each whitespace gap) of `text` in its own span carrying
 * the tracking that renders it at PowerPoint's width, so a line assembled out
 * of whole pieces measures exactly what PowerPoint measured (issue #149).
 *
 * The four shared-builder bindings get this by emitting sibling runs; React
 * builds its own spans, so it splits here, at the one place plain run text
 * becomes nodes. `inner` keeps whatever the caller was already doing with the
 * text (script-aware fonts) intact inside each piece.
 *
 * With no metric context, or nothing to split, this is the caller's own
 * rendering unchanged - one text node, no extra DOM.
 */
export function renderMetricPieces(
	text: string,
	metric: MetricTextContext | undefined,
	keyPrefix: string,
	inner: (text: string, key: string) => React.ReactNode,
): React.ReactNode {
	if (!metric || !text) {
		return inner(text, keyPrefix);
	}
	const pieces = splitRunForMetrics(text, metric.font);
	if (pieces.length <= 1) {
		return inner(text, keyPrefix);
	}
	return pieces.map((piece, i) => (
		<span
			key={`${keyPrefix}-w${i}`}
			style={{
				...metric.nestedStyle,
				letterSpacing: pieceLetterSpacing(metric.authoredPx, piece.tracking),
			}}
		>
			{inner(piece.text, `${keyPrefix}-w${i}`)}
		</span>
	));
}

/**
 * Render the inner content of a text segment span, handling both the
 * no-highlight fast path and the find-highlight split path.
 */
export function renderSegmentContent(
	elementId: string,
	segmentIndex: number,
	textValue: string,
	lines: string[],
	needsScriptFonts: boolean,
	scriptFonts: ScriptFonts,
	baseFontFamily: string,
	findHighlights: ElementFindHighlights | undefined,
	/** When present, `\t` is laid out with real tab stops (align + leaders). */
	tabContext?: TabRenderContext,
	/** When present, each word gets the tracking PowerPoint measured it at. */
	metric?: MetricTextContext,
	/**
	 * D2-G3: true for an `a:rPr/@u="words"` run. Every leaf render below routes
	 * through `renderUnderlineWords` (see `text-segment-underline-words.tsx`),
	 * which is a no-op unless this is set.
	 */
	isUnderlineWords = false,
	/** The decoration a WORD piece's own span redeclares; see the module doc. */
	wordDecoration?: React.CSSProperties,
): React.ReactNode {
	const segHl = findHighlights?.get(segmentIndex);
	const renderLeaf = makeSegmentPieceRenderer(
		needsScriptFonts,
		scriptFonts,
		baseFontFamily,
		isUnderlineWords,
		wordDecoration,
		metric,
	);
	if (!segHl || segHl.length === 0) {
		// Fast path: no highlights, render lines with script-aware fonts.
		return lines.map((line: string, lineIndex: number) => {
			const lineKey = `${elementId}-seg-${segmentIndex}-line-${lineIndex}`;
			return (
				<React.Fragment key={lineKey}>
					{tabContext && line.includes('\t')
						? renderTabbedLine(line, tabContext, lineKey, renderLeaf, metric?.nestedStyle)
						: renderLeaf(line, lineKey)}
					{lineIndex < lines.length - 1 ? <br /> : null}
				</React.Fragment>
			);
		});
	}

	// Split the entire segment text into highlighted/plain chunks
	const sorted = [...segHl].sort((a, b) => a.startOffset - b.startOffset);
	const chunks: Array<{
		text: string;
		highlighted: boolean;
		isCurrent: boolean;
	}> = [];
	let cursor = 0;
	for (const hl of sorted) {
		if (hl.startOffset > cursor) {
			chunks.push({
				text: textValue.slice(cursor, hl.startOffset),
				highlighted: false,
				isCurrent: false,
			});
		}
		chunks.push({
			text: textValue.slice(hl.startOffset, hl.startOffset + hl.length),
			highlighted: true,
			isCurrent: hl.isCurrent,
		});
		cursor = hl.startOffset + hl.length;
	}
	if (cursor < textValue.length) {
		chunks.push({
			text: textValue.slice(cursor),
			highlighted: false,
			isCurrent: false,
		});
	}
	return chunks.map((chunk, ci) => {
		const chunkKey = `${elementId}-seg-${segmentIndex}-hl-${ci}`;
		return chunk.highlighted ? (
			<mark
				key={chunkKey}
				style={{
					...metric?.nestedStyle,
					backgroundColor: chunk.isCurrent ? '#f97316' : '#facc15',
					color: 'inherit',
					borderRadius: 2,
				}}
			>
				{renderLeaf(chunk.text, chunkKey)}
			</mark>
		) : (
			<React.Fragment key={chunkKey}>{renderLeaf(chunk.text, chunkKey)}</React.Fragment>
		);
	});
}

/**
 * Render an equation segment (inline MathML from OMML).
 * Returns a React node, or `null` if not an equation.
 *
 * When `equationNumber` is provided, the equation is rendered centered with
 * the number right-aligned using a flexbox `justify-content: space-between`
 * layout, matching the standard academic equation numbering convention.
 */
export function renderEquationSegment(
	elementId: string,
	segmentIndex: number,
	equationXml: Record<string, unknown>,
	equationNumber?: string,
): React.ReactNode {
	const mathml = convertOmmlToMathMl(equationXml as OmmlNode);
	const safeMathml = mathml ? sanitizeMathMl(mathml) : '';

	const equationContent = safeMathml ? (
		<span
			className='inline-block align-middle'
			style={{
				fontFamily: '"Cambria Math", "STIX Two Math", serif',
			}}
			dangerouslySetInnerHTML={{ __html: safeMathml }}
		/>
	) : (
		<span className='inline-block px-1 py-0.5 rounded text-xs bg-gray-200/20 text-gray-400 italic'>
			{translationsEn['pptx.textSegment.equationFallback']}
		</span>
	);

	// When an equation number is provided, wrap in a flex container:
	// equation centered, number right-aligned.
	if (equationNumber) {
		return (
			<span
				key={`${elementId}-seg-${segmentIndex}`}
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					width: '100%',
				}}
			>
				{/* Left spacer to balance the right-aligned number */}
				<span style={{ visibility: 'hidden', whiteSpace: 'nowrap' }}>({equationNumber})</span>
				<span style={{ textAlign: 'center', flex: 1 }}>{equationContent}</span>
				<span
					style={{
						whiteSpace: 'nowrap',
						fontFamily: '"Cambria Math", "STIX Two Math", serif',
					}}
				>
					({equationNumber})
				</span>
			</span>
		);
	}

	return <span key={`${elementId}-seg-${segmentIndex}`}>{equationContent}</span>;
}

// Picture bullets are no longer rendered here. Shared `buildParagraphs` resolves
// the marker (`bulletPicture`, via `resolvePictureBullet`) and React's paragraph
// renderer emits the `<img>` or the glyph fallback from that descriptor, exactly
// as the other four bindings do - React's private `renderPictureBullet` was a
// fifth copy of the same decision.

// Underline decoration (extracted to pptx-viewer-shared).
// `resolveUnderlineDecorationStyle` + `UnderlineDecorationCss` now live in
// `pptx-viewer-shared` (render/text-decoration). Re-exported here so existing
// React import paths keep working.
export type { UnderlineDecorationCss } from 'pptx-viewer-shared';
export { resolveUnderlineDecorationStyle } from 'pptx-viewer-shared';
