/**
 * WebGL geometry for the 3-D Pie (`chart-3d-pie-layout.ts`): one mesh per
 * slice (top, rim, the two cut faces, bottom) with baked vertex colours, and
 * the white slice seams PowerPoint draws (`a:ln` in `lt1`).
 *
 * Shading, fitted to `gt/chart-14,15`: the top face keeps the slice colour;
 * the rim darkens from the left toward the right, `max(0.385, 0.57 - 0.275
 * phi)` with `phi` the rim normal's angle to the right of straight toward the
 * viewer (radians). The flat cut faces of an exploded pie follow their own
 * rule, lighter turned right: `0.5 + 0.2 sin(phi)` (0.70 at +59 degrees,
 * 0.42 at -23, 0.39 at -59, 0.3 at -90 on `gt/chart-15`).
 *
 * @module chart-3d-pie-marks
 */
import type * as THREE from 'three';

import { perspBoxMatrix } from './chart-3d-persp-view';
import type { PieChartLayout, PieSlice } from './chart-3d-pie-layout';
import { pieRimPoint } from './chart-3d-pie-layout';

type ThreeModule = typeof THREE;
type Vec3 = [number, number, number];

const SEAM_COLOR = 0xffffff;
/** Arc segments per full turn. */
const SEGMENTS_PER_TURN = 144;

/** Shade multiplier for a box-space normal (box -z faces the viewer); `cut` for a slice's flat cut face. */
export function pieFaceShade(nx: number, ny: number, nz: number, cut = false): number {
	if (ny > 0.5) {
		return 1;
	}
	if (ny < -0.5) {
		return 0.3;
	}
	const phi = Math.atan2(nx, -nz);
	if (cut) {
		return 0.5 + 0.2 * Math.sin(phi);
	}
	return Math.max(0.385, 0.57 - 0.275 * phi);
}

export interface PieMarks {
	group: THREE.Group;
	meshes: THREE.Mesh[];
	/** Rebuild the slices (a drag preview). */
	setSlices: (slices: ReadonlyArray<PieSlice>) => void;
	dispose: () => void;
}

interface SliceBuffers {
	positions: number[];
	colors: number[];
	seams: number[];
}

function sliceBuffers(three: ThreeModule, layout: PieChartLayout, slice: PieSlice): SliceBuffers {
	const base = new three.Color(slice.color).getRGB(new three.Color(), three.SRGBColorSpace);
	const out = new three.Color();
	const positions: number[] = [];
	const colors: number[] = [];
	const cx = layout.center.x + slice.offset.x;
	const cz = layout.center.z + slice.offset.z;
	const top = layout.center.y;
	const r = layout.radius;
	const push = (p: Vec3, n: Vec3, cut = false): void => {
		const f = pieFaceShade(n[0], n[1], n[2], cut);
		out.setRGB(
			Math.min(1, base.r * f),
			Math.min(1, base.g * f),
			Math.min(1, base.b * f),
			three.SRGBColorSpace,
		);
		positions.push(...p);
		colors.push(out.r, out.g, out.b);
	};
	const span = slice.endAngle - slice.startAngle;
	const steps = Math.max(2, Math.ceil((span / (Math.PI * 2)) * SEGMENTS_PER_TURN));
	const angles = Array.from({ length: steps + 1 }, (_, i) => slice.startAngle + (span * i) / steps);
	const rim = (a: number, y: number): Vec3 => {
		const p = pieRimPoint(cx, cz, r, a);
		return [p.x, y, p.z];
	};
	const radial = (a: number): Vec3 => [Math.sin(a), 0, Math.cos(a)];
	for (let i = 0; i < steps; i++) {
		const a0 = angles[i];
		const a1 = angles[i + 1];
		// Top and bottom fans.
		push([cx, top, cz], [0, 1, 0]);
		push(rim(a0, top), [0, 1, 0]);
		push(rim(a1, top), [0, 1, 0]);
		push([cx, 0, cz], [0, -1, 0]);
		push(rim(a1, 0), [0, -1, 0]);
		push(rim(a0, 0), [0, -1, 0]);
		// Rim, smooth-shaded by the radial normal.
		push(rim(a0, top), radial(a0));
		push(rim(a0, 0), radial(a0));
		push(rim(a1, 0), radial(a1));
		push(rim(a0, top), radial(a0));
		push(rim(a1, 0), radial(a1));
		push(rim(a1, top), radial(a1));
	}
	// The two cut faces, normals perpendicular to their radius.
	for (const [a, sign] of [
		[slice.startAngle, -1],
		[slice.endAngle, 1],
	] as const) {
		const n: Vec3 = [sign * Math.cos(a), 0, -sign * Math.sin(a)];
		push([cx, top, cz], n, true);
		push([cx, 0, cz], n, true);
		push(rim(a, 0), n, true);
		push([cx, top, cz], n, true);
		push(rim(a, 0), n, true);
		push(rim(a, top), n, true);
	}
	const seams: number[] = [];
	for (let i = 0; i < steps; i++) {
		seams.push(...rim(angles[i], top), ...rim(angles[i + 1], top));
	}
	for (const a of [slice.startAngle, slice.endAngle]) {
		seams.push(cx, top, cz, ...rim(a, top), ...rim(a, top), ...rim(a, 0));
	}
	return { positions, colors, seams };
}

/** Build the slice meshes and seams of a pie layout. */
export function buildPieMarks(three: ThreeModule, layout: PieChartLayout): PieMarks {
	const group = new three.Group();
	group.matrixAutoUpdate = false;
	group.matrix.copy(perspBoxMatrix(three, layout.view));
	const material = new three.MeshBasicMaterial({
		vertexColors: true,
		side: three.DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1,
	});
	const seamMaterial = new three.LineBasicMaterial({ color: SEAM_COLOR });
	// Stable array: the scene's pick targets keep pointing at it across rebuilds.
	const meshes: THREE.Mesh[] = [];
	let seams: THREE.LineSegments | null = null;
	const clear = (): void => {
		for (const mesh of meshes) {
			group.remove(mesh);
			mesh.geometry.dispose();
		}
		if (seams) {
			group.remove(seams);
			seams.geometry.dispose();
		}
	};
	const build = (slices: ReadonlyArray<PieSlice>): void => {
		clear();
		const seamPoints: number[] = [];
		const built = slices.map((slice) => {
			const b = sliceBuffers(three, layout, slice);
			const geometry = new three.BufferGeometry();
			geometry.setAttribute('position', new three.Float32BufferAttribute(b.positions, 3));
			geometry.setAttribute('color', new three.Float32BufferAttribute(b.colors, 3));
			const mesh = new three.Mesh(geometry, material);
			mesh.userData = { seriesIndex: 0, pointIndex: slice.pointIndex };
			group.add(mesh);
			seamPoints.push(...b.seams);
			return mesh;
		});
		meshes.splice(0, meshes.length, ...built);
		const seamGeometry = new three.BufferGeometry();
		seamGeometry.setAttribute('position', new three.Float32BufferAttribute(seamPoints, 3));
		seams = new three.LineSegments(seamGeometry, seamMaterial);
		group.add(seams);
	};
	build(layout.slices);
	return {
		group,
		meshes,
		setSlices: build,
		dispose() {
			clear();
			material.dispose();
			seamMaterial.dispose();
		},
	};
}
