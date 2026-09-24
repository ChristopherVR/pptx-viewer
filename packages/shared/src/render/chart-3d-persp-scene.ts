/**
 * `<pptx-three-view>` scene for the perspective 3D line / area / surface
 * charts (`chart-3d-persp-layout.ts`): the box's gridlines and marks in WebGL
 * through PowerPoint's fitted camera, its labels, title and legend in the SVG
 * overlay, and hover / select / drag on the shared mark interaction.
 *
 * A pick resolves to the nearest data point on the hit mark; a vertical drag
 * moves that point's value (not a stacked area's, as in the 2D chart), at the
 * screen scale of the value axis at that point. A surface's legend lists its
 * value bands, as PowerPoint's does.
 *
 * @module chart-3d-persp-scene
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import { renderChart3DChromeOverlaySvg } from './chart-3d-chrome-overlay';
import { attachChart3DMarkInteraction } from './chart-3d-mark-interaction';
import type { Chart3DPoint } from './chart-3d-mark-interaction';
import type { PerspChartLayout } from './chart-3d-persp-layout';
import { buildPerspMarkSet } from './chart-3d-persp-mark-set';
import { surfaceBands } from './chart-3d-persp-surface';
import { buildPerspCamera, perspToScreen } from './chart-3d-persp-view';
import { roundDragValue } from './chart-interaction';
import { DEFAULT_PALETTE } from './chart-view-model-scale';
import type { ChartViewModel, LegendEntry } from './chart-view-model-types';

/** Selection marker colour (the 2D selected-mark accent). */
const SELECTED_COLOR = 0x2563eb;

export interface PerspSceneInput {
	vm: ChartViewModel;
	layout: PerspChartLayout;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
}

/** A surface's legend: one entry per value band (hollow keys for a wireframe). */
function surfaceLegend(
	chartData: PptxChartData,
	layout: PerspChartLayout,
	palette: readonly string[],
	background: string,
	textStyle: LegendEntry['textStyle'],
): LegendEntry[] {
	return surfaceBands(chartData, layout.range, palette).map((band) => ({
		label: band.label,
		color: band.color,
		...(textStyle ? { textStyle } : {}),
		...(chartData.wireframe
			? {
					lineSwatch: {
						primitives: [
							{ kind: 'rect' as const, x: 0, y: -7, w: 10, h: 10, fill: band.color },
							{ kind: 'rect' as const, x: 1, y: -6, w: 8, h: 8, fill: background },
						],
					},
				}
			: {}),
	}));
}

export function mountPerspChartView(input: PerspSceneInput, ctx: ThreeViewContext): ThreeViewScene {
	const three = ctx.three;
	const { vm, layout, chartData } = input;
	const palette = chartData.colorPalette?.length ? chartData.colorPalette : DEFAULT_PALETTE;
	const camera = buildPerspCamera(three, layout.view, vm.svgWidth, vm.svgHeight);
	const scene = new three.Scene();
	const marks = buildPerspMarkSet(three, chartData, layout, palette);
	scene.add(marks.group);

	const markerGeometry = new three.OctahedronGeometry(layout.view.box.w * 0.012);
	const markerMaterial = new three.MeshBasicMaterial({ color: SELECTED_COLOR });
	const marker = new three.Mesh(markerGeometry, markerMaterial);
	marker.visible = false;
	marks.group.add(marker);

	const overlay = renderChart3DChromeOverlaySvg(ctx.document, vm, {
		labels: layout.labels,
		reverseLegend: false,
		legend:
			layout.kind === 'surface'
				? surfaceLegend(
						chartData,
						layout,
						palette,
						vm.areaFill ?? '#ffffff',
						vm.legend[0]?.textStyle,
					)
				: undefined,
	});
	ctx.overlay.appendChild(overlay);

	const valueAt = (point: Chart3DPoint): number | undefined => {
		const v = chartData.series[point.seriesIndex]?.values[point.pointIndex];
		return v !== undefined && Number.isFinite(v) ? v : undefined;
	};
	const placeMarker = (point: Chart3DPoint, value: number): void => {
		marker.position.set(...marks.anchor(point, value));
	};

	const interaction = attachChart3DMarkInteraction({
		ctx,
		camera,
		scene,
		svgHeight: vm.svgHeight,
		chartData,
		categoryLabels: input.categoryLabels,
		seriesNames: chartData.series.map((s) => s.name),
		adapter: {
			targets: marks.targets,
			pointAt: (hit) => marks.pointAt(hit.object, marks.group.worldToLocal(hit.point.clone())),
			valueOf: valueAt,
			beginDrag(point) {
				const start = valueAt(point);
				if (!marks.draggable || start === undefined) {
					return null;
				}
				const unit = layout.range.majorUnit || 1;
				const [x, y, z] = marks.anchor(point, start);
				const y0 = perspToScreen(layout.view, [x, y, z]).y;
				const y1 = perspToScreen(layout.view, [x, y + unit * layout.valueScale, z]).y;
				const pxPerValue = (y0 - y1) / unit || 1;
				const span = layout.range.max - layout.range.min;
				return {
					preview(_dx, dy) {
						const value = roundDragValue(start - dy / pxPerValue, {
							min: layout.range.min,
							max: layout.range.max,
							span,
						});
						marks.preview(point, value);
						if (marker.visible) {
							placeMarker(point, value);
						}
						return value;
					},
				};
			},
			highlight(point) {
				const value = point ? valueAt(point) : undefined;
				marker.visible = point !== null && value !== undefined;
				if (point && value !== undefined) {
					placeMarker(point, value);
				}
			},
			dispose() {
				markerGeometry.dispose();
				markerMaterial.dispose();
			},
		},
	});

	let disposed = false;
	return {
		render(renderer: THREE.WebGLRenderer) {
			renderer.render(scene, camera);
		},
		resize() {
			// The projection is fixed in authored chart px, like the overlay.
		},
		isAnimating: () => false,
		setInteractive: (on) => interaction.setInteractive(on),
		setSelectedPart: (part) => interaction.setSelectedPart(part),
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			interaction.dispose();
			marks.dispose();
			overlay.remove();
		},
	};
}
