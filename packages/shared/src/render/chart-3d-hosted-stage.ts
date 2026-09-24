/**
 * The shared frame every perspective 3D chart scene (bar3D, line3D, area3D,
 * pie3D, surface3D) runs inside when hosted by `<pptx-three-view>`.
 *
 * Each scene module only builds its own meshes, hover tooltip, pointer
 * interaction and label overlay against the stage this module creates (lights,
 * perspective camera, OrbitControls); {@link finishHostedChart3DScene} turns
 * the result into the {@link ThreeViewScene} the host drives. Nothing here
 * creates a `WebGLRenderer` or runs a frame loop: the one page-wide renderer
 * (`three-view/renderer-host.ts`) draws on demand, so this module asks for a
 * frame whenever the camera moves or a pointer gesture may have changed a
 * mesh (hover, selection highlight, value-drag preview).
 *
 * `three` arrives through the mount context; this module never imports it at
 * runtime (see `three-view/no-runtime-three-import.test.ts`).
 *
 * @module chart-3d-hosted-stage
 */
import type * as THREE from 'three';

import type { ThreeOrbitControls, ThreeViewContext, ThreeViewScene } from '../three-view/types';
import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type { ChartPartRef } from './chart-view-model';

/** Camera placement a scene derives from its own `c:view3D`. */
export interface Chart3DCameraPlacement {
	fov: number;
	position: readonly [number, number, number];
	target: readonly [number, number, number];
}

/** Orbit limits a scene applies to its controls. */
export interface Chart3DOrbitLimits {
	minDistance: number;
	maxDistance: number;
}

/** What a hosted chart scene builds its meshes against. */
export interface HostedChart3DStage {
	three: typeof THREE;
	/** The canvas pointer input lands on (hover tooltip, raycasts, OrbitControls). */
	canvas: HTMLCanvasElement;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	/** OrbitControls, or a disabled stand-in when the addon is unavailable. */
	controls: { enabled: boolean };
	width: number;
	height: number;
}

/** The scene-specific parts {@link finishHostedChart3DScene} wraps. */
export interface HostedChart3DParts {
	/** Called after every frame (re-project the DOM label overlay). */
	afterRender?: (camera: THREE.PerspectiveCamera, width: number, height: number) => void;
	/** The view's CSS size changed (pointer calibration). */
	resize?: (width: number, height: number) => void;
	setSelectedPart?: (part: ChartPartRef | null) => void;
	setTextStyle?: (style: TextStyleAnimationDescriptor | undefined) => void;
	/** Release the scene's own geometries, materials, listeners and overlay nodes. */
	dispose: () => void;
}

/** Pointer events after which a scene may look different (hover, highlight, drag preview). */
const REDRAW_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'pointerleave', 'wheel'] as const;

/** Build the lights, camera and controls every perspective chart scene shares. */
export function createHostedChart3DStage(
	ctx: ThreeViewContext,
	placement: Chart3DCameraPlacement,
	limits: Chart3DOrbitLimits,
	ambientIntensity = 0.6,
): HostedChart3DStage & { orbit: ThreeOrbitControls | null } {
	const three = ctx.three;
	const width = Math.max(1, ctx.size.width);
	const height = Math.max(1, ctx.size.height);

	const scene = new three.Scene();
	scene.add(new three.AmbientLight(0xffffff, ambientIntensity));
	const key = new three.DirectionalLight(0xffffff, 0.8);
	key.position.set(5, 8, 5);
	scene.add(key);
	const fill = new three.DirectionalLight(0xffffff, 0.3);
	fill.position.set(-3, 4, -2);
	scene.add(fill);

	const camera = new three.PerspectiveCamera(placement.fov, width / height, 0.1, 1000);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	let orbit: ThreeOrbitControls | null = null;
	if (ctx.OrbitControls) {
		orbit = new ctx.OrbitControls(camera, ctx.eventTarget);
		const limited = orbit as ThreeOrbitControls & {
			minDistance?: number;
			maxDistance?: number;
			maxPolarAngle?: number;
		};
		limited.enablePan = true;
		limited.enableZoom = true;
		limited.enableRotate = true;
		limited.minDistance = limits.minDistance;
		limited.maxDistance = limits.maxDistance;
		limited.maxPolarAngle = Math.PI / 2 + 0.3;
		limited.target.copy(target);
		limited.enabled = ctx.interactive;
		limited.update();
	}

	return {
		three,
		canvas: ctx.eventTarget as HTMLCanvasElement,
		scene,
		camera,
		controls: orbit ?? { enabled: false },
		orbit,
		width,
		height,
	};
}

/** Value-interaction callbacks a hosted scene hands its pointer wiring, plus the interactive switch. */
export interface HostedChart3DInteraction {
	onSelect: (part: ChartPartRef | null) => void;
	onValueDragPreview: (part: ChartPartRef, value: number) => void;
	onValueDragCommit: (part: ChartPartRef, value: number) => void;
	/** Turn event emission on/off (follows the view's `interactive` flag). */
	set: (on: boolean) => void;
}

/**
 * The value-interaction callbacks a hosted scene hands its pointer wiring:
 * they raise `<pptx-three-view>` select/drag events, and stay silent while the
 * view is not interactive (a read-only mount never touches the selection).
 */
export function hostedChart3DInteraction(ctx: ThreeViewContext): HostedChart3DInteraction {
	let interactive = ctx.interactive;
	return {
		onSelect: (part) => {
			if (interactive) {
				ctx.emit({ type: 'select', part });
			}
		},
		onValueDragPreview: (part, value) => {
			if (interactive) {
				ctx.emit({ type: 'drag', detail: { part, value, phase: 'move' } });
			}
		},
		onValueDragCommit: (part, value) => {
			if (interactive) {
				ctx.emit({ type: 'drag', detail: { part, value, phase: 'commit' } });
			}
		},
		set: (on) => {
			interactive = on;
		},
	};
}

/** Wrap a built stage + its scene-specific parts as the {@link ThreeViewScene} the host drives. */
export function finishHostedChart3DScene(
	ctx: ThreeViewContext,
	stage: HostedChart3DStage & { orbit: ThreeOrbitControls | null },
	parts: HostedChart3DParts,
	interactive: { set: (on: boolean) => void },
): ThreeViewScene {
	let width = stage.width;
	let height = stage.height;
	const requestRender = (): void => ctx.requestRender();
	stage.orbit?.addEventListener('change', requestRender);
	for (const type of REDRAW_EVENTS) {
		ctx.eventTarget.addEventListener(type, requestRender);
	}

	let disposed = false;
	return {
		render(renderer) {
			stage.orbit?.update();
			renderer.render(stage.scene, stage.camera);
			parts.afterRender?.(stage.camera, width, height);
		},
		resize(size) {
			width = Math.max(1, size.width);
			height = Math.max(1, size.height);
			stage.camera.aspect = width / height;
			stage.camera.updateProjectionMatrix();
			parts.resize?.(width, height);
		},
		isAnimating: () => false,
		setInteractive(on) {
			interactive.set(on);
			if (stage.orbit) {
				stage.orbit.enabled = on;
			}
		},
		setSelectedPart(part) {
			parts.setSelectedPart?.(part);
		},
		setTextStyle(style) {
			parts.setTextStyle?.(style);
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			stage.orbit?.removeEventListener('change', requestRender);
			for (const type of REDRAW_EVENTS) {
				ctx.eventTarget.removeEventListener(type, requestRender);
			}
			stage.orbit?.dispose();
			parts.dispose();
			stage.scene.clear();
		},
	};
}
