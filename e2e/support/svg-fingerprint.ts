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
 * @module e2e/support/svg-fingerprint
 */
import type { Page } from '@playwright/test';

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
	texts: SvgTextNode[];
}

/**
 * Capture every chart `<svg>` on the current slide.
 *
 * Geometry is read from the SVG *attributes* rather than computed style or
 * client rects: they are the values the shared view model emitted, in the
 * chart's own user-space units, so they are already free of the per-binding
 * stage zoom and need no normalisation.
 */
export async function fingerprintCharts(page: Page): Promise<SvgChartFingerprint[]> {
	return page.evaluate(() => {
		const round = (value: number): number => Math.round(value * 100) / 100;
		const num = (value: string | null): number => {
			const parsed = Number.parseFloat(value ?? '');
			return Number.isFinite(parsed) ? round(parsed) : 0;
		};

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
			for (const node of svg.querySelectorAll('*')) {
				const tag = node.tagName.toLowerCase();
				if (PAINTED.has(tag)) {
					primitives[tag] = (primitives[tag] ?? 0) + 1;
				}
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
				texts,
			} satisfies SvgChartFingerprint;
		});
	});
}

/** Every way a binding's charts disagree with the reference's, in plain lines. */
export function diffCharts(
	reference: SvgChartFingerprint[],
	candidate: SvgChartFingerprint[],
): string[] {
	const problems: string[] = [];
	const byId = new Map(candidate.map((chart) => [chart.elementId, chart]));

	for (const expected of reference) {
		const actual = byId.get(expected.elementId);
		if (!actual) {
			problems.push(`chart ${expected.elementId}: not rendered`);
			continue;
		}
		byId.delete(expected.elementId);

		if (expected.taggedAsElement !== actual.taggedAsElement) {
			problems.push(
				`chart ${expected.elementId}: data-pptx-element is ${
					actual.taggedAsElement ? 'set' : 'MISSING'
				}, reference has it ${expected.taggedAsElement ? 'set' : 'unset'} (the chart is not part of the neutral element contract in this binding)`,
			);
		}

		// The chart box is laid out by the binding, so allow a hair of rounding.
		if (Math.abs(expected.aspect - actual.aspect) > 0.02) {
			problems.push(
				`chart ${expected.elementId}: aspect ${actual.aspect} vs reference ${expected.aspect}`,
			);
		}

		for (const tag of new Set([
			...Object.keys(expected.primitives),
			...Object.keys(actual.primitives),
		])) {
			const want = expected.primitives[tag] ?? 0;
			const got = actual.primitives[tag] ?? 0;
			if (want !== got) {
				problems.push(
					`chart ${expected.elementId}: paints ${got} <${tag}> where the reference paints ${want}`,
				);
			}
		}

		if (expected.texts.length !== actual.texts.length) {
			problems.push(
				`chart ${expected.elementId}: ${actual.texts.length} text nodes vs reference ${expected.texts.length}`,
			);
			continue;
		}
		expected.texts.forEach((want, index) => {
			const got = actual.texts[index];
			for (const key of [
				'text',
				'fontSize',
				'fontWeight',
				'fontFamily',
				'fill',
				'textAnchor',
				'transform',
			] as const) {
				if (want[key] !== got[key]) {
					problems.push(
						`chart ${expected.elementId} text #${index} ("${want.text}"): ${key} is "${got[key]}", reference has "${want[key]}"`,
					);
				}
			}
			for (const axis of ['x', 'y'] as const) {
				// User-space units straight off the shared view model: these should be
				// equal outright, so the allowance is only for float formatting.
				if (Math.abs(want[axis] - got[axis]) > 0.51) {
					problems.push(
						`chart ${expected.elementId} text #${index} ("${want.text}"): ${axis} is ${got[axis]}, reference has ${want[axis]}`,
					);
				}
			}
		});
	}

	for (const extra of byId.values()) {
		problems.push(`chart ${extra.elementId}: rendered, but the reference has no such chart`);
	}

	return problems;
}
