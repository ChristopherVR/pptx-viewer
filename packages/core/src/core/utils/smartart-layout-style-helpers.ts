/**
 * SmartArt DiagramML interpreter - pure colour / style / text helpers.
 *
 * Back the interpreter's node builders (`smartart-layout-interpreter-render.ts`)
 * and its arrangers. No framework code, no DOM.
 *
 * Moved here from `pptx-viewer-shared` (`smartart-layout-helpers.ts`) so the
 * save/decompose pipeline in this package can call the same interpreter the
 * bindings render with; `pptx-viewer-core` cannot import `pptx-viewer-shared`
 * (shared depends on core), so the single copy now lives in core and shared
 * re-exports it. Tree helpers (`buildTree`/`treeWidth`/`treeDepth`) stay in
 * `smartart-helpers.ts`, which already defined equivalent core-native
 * versions; duplicating a second copy here would recreate the exact drift
 * this move is meant to end.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { RenderedNodeTextStyle } from './smartart-layout-types';

// ── Colour + style utilities ─────────────────────────────────────────────────

/** Pick a colour from the palette, cycling for any index. */
export function colour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

/**
 * Resolve the effective fill for a node: an explicit per-node
 * `node.style.fillColor` override wins, otherwise the cycled palette colour.
 */
export function nodeFill(node: PptxSmartArtNode, index: number, palette: string[]): string {
	const override = node.style?.fillColor;
	return override && override.length > 0 ? override : colour(index, palette);
}

/**
 * Resolve the effective outline stroke for a node: an explicit per-node
 * `node.style.lineColor` override wins, otherwise the style-derived default.
 */
export function nodeStroke(node: PptxSmartArtNode, defaultStroke: string): string {
	const override = node.style?.lineColor;
	return override && override.length > 0 ? override : defaultStroke;
}

/**
 * Resolve the per-node label styling from an explicit `node.style` override.
 *
 * Returns only the fields the node actually overrides, so spreading the result
 * into a `RenderedNode` leaves the binding defaults (white, no weight, no
 * italic) in place for an unstyled node.
 */
export function nodeTextStyle(node: PptxSmartArtNode): RenderedNodeTextStyle {
	const style = node.style;
	if (!style) {
		return {};
	}
	const out: RenderedNodeTextStyle = {};
	if (style.fontColor && style.fontColor.length > 0) {
		out.fontColor = style.fontColor;
	}
	if (style.bold) {
		out.fontWeight = 700;
	}
	if (style.italic) {
		out.fontStyle = 'italic';
	}
	return out;
}

/** Compute a fading opacity for progressive nodes. */
export function nodeOpacity(index: number, total: number, style: SmartArtStyle): number {
	const base = style === 'intense' ? 1.0 : style === 'moderate' ? 0.92 : 0.85;
	if (total <= 1) {
		return base;
	}
	return base - (index / (total - 1)) * 0.15;
}

/** Drop-shadow filter string for the given style. */
export function styleShadow(style: SmartArtStyle): string | undefined {
	if (style === 'intense') {
		return 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))';
	}
	if (style === 'moderate') {
		return 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))';
	}
	return undefined;
}

/** Stroke width for node outlines. */
export function styleStroke(style: SmartArtStyle): number {
	if (style === 'intense') {
		return 2;
	}
	if (style === 'moderate') {
		return 1.5;
	}
	return 0;
}

/** Truncate text at `max` chars, appending an ellipsis. */
export function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

/**
 * Fit font size to available space.
 * Uses a 0.6 char-width heuristic; clamps to 6 px minimum.
 */
export function fitFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	baseSize: number,
): number {
	const charWidthRatio = 0.6;
	const maxByWidth = maxWidth / Math.max(1, text.length * charWidthRatio);
	const maxByHeight = maxHeight * 0.5;
	return Math.max(6, Math.min(baseSize, maxByWidth, maxByHeight));
}

/**
 * SVG polygon `points` for a chevron / arrow inscribed in the box at (`x`, `y`)
 * sized `w` x `h`: a notch on the left edge and a tip on the right.
 *
 * @param x - Left edge.
 * @param y - Top edge.
 * @param w - Box width.
 * @param h - Box height.
 * @returns Space-separated `"x,y"` pairs.
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
 * SVG polygon `points` for a cog wheel centred at (`cx`, `cy`).
 *
 * Vertices alternate between `outerR` (tooth tip) and `innerR` (tooth valley),
 * two vertices per tooth. Emitted as polygon points rather than a path so the
 * gear rides the existing `RenderedPolygonNode` contract every binding already
 * renders; the outline is identical either way because the teeth are straight
 * segments.
 *
 * @param cx     - Centre x.
 * @param cy     - Centre y.
 * @param outerR - Tooth-tip radius.
 * @param innerR - Tooth-valley radius.
 * @param teeth  - Number of teeth.
 * @returns Space-separated `"x,y"` pairs.
 */
export function gearPoints(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	teeth: number,
): string {
	const total = Math.max(1, teeth) * 2;
	const step = (Math.PI * 2) / total;
	const pairs: string[] = [];
	for (let i = 0; i < total; i++) {
		const angle = i * step - Math.PI / 2;
		const r = i % 2 === 0 ? outerR : innerR;
		pairs.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
	}
	return pairs.join(' ');
}

/** Outline-stroke colour for a node given its computed stroke width. */
export function strokeFor(sw: number): string {
	return sw > 0 ? 'rgba(255,255,255,0.3)' : 'none';
}

/** Depth-first flatten of a nested node forest. */
export function flattenNodes(roots: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (n: PptxSmartArtNode): void => {
		out.push(n);
		for (const c of n.children ?? []) {
			walk(c);
		}
	};
	for (const r of roots) {
		walk(r);
	}
	return out;
}
