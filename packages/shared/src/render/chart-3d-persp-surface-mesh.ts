/**
 * WebGL objects for the banded 3-D Surface (`chart-3d-persp-surface.ts`):
 * flat-shaded band triangles, or coloured band lines for a wireframe, plus an
 * invisible unclipped grid mesh for picking (a wireframe's hairlines are too
 * thin to hit).
 *
 * @module chart-3d-persp-surface-mesh
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { PerspChartLayout } from './chart-3d-persp-layout';
import { perspValueY } from './chart-3d-persp-marks';
import { buildPerspGridlines } from './chart-3d-persp-mesh';
import { buildSurfaceGeometry, surfaceRowZ } from './chart-3d-persp-surface';
import { perspBoxMatrix } from './chart-3d-persp-view';
import { chart3DNormalShade } from './chart-3d-shading';

type ThreeModule = typeof THREE;

export interface SurfaceMarks {
	group: THREE.Group;
	pickTarget: THREE.Mesh;
	rebuild: (override?: { seriesIndex: number; pointIndex: number; value: number }) => void;
	dispose: () => void;
}

function srgb(three: ThreeModule, hex: string, f: number): THREE.Color {
	const base = new three.Color(hex).getRGB(new three.Color(), three.SRGBColorSpace);
	return new three.Color().setRGB(
		Math.min(1, base.r * f),
		Math.min(1, base.g * f),
		Math.min(1, base.b * f),
		three.SRGBColorSpace,
	);
}

function buildVisual(
	three: ThreeModule,
	chartData: PptxChartData,
	layout: PerspChartLayout,
	palette: readonly string[],
	override?: { seriesIndex: number; pointIndex: number; value: number },
): THREE.Object3D {
	const geo = buildSurfaceGeometry(chartData, layout, palette, override);
	const positions: number[] = [];
	const colors: number[] = [];
	if (chartData.wireframe) {
		for (const seg of geo.segments) {
			const c = srgb(three, geo.bands[seg.band].color, 1);
			positions.push(...seg.from, ...seg.to);
			colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
		}
		const g = new three.BufferGeometry();
		g.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
		g.setAttribute('color', new three.Float32BufferAttribute(colors, 3));
		return new three.LineSegments(g, new three.LineBasicMaterial({ vertexColors: true }));
	}
	const a = new three.Vector3();
	const b = new three.Vector3();
	const n = new three.Vector3();
	for (const tri of geo.triangles) {
		const [p0, p1, p2] = tri.points;
		a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
		b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
		n.crossVectors(a, b).normalize();
		if (n.y < 0) {
			n.negate();
		}
		// Box-space -z faces the viewer.
		const c = srgb(three, geo.bands[tri.band].color, chart3DNormalShade('box', n.x, n.y, -n.z));
		positions.push(...p0, ...p1, ...p2);
		colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
	}
	const g = new three.BufferGeometry();
	g.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
	g.setAttribute('color', new three.Float32BufferAttribute(colors, 3));
	return new three.Mesh(
		g,
		new three.MeshBasicMaterial({ vertexColors: true, side: three.DoubleSide }),
	);
}

function buildPickGeometry(
	three: ThreeModule,
	chartData: PptxChartData,
	layout: PerspChartLayout,
): THREE.BufferGeometry {
	const nSer = chartData.series.length;
	const nCat = layout.categoryX.length;
	const at = (s: number, c: number): number[] => {
		const v = chartData.series[s]?.values[c];
		return [
			layout.categoryX[c],
			perspValueY(layout, v !== undefined && Number.isFinite(v) ? v : layout.range.min),
			surfaceRowZ(layout, s, nSer),
		];
	};
	const positions: number[] = [];
	for (let s = 0; s + 1 < nSer; s++) {
		for (let c = 0; c + 1 < nCat; c++) {
			positions.push(...at(s, c), ...at(s, c + 1), ...at(s + 1, c + 1));
			positions.push(...at(s, c), ...at(s + 1, c + 1), ...at(s + 1, c));
		}
	}
	const g = new three.BufferGeometry();
	g.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
	return g;
}

function disposeObject(object: THREE.Object3D): void {
	const withGeometry = object as THREE.Object3D & {
		geometry?: THREE.BufferGeometry;
		material?: THREE.Material;
	};
	withGeometry.geometry?.dispose();
	withGeometry.material?.dispose();
}

/** Build the surface's objects into a box-space group. */
export function buildSurfaceMarks(
	three: ThreeModule,
	chartData: PptxChartData,
	layout: PerspChartLayout,
	palette: readonly string[],
): SurfaceMarks {
	const group = new three.Group();
	group.matrixAutoUpdate = false;
	group.matrix.copy(perspBoxMatrix(three, layout.view));
	const gridlines = buildPerspGridlines(three, layout);
	group.add(gridlines);
	let visual = buildVisual(three, chartData, layout, palette);
	group.add(visual);
	const pickMaterial = new three.MeshBasicMaterial({ side: three.DoubleSide, visible: false });
	const pickTarget = new three.Mesh(buildPickGeometry(three, chartData, layout), pickMaterial);
	group.add(pickTarget);
	return {
		group,
		pickTarget,
		rebuild(override) {
			group.remove(visual);
			disposeObject(visual);
			visual = buildVisual(three, chartData, layout, palette, override);
			group.add(visual);
		},
		dispose() {
			disposeObject(visual);
			disposeObject(gridlines);
			pickTarget.geometry.dispose();
			pickMaterial.dispose();
		},
	};
}
