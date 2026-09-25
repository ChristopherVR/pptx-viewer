/**
 * PowerPoint's 3-D Pie (`c:pie3DChart`) as a disc in the perspective chart
 * camera (`chart-3d-persp-view.ts`), fitted to `gt/chart-14,15`:
 *
 * - The pie is a puck of radius 1 and thickness `0.23` (box `2 x 0.23 x 2`,
 *   scaled by `c:view3D/@hPercent`), pitched `0.91 * rotX` toward the viewer
 *   (27.2 degrees fitted for rotX 30) and seen from `1.38` box diagonals: a
 *   closer camera than the cartesian charts use, so the front of the pie is
 *   visibly larger than the back.
 * - The first slice starts at 12 o'clock (plus `c:firstSliceAng`) and slices
 *   run clockwise seen from above.
 * - The unexploded puck fits the plot rect; exploding shrinks the radius by
 *   `1 / (1 + explosion)` and moves each slice out along its bisector by its
 *   own explosion, so an exploded pie keeps the same footprint.
 *
 * @module chart-3d-pie-layout
 */
import type { PptxElement } from 'pptx-viewer-core';

import { fitPerspView, perspCameraFor } from './chart-3d-persp-view';
import type { PerspView } from './chart-3d-persp-view';
import type { ChartViewModel } from './chart-view-model-types';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Puck thickness per unit radius. */
const PIE_THICKNESS = 0.23;
/** Fitted pitch per degree of rotX. */
const PIE_PITCH_PER_ROTX = 0.91;
/** Fitted camera distance, in box diagonals. */
const PIE_CAMERA_DIAGONALS = 1.38;
const RECT_MARGIN = 18 * PT;
const RECT_TOP_WITH_TITLE = 48 * PT;
const RECT_TOP_NO_TITLE = 14 * PT;
const RECT_BOTTOM_WITH_LEGEND = 44 * PT;
const RECT_BOTTOM_NO_LEGEND = 14 * PT;
/** Rim samples used to fit the disc. */
const RIM_SAMPLES = 96;

export interface PieSlice {
	pointIndex: number;
	value: number;
	color: string;
	/** Clockwise from 12 o'clock, radians. */
	startAngle: number;
	endAngle: number;
	/** Box-space offset of the exploded slice. */
	offset: { x: number; z: number };
}

export interface PieChartLayout {
	view: PerspView;
	/** Box-space centre of the pie's top face (its bottom face sits on y = 0). */
	center: { x: number; y: number; z: number };
	radius: number;
	thickness: number;
	slices: PieSlice[];
}

/** Box (x, z) of the rim at `angle` (clockwise from 12 o'clock) for a pie centred at (cx, cz). */
export function pieRimPoint(
	cx: number,
	cz: number,
	radius: number,
	angle: number,
): { x: number; z: number } {
	return { x: cx + radius * Math.sin(angle), z: cz + radius * Math.cos(angle) };
}

/**
 * The flat pie's view model is square (its 2D render letterboxes a square
 * viewBox into the frame); the 3D scene draws across the whole frame, so
 * widen it to the element's own aspect, keeping the centred title and legend
 * centred.
 */
export function widenPieViewModel(vm: ChartViewModel, element: PptxElement): ChartViewModel {
	const width = vm.svgHeight * (element.width / Math.max(element.height, 1));
	const dx = (width - vm.svgWidth) / 2;
	if (Math.abs(dx) < 1e-6) {
		return vm;
	}
	return {
		...vm,
		svgWidth: width,
		titleX: vm.titleX + dx,
		legendX: vm.legendAnchor === 'middle' ? vm.legendX + dx : vm.legendX,
	};
}

/** The 3-D pie layout of a `pie3D` chart element, or `null`. */
export function computePieChartLayout(
	element: PptxElement,
	vm: ChartViewModel,
): PieChartLayout | null {
	if (element.type !== 'chart' || !element.chartData) {
		return null;
	}
	const chartData = element.chartData;
	const series = chartData.series[0];
	if (!series || series.values.length === 0) {
		return null;
	}
	const view3D = chartData.view3D;
	const thickness = PIE_THICKNESS * ((view3D?.hPercent ?? 100) / 100);
	const box = { w: 2, h: thickness, d: 2 };
	const camera = perspCameraFor(box, 0, view3D?.rotY ?? 0);
	camera.pitch = ((view3D?.rotX ?? 30) * PIE_PITCH_PER_ROTX * Math.PI) / 180;
	camera.dist = PIE_CAMERA_DIAGONALS * Math.hypot(box.w, box.h, box.d);
	const rim: Array<[number, number, number]> = [];
	for (let i = 0; i < RIM_SAMPLES; i++) {
		const a = (i / RIM_SAMPLES) * Math.PI * 2;
		const p = pieRimPoint(1, 1, 1, a);
		rim.push([p.x, 0, p.z], [p.x, box.h, p.z]);
	}
	const hasLegend =
		chartData.style?.hasLegend !== false && (chartData.style?.legendPosition ?? 'b') === 'b';
	const view = fitPerspView(
		camera,
		{
			left: RECT_MARGIN,
			right: vm.svgWidth - RECT_MARGIN,
			top: vm.title ? RECT_TOP_WITH_TITLE : RECT_TOP_NO_TITLE,
			bottom: vm.svgHeight - (hasLegend ? RECT_BOTTOM_WITH_LEGEND : RECT_BOTTOM_NO_LEGEND),
		},
		rim,
	);

	const explosionOf = (i: number): number =>
		Math.max(
			0,
			(series.dataPoints?.find((d) => d.idx === i)?.explosion ?? series.explosion ?? 0) / 100,
		);
	const values = series.values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0));
	const maxExplosion = values.reduce((m, _v, i) => Math.max(m, explosionOf(i)), 0);
	const radius = 1 / (1 + maxExplosion);
	const total = values.reduce((t, v) => t + v, 0) || 1;
	let angle = ((chartData.firstSliceAngle ?? 0) * Math.PI) / 180;
	const slices = values.map((value, i): PieSlice => {
		const startAngle = angle;
		const endAngle = angle + (value / total) * Math.PI * 2;
		angle = endAngle;
		const mid = (startAngle + endAngle) / 2;
		const out = explosionOf(i) * radius;
		return {
			pointIndex: i,
			value: series.values[i],
			color: vm.legend[i]?.color ?? '#4472c4',
			startAngle,
			endAngle,
			offset: { x: out * Math.sin(mid), z: out * Math.cos(mid) },
		};
	});
	return {
		view,
		center: { x: 1, y: box.h * radius, z: 1 },
		radius,
		thickness: box.h * radius,
		slices,
	};
}
