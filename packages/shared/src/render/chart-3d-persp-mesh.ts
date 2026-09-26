/**
 * WebGL geometry for the perspective 3D chart layout
 * (`chart-3d-persp-layout.ts`): the wall gridlines and one extruded, flat-
 * shaded mesh per mark prism (`chart-3d-persp-marks.ts`), in a group whose
 * matrix maps box space onto `buildPerspCamera`'s view space.
 *
 * Faces are shaded per vertex from their box-space normal with the same
 * quadratic form as the bar chart (`chart3DNormalShade`), the box's front
 * (-z, toward the viewer) as the lit face. Box space (x right, y up, z away)
 * is left-handed, so the box matrix mirrors; materials are two-sided.
 *
 * @module chart-3d-persp-mesh
 */
import type * as THREE from 'three';

import type { PerspChartLayout } from './chart-3d-persp-layout';
import type { PerspPrism } from './chart-3d-persp-marks';
import { buildShapedPrismGeometry, isShapedPerspPrism } from './chart-3d-persp-shape-mesh';
import { perspBoxMatrix } from './chart-3d-persp-view';
import { chart3DNormalShade } from './chart-3d-shading';

type ThreeModule = typeof THREE;

/** PowerPoint's default major gridline colour (tx1 at 15% tint, `#D9D9D9`). */
const GRIDLINE_COLOR = 0xd9d9d9;

export interface PerspMeshResult {
	/** Box-space root (its matrix is the box placement). */
	group: THREE.Group;
	/** One mesh per prism, same order; `userData` names its series (and a bar's point). */
	meshes: THREE.Mesh[];
	/** Replace mesh `i`'s geometry with `prism` (a drag preview). */
	setPrism: (i: number, prism: PerspPrism) => void;
	dispose: () => void;
}

/** Bake face shading into a geometry's vertex colours. */
export function shadePerspGeometry(
	three: ThreeModule,
	geometry: THREE.BufferGeometry,
	color: string,
): void {
	const normals = geometry.getAttribute('normal');
	const colors = new Float32Array(normals.count * 3);
	const base = new three.Color(color).getRGB(new three.Color(), three.SRGBColorSpace);
	const out = new three.Color();
	for (let i = 0; i < normals.count; i++) {
		// Box-space -z faces the viewer.
		const f = chart3DNormalShade('box', normals.getX(i), normals.getY(i), -normals.getZ(i));
		out.setRGB(
			Math.min(1, base.r * f),
			Math.min(1, base.g * f),
			Math.min(1, base.b * f),
			three.SRGBColorSpace,
		);
		colors[i * 3] = out.r;
		colors[i * 3 + 1] = out.g;
		colors[i * 3 + 2] = out.b;
	}
	geometry.setAttribute('color', new three.Float32BufferAttribute(colors, 3));
}

/** An extruded, shaded prism geometry in box space. */
export function buildPrismGeometry(three: ThreeModule, prism: PerspPrism): THREE.BufferGeometry {
	if (isShapedPerspPrism(prism)) {
		return buildShapedPrismGeometry(three, prism);
	}
	const shape = new three.Shape(prism.outline.map(([x, y]) => new three.Vector2(x, y)));
	const extruded = new three.ExtrudeGeometry(shape, {
		depth: Math.max(prism.z1 - prism.z0, 1e-6),
		bevelEnabled: false,
		steps: 1,
	});
	const geometry = extruded.index ? extruded.toNonIndexed() : extruded;
	if (geometry !== extruded) {
		extruded.dispose();
	}
	geometry.translate(0, 0, prism.z0);
	geometry.computeVertexNormals();
	shadePerspGeometry(three, geometry, prism.color);
	return geometry;
}

/** The wall gridlines and floor edges of a perspective layout, in box space. */
export function buildPerspGridlines(
	three: ThreeModule,
	layout: Pick<PerspChartLayout, 'gridlines'>,
): THREE.LineSegments {
	const points: number[] = [];
	for (const line of layout.gridlines) {
		points.push(...line.from, ...line.to);
	}
	const geometry = new three.BufferGeometry();
	geometry.setAttribute('position', new three.Float32BufferAttribute(points, 3));
	return new three.LineSegments(geometry, new three.LineBasicMaterial({ color: GRIDLINE_COLOR }));
}

/** Build the gridlines and prism meshes of a perspective layout. */
export function buildPerspMeshes(
	three: ThreeModule,
	layout: Pick<PerspChartLayout, 'view' | 'gridlines'>,
	prisms: ReadonlyArray<PerspPrism>,
): PerspMeshResult {
	const group = new three.Group();
	group.matrixAutoUpdate = false;
	group.matrix.copy(perspBoxMatrix(three, layout.view));

	const gridlines = buildPerspGridlines(three, layout);
	group.add(gridlines);

	const material = new three.MeshBasicMaterial({ vertexColors: true, side: three.DoubleSide });
	const meshes = prisms.map((prism) => {
		const mesh = new three.Mesh(buildPrismGeometry(three, prism), material);
		mesh.userData = { seriesIndex: prism.seriesIndex, pointIndex: prism.pointIndex };
		group.add(mesh);
		return mesh;
	});

	return {
		group,
		meshes,
		setPrism(i, prism) {
			const mesh = meshes[i];
			if (!mesh) {
				return;
			}
			const previous = mesh.geometry;
			mesh.geometry = buildPrismGeometry(three, prism);
			previous.dispose();
		},
		dispose() {
			gridlines.geometry.dispose();
			(gridlines.material as THREE.Material).dispose();
			material.dispose();
			for (const mesh of meshes) {
				mesh.geometry.dispose();
			}
		},
	};
}
