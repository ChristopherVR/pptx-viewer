/**
 * `chart-3d-hover-tooltip`: the identical raycast-pointer-to-native-tooltip
 * wiring every interactive three.js chart scene (bar3D, line3D, area3D,
 * pie3D, surface3D) used to define for itself: convert a pointer position to
 * NDC, raycast it against the scene's marks, and set the canvas element's own
 * `title` attribute so the browser shows the same native tooltip every other
 * chart kind's SVG `<title>` mark already gets. Extracted so the five
 * near-identical copies become one; each scene supplies only its own
 * mesh list and hit -> tooltip-text mapping (`bar-chart-3d-hit-test.ts` and
 * its per-kind siblings).
 *
 * @module chart-3d-hover-tooltip
 */
import type * as THREE from 'three';

type ThreeModule = typeof THREE;

/** Options wiring one scene's meshes/camera into the shared hover-tooltip raycaster. */
export interface Chart3DHoverTooltipOptions {
	three: ThreeModule;
	canvas: HTMLCanvasElement;
	camera: THREE.Camera;
	/** Meshes to raycast against (a single-element array for a scene with one shared mesh, e.g. surface3D). */
	meshes: ReadonlyArray<THREE.Object3D>;
	/** Build the tooltip text for a raycast hit (or `undefined`, when there is none). */
	buildTooltip: (intersection: THREE.Intersection | undefined) => string | undefined;
}

/** Handle returned by {@link attachChart3DHoverTooltip}. */
export interface Chart3DHoverTooltipHandle {
	dispose: () => void;
}

/** Attach the shared raycast-hover-tooltip wiring to one scene's canvas. */
export function attachChart3DHoverTooltip(
	options: Chart3DHoverTooltipOptions,
): Chart3DHoverTooltipHandle {
	const raycaster = new options.three.Raycaster();
	const ndc = new options.three.Vector2();
	let hoveredTooltip: string | undefined;

	const updateHoverTooltip = (clientX: number, clientY: number): void => {
		const rect = options.canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return;
		}
		ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(ndc, options.camera);
		const hit = raycaster.intersectObjects(options.meshes as THREE.Object3D[], false)[0];
		const tooltip = options.buildTooltip(hit);
		if (tooltip !== hoveredTooltip) {
			hoveredTooltip = tooltip;
			options.canvas.title = tooltip ?? '';
		}
	};
	const onPointerMove = (event: PointerEvent): void => {
		updateHoverTooltip(event.clientX, event.clientY);
	};
	const onPointerLeave = (): void => {
		if (hoveredTooltip !== undefined) {
			hoveredTooltip = undefined;
			options.canvas.title = '';
		}
	};
	options.canvas.addEventListener('pointermove', onPointerMove);
	options.canvas.addEventListener('pointerleave', onPointerLeave);

	return {
		dispose() {
			options.canvas.removeEventListener('pointermove', onPointerMove);
			options.canvas.removeEventListener('pointerleave', onPointerLeave);
		},
	};
}
