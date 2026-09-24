/**
 * `<pptx-three-view>` scene for the perspective 3D line / area charts
 * (`chart-3d-persp-layout.ts`): the box's gridlines and marks in WebGL
 * through PowerPoint's fitted camera, its labels, title and legend in the SVG
 * overlay, and hover / select / drag on the shared mark interaction.
 *
 * A pick resolves to the nearest category along the hit series; a vertical
 * drag moves that point's value (standard grouping only, as in the 2D
 * chart), at the screen scale of the value axis at that point.
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
import { buildPerspPrisms, perspRowSpan, perspValueY } from './chart-3d-persp-marks';
import { buildPerspMeshes } from './chart-3d-persp-mesh';
import { buildPerspCamera, perspToScreen } from './chart-3d-persp-view';
import { roundDragValue } from './chart-interaction';
import type { ChartViewModel } from './chart-view-model-types';

/** Selection marker colour (the 2D selected-mark accent). */
const SELECTED_COLOR = 0x2563eb;

export interface PerspSceneInput {
	vm: ChartViewModel;
	layout: PerspChartLayout;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
}

/** Nearest category to a box x. */
function nearestCategory(layout: PerspChartLayout, x: number): number {
	let best = 0;
	layout.categoryX.forEach((cx, i) => {
		if (Math.abs(cx - x) < Math.abs(layout.categoryX[best] - x)) {
			best = i;
		}
	});
	return best;
}

export function mountPerspChartView(input: PerspSceneInput, ctx: ThreeViewContext): ThreeViewScene {
	const three = ctx.three;
	const { vm, layout, chartData } = input;
	const camera = buildPerspCamera(three, layout.view, vm.svgWidth, vm.svgHeight);
	const scene = new three.Scene();
	const marks = buildPerspMeshes(three, layout, buildPerspPrisms(chartData, layout));
	scene.add(marks.group);

	const markerGeometry = new three.OctahedronGeometry(layout.view.box.w * 0.012);
	const markerMaterial = new three.MeshBasicMaterial({ color: SELECTED_COLOR });
	const marker = new three.Mesh(markerGeometry, markerMaterial);
	marker.visible = false;
	marks.group.add(marker);

	const overlay = renderChart3DChromeOverlaySvg(ctx.document, vm, {
		labels: layout.labels,
		reverseLegend: false,
	});
	ctx.overlay.appendChild(overlay);

	const stacked = layout.grouping !== 'standard';
	const rowOf = (seriesIndex: number): number => (stacked ? 0 : seriesIndex);
	const valueAt = (point: Chart3DPoint): number | undefined => {
		const v = chartData.series[point.seriesIndex]?.values[point.pointIndex];
		return v !== undefined && Number.isFinite(v) ? v : undefined;
	};
	function placeMarker(point: Chart3DPoint, value: number): void {
		const [z0, z1] = perspRowSpan(layout, rowOf(point.seriesIndex));
		marker.position.set(
			layout.categoryX[point.pointIndex],
			perspValueY(layout, value),
			(z0 + z1) / 2,
		);
	}

	const interaction = attachChart3DMarkInteraction({
		ctx,
		camera,
		scene,
		svgHeight: vm.svgHeight,
		chartData,
		categoryLabels: input.categoryLabels,
		seriesNames: chartData.series.map((s) => s.name),
		adapter: {
			targets: marks.meshes,
			pointAt(hit) {
				const seriesIndex = (hit.object.userData as { seriesIndex?: number }).seriesIndex;
				if (seriesIndex === undefined) {
					return null;
				}
				const local = marks.group.worldToLocal(hit.point.clone());
				return { seriesIndex, pointIndex: nearestCategory(layout, local.x) };
			},
			valueOf: valueAt,
			beginDrag(point) {
				const start = valueAt(point);
				if (stacked || start === undefined) {
					return null;
				}
				const [z0, z1] = perspRowSpan(layout, rowOf(point.seriesIndex));
				const x = layout.categoryX[point.pointIndex];
				const z = (z0 + z1) / 2;
				const unit = layout.range.majorUnit || 1;
				const y0 = perspToScreen(layout.view, [x, perspValueY(layout, start), z]).y;
				const y1 = perspToScreen(layout.view, [
					x,
					perspValueY(layout, start) + unit * layout.valueScale,
					z,
				]).y;
				const pxPerValue = (y0 - y1) / unit;
				const span = layout.range.max - layout.range.min;
				return {
					preview(_dx, dy) {
						const value = roundDragValue(start - dy / (pxPerValue || 1), {
							min: layout.range.min,
							max: layout.range.max,
							span,
						});
						marks.setPrism(
							point.seriesIndex,
							buildPerspPrisms(chartData, layout, { ...point, value })[point.seriesIndex],
						);
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
