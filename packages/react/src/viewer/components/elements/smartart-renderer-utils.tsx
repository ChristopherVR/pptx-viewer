import type { PptxSmartArtChrome } from 'pptx-viewer-core';
import { centeredSvgTextLines } from 'pptx-viewer-shared';
import type { RenderedGradient, SvgTextLine } from 'pptx-viewer-shared';
import React from 'react';

/**
 * Fraction of a shape's width its label may occupy, leaving the text inset
 * DiagramML shapes carry. Matches the shared cached-shape projection.
 */
const LABEL_WIDTH_FRACTION = 0.82;

// ── Inline-edit node tagging ──────────────────────────────────────────────────

/** Props applied to a rendered SmartArt node group (`<g>`). */
export interface SmartArtNodeGroupProps {
	'data-smartart-node-id': string;
	style: React.CSSProperties;
	/** Accessibility role so each node is announced as a discrete graphic. */
	role?: 'img';
	/** Per-node `aria-label` (from the shared a11y view-model), when known. */
	'aria-label'?: string;
}

/**
 * Props applied to each rendered SmartArt node group (`<g>`) so the inline
 * editing layer ({@link ../SmartArtEditableLayer}) can map a double-click back
 * to a node id and position an editor over it, and so assistive technology can
 * announce the node.
 *
 * `pointerEvents: 'auto'` re-enables hit-testing on the group (the parent
 * `<svg>` sets `pointer-events: none`); clicks still bubble to the element
 * container, so selection / drag of the SmartArt element are unaffected.
 *
 * When `label` is supplied the group gains `role="img"` + `aria-label`; pair it
 * with an SVG `<title>` inside the group for browsers that surface it.
 *
 * @param nodeId - The SmartArt model node id this group represents.
 * @param shadow - The CSS `filter` string the group already applies (may be
 *                 empty); preserved so styling is unchanged.
 * @param label  - Optional per-node accessibility label.
 */
export function smartArtNodeGroupProps(
	nodeId: string,
	shadow?: string,
	label?: string,
): SmartArtNodeGroupProps {
	const props: SmartArtNodeGroupProps = {
		'data-smartart-node-id': nodeId,
		style: { filter: shadow, pointerEvents: 'auto' },
	};
	if (label) {
		props.role = 'img';
		props['aria-label'] = label;
	}
	return props;
}

// ── Font sizing ─────────────────────────────────────────────────────────────

// `fitFontSize` and `chevronPoints` are shared geometry; re-exported here so
// the historical React import surface is unchanged.
export { chevronPoints, fitFontSize } from 'pptx-viewer-shared';

// ── Gradient paint server ───────────────────────────────────────────────────

/** Props for {@link SmartArtGradient}. */
export interface SmartArtGradientProps {
	/** The gradient as resolved by the shared cached-shape projection. */
	gradient: RenderedGradient;
}

/**
 * The SVG paint server for a cached shape's gradient fill.
 *
 * Place it inside a `<defs>`; the shape's `fill` already references it by id.
 * Every value comes from the shared projection, including the axis endpoints
 * converted from the OOXML angle.
 */
export function SmartArtGradient({ gradient }: SmartArtGradientProps): React.ReactElement {
	const stops = gradient.stops.map((stop, i) => (
		<stop
			key={`${gradient.id}-s${i}`}
			offset={stop.offset}
			stopColor={stop.color}
			{...(stop.opacity !== undefined ? { stopOpacity: stop.opacity } : {})}
		/>
	));
	return gradient.kind === 'radial' ? (
		<radialGradient id={gradient.id} cx={gradient.cx} cy={gradient.cy} r={gradient.r}>
			{stops}
		</radialGradient>
	) : (
		<linearGradient
			id={gradient.id}
			x1={gradient.x1}
			y1={gradient.y1}
			x2={gradient.x2}
			y2={gradient.y2}
		>
			{stops}
		</linearGradient>
	);
}

// ── Multi-line SVG node text ─────────────────────────────────────────────────

/** Props for {@link SmartArtNodeText}. */
export interface SmartArtNodeTextProps {
	/**
	 * Node text content; split on `\n` for multi-line rendering. Omitted when
	 * {@link lines} already carries the resolved layout.
	 */
	text?: string;
	/**
	 * Lines whose wrapping and baselines were resolved upstream (the shared
	 * cached-shape projection). When given, nothing here re-measures: the
	 * component places one `<tspan>` per entry at its own `y`.
	 */
	lines?: SvgTextLine[];
	/** X coordinate of the text block centre. */
	x: number;
	/** Y coordinate of the text block centre. */
	y: number;
	/** Text fill colour. */
	fill: string;
	/** Font size in pixels. */
	fontSize: number;
	/** Optional font weight (e.g. `'bold'`, `700`). */
	fontWeight?: number | string;
	/** Optional font style (e.g. `'italic'`). */
	fontStyle?: string;
	/** Optional CSS class applied to the outer `<text>` element. */
	className?: string;
	/**
	 * SVG `text-anchor` for the block. Defaults to `'middle'`; `'start'` is used
	 * by labels parked beside their node (target leaders, gear legend rows).
	 */
	textAnchor?: 'start' | 'middle' | 'end';
	/**
	 * Axis anchor point for multi-line layout. Defaults to `'middle'`.
	 *
	 * - `'middle'`: centre the block around `y` (`dominantBaseline='central'`).
	 *   `startY = y - totalHeight/2 + lineHeight/2`.
	 * - `'bottom'`: last line's baseline at `y` (`dominantBaseline='auto'`).
	 *   `startY = y - (lines.length - 1) * lineHeight`. Matches
	 *   `<text y={y} dominantBaseline='auto'>` for a single line.
	 * - `'top'`: first line's top at `y` (`dominantBaseline='hanging'`).
	 *   `startY = y`. Matches `<text y={y} dominantBaseline='hanging'>` for a
	 *   single line.
	 */
	anchor?: 'top' | 'middle' | 'bottom';
	/**
	 * Width available for the label. When given, long text is word-wrapped to fit
	 * instead of running past the shape; when omitted only authored line breaks
	 * split it.
	 */
	maxWidth?: number;
}

/**
 * Render node text as one or more SVG `<tspan>` lines, splitting on `\n`.
 *
 * The `anchor` prop controls how the text block is positioned relative to `y`:
 * - `'middle'` (default): centres the block around `y`.
 * - `'bottom'`: the last line's baseline sits at `y`; lines stack upward.
 * - `'top'`: the first line's top sits at `y`; lines stack downward.
 *
 * When `text` has no newlines the output is equivalent to the corresponding
 * plain `<text>` with the matching `dominantBaseline`, preserving existing
 * single-line rendering exactly.
 */
export function SmartArtNodeText({
	text,
	lines: positionedLines,
	x,
	y,
	fill,
	fontSize,
	fontWeight,
	fontStyle,
	className,
	textAnchor = 'middle',
	anchor = 'middle',
	maxWidth,
}: SmartArtNodeTextProps): React.ReactElement {
	if (positionedLines) {
		return (
			<text
				x={x}
				textAnchor={textAnchor}
				dominantBaseline='central'
				fill={fill}
				fontSize={fontSize}
				fontWeight={fontWeight}
				fontStyle={fontStyle}
				className={className}
			>
				{positionedLines.map((line, i) => (
					<tspan key={i} x={x} y={line.y}>
						{line.text}
					</tspan>
				))}
			</text>
		);
	}
	const source = text ?? '';
	const lines =
		maxWidth !== undefined
			? centeredSvgTextLines(source, fontSize, { maxWidth: maxWidth * LABEL_WIDTH_FRACTION }).map(
					(line) => line.text,
				)
			: source.split('\n').filter((l) => l.length > 0);
	const lineHeight = fontSize * 1.2;

	let startY: number;
	let dominantBaseline: 'auto' | 'hanging' | 'central';

	if (anchor === 'bottom') {
		// Last line's baseline at y; stack lines upward.
		startY = lines.length > 0 ? y - (lines.length - 1) * lineHeight : y;
		dominantBaseline = 'auto';
	} else if (anchor === 'top') {
		// First line's top at y; stack lines downward.
		startY = y;
		dominantBaseline = 'hanging';
	} else {
		// middle: centre the block around y.
		const totalHeight = lines.length * lineHeight;
		startY = lines.length > 0 ? y - totalHeight / 2 + lineHeight / 2 : y;
		dominantBaseline = 'central';
	}

	return (
		<text
			x={x}
			textAnchor={textAnchor}
			dominantBaseline={dominantBaseline}
			fill={fill}
			fontSize={fontSize}
			fontWeight={fontWeight}
			fontStyle={fontStyle}
			className={className}
		>
			{lines.map((line, i) => (
				<tspan key={i} x={x} y={startY + i * lineHeight}>
					{line}
				</tspan>
			))}
		</text>
	);
}

// ── Chrome wrapper ──────────────────────────────────────────────────────────

/** Container-level accessibility metadata for the SmartArt chrome wrapper. */
export interface SmartArtChromeA11y {
	/** ARIA role for the container. Always `"img"`. */
	role: 'img';
	/** Container `aria-label` (the full diagram description). */
	label: string;
}

/**
 * Wrap SmartArt content in a chrome container that applies optional
 * background colour and outline border from the diagram's chrome settings, plus
 * container-level accessibility (`role="img"` + `aria-label`) when supplied.
 *
 * @param chrome    - Optional chrome styling (background, outline).
 * @param content   - The React element to wrap.
 * @param className - Additional CSS classes for the wrapper `<div>`.
 * @param a11y      - Optional container role / aria-label for assistive tech.
 * @returns A `<div>` wrapping the content with chrome styles applied.
 */
export function wrapChrome(
	chrome: PptxSmartArtChrome | undefined,
	content: React.ReactElement,
	className: string,
	a11y?: SmartArtChromeA11y,
): React.ReactElement {
	const wrapperStyle: React.CSSProperties = {};
	if (chrome?.backgroundColor) {
		wrapperStyle.backgroundColor = chrome.backgroundColor;
	}
	if (chrome?.outlineColor) {
		wrapperStyle.border = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
	}

	return (
		<div
			className={`w-full h-full ${className}`}
			style={wrapperStyle}
			role={a11y?.role}
			aria-label={a11y?.label}
		>
			{content}
		</div>
	);
}
