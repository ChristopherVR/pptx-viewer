import type {
	ChartPartRef,
	ChartViewModel,
	SvgLine,
	SvgPrimitive,
	SvgText,
} from 'pptx-viewer-shared';
import { chartPartToAttrs } from 'pptx-viewer-shared';

import { applyStyleMap, createSvgEl, setSvgAttrs } from '../dom';

/**
 * Vanilla projector for the framework-agnostic chart view-model engine.
 *
 * `pptx-viewer-shared`'s `buildChartViewModel` projects a chart element into a
 * `ChartViewModel` of pure `SvgPrimitive` descriptors; this module maps that
 * descriptor list to real SVG DOM, mirroring Vue's `ChartViewModelSvg.vue` and
 * React's `renderChartViewModel`, so all geometry / layout / data math stays
 * shared and only the DOM emission lives here.
 */

const LEGEND_ITEM_WIDTH = 80;

/** Render a full `ChartViewModel` to an `<svg>` element. */
export function renderChartViewModelSvg(
	doc: Document,
	vm: ChartViewModel,
	preserveAspectRatio: 'none' | 'xMidYMid meet',
): SVGSVGElement {
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptxv-chart-svg',
		viewBox: `0 0 ${vm.svgWidth} ${vm.svgHeight}`,
		preserveAspectRatio,
	});
	applyStyleMap(svg, { width: '100%', height: '100%', display: 'block' });

	svg.appendChild(
		createSvgEl(doc, 'rect', {
			x: 0,
			y: 0,
			width: vm.svgWidth,
			height: vm.svgHeight,
			fill: '#0f172a11',
		}),
	);

	if (vm.title) {
		const title = createSvgEl(doc, 'text', {
			x: vm.titleX,
			y: vm.titleY,
			'text-anchor': 'middle',
			'font-size': 12,
			'font-weight': 600,
			fill: '#1e293b',
			'data-chart-part': 'title',
		});
		title.textContent = vm.title;
		svg.appendChild(title);
	}

	for (const gl of vm.gridlines) {
		svg.appendChild(renderLine(doc, gl));
	}
	for (const gl of vm.secondaryGridlines ?? []) {
		svg.appendChild(renderLine(doc, gl));
	}
	for (const lbl of vm.axisLabels) {
		svg.appendChild(renderText(doc, lbl));
	}
	for (const lbl of vm.secondaryAxisLabels ?? []) {
		svg.appendChild(renderText(doc, lbl));
	}
	if (vm.zeroLine) {
		svg.appendChild(renderLine(doc, vm.zeroLine));
	}
	for (const lbl of vm.categoryLabels) {
		svg.appendChild(renderText(doc, lbl));
	}

	for (const prim of vm.primitives) {
		const node = renderPrimitive(doc, prim);
		if (node) {
			svg.appendChild(node);
		}
	}

	for (const dl of vm.dataLabels) {
		svg.appendChild(renderText(doc, dl));
	}

	appendLegend(doc, svg, vm);
	return svg;
}

/** One `SvgPrimitive` descriptor to its SVG node (`null` for non-visual kinds). */
function renderPrimitive(doc: Document, prim: SvgPrimitive): SVGElement | null {
	switch (prim.kind) {
		case 'rect': {
			const el = createSvgEl(doc, 'rect', {
				x: prim.x,
				y: prim.y,
				width: prim.w,
				height: prim.h,
				fill: prim.fill,
				rx: prim.rx ?? 0,
				opacity: prim.opacity ?? 1,
			});
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'path': {
			const el = createSvgEl(doc, 'path', {
				d: prim.d,
				fill: prim.fill,
				stroke: prim.stroke ?? 'none',
				'stroke-width': prim.strokeWidth ?? 0,
				'fill-opacity': prim.opacity ?? 1,
			});
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'polyline': {
			const el = createSvgEl(doc, 'polyline', {
				points: prim.points,
				stroke: prim.stroke,
				'stroke-width': prim.strokeWidth,
				fill: prim.fill,
				opacity: prim.opacity ?? 1,
			});
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'circle': {
			const el = createSvgEl(doc, 'circle', {
				cx: prim.cx,
				cy: prim.cy,
				r: prim.r,
				fill: prim.fill,
				opacity: prim.opacity ?? 1,
			});
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'line':
			return renderLine(doc, prim);
		case 'polygon': {
			const el = createSvgEl(doc, 'polygon', {
				points: prim.points,
				fill: prim.fill,
				stroke: prim.stroke,
				'stroke-width': prim.strokeWidth,
				opacity: prim.opacity ?? 1,
				'stroke-dasharray': prim.dashArray,
			});
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'text':
			return renderText(doc, prim);
		// Non-visual descriptor (gradient defs); the Vue/React projectors skip
		// it in their primitive switch as well.
		case 'areaGradient':
			return null;
	}
}

function renderLine(doc: Document, line: SvgLine): SVGLineElement {
	return createSvgEl(doc, 'line', {
		x1: line.x1,
		y1: line.y1,
		x2: line.x2,
		y2: line.y2,
		stroke: line.stroke,
		'stroke-width': line.strokeWidth,
		'stroke-dasharray': line.dashArray,
		opacity: line.opacity ?? 1,
	});
}

function renderText(doc: Document, text: SvgText): SVGTextElement {
	const el = createSvgEl(doc, 'text', {
		x: text.x,
		y: text.y,
		'text-anchor': text.textAnchor,
		'font-size': text.fontSize,
		fill: text.fill,
		'font-weight': text.fontWeight ?? 'normal',
		'dominant-baseline': text.dominantBaseline,
		opacity: text.opacity ?? 1,
		transform: text.transform,
	});
	el.textContent = text.text;
	return el;
}

/**
 * `data-chart-*` hit-testing attributes for a tagged data-mark primitive.
 * Inert without pointer events; emitted for parity with the other bindings so
 * hosts layering interaction on top can reuse the same shared hit-testing.
 */
function applyPartAttrs(el: SVGElement, part: ChartPartRef | undefined): void {
	if (part) {
		setSvgAttrs(el, chartPartToAttrs(part));
	}
}

/** Legend swatches + labels (horizontal row, or a vertical stack on the side). */
function appendLegend(doc: Document, svg: SVGSVGElement, vm: ChartViewModel): void {
	const vertical = vm.legendAnchor === 'start';
	vm.legend.forEach((entry, i) => {
		const x = vertical
			? vm.legendX
			: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH;
		const y = vertical ? vm.legendY + i * 14 : vm.legendY;
		const g = createSvgEl(doc, 'g', {
			class: 'pptxv-chart-legend-item',
			transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`,
		});
		g.appendChild(
			createSvgEl(doc, 'rect', { x: 0, y: -7, width: 10, height: 10, rx: 2, fill: entry.color }),
		);
		const label = createSvgEl(doc, 'text', { x: 13, y: 3, 'font-size': 9, fill: '#475569' });
		label.textContent = entry.label;
		g.appendChild(label);
		svg.appendChild(g);
	});
}
