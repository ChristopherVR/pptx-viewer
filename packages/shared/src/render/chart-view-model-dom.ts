/**
 * Pure-DOM projector for the framework-agnostic chart view-model engine.
 *
 * `buildChartViewModel` projects a chart element into a `ChartViewModel` of
 * pure `SvgPrimitive` descriptors; this module maps that descriptor list to
 * real SVG DOM (no framework), mirroring Vue's `ChartViewModelSvg.vue` and
 * React's `renderChartViewModel`. The vanilla binding renders its charts with
 * it, and the 3D chart scene draws its SVG chrome overlay (title, legend,
 * axis labels) with the same code so 2D and 3D text match exactly.
 *
 * Moved here from `packages/vanilla/src/viewer/render/elements/chart-svg.ts`.
 *
 * @module chart-view-model-dom
 */
import { computeChartLegendLayout } from './chart-legend-layout';
import type { ChartViewModel, SvgLine, SvgPrimitive, SvgText } from './chart-view-model';
import {
	appendTitle,
	applyPartAttrs,
	createSvgEl,
	renderPatternDef,
} from './chart-view-model-dom-helpers';

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
	svg.style.setProperty('width', '100%');
	svg.style.setProperty('height', '100%');
	svg.style.setProperty('display', 'block');

	// c:dPt/c:pictureOptions picture-fill patterns, rendered before anything
	// references them via fill="url(#...)".
	if (vm.defs && vm.defs.length > 0) {
		const defs = createSvgEl(doc, 'defs', {});
		for (const def of vm.defs) {
			defs.appendChild(renderPatternDef(doc, def));
		}
		svg.appendChild(defs);
	}

	// Skipped entirely when the deck declares `<a:noFill/>` on `c:chartSpace`:
	// an SVG `rect` with no `fill` paints black, so the element must not exist.
	if (vm.areaFill) {
		svg.appendChild(
			createSvgEl(doc, 'rect', {
				x: 0,
				y: 0,
				width: vm.svgWidth,
				height: vm.svgHeight,
				rx: vm.areaRadius,
				fill: vm.areaFill,
			}),
		);
	}

	if (vm.title) {
		const title = createSvgEl(doc, 'text', {
			x: vm.titleX,
			y: vm.titleY,
			'text-anchor': 'middle',
			'font-size': vm.titleStyle?.fontSize ?? 12,
			'font-weight': vm.titleStyle?.fontWeight ?? 600,
			'font-family': vm.titleStyle?.fontFamily,
			fill: vm.titleStyle?.fill ?? '#1e293b',
			'data-chart-part': 'title',
		});
		if (vm.titleRunSpans && vm.titleRunSpans.length > 0) {
			for (const run of vm.titleRunSpans) {
				const tspan = createSvgEl(doc, 'tspan', {
					'font-size': run.fontSize,
					'font-weight': run.fontWeight,
					'font-style': run.fontStyle,
					'font-family': run.fontFamily,
					fill: run.fill,
				});
				tspan.textContent = run.text;
				title.appendChild(tspan);
			}
		} else {
			title.textContent = vm.title;
		}
		svg.appendChild(title);
	}

	for (const gl of vm.gridlines) {
		svg.appendChild(renderChartLineSvg(doc, gl));
	}
	for (const gl of vm.secondaryGridlines ?? []) {
		svg.appendChild(renderChartLineSvg(doc, gl));
	}
	for (const lbl of vm.axisLabels) {
		svg.appendChild(renderChartTextSvg(doc, lbl));
	}
	for (const lbl of vm.secondaryAxisLabels ?? []) {
		svg.appendChild(renderChartTextSvg(doc, lbl));
	}
	if (vm.zeroLine) {
		svg.appendChild(renderChartLineSvg(doc, vm.zeroLine));
	}
	for (const lbl of vm.categoryLabels) {
		svg.appendChild(renderChartTextSvg(doc, lbl));
	}

	for (const prim of vm.primitives) {
		const node = renderChartPrimitiveSvg(doc, prim);
		if (node) {
			svg.appendChild(node);
		}
	}

	for (const dl of vm.dataLabels) {
		svg.appendChild(renderChartTextSvg(doc, dl));
	}

	appendChartLegendSvg(doc, svg, vm);
	return svg;
}

/** One `SvgPrimitive` descriptor to its SVG node (`null` for non-visual kinds). */
export function renderChartPrimitiveSvg(doc: Document, prim: SvgPrimitive): SVGElement | null {
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
			appendTitle(doc, el, prim.title);
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'path': {
			const el = createSvgEl(doc, 'path', {
				d: prim.d,
				fill: prim.fill,
				stroke: prim.stroke ?? 'none',
				'stroke-width': prim.strokeWidth ?? 0,
				'stroke-dasharray': prim.dashArray,
				'fill-opacity': prim.opacity ?? 1,
			});
			// The shared descriptor's tooltip, as an SVG <title> child. It is the
			// shape's ACCESSIBLE NAME as well as its hover text, and a choropleth
			// patch carries no label of its own: without it a region map announces
			// nothing and names nothing.
			appendTitle(doc, el, prim.title);
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
			appendTitle(doc, el, prim.title);
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
			appendTitle(doc, el, prim.title);
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'line':
			return renderChartLineSvg(doc, prim);
		case 'polygon': {
			const el = createSvgEl(doc, 'polygon', {
				points: prim.points,
				fill: prim.fill,
				stroke: prim.stroke,
				'stroke-width': prim.strokeWidth,
				opacity: prim.opacity ?? 1,
				'stroke-dasharray': prim.dashArray,
				transform: prim.transform,
			});
			appendTitle(doc, el, prim.title);
			applyPartAttrs(el, prim.part);
			return el;
		}
		case 'text':
			return renderChartTextSvg(doc, prim);
		// Non-visual descriptor (gradient defs); the Vue/React projectors skip
		// it in their primitive switch as well.
		case 'areaGradient':
			return null;
	}
}

export function renderChartLineSvg(doc: Document, line: SvgLine): SVGLineElement {
	const el = createSvgEl(doc, 'line', {
		x1: line.x1,
		y1: line.y1,
		x2: line.x2,
		y2: line.y2,
		stroke: line.stroke,
		'stroke-width': line.strokeWidth,
		'stroke-dasharray': line.dashArray,
		opacity: line.opacity ?? 1,
		transform: line.transform,
	});
	appendTitle(doc, el, line.title);
	return el;
}

export function renderChartTextSvg(doc: Document, text: SvgText): SVGTextElement {
	const el = createSvgEl(doc, 'text', {
		x: text.x,
		y: text.y,
		'text-anchor': text.textAnchor,
		'font-size': text.fontSize,
		fill: text.fill,
		'font-weight': text.fontWeight ?? 'normal',
		'font-style': text.fontStyle ?? 'normal',
		'font-family': text.fontFamily,
		'dominant-baseline': text.dominantBaseline,
		opacity: text.opacity ?? 1,
		transform: text.transform,
	});
	el.textContent = text.text;
	return el;
}

/** Legend swatches + labels (horizontal row, or a vertical stack on the side). */
export function appendChartLegendSvg(doc: Document, svg: SVGElement, vm: ChartViewModel): void {
	computeChartLegendLayout(vm).forEach((item) => {
		const g = createSvgEl(doc, 'g', {
				class: 'pptxv-chart-legend-item',
				transform: `translate(${item.x.toFixed(1)},${item.y.toFixed(1)})`,
			}),
			label = createSvgEl(doc, 'text', {
				x: 13,
				y: 3,
				'font-size': item.fontSize,
				fill: item.fill,
				'font-weight': item.fontWeight,
				'font-style': item.fontStyle,
				'font-family': item.fontFamily,
			});
		if (item.lineSwatch) {
			for (const prim of item.lineSwatch.primitives) {
				const node = renderChartPrimitiveSvg(doc, prim);
				if (node) {
					g.appendChild(node);
				}
			}
		} else {
			g.appendChild(
				createSvgEl(doc, 'rect', { x: 0, y: -7, width: 10, height: 10, rx: 2, fill: item.color }),
			);
		}
		label.textContent = item.label;
		g.appendChild(label);
		svg.appendChild(g);
	});
}
