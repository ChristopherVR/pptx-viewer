import type { PptxSmartArtChrome } from 'pptx-viewer-core';
import React from 'react';

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

/**
 * Compute the largest font size that will fit `text` within a bounding box
 * defined by `maxWidth` x `maxHeight`, capped at `baseSize`.
 *
 * The heuristic assumes each character is roughly 0.6x the font size in width.
 * The returned value is clamped to a minimum of 6 px to remain legible.
 *
 * @param text      - The string to measure.
 * @param maxWidth  - Available horizontal space in pixels.
 * @param maxHeight - Available vertical space in pixels.
 * @param baseSize  - Maximum (ideal) font size in pixels.
 * @returns The computed font size in pixels (>= 6).
 */
export function fitFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	baseSize: number,
): number {
	// Approximate: each character is ~0.6x the font size in width
	const charWidthRatio = 0.6;
	const maxByWidth = maxWidth / (text.length * charWidthRatio);
	const maxByHeight = maxHeight * 0.5;
	return Math.max(6, Math.min(baseSize, maxByWidth, maxByHeight));
}

// ── SVG shape helpers ───────────────────────────────────────────────────────

/**
 * Generate SVG polygon `points` for a chevron / arrow shape inscribed in the
 * bounding box starting at (`x`, `y`) with size `w` x `h`.
 *
 * The chevron has a notch on the left side and an arrow tip on the right.
 *
 * @param x - Left edge x coordinate.
 * @param y - Top edge y coordinate.
 * @param w - Width of the bounding box.
 * @param h - Height of the bounding box.
 * @returns A space-separated list of "x,y" coordinate pairs.
 */
export function chevronPoints(x: number, y: number, w: number, h: number): string {
	const depth = Math.min(w * 0.2, h * 0.4);
	return [
		`${x},${y}`,
		`${x + w - depth},${y}`,
		`${x + w},${y + h / 2}`,
		`${x + w - depth},${y + h}`,
		`${x},${y + h}`,
		`${x + depth},${y + h / 2}`,
	].join(' ');
}

/**
 * Generate an SVG path string for a gear shape with teeth.
 *
 * The gear is centred at (`cx`, `cy`). Teeth alternate between `outerR` and
 * `innerR` radii around the centre.
 *
 * @param cx     - Centre x coordinate.
 * @param cy     - Centre y coordinate.
 * @param outerR - Outer (tooth tip) radius.
 * @param innerR - Inner (tooth valley) radius.
 * @param teeth  - Number of teeth around the gear.
 * @returns An SVG path data string (M/L/Z).
 */
export function gearPath(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	teeth: number,
): string {
	const segments: string[] = [];
	const step = (Math.PI * 2) / (teeth * 2);

	for (let i = 0; i < teeth * 2; i++) {
		const angle = i * step - Math.PI / 2;
		const r = i % 2 === 0 ? outerR : innerR;
		const x = cx + r * Math.cos(angle);
		const y = cy + r * Math.sin(angle);
		segments.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
	}
	segments.push('Z');
	return segments.join(' ');
}

// ── Multi-line SVG node text ─────────────────────────────────────────────────

/** Props for {@link SmartArtNodeText}. */
export interface SmartArtNodeTextProps {
	/** Node text content; split on `\n` for multi-line rendering. */
	text: string;
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
	x,
	y,
	fill,
	fontSize,
	fontWeight,
	fontStyle,
	className,
	anchor = 'middle',
}: SmartArtNodeTextProps): React.ReactElement {
	const lines = text.split('\n').filter((l) => l.length > 0);
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
			textAnchor='middle'
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
