/**
 * Three.js SmartArt renderer - mesh-group construction.
 *
 * Turns a pure {@link SmartArt3DModel} into a `THREE.Group` of extruded blocks
 * (with bevels, edge outlines, and front-face text planes) plus connector
 * lines. All allocated GPU resources are tracked so the caller can dispose them
 * deterministically.
 */

import {
	BufferGeometry,
	Color,
	EdgesGeometry,
	Euler,
	ExtrudeGeometry,
	Group,
	Line,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Shape,
	Vector3,
} from 'three';

import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';
import type { SmartArt3DMesh, SmartArt3DModel } from '../render/smartart-3d-types';
import { makeTextTexture } from './text-texture';

/** A disposable GPU resource (geometry, material, or texture). */
interface Disposable {
	dispose: () => void;
}

/** A built mesh group plus its teardown hook. */
export interface BuiltMeshGroup {
	group: Group;
	/**
	 * Rebuild every node's label plane with a new font-style emphasis override
	 * (or `undefined` to clear it) - the LABEL textures are baked into a canvas
	 * (see `text-texture.ts`), so applying an emphasis change means disposing
	 * and repainting them, unlike a CSS override on DOM text. Leaves the block
	 * extrusions and connectors untouched.
	 */
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	dispose: () => void;
}

/** Build the extruded geometry for one node. */
function extrudeGeometry(m: SmartArt3DMesh): ExtrudeGeometry {
	const shape = new Shape();
	m.outline.forEach((p, i) => {
		if (i === 0) {
			shape.moveTo(p.x, p.y);
		} else {
			shape.lineTo(p.x, p.y);
		}
	});
	shape.closePath();

	const bevelEnabled = m.bevel > 0;
	return new ExtrudeGeometry(shape, {
		depth: m.depth,
		bevelEnabled,
		bevelThickness: m.bevel,
		bevelSize: m.bevel,
		bevelSegments: 2,
		curveSegments: m.rounded ? 24 : 1,
		steps: 1,
	});
}

/** Add the extruded block + edge outline for one node to the group. */
function addBlock(group: Group, disposables: Disposable[], m: SmartArt3DMesh): ExtrudeGeometry {
	const geo = extrudeGeometry(m);
	const material = new MeshStandardMaterial({
		color: new Color(m.fill),
		metalness: 0.12,
		roughness: 0.52,
		transparent: m.opacity < 1,
		opacity: m.opacity,
	});
	const mesh = new Mesh(geo, material);
	mesh.position.set(m.position.x, m.position.y, m.position.z);
	mesh.rotation.set(m.rotation.x, m.rotation.y, m.rotation.z);
	group.add(mesh);
	disposables.push(geo, material);

	if (m.strokeWidth > 0) {
		const edges = new EdgesGeometry(geo, 30);
		const lineMaterial = new LineBasicMaterial({ color: new Color(m.stroke) });
		const line = new LineSegments(edges, lineMaterial);
		line.position.copy(mesh.position);
		line.rotation.copy(mesh.rotation);
		group.add(line);
		disposables.push(edges, lineMaterial);
	}
	return geo;
}

/** One node's currently-mounted label plane (or none), tracked for `setTextStyle` rebuilds. */
interface LabelEntry {
	node: SmartArt3DMesh;
	plane: Mesh | null;
	disposables: Disposable[];
}

/** Build a front-face text plane for one node, or `null` when it has no label / no DOM. */
function buildLabelPlane(
	m: SmartArt3DMesh,
	textStyle: TextStyleAnimationDescriptor | undefined,
): { plane: Mesh; disposables: Disposable[] } | null {
	if (!m.text) {
		return null;
	}
	const tex = makeTextTexture(
		m.text,
		m.textColor,
		m.fontSize,
		m.halfWidth * 2,
		m.halfHeight * 2,
		textStyle,
	);
	if (!tex) {
		return null;
	}
	const planeGeo = new PlaneGeometry(tex.worldWidth, tex.worldHeight);
	const planeMaterial = new MeshBasicMaterial({
		map: tex.texture,
		transparent: true,
		depthWrite: false,
	});
	const plane = new Mesh(planeGeo, planeMaterial);
	// Float just past the front (+z) face, clearing any bevel, following the
	// mesh's rotation so the label sits flat on the (possibly rotated) face.
	const euler = new Euler(m.rotation.x, m.rotation.y, m.rotation.z);
	const offset = new Vector3(0, 0, m.depth + m.bevel + 0.4).applyEuler(euler);
	plane.position.set(m.position.x + offset.x, m.position.y + offset.y, m.position.z + offset.z);
	plane.rotation.copy(euler);
	return { plane, disposables: [planeGeo, planeMaterial, tex.texture] };
}

/** Add a connector poly-line on the base plane. */
function addConnectors(group: Group, disposables: Disposable[], model: SmartArt3DModel): void {
	for (const c of model.connectors) {
		if (c.points.length < 2) {
			continue;
		}
		const geo = new BufferGeometry().setFromPoints(c.points.map((p) => new Vector3(p.x, p.y, p.z)));
		const material = new LineBasicMaterial({
			color: new Color(c.color),
			transparent: true,
			opacity: 0.7,
		});
		group.add(new Line(geo, material));
		disposables.push(geo, material);
	}
}

/** Remove and dispose one label entry's current plane, if any. */
function clearLabel(group: Group, entry: LabelEntry): void {
	if (entry.plane) {
		group.remove(entry.plane);
	}
	for (const d of entry.disposables) {
		d.dispose();
	}
	entry.plane = null;
	entry.disposables = [];
}

/**
 * Build a `THREE.Group` for a SmartArt 3D model. The group is centred on the
 * origin (the model positions already are); callers add it to the scene.
 * `textStyle` is a font-style emphasis override applied to every node's
 * label (see {@link BuiltMeshGroup.setTextStyle}); emphasis is authored per
 * shape/animation-target, not per SmartArt node, so it applies uniformly.
 */
export function buildMeshGroup(
	model: SmartArt3DModel,
	textStyle?: TextStyleAnimationDescriptor,
): BuiltMeshGroup {
	const group = new Group();
	const blockDisposables: Disposable[] = [];
	const labelEntries: LabelEntry[] = model.meshes.map((m) => {
		addBlock(group, blockDisposables, m);
		const built = buildLabelPlane(m, textStyle);
		if (built) {
			group.add(built.plane);
		}
		return { node: m, plane: built?.plane ?? null, disposables: built?.disposables ?? [] };
	});
	addConnectors(group, blockDisposables, model);

	return {
		group,
		setTextStyle(style) {
			for (const entry of labelEntries) {
				clearLabel(group, entry);
				const built = buildLabelPlane(entry.node, style);
				if (built) {
					group.add(built.plane);
					entry.plane = built.plane;
					entry.disposables = built.disposables;
				}
			}
		},
		dispose() {
			for (const d of blockDisposables) {
				d.dispose();
			}
			for (const entry of labelEntries) {
				clearLabel(group, entry);
			}
		},
	};
}
