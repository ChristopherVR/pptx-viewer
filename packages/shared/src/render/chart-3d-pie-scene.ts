/**
 * `<pptx-three-view>` scene for the 3-D Pie (`chart-3d-pie-layout.ts`): the
 * slices in WebGL through the fitted perspective camera, title and legend in
 * the SVG overlay, and hover / select / drag on the shared mark interaction.
 *
 * A slice drag sweeps its trailing edge around the pie like the flat pie
 * (`resolvePieSliceShareValue`): the pointer is unprojected onto the pie's top
 * plane and its angle there sets the slice's share.
 *
 * @module chart-3d-pie-scene
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import { renderChart3DChromeOverlaySvg } from './chart-3d-chrome-overlay';
import { attachChart3DMarkInteraction } from './chart-3d-mark-interaction';
import { buildPerspCamera, perspScreenToPlaneY } from './chart-3d-persp-view';
import { computePieChartLayout, pieRimPoint } from './chart-3d-pie-layout';
import type { PieChartLayout } from './chart-3d-pie-layout';
import { buildPieMarks } from './chart-3d-pie-marks';
import { resolvePieSliceShareValue } from './chart-interaction-pie';
import type { ChartViewModel } from './chart-view-model-types';

/** Selection marker colour (the 2D selected-mark accent). */
const SELECTED_COLOR = 0x2563eb;

export interface PieSceneInput {
	element: PptxElement;
	vm: ChartViewModel;
	layout: PieChartLayout;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
}

/** The layout's slices with one value replaced (a drag preview). */
function slicesWith(input: PieSceneInput, pointIndex: number, value: number) {
	const series = input.chartData.series.map((s, i) =>
		i === 0 ? { ...s, values: s.values.map((v, j) => (j === pointIndex ? value : v)) } : s,
	);
	const element = {
		...input.element,
		chartData: { ...input.chartData, series },
	} as PptxElement;
	return computePieChartLayout(element, input.vm)?.slices ?? input.layout.slices;
}

export function mountPieChartView(input: PieSceneInput, ctx: ThreeViewContext): ThreeViewScene {
	const three = ctx.three;
	const { vm, layout, chartData } = input;
	const camera = buildPerspCamera(three, layout.view, vm.svgWidth, vm.svgHeight);
	const scene = new three.Scene();
	const marks = buildPieMarks(three, layout);
	scene.add(marks.group);

	const markerGeometry = new three.OctahedronGeometry(0.03);
	const markerMaterial = new three.MeshBasicMaterial({ color: SELECTED_COLOR });
	const marker = new three.Mesh(markerGeometry, markerMaterial);
	marker.visible = false;
	marks.group.add(marker);

	const overlay = renderChart3DChromeOverlaySvg(ctx.document, vm, {
		labels: [],
		reverseLegend: false,
	});
	ctx.overlay.appendChild(overlay);

	const values = (): number[] => chartData.series[0]?.values.slice() ?? [];
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
				const pointIndex = (hit.object.userData as { pointIndex?: number }).pointIndex;
				return pointIndex === undefined ? null : { seriesIndex: 0, pointIndex };
			},
			valueOf(point) {
				const v = chartData.series[0]?.values[point.pointIndex];
				return v !== undefined && Number.isFinite(v) ? v : undefined;
			},
			beginDrag(point) {
				const slice = layout.slices[point.pointIndex];
				if (!slice) {
					return null;
				}
				const start = values();
				return {
					preview(_dx, _dy, at) {
						const hit = perspScreenToPlaneY(layout.view, at.x, at.y, layout.center.y);
						if (!hit) {
							return start[point.pointIndex];
						}
						const angle = Math.atan2(
							hit.x - layout.center.x - slice.offset.x,
							hit.z - layout.center.z - slice.offset.z,
						);
						const value = resolvePieSliceShareValue(
							angle,
							slice.startAngle,
							start,
							point.pointIndex,
						);
						marks.setSlices(slicesWith(input, point.pointIndex, value));
						return value;
					},
				};
			},
			highlight(point) {
				const slice = point ? layout.slices[point.pointIndex] : undefined;
				marker.visible = slice !== undefined;
				if (slice) {
					const mid = (slice.startAngle + slice.endAngle) / 2;
					const p = pieRimPoint(
						layout.center.x + slice.offset.x,
						layout.center.z + slice.offset.z,
						layout.radius * 0.6,
						mid,
					);
					marker.position.set(p.x, layout.center.y, p.z);
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
