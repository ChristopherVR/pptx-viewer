/**
 * The marks of a perspective 3D chart scene (`chart-3d-persp-scene.ts`)
 * behind one interface, so the scene, its picking and its drag preview do
 * not care whether they draw line / area prisms or a banded surface.
 *
 * @module chart-3d-persp-mark-set
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { Chart3DPoint } from './chart-3d-mark-interaction';
import type { PerspChartLayout } from './chart-3d-persp-layout';
import { buildPerspPrisms, perspRowSpan, perspValueY } from './chart-3d-persp-marks';
import { buildPerspMeshes } from './chart-3d-persp-mesh';
import { surfaceRowZ } from './chart-3d-persp-surface';
import { buildSurfaceMarks } from './chart-3d-persp-surface-mesh';

type ThreeModule = typeof THREE;

export interface PerspMarkSet {
	/** Box-space root (its matrix is the box placement). */
	group: THREE.Group;
	/** Objects rays are cast against. */
	targets: THREE.Object3D[];
	/** The data point at a box-space hit on `object`. */
	pointAt: (object: THREE.Object3D, local: THREE.Vector3) => Chart3DPoint | null;
	/** Box-space anchor of a point drawn at `value` (selection marker, drag scale). */
	anchor: (point: Chart3DPoint, value: number) => [number, number, number];
	/** Whether a point's value can be dragged. */
	draggable: boolean;
	/** Redraw with one point at `value` (a drag preview). */
	preview: (point: Chart3DPoint, value: number) => void;
	dispose: () => void;
}

function nearestIndex(xs: readonly number[], x: number): number {
	let best = 0;
	xs.forEach((v, i) => {
		if (Math.abs(v - x) < Math.abs(xs[best] - x)) {
			best = i;
		}
	});
	return best;
}

/** Build the mark set for a laid-out perspective chart. */
export function buildPerspMarkSet(
	three: ThreeModule,
	chartData: PptxChartData,
	layout: PerspChartLayout,
	palette: readonly string[],
): PerspMarkSet {
	if (layout.kind === 'surface') {
		const nSer = chartData.series.length;
		const zs = Array.from({ length: nSer }, (_, s) => surfaceRowZ(layout, s, nSer));
		const surface = buildSurfaceMarks(three, chartData, layout, palette);
		return {
			group: surface.group,
			targets: [surface.pickTarget],
			pointAt: (_object, local) => ({
				seriesIndex: nearestIndex(zs, local.z),
				pointIndex: nearestIndex(layout.categoryX, local.x),
			}),
			anchor: (point, value) => [
				layout.categoryX[point.pointIndex],
				perspValueY(layout, value),
				zs[point.seriesIndex],
			],
			draggable: true,
			preview: (point, value) => surface.rebuild({ ...point, value }),
			dispose: () => surface.dispose(),
		};
	}
	if (layout.kind === 'bar') {
		return buildBarMarkSet(three, chartData, layout);
	}
	const stacked = layout.grouping !== 'standard' && layout.grouping !== 'clustered';
	const meshes = buildPerspMeshes(three, layout, buildPerspPrisms(chartData, layout));
	return {
		group: meshes.group,
		targets: meshes.meshes,
		pointAt(object, local) {
			const seriesIndex = (object.userData as { seriesIndex?: number }).seriesIndex;
			return seriesIndex === undefined
				? null
				: { seriesIndex, pointIndex: nearestIndex(layout.categoryX, local.x) };
		},
		anchor(point, value) {
			const [z0, z1] = perspRowSpan(layout, stacked ? 0 : point.seriesIndex);
			return [layout.categoryX[point.pointIndex], perspValueY(layout, value), (z0 + z1) / 2];
		},
		draggable: !stacked,
		preview(point, value) {
			meshes.setPrism(
				point.seriesIndex,
				buildPerspPrisms(chartData, layout, { ...point, value })[point.seriesIndex],
			);
		},
		dispose: () => meshes.dispose(),
	};
}

/** Bars: one prism per point, dragged one at a time (not stacked ones, as in the 2D chart). */
function buildBarMarkSet(
	three: ThreeModule,
	chartData: PptxChartData,
	layout: PerspChartLayout,
): PerspMarkSet {
	const prisms = buildPerspPrisms(chartData, layout);
	const meshes = buildPerspMeshes(three, layout, prisms);
	const indexOf = (point: Chart3DPoint): number =>
		prisms.findIndex(
			(p) => p.seriesIndex === point.seriesIndex && p.pointIndex === point.pointIndex,
		);
	return {
		group: meshes.group,
		targets: meshes.meshes,
		pointAt(object) {
			const data = object.userData as { seriesIndex?: number; pointIndex?: number };
			return data.seriesIndex === undefined || data.pointIndex === undefined
				? null
				: { seriesIndex: data.seriesIndex, pointIndex: data.pointIndex };
		},
		anchor(point, value) {
			const prism = prisms[indexOf(point)];
			if (!prism) {
				return [0, perspValueY(layout, value), 0];
			}
			const xs = prism.outline.map(([x]) => x);
			return [
				(Math.min(...xs) + Math.max(...xs)) / 2,
				perspValueY(layout, value),
				(prism.z0 + prism.z1) / 2,
			];
		},
		draggable: layout.grouping === 'clustered' || layout.grouping === 'standard',
		preview(point, value) {
			const i = indexOf(point);
			const next = buildPerspPrisms(chartData, layout, { ...point, value })[i];
			if (next) {
				meshes.setPrism(i, next);
			}
		},
		dispose: () => meshes.dispose(),
	};
}
