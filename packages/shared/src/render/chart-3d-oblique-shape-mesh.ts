/**
 * Round and pointed bars (`c:shape` cylinder / cone / pyramid and the
 * `coneToMax` / `pyramidToMax` frustums) for the right-angle-axes 3D bar chart
 * (`chart-3d-oblique-layout.ts`).
 *
 * Measured on `gt/chart-07..09.webp`: every shape sits in the SAME footprint
 * as a box bar (a round shape is inscribed in the `w x d` base, a pyramid
 * fills it), so the layout is unchanged and only the mesh differs.
 *
 * Geometry is unit-sized (-0.5..0.5 on every axis, like `BoxGeometry(1,1,1)`)
 * so the caller places it with `position` + `scale` exactly as it does a box.
 * Shading is baked into vertex colours from each vertex's WORLD normal (the
 * unit normal corrected for the mesh's non-uniform scale), with
 * `chart-3d-shading.ts`'s per-shape quadratic form, so the drag preview
 * re-shades a bar whose proportions change. A round surface is shaded
 * relative to the oblique VIEW direction (yawed `atan(sin rotY)` off the
 * front normal), which is why PowerPoint's highlight sits at the middle of
 * the silhouette rather than left of it; flat facets keep the box table.
 *
 * @module chart-3d-oblique-shape-mesh
 */
import type * as THREE from 'three';

import type { ObliqueBar } from './chart-3d-oblique-layout';
import { chart3DNormalShade } from './chart-3d-shading';

type ThreeModule = typeof THREE;

/** Radial segments of a round shape: smooth at any chart size. */
const ROUND_SEGMENTS = 48;

/** Whether a bar is drawn with this module rather than as a box. */
export function isShapedObliqueBar(bar: Pick<ObliqueBar, 'shape'>): boolean {
	return bar.shape !== 'box';
}

/** Cache key of a bar's unit geometry (shape, taper and orientation). */
export function obliqueShapeKey(bar: ObliqueBar, horizontal: boolean): string {
	return `${bar.shape}:${bar.taper.bottom.toFixed(4)}:${bar.taper.top.toFixed(4)}:${horizontal ? 'h' : 'v'}`;
}

/**
 * The unit geometry of a shaped bar, its axis along +Y (or +X for a
 * horizontal chart, the base at the value-axis baseline end).
 */
export function buildObliqueShapeGeometry(
	three: ThreeModule,
	bar: ObliqueBar,
	horizontal: boolean,
): THREE.BufferGeometry {
	const pointed = bar.shape === 'pyramid' || bar.shape === 'pyramidToMax';
	let geometry: THREE.BufferGeometry;
	if (pointed) {
		// A 4-segment cylinder is a diamond of "radius" r; turned 45 degrees and
		// widened by sqrt(2) its base is the full unit square.
		const r = Math.SQRT1_2;
		const faceted = new three.CylinderGeometry(
			r * bar.taper.top,
			r * bar.taper.bottom,
			1,
			4,
		).rotateY(Math.PI / 4);
		geometry = faceted.toNonIndexed();
		faceted.dispose();
		geometry.computeVertexNormals();
	} else {
		geometry = new three.CylinderGeometry(
			0.5 * bar.taper.top,
			0.5 * bar.taper.bottom,
			1,
			ROUND_SEGMENTS,
		);
	}
	if (horizontal) {
		geometry.rotateZ(-Math.PI / 2);
	}
	return geometry;
}

/**
 * (Re)write a shaped bar's vertex colours for its current world `scale`, so
 * each vertex gets the shade of its world-space normal.
 */
export function shadeObliqueShapeGeometry(
	three: ThreeModule,
	geometry: THREE.BufferGeometry,
	bar: Pick<ObliqueBar, 'shape' | 'color'>,
	scale: { x: number; y: number; z: number },
	viewYaw: number,
): void {
	const round = bar.shape !== 'pyramid' && bar.shape !== 'pyramidToMax';
	const cos = Math.cos(round ? viewYaw : 0);
	const sin = Math.sin(round ? viewYaw : 0);
	const normals = geometry.getAttribute('normal');
	const count = normals.count;
	let colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
	if (!colors || colors.count !== count) {
		colors = new three.Float32BufferAttribute(new Float32Array(count * 3), 3);
		geometry.setAttribute('color', colors);
	}
	const base = new three.Color(bar.color);
	const srgb = base.getRGB(new three.Color(), three.SRGBColorSpace);
	const out = new three.Color();
	for (let i = 0; i < count; i++) {
		// Normals transform by the inverse scale.
		let nx = normals.getX(i) / Math.max(scale.x, 1e-6);
		let ny = normals.getY(i) / Math.max(scale.y, 1e-6);
		let nz = normals.getZ(i) / Math.max(scale.z, 1e-6);
		const len = Math.hypot(nx, ny, nz) || 1;
		nx /= len;
		ny /= len;
		nz /= len;
		const f = chart3DNormalShade(bar.shape, nx * cos - nz * sin, ny, nx * sin + nz * cos);
		out.setRGB(
			Math.min(1, srgb.r * f),
			Math.min(1, srgb.g * f),
			Math.min(1, srgb.b * f),
			three.SRGBColorSpace,
		);
		colors.setXYZ(i, out.r, out.g, out.b);
	}
	colors.needsUpdate = true;
}
