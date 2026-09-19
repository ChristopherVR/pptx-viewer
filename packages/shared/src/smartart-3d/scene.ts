/**
 * Three.js SmartArt renderer - vanilla scene runtime.
 *
 * Frames a {@link SmartArt3DModel} in a WebGL scene (lights, perspective
 * camera, optional OrbitControls, render loop) on a caller-provided canvas.
 * Pure vanilla three.js - no framework code - so the React, Vue, and Angular
 * bindings all mount it through a thin canvas wrapper. `three` is imported here
 * only; this module lives behind the `pptx-viewer-shared/smartart-3d` subpath so
 * it is lazily loaded and `three` stays an optional dependency.
 *
 * Camera framing (`contentSphere`/`fitCamera`/`cameraElevation`) and label
 * billboarding (`billboardLabels`) are pure geometry, split out to
 * `scene-camera.ts` to keep this module focused on mount/render-loop
 * orchestration.
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

import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';
import type { SmartArt3DModel } from '../render/smartart-3d-types';
import { buildMeshGroup } from './meshes';
import { billboardLabels, contentSphere, fitCamera, FOV } from './scene-camera';

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
	/** Active font-style emphasis override (bold/italic/underline/size/colour) for every node's caption. */
	textStyle?: TextStyleAnimationDescriptor;
}

/** Imperative handle to a mounted SmartArt 3D view. */
export interface SmartArt3DHandle {
	/** Resize the renderer + camera to new pixel dimensions. */
	resize: (width: number, height: number) => void;
	/** Toggle interactive orbit controls at runtime. */
	setInteractive: (on: boolean) => void;
	/** Apply (or clear) a font-style emphasis override on every node's caption. */
	setTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
	/** Tear down the renderer, controls, and all GPU resources. */
	dispose: () => void;
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

	const bounds = contentSphere(model);
	const { cx, cy, cz, radius } = bounds;
	const aspect = width / Math.max(1, height);
	// Fit the content's projected bounding box (not just its sphere) to the
	// frame; see `fitCamera` for why the sphere fit alone left wide, flat
	// diagrams tiny.
	const placement = fitCamera(bounds, model.family, aspect);
	const { dist } = placement;

	const camera = new PerspectiveCamera(FOV, aspect, 0.1, dist * 8 + radius * 4);
	camera.position.set(...placement.position);
	camera.lookAt(...placement.target);

	scene.add(new AmbientLight(0xffffff, 0.62));
	const key = new DirectionalLight(0xffffff, 0.95);
	key.position.set(cx + radius, cy + radius * 1.4, cz + dist);
	scene.add(key);
	const fill = new DirectionalLight(0xffffff, 0.3);
	fill.position.set(cx - radius, cy - radius * 0.6, cz + dist * 0.6);
	scene.add(fill);

	const built = buildMeshGroup(model, options.textStyle);
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
		billboardLabels(built, camera);
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
		setTextStyle(style: TextStyleAnimationDescriptor | undefined) {
			built.setTextStyle(style);
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
