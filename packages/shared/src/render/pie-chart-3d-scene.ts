/**
 * Vanilla three.js 3D pie-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive `pie3D` chart into a caller-provided container
 * element: dynamically imports `three` plus its `OrbitControls` addon, builds
 * one real `THREE.CylinderGeometry` wedge mesh per data point (a partial-arc
 * cylinder, so each wedge gets a flat top/bottom face, the two curved rim
 * faces, and the two flat radial "cut" faces for free), lights, a perspective
 * camera driven by `c:view3D` (`rotX`/`rotY`/`rperspective`/`hPercent`),
 * OrbitControls, and a RAF loop. Raycasts pointer moves against the wedges to
 * set a native hover tooltip on the canvas element (see
 * {@link ./pie-chart-3d-hit-test.ts}), matching every other chart kind's
 * SVG-`<title>` hover tooltip. Exposes `dispose()` for deterministic teardown.
 *
 * Unlike the cartesian 3D scenes (bar3D/line3D/area3D), a pie has no plot
 * rectangle to wall in, so this module mounts no grid floor or
 * `c:floor`/`c:sideWall`/`c:backWall` panels, matching PowerPoint's own
 * behaviour and the flat SVG engine's `chart-3d-surfaces.ts` doc comment.
 *
 * A wedge is also drag-to-value, exactly like the flat SVG pie/doughnut:
 * dragging sweeps its trailing edge around the pie's centre, and every other
 * slice's ANGLE renormalises live (its own absolute value stays fixed, but the
 * series total the pie's angles divide against changes) - see
 * `pie-chart-3d-drag.ts` / `pie-chart-3d-interaction-wiring.ts`. Because the
 * bar3D/line3D/area3D/surface3D drag calibration in
 * `chart-3d-pointer-interaction.ts` only handles a single fixed WORLD axis,
 * this scene wires its own pointer interaction instead of that shared one.
 *
 * Mirrors {@link ./bar-chart-3d-scene.ts} (`mountBarChart3D`), the
 * established shape for this "optional three.js scene with a 2D SVG safety
 * net" pattern: `three` is an OPTIONAL peer dependency, every import is
 * dynamic and guarded, and a missing dependency resolves to a no-op sentinel
 * handle so the caller falls back to the flat 2D renderer.
 *
 * @module pie-chart-3d-scene
 */

import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
import { loadChart3DOrbitControls, loadChart3DThree } from './chart-3d-three-loader';
import type { ChartPartRef } from './chart-view-model';
import type { PieChart3DSceneOptions } from './pie-chart-3d-data';
import {
	computePieChart3DCameraPlacement,
	computePieChart3DSliceAngles,
} from './pie-chart-3d-geom';
import type { PieChart3DSliceAngle } from './pie-chart-3d-geom';
import { buildPieChart3DHoverTooltip } from './pie-chart-3d-hit-test';
import type { PieChart3DHit } from './pie-chart-3d-hit-test';
import { attachPieChart3DInteraction } from './pie-chart-3d-interaction-wiring';
import type {
	PieChart3DInteraction,
	PieChart3DInteractionHandle,
	PieChart3DWedgeAngleRef,
} from './pie-chart-3d-interaction-wiring';
import { applyPieChart3DWedgeAngles, buildPieChart3DWedgeMeshes } from './pie-chart-3d-mesh';

export type { PieChart3DInteraction };

/** Imperative handle to a mounted pie3D chart view. */
export interface PieChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	/** Apply (or clear) the selected-wedge highlight, e.g. when selection changes via the inspector rather than a click on this scene. */
	setSelectedPart: (part: ChartPartRef | null) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const PIE_CHART_THREE_UNAVAILABLE: PieChart3DHandle = {
	ok: false,
	resize: () => {},
	setSelectedPart: () => {},
	dispose: () => {},
};

/**
 * Mount an interactive 3D pie chart into `container` and start rendering.
 *
 * Resolves to {@link PIE_CHART_THREE_UNAVAILABLE} when `three` or its
 * OrbitControls addon cannot be loaded, so the caller can fall back to the
 * flat SVG oblique-projection pie3D renderer.
 */
export async function mountPieChart3D(
	container: HTMLElement,
	options: PieChart3DSceneOptions,
	interaction?: PieChart3DInteraction,
): Promise<PieChart3DHandle> {
	const threeModule = await loadChart3DThree();
	const OrbitCtrlCtor = threeModule ? await loadChart3DOrbitControls() : null;
	if (!threeModule || !OrbitCtrlCtor) {
		return PIE_CHART_THREE_UNAVAILABLE;
	}
	// A stable non-null binding (rather than the `ThreeModule | null` `threeModule`
	// above): TypeScript's control-flow narrowing from the guard above does not
	// reliably survive into `recomputeLiveAngles` below, a hoisted function
	// declaration referencing `three` from an enclosing scope.
	const three = threeModule;

	let width = Math.max(1, options.width);
	let height = Math.max(1, options.height);

	const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(
		Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2),
	);
	renderer.setSize(width, height, false);
	const canvas = renderer.domElement;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.display = 'block';
	canvas.style.willChange = 'transform';
	container.appendChild(canvas);

	const scene = new three.Scene();
	scene.add(new three.AmbientLight(0xffffff, 0.65));
	const key = new three.DirectionalLight(0xffffff, 0.8);
	key.position.set(5, 8, 5);
	scene.add(key);
	const fill = new three.DirectionalLight(0xffffff, 0.3);
	fill.position.set(-3, 4, -2);
	scene.add(fill);

	const placement = computePieChart3DCameraPlacement(options.view3D);
	const camera = new three.PerspectiveCamera(placement.fov, width / height, 0.1, 1000);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	// One CylinderGeometry mesh per wedge (see pie-chart-3d-mesh.ts for why a
	// partial-arc capped cylinder gets a full wedge shape for free).
	const {
		meshes: wedgeMeshes,
		geometries: wedgeGeometries,
		materials: wedgeMaterials,
	} = buildPieChart3DWedgeMeshes(
		three,
		scene,
		options.wedges,
		options.outerRadius,
		options.thickness,
	);

	// Raycast-based hover tooltip: each wedge mesh carries its own point index
	// in `userData`, so a hit reports the slice directly (no face-index -> cell
	// arithmetic, matching bar3D's box meshes).
	const hoverTooltip = attachChart3DHoverTooltip({
		three,
		canvas,
		camera,
		meshes: wedgeMeshes,
		buildTooltip: (intersection) =>
			buildPieChart3DHoverTooltip(intersection?.object.userData as PieChart3DHit | undefined, {
				categoryLabels: options.categoryLabels,
				seriesName: options.seriesName,
				numberFormat: options.numberFormat,
			}),
	});

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 0.5;
	controls.maxDistance = 30;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	// Live wedge-angle snapshot, updated by `recomputeLiveAngles` on every value
	// drag preview/commit tick so `getWedges` (re-read by the interaction
	// wiring at the start of every press) always reflects the on-screen
	// geometry, even across several drags within one mount, before any commit
	// round-trips through the caller and remounts the whole scene fresh.
	let currentAngles: readonly PieChart3DSliceAngle[] = options.wedges;
	let liveValues = options.values.slice();

	/** Recompute every wedge's angle from `liveValues` (one value already replaced by the caller) and rebuild its mesh. */
	function recomputeLiveAngles(): void {
		const angles = computePieChart3DSliceAngles(
			liveValues,
			options.explosions,
			options.firstSliceAngleDeg,
			options.outerRadius,
		);
		currentAngles = angles;
		applyPieChart3DWedgeAngles(
			three,
			wedgeMeshes,
			wedgeGeometries,
			options.outerRadius,
			options.thickness,
			angles,
		);
	}

	// Click-to-select + drag-to-value: each wedge is its own mesh, so it gets
	// the same emissive highlight bar3D/line3D/area3D marks do, and the ANGLE
	// drag (see the module doc comment) is wired through
	// `pie-chart-3d-interaction-wiring.ts` rather than the generic
	// single-fixed-axis calibration `chart-3d-pointer-interaction.ts` uses for
	// bar3D/line3D/area3D/surface3D.
	const pointerInteraction: PieChart3DInteractionHandle = attachPieChart3DInteraction({
		three,
		canvas,
		camera,
		controls,
		wedgeMeshes,
		wedgeMaterials: wedgeMaterials as unknown as HighlightableMaterialRef[],
		getWedges: (): readonly PieChart3DWedgeAngleRef[] => currentAngles,
		interaction: {
			onSelect: interaction?.onSelect,
			onValueDragPreview: (part, value) => {
				if (part.pointIndex !== undefined) {
					liveValues = liveValues.map((v, i) => (i === part.pointIndex ? value : v));
					recomputeLiveAngles();
				}
				interaction?.onValueDragPreview?.(part, value);
			},
			onValueDragCommit: (part, value) => {
				if (part.pointIndex !== undefined) {
					liveValues = liveValues.map((v, i) => (i === part.pointIndex ? value : v));
					recomputeLiveAngles();
				}
				interaction?.onValueDragCommit?.(part, value);
			},
		},
	});

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls.update();
		renderer.render(scene, camera);
	};
	frame = requestAnimationFrame(renderLoop);

	return {
		ok: true,
		resize(w: number, h: number) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			// No `updateSize`: unlike the generic `chart-3d-pointer-interaction.ts`
			// (which caches width/height to project a calibration to screen space
			// once at drag-start), this scene's own wiring re-derives the pointer's
			// NDC position from `canvas.getBoundingClientRect()` on every raycast,
			// so it needs no cached size to keep in sync.
		},
		setSelectedPart(part: ChartPartRef | null) {
			pointerInteraction.setSelectedPart(part);
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			cancelAnimationFrame(frame);
			hoverTooltip.dispose();
			pointerInteraction.dispose();
			controls.dispose();
			for (const g of wedgeGeometries) {
				g.dispose();
			}
			for (const m of wedgeMaterials) {
				m.dispose();
			}
			scene.clear();
			renderer.dispose();
			canvas.remove();
		},
	};
}
