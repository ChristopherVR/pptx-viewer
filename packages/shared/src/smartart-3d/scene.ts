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

/** Camera distance that frames a `width x height` plane at the given FOV. */
function frameDistance(width: number, height: number, aspect: number): number {
	const vFov = (FOV * Math.PI) / 180;
	const fitH = height / 2 / Math.tan(vFov / 2);
	const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
	const fitW = width / 2 / Math.tan(hFov / 2);
	return Math.max(fitH, fitW) * 1.18;
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

	const { width: bw, height: bh } = model.bounds;
	const aspect = width / Math.max(1, height);
	const dist = frameDistance(bw, bh, aspect);

	const camera = new PerspectiveCamera(FOV, aspect, 0.1, dist * 8 + 1000);
	// Slight offset gives the extrusion a readable 3D presence.
	camera.position.set(bw * 0.12, bh * 0.1, dist);
	camera.lookAt(0, 0, 0);

	scene.add(new AmbientLight(0xffffff, 0.62));
	const key = new DirectionalLight(0xffffff, 0.95);
	key.position.set(bw * 0.4, bh * 0.6, dist);
	scene.add(key);
	const fill = new DirectionalLight(0xffffff, 0.3);
	fill.position.set(-bw * 0.5, -bh * 0.3, dist * 0.6);
	scene.add(fill);

	const built = buildMeshGroup(model);
	scene.add(built.group);

	let controls: OrbitControls | null = null;
	const enableControls = (on: boolean): void => {
		if (on && !controls) {
			controls = new OrbitControls(camera, canvas);
			controls.enablePan = false;
			controls.target.set(0, 0, 0);
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
