/**
 * Round and pointed bars (`c:shape` cylinder / cone / pyramid and the
 * `...ToMax` slices) on the perspective box (`chart-3d-persp-layout.ts`), for
 * a `bar3D` chart without right-angle axes.
 *
 * The right-angle-axes chart already builds these solids
 * (`chart-3d-oblique-shape-mesh.ts`): a unit shape inscribed in the bar's
 * footprint. Here the same unit geometry is scaled into the prism's box-space
 * bounding box and shaded from its box-space normals with the shape's own
 * form (`chart-3d-shading.ts`); box-space `-z` faces the viewer. Without
 * right-angle axes PowerPoint has no export of this setting in the parity
 * deck, so the shading follows the box convention unverified.
 *
 * @module chart-3d-persp-shape-mesh
 */
import type * as THREE from 'three';

import { buildObliqueShapeGeometry } from './chart-3d-oblique-shape-mesh';
import type { ObliqueBar } from './chart-3d-oblique-types';
import type { PerspPrism } from './chart-3d-persp-marks';
import { chart3DNormalShade } from './chart-3d-shading';

type ThreeModule = typeof THREE;

/** Whether a prism is drawn as a shaped solid rather than an extrusion. */
export function isShapedPerspPrism(prism: PerspPrism): boolean {
	return prism.shape !== undefined && prism.shape !== 'box';
}

/** The prism's box-space bounding box: `[x0, x1, y0, y1]`. */
function outlineBounds(prism: PerspPrism): [number, number, number, number] {
	const xs = prism.outline.map(([x]) => x);
	const ys = prism.outline.map(([, y]) => y);
	return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/** A shaped bar's geometry in box space, with shading baked into vertex colours. */
export function buildShapedPrismGeometry(
	three: ThreeModule,
	prism: PerspPrism,
): THREE.BufferGeometry {
	const shape = prism.shape ?? 'box';
	const unit = buildObliqueShapeGeometry(
		three,
		{ shape, taper: prism.taper ?? { bottom: 1, top: 1 } } as ObliqueBar,
		Boolean(prism.horizontal),
	);
	const geometry = unit.index ? unit.toNonIndexed() : unit;
	if (geometry !== unit) {
		unit.dispose();
	}
	const [x0, x1, y0, y1] = outlineBounds(prism);
	const sx = Math.max(x1 - x0, 1e-6);
	const sy = Math.max(y1 - y0, 1e-6);
	const sz = Math.max(prism.z1 - prism.z0, 1e-6);
	geometry.scale(sx, sy, sz);
	geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (prism.z0 + prism.z1) / 2);
	geometry.computeVertexNormals();

	const normals = geometry.getAttribute('normal');
	const colors = new Float32Array(normals.count * 3);
	const base = new three.Color(prism.color).getRGB(new three.Color(), three.SRGBColorSpace);
	const out = new three.Color();
	for (let i = 0; i < normals.count; i++) {
		const f = chart3DNormalShade(shape, normals.getX(i), normals.getY(i), -normals.getZ(i));
		out.setRGB(
			Math.min(1, base.r * f),
			Math.min(1, base.g * f),
			Math.min(1, base.b * f),
			three.SRGBColorSpace,
		);
		colors.set([out.r, out.g, out.b], i * 3);
	}
	geometry.setAttribute('color', new three.Float32BufferAttribute(colors, 3));
	return geometry;
}
