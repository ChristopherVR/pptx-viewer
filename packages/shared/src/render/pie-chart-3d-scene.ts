/**
 * three.js 3D pie-chart scene for `<pptx-three-view>` (framework-agnostic).
 *
 * Builds an interactive `pie3D` chart as a `<pptx-three-view>` scene (drawn
 * by the shared renderer; see {@link ./chart-3d-hosted-stage.ts}): builds
 * one real `THREE.CylinderGeometry` wedge mesh per data point (a partial-arc
 * cylinder, so each wedge gets a flat top/bottom face, the two curved rim
 * faces, and the two flat radial "cut" faces for free), lights, a perspective
 * camera driven by `c:view3D` (`rotX`/`rotY`/`rperspective`/`hPercent`) and
 * OrbitControls. Raycasts pointer moves against the wedges to
 * set a native hover tooltip on the canvas element (see
 * {@link ./pie-chart-3d-hit-test.ts}), matching every other chart kind's
 * SVG-`<title>` hover tooltip.
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
 * @module pie-chart-3d-scene
 */

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import {
	createHostedChart3DStage,
	finishHostedChart3DScene,
	hostedChart3DInteraction,
} from './chart-3d-hosted-stage';
import { attachChart3DHoverTooltip } from './chart-3d-hover-tooltip';
import type { HighlightableMaterialRef } from './chart-3d-mesh-highlight';
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
	PieChart3DInteractionHandle,
	PieChart3DWedgeAngleRef,
} from './pie-chart-3d-interaction-wiring';
import { applyPieChart3DWedgeAngles, buildPieChart3DWedgeMeshes } from './pie-chart-3d-mesh';

/** Build the hosted pie3D scene. */
export function createPieChart3DScene(
	ctx: ThreeViewContext,
	options: PieChart3DSceneOptions,
): ThreeViewScene {
	const placement = computePieChart3DCameraPlacement(options.view3D);
	const stage = createHostedChart3DStage(
		ctx,
		placement,
		{ minDistance: 0.5, maxDistance: 30 },
		0.65,
	);
	const { three, scene, camera, canvas, controls } = stage;
	const interaction = hostedChart3DInteraction(ctx);

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

	return finishHostedChart3DScene(
		ctx,
		stage,
		{
			// No `resize`: this scene's own wiring re-derives the pointer's NDC
			// position from `canvas.getBoundingClientRect()` on every raycast.
			setSelectedPart: (part) => pointerInteraction.setSelectedPart(part),
			dispose() {
				hoverTooltip.dispose();
				pointerInteraction.dispose();
				for (const g of wedgeGeometries) {
					g.dispose();
				}
				for (const m of wedgeMaterials) {
					m.dispose();
				}
			},
		},
		interaction,
	);
}
