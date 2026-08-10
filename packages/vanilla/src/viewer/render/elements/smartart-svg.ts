import { centeredSvgTextLines } from 'pptx-viewer-shared';
import type { SvgTextLine } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';

/**
 * DOM assembly for the SmartArt drawing-shapes and fallback layout paths. The
 * line geometry itself comes from `pptx-viewer-shared`; this file only turns it
 * into elements.
 */

export type { SvgTextLine };

/** Split a label on newlines and centre the block on the node centre (offset 0). */
export function svgTextLines(text: string, fontSize: number): SvgTextLine[] {
	return centeredSvgTextLines(text, fontSize);
}

/** Options for {@link appendCenteredSvgText}. */
export interface CenteredSvgTextOptions {
	text: string;
	/** Centre x of the node (text anchor). */
	x: number;
	/** Centre y of the node (lines are offset around it). */
	y: number;
	fill: string;
	fontSize: number;
}

/**
 * Append a centred, multi-line `<text>` (one `<tspan>` per line) to `parent`.
 */
export function appendCenteredSvgText(
	doc: Document,
	parent: SVGElement,
	options: CenteredSvgTextOptions,
): void {
	appendSvgTextLines(doc, parent, {
		lines: svgTextLines(options.text, options.fontSize).map((line) => ({
			text: line.text,
			y: options.y + line.y,
		})),
		x: options.x,
		fill: options.fill,
		fontSize: options.fontSize,
	});
}

/** Options for {@link appendSvgTextLines}. */
export interface SvgTextLinesOptions {
	/** Lines to draw, each already carrying its own baseline. */
	lines: SvgTextLine[];
	/** Centre x of the block (text anchor). */
	x: number;
	fill: string;
	fontSize: number;
}

/**
 * Append a `<text>` built from already-positioned lines. Shapes whose label
 * geometry was resolved upstream (the cached drawing-shape path) come in this
 * way, so nothing here recomputes it.
 */
export function appendSvgTextLines(
	doc: Document,
	parent: SVGElement,
	options: SvgTextLinesOptions,
): void {
	const textEl = createSvgEl(doc, 'text', {
		x: options.x,
		'text-anchor': 'middle',
		'dominant-baseline': 'central',
		fill: options.fill,
		'font-size': options.fontSize,
	});
	for (const line of options.lines) {
		const tspan = createSvgEl(doc, 'tspan', { x: options.x, y: line.y });
		tspan.textContent = line.text;
		textEl.appendChild(tspan);
	}
	parent.appendChild(textEl);
}

/** Inline style applied to every SmartArt SVG so it fills the element box. */
export const SMARTART_SVG_STYLE = 'width:100%;height:100%;pointer-events:none;display:block';
