import type { ChartPartRef, ChartSvgDef } from 'pptx-viewer-shared';
import { chartPartToAttrs } from 'pptx-viewer-shared';

import { createSvgEl, setSvgAttrs } from '../dom';

/**
 * Small SVG-node helpers shared by `chart-svg.ts`'s primitive/pattern/line
 * renderers. Split out to keep that file within the repo's ~300-LOC limit.
 */

/** One `ChartSvgDef` (a data point's picture-fill `<pattern>`) to its SVG node. */
export function renderPatternDef(doc: Document, def: ChartSvgDef): SVGElement {
	const pattern = createSvgEl(doc, 'pattern', {
		id: def.id,
		patternUnits: def.patternUnits,
		x: def.x,
		y: def.y,
		width: def.width,
		height: def.height,
	});
	pattern.appendChild(
		createSvgEl(doc, 'image', {
			href: def.href,
			x: 0,
			y: 0,
			width: def.width,
			height: def.height,
			preserveAspectRatio: def.preserveAspectRatio,
		}),
	);
	return pattern;
}

/**
 * Append the shared descriptor's tooltip as an SVG `<title>` child, when set.
 * Shared by every mark-primitive branch (rect / path / polyline / circle /
 * line / polygon) so a hover reveals the same value/label text the other four
 * bindings show.
 */
export function appendTitle(doc: Document, el: SVGElement, title: string | undefined): void {
	if (title === undefined) {
		return;
	}
	const titleEl = createSvgEl(doc, 'title', {});
	titleEl.textContent = title;
	el.appendChild(titleEl);
}

/**
 * `data-chart-*` hit-testing attributes for a tagged data-mark primitive.
 * Inert without pointer events; emitted for parity with the other bindings so
 * hosts layering interaction on top can reuse the same shared hit-testing.
 */
export function applyPartAttrs(el: SVGElement, part: ChartPartRef | undefined): void {
	if (part) {
		setSvgAttrs(el, chartPartToAttrs(part));
	}
}
