/**
 * Small SVG-node helpers for `chart-view-model-dom.ts`'s primitive, pattern
 * and line renderers (moved here from the vanilla binding so the 3D chart
 * overlay can draw the same chart chrome). Split out to keep that file within
 * the repo's ~300-LOC limit.
 *
 * @module chart-view-model-dom-helpers
 */
import { chartPartToAttrs } from './chart-interaction';
import type { ChartPartRef, ChartSvgDef } from './chart-view-model';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Set attributes on an SVG element, skipping undefined values. */
export function setSvgAttrs(el: Element, attrs: Record<string, string | number | undefined>): void {
	for (const [name, value] of Object.entries(attrs)) {
		if (value !== undefined) {
			el.setAttribute(name, String(value));
		}
	}
}

/** Create an SVG element in `doc` with the given attributes (undefined values skipped). */
export function createSvgEl<K extends keyof SVGElementTagNameMap>(
	doc: Document,
	tag: K,
	attrs?: Record<string, string | number | undefined>,
): SVGElementTagNameMap[K] {
	const el = doc.createElementNS(SVG_NS, tag);
	if (attrs) {
		setSvgAttrs(el, attrs);
	}
	return el;
}

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
