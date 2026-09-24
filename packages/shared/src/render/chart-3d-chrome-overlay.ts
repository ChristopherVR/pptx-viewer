import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
/**
 * chart-3d-chrome-overlay.ts: the SVG "chrome" (chart-area fill/border,
 * title, legend, value-axis gridlines/ticks, category labels) a 3D chart
 * scene draws OVER its WebGL canvas via `ctx.overlay`.
 *
 * PowerPoint's own 3D charts always show this chrome exactly like the 2D
 * chart does (see the parity brief's "hybrid rendering" requirement); for a
 * chart in the oblique (`rAngAx=1`) projection family this chrome is
 * ALREADY pixel-correct in the flat 2D `ChartViewModel` (verified against
 * `gt/chart-01.webp`: axes/gridlines/title/legend sit exactly where a plain
 * 2D chart would put them, perfectly undistorted), so this module reuses the
 * SAME `chart-view-model-dom.ts` piece-renderers the 2D/vanilla projector
 * uses, just WITHOUT `vm.primitives`/`vm.dataLabels` (the flat oblique
 * bars/extrusion polygons, replaced by real WebGL geometry).
 *
 * @module chart-3d-chrome-overlay
 */
import {
	appendChartLegendSvg,
	renderChartLineSvg,
	renderChartTextSvg,
} from './chart-view-model-dom';
import { createSvgEl } from './chart-view-model-dom-helpers';
import type { ChartViewModel } from './chart-view-model-types';

/**
 * Render a `ChartViewModel`'s chrome (everything except data marks) to an
 * `<svg>` sized to `vm.svgWidth` x `vm.svgHeight`, matching the WebGL
 * scene's own world-unit convention (1 world unit = 1 authored chart px) so
 * an element positioned from the same view-model's rects lines up exactly.
 */
export function renderChart3DChromeOverlaySvg(
	doc: Document,
	source: ChartViewModel,
	oblique?: ObliqueChartLayout,
): SVGSVGElement {
	const vm = oblique ? withObliqueChromePositions(source) : source;
	const svg = createSvgEl(doc, 'svg', {
		class: 'pptxv-chart-3d-chrome',
		viewBox: `0 0 ${vm.svgWidth} ${vm.svgHeight}`,
		preserveAspectRatio: 'none',
	});
	svg.style.setProperty('width', '100%');
	svg.style.setProperty('height', '100%');
	svg.style.setProperty('display', 'block');
	svg.style.setProperty('position', 'absolute');
	svg.style.setProperty('inset', '0');
	// The WebGL canvas paints the marks; this overlay only adds chrome on top
	// of them, so pointer events must fall through to the canvas underneath.
	svg.style.setProperty('pointer-events', 'none');

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

	if (oblique) {
		// The box's gridlines are drawn in the scene (bars hide the back
		// wall); only its axis labels go here.
		appendObliqueLabels(doc, svg, vm, oblique);
		// PowerPoint lists a clustered horizontal bar chart's legend bottom-up,
		// matching the order the series stack up the category axis.
		const legendVm =
			oblique.horizontal && oblique.grouping === 'clustered'
				? { ...vm, legend: [...vm.legend].reverse() }
				: vm;
		appendChartLegendSvg(doc, svg, legendVm);
		return svg;
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

	appendChartLegendSvg(doc, svg, vm);
	return svg;
}

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Title baseline below the chart top, and legend baseline above its bottom, measured on `gt/chart-01`. */
const OBLIQUE_TITLE_BASELINE = 24 * PT;
const OBLIQUE_LEGEND_BASELINE = 14 * PT;

/** The flat view model with its title and legend moved to where PowerPoint puts them on a 3D chart. */
function withObliqueChromePositions(vm: ChartViewModel): ChartViewModel {
	const legendBottom = (vm.legendY ?? vm.svgHeight - 8) >= vm.svgHeight / 2;
	return {
		...vm,
		titleY: OBLIQUE_TITLE_BASELINE,
		// Legend text sits 3px below `legendY` (see `appendChartLegendSvg`).
		legendY: legendBottom ? vm.svgHeight - OBLIQUE_LEGEND_BASELINE - 3 : vm.legendY,
	};
}

function appendObliqueLabels(
	doc: Document,
	svg: SVGElement,
	vm: ChartViewModel,
	layout: ObliqueChartLayout,
): void {
	const style = vm.axisLabels[0];
	for (const label of layout.labels) {
		svg.appendChild(
			renderChartTextSvg(doc, {
				kind: 'text',
				x: label.x,
				y: label.y,
				text: label.text,
				fontSize: label.fontSize,
				fill: style?.fill ?? '#595959',
				fontFamily: style?.fontFamily,
				textAnchor: label.anchor,
				dominantBaseline: label.baseline,
			}),
		);
	}
}
