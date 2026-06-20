/**
 * Three.js SmartArt renderer - vanilla scene runtime.
 *
 * Frames a {@link SmartArt3DModel} in a WebGL scene (lights, perspective
 * camera, optional OrbitControls, render loop) on a caller-provided canvas.
 * Pure vanilla three.js - no framework code - so the React, Vue, and Angular
 * bindings all mount it through a thin canvas wrapper. `three` is imported here
 * only; this module lives behind the `pptx-viewer-shared/smartart-3d` subpath so
 * it is lazily loaded and `three` stays an optional dependency.
 */

import {
	AmbientLight,
	Color,
	DirectionalLight,
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { SmartArt3DModel } from '../render/smartart-3d-types';
import { buildMeshGroup } from './meshes';

/** Tunables for the mounted 3D view. */
export interface SmartArt3DViewOptions {
	/** Enable OrbitControls (rotate/zoom). Default `false`. */
	interactive?: boolean;
	/** Slowly auto-rotate the model. Default `false`. */
	autoRotate?: boolean;
	/** Solid background colour `#rrggbb`; omit for transparent. */
	background?: string;
	/** Device pixel-ratio cap. Default `2`. */
	maxPixelRatio?: number;
}

/** Imperative handle to a mounted SmartArt 3D view. */
export interface SmartArt3DHandle {
	/** Resize the renderer + camera to new pixel dimensions. */
	resize: (width: number, height: number) => void;
	/** Toggle interactive orbit controls at runtime. */
	setInteractive: (on: boolean) => void;
	/** Tear down the renderer, controls, and all GPU resources. */
	dispose: () => void;
}

const FOV = 42;

/** A bounding sphere of the 3D content (centre + radius). */
interface ContentSphere {
	cx: number;
	cy: number;
	cz: number;
	radius: number;
}

/** Bounding sphere of all meshes (expanded by footprint/depth) + connectors. */
function contentSphere(model: SmartArt3DModel): ContentSphere {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	const expand = (x: number, y: number, z: number, r: number): void => {
		minX = Math.min(minX, x - r);
		minY = Math.min(minY, y - r);
		minZ = Math.min(minZ, z - r);
		maxX = Math.max(maxX, x + r);
		maxY = Math.max(maxY, y + r);
		maxZ = Math.max(maxZ, z + r);
	};
	for (const m of model.meshes) {
		const r = Math.max(m.halfWidth, m.halfHeight) + m.depth + m.bevel;
		expand(m.position.x, m.position.y, m.position.z, r);
	}
	for (const c of model.connectors) {
		for (const p of c.points) {
			expand(p.x, p.y, p.z, 1);
		}
	}
	if (!Number.isFinite(minX)) {
		const fallback = Math.max(model.bounds.width, model.bounds.height) / 2 || 1;
		return { cx: 0, cy: 0, cz: 0, radius: fallback };
	}
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		cz: (minZ + maxZ) / 2,
		radius: 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1,
	};
}

/** Camera distance that frames a bounding sphere of `radius` at the given FOV. */
function frameDistance(radius: number, aspect: number): number {
	const vFov = (FOV * Math.PI) / 180;
	const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
	const minFov = Math.min(vFov, hFov);
	return (radius / Math.sin(minFov / 2)) * 1.1;
}

/**
 * Mount a SmartArt 3D model onto a canvas and start rendering.
 *
 * @returns a handle for resizing, toggling interactivity, and disposal.
 */
export function mountSmartArt3D(
	canvas: HTMLCanvasElement,
	model: SmartArt3DModel,
	width: number,
	height: number,
	options: SmartArt3DViewOptions = {},
): SmartArt3DHandle {
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: !options.background });
	renderer.setPixelRatio(
		Math.min(
			typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
			options.maxPixelRatio ?? 2,
		),
	);
	renderer.setSize(width, height, false);

	const scene = new Scene();
	if (options.background) {
		scene.background = new Color(options.background);
	}

	const { cx, cy, cz, radius } = contentSphere(model);
	const aspect = width / Math.max(1, height);
	const dist = frameDistance(radius, aspect);

	const camera = new PerspectiveCamera(FOV, aspect, 0.1, dist * 8 + radius * 4);
	// A slight elevation + offset gives the extrusion/spatial depth a readable
	// three-quarter presence, framing the content's own centroid.
	camera.position.set(cx + radius * 0.25, cy + radius * 0.3, cz + dist);
	camera.lookAt(cx, cy, cz);

	scene.add(new AmbientLight(0xffffff, 0.62));
	const key = new DirectionalLight(0xffffff, 0.95);
	key.position.set(cx + radius, cy + radius * 1.4, cz + dist);
	scene.add(key);
	const fill = new DirectionalLight(0xffffff, 0.3);
	fill.position.set(cx - radius, cy - radius * 0.6, cz + dist * 0.6);
	scene.add(fill);

	const built = buildMeshGroup(model);
	scene.add(built.group);

	let controls: OrbitControls | null = null;
	const enableControls = (on: boolean): void => {
		if (on && !controls) {
			controls = new OrbitControls(camera, canvas);
			controls.enablePan = false;
			controls.target.set(cx, cy, cz);
			controls.minDistance = dist * 0.4;
			controls.maxDistance = dist * 3;
			controls.update();
		} else if (!on && controls) {
			controls.dispose();
			controls = null;
		}
		if (controls) {
			controls.autoRotate = Boolean(options.autoRotate);
			controls.autoRotateSpeed = 1.2;
		}
	};
	enableControls(Boolean(options.interactive));

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls?.update();
		renderer.render(scene, camera);
	};
	frame = requestAnimationFrame(renderLoop);

	return {
		resize(w: number, h: number) {
			camera.aspect = w / Math.max(1, h);
			camera.updateProjectionMatrix();
			renderer.setSize(w, h, false);
		},
		setInteractive(on: boolean) {
			enableControls(on);
		},
		dispose() {
			disposed = true;
			cancelAnimationFrame(frame);
			controls?.dispose();
			built.dispose();
			renderer.dispose();
		},
	};
}
