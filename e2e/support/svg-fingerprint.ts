/**
 * SVG primitive capture, for the parts of a slide the bindings do not lay out
 * themselves.
 *
 * Charts are the strongest parity case in the repo: `packages/shared/src/render/
 * chart-view-model.ts` resolves the entire scene (bars, axes, gridlines, label
 * text and its typography) into a framework-agnostic primitive list, and each
 * binding does nothing but paint those primitives. Nothing per-binding sits
 * between the model and the DOM, so unlike HTML text - where four bindings
 * legitimately inherit different chrome fonts - chart SVG should be
 * attribute-for-attribute identical. That makes it worth asserting strictly:
 * any difference at all is a binding failing to paint what the shared engine
 * told it to.
 *
 * The comparison logic lives in `support/svg-diff` and is re-exported here so
 * existing callers keep one import site.
 *
 * @module e2e/support/svg-fingerprint
 */
import type { Page } from '@playwright/test';

export { diffCharts } from './svg-diff';

/** One `<text>` node inside a rendered chart. */
export interface SvgTextNode {
	text: string;
	x: number;
	y: number;
	fontSize: string;
	fontWeight: string;
	fontFamily: string;
	fill: string;
	textAnchor: string;
	transform: string;
}

/** One painted non-text primitive inside a rendered chart. */
export interface SvgPrimitiveShape {
	tag: string;
	/** Computed `fill`, with `url(#...)` paint-server ids neutralised. */
	fill: string;
	/** Computed `stroke`, with `url(#...)` paint-server ids neutralised. */
	stroke: string;
	/** Computed `stroke-width`, e.g. `1px`. */
	strokeWidth: string;
	/**
	 * Geometry in the chart's user-space units, rounded to 2 decimals:
	 * rect/image `x,y,w,h`; circle `cx,cy,r`; ellipse `cx,cy,rx,ry`; line
	 * `x1,y1,x2,y2`; path/polygon/polyline the `getBBox()` box `x,y,w,h`
	 * (bounding boxes rather than raw `d` strings, so float formatting in the
	 * path data cannot masquerade as a rendering difference).
	 */
	geometry: number[];
}

/** The primitive census of one chart element. */
export interface SvgChartFingerprint {
	/** `data-element-id`, the core-assigned join key. */
	elementId: string;
	/** Viewport-relative aspect ratio of the chart box. */
	aspect: number;
	/**
	 * Whether the chart host carries `data-pptx-element="true"`.
	 *
	 * Captured rather than assumed: charts are found through the accessibility
	 * contract here precisely because two bindings do not tag their chart frames
	 * as elements, and a spec that selected on the element marker would silently
	 * find no charts in those two and pass.
	 */
	taggedAsElement: boolean;
	/** Count of each primitive tag, e.g. `{ rect: 12, path: 3 }`. */
	primitives: Record<string, number>;
	/** Every painted non-text primitive, with paint and geometry. */
	shapes: SvgPrimitiveShape[];
	texts: SvgTextNode[];
}

/**
 * Capture every chart `<svg>` on the current slide.
 *
 * Geometry is read from the SVG *attributes* (and `getBBox()` for paths)
 * rather than client rects: they are the values the shared view model emitted,
 * in the chart's own user-space units, so they are already free of the
 * per-binding stage zoom and need no normalisation. Paint is read from
 * computed style so `#ff0000`, `red` and `rgb(255, 0, 0)` compare equal.
 */
export async function fingerprintCharts(page: Page): Promise<SvgChartFingerprint[]> {
	return page.evaluate(() => {
		const round = (value: number): number => Math.round(value * 100) / 100;
		const num = (value: string | null): number => {
			const parsed = Number.parseFloat(value ?? '');
			return Number.isFinite(parsed) ? round(parsed) : 0;
		};
		// Paint-server references embed generated ids that legitimately differ
		// per binding; the reference target is compared structurally elsewhere.
		const paint = (value: string): string => value.replace(/url\([^)]*\)/gu, 'url(ref)');

		// Scoped to the main stage, not the whole viewport: at least one binding
		// paints a second copy of the chart elsewhere in the scroll area, and the
		// thumbnail rail draws its own.
		const stage = document.querySelector('[aria-roledescription="slide"]');
		if (!stage) {
			return [];
		}
		const hosts = [...stage.querySelectorAll('[aria-roledescription="chart"]')].filter((host) =>
			host.querySelector('svg'),
		);

		return hosts.map((host, index) => {
			const svg = host.querySelector('svg')!;
			const box = svg.getBoundingClientRect();

			// Only marks that put ink on the slide. `<g>`, `<defs>` and `<clipPath>`
			// are how a binding chooses to nest what it draws, not what it draws:
			// counting them reports a wrapper element as a rendering difference.
			const PAINTED = new Set([
				'rect',
				'path',
				'circle',
				'ellipse',
				'line',
				'polygon',
				'polyline',
				'text',
				'image',
			]);
			const primitives: Record<string, number> = {};
			const shapes: {
				tag: string;
				fill: string;
				stroke: string;
				strokeWidth: string;
				geometry: number[];
			}[] = [];
			for (const node of svg.querySelectorAll('*')) {
				const tag = node.tagName.toLowerCase();
				if (!PAINTED.has(tag)) {
					continue;
				}
				primitives[tag] = (primitives[tag] ?? 0) + 1;
				if (tag === 'text') {
					continue; // captured with typography below
				}
				const a = (name: string): number => num(node.getAttribute(name));
				let geometry: number[] = [];
				if (tag === 'rect' || tag === 'image') {
					geometry = [a('x'), a('y'), a('width'), a('height')];
				} else if (tag === 'circle') {
					geometry = [a('cx'), a('cy'), a('r')];
				} else if (tag === 'ellipse') {
					geometry = [a('cx'), a('cy'), a('rx'), a('ry')];
				} else if (tag === 'line') {
					geometry = [a('x1'), a('y1'), a('x2'), a('y2')];
				} else if (node instanceof SVGGraphicsElement) {
					try {
						const bbox = node.getBBox();
						geometry = [round(bbox.x), round(bbox.y), round(bbox.width), round(bbox.height)];
					} catch {
						geometry = [];
					}
				}
				const style = getComputedStyle(node);
				shapes.push({
					tag,
					fill: paint(style.fill),
					stroke: paint(style.stroke),
					strokeWidth: style.strokeWidth,
					geometry,
				});
			}

			// SVG presentation attributes are compared at their resolved values: an
			// omitted `font-weight` and an explicit `font-weight="normal"` paint the
			// same glyphs, and reporting that as a difference buries the real ones.
			const attr = (node: Element, name: string, fallback: string): string =>
				node.getAttribute(name) ?? fallback;

			const texts = [...svg.querySelectorAll('text')].map((node) => ({
				text: (node.textContent ?? '').replace(/\s+/gu, ' ').trim(),
				x: num(node.getAttribute('x')),
				y: num(node.getAttribute('y')),
				fontSize: attr(node, 'font-size', ''),
				fontWeight: attr(node, 'font-weight', 'normal'),
				fontFamily: attr(node, 'font-family', ''),
				fill: attr(node, 'fill', 'black'),
				textAnchor: attr(node, 'text-anchor', 'start'),
				transform: attr(node, 'transform', 'none'),
			}));

			return {
				elementId: host.getAttribute('data-element-id') ?? `chart-${index}`,
				aspect: box.height === 0 ? 0 : round(box.width / box.height),
				taggedAsElement: host.getAttribute('data-pptx-element') === 'true',
				primitives,
				shapes,
				texts,
			} satisfies SvgChartFingerprint;
		});
	});
}
