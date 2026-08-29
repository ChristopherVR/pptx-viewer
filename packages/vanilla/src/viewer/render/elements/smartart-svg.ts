import type { RenderedGradient, SvgTextLine } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';

/**
 * DOM assembly for the SmartArt drawing-shapes and fallback layout paths. The
 * line geometry itself comes from `pptx-viewer-shared` (`projectDrawingShapes`
 * for the cached path, `smartArtNodeLabel` for the fallback layout); this file
 * only turns it into elements.
 */

export type { SvgTextLine };

/** Options for {@link appendSvgTextLines}. */
export interface SvgTextLinesOptions {
	/** Lines to draw, each already carrying its own baseline. */
	lines: SvgTextLine[];
	/** Centre x of the block (text anchor). */
	x: number;
	fill: string;
	fontSize: number;
	/** SVG `font-family`. Omitted when unset. */
	fontFamily?: string;
	/** SVG `text-anchor`. Defaults to `middle`. */
	textAnchor?: 'start' | 'middle' | 'end';
	/** SVG `dominant-baseline`. Defaults to `central`. */
	dominantBaseline?: 'auto' | 'hanging' | 'central';
	/** SVG `font-weight`. Omitted when unset. */
	fontWeight?: number;
	/** SVG `font-style`. Omitted when unset. */
	fontStyle?: string;
}

/**
 * Append a `<text>` built from already-positioned lines. Shapes whose label
 * geometry was resolved upstream (the cached drawing-shape path, or the shared
 * `smartArtNodeLabel` decision function) come in this way, so nothing here
 * recomputes it.
 */
export function appendSvgTextLines(
	doc: Document,
	parent: SVGElement,
	options: SvgTextLinesOptions,
): void {
	const textEl = createSvgEl(doc, 'text', {
		x: options.x,
		'text-anchor': options.textAnchor ?? 'middle',
		'dominant-baseline': options.dominantBaseline ?? 'central',
		fill: options.fill,
		'font-size': options.fontSize,
		'font-family': options.fontFamily,
		'font-weight': options.fontWeight,
		'font-style': options.fontStyle,
	});
	for (const line of options.lines) {
		const tspan = createSvgEl(doc, 'tspan', { x: options.x, y: line.y });
		tspan.textContent = line.text;
		textEl.appendChild(tspan);
	}
	parent.appendChild(textEl);
}

/**
 * Build the `<defs>` element holding a cached shape's gradient paint server.
 *
 * Everything about the gradient (kind, axis endpoints from the OOXML angle,
 * stops) is resolved by the shared projection; this only creates the nodes.
 */
export function buildSvgGradientDefs(doc: Document, gradient: RenderedGradient): SVGElement {
	const defs = createSvgEl(doc, 'defs');
	const server =
		gradient.kind === 'radial'
			? createSvgEl(doc, 'radialGradient', {
					id: gradient.id,
					cx: gradient.cx,
					cy: gradient.cy,
					r: gradient.r,
				})
			: createSvgEl(doc, 'linearGradient', {
					id: gradient.id,
					x1: gradient.x1,
					y1: gradient.y1,
					x2: gradient.x2,
					y2: gradient.y2,
				});
	for (const stop of gradient.stops) {
		server.appendChild(
			createSvgEl(doc, 'stop', {
				offset: stop.offset,
				'stop-color': stop.color,
				'stop-opacity': stop.opacity,
			}),
		);
	}
	defs.appendChild(server);
	return defs;
}

/** Inline style applied to every SmartArt SVG so it fills the element box. */
export const SMARTART_SVG_STYLE = 'width:100%;height:100%;pointer-events:none;display:block';
