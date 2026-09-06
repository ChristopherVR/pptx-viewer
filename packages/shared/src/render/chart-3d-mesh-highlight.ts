/**
 * `chart-3d-mesh-highlight`: the one-mesh-per-mark selected-highlight loop
 * shared by bar3D, line3D, area3D, and pie3D (every interactive 3D chart
 * scene EXCEPT surface3D, whose grid is a single mesh with no per-cell
 * material to isolate - it highlights its selected vertex with a small
 * marker mesh instead, see `surface-chart-3d-interaction-wiring.ts`'s
 * `createSurfaceHighlightMarker`).
 *
 * Each of those four scenes tags every mark's own mesh material with its
 * (series, point) in `userData` already (for hover/click hit-testing); this
 * module just walks that same list and toggles `material.emissive` on the
 * mark matching the current selection, clearing every other mark's.
 *
 * A bar3D box with a `c:pictureOptions` picture fill mounts a per-face
 * `THREE.Material[]` array rather than one material (see
 * `bar-chart-3d-materials.ts`), so `material` here also accepts a readonly
 * array: every material in it gets the same emissive toggle, highlighting
 * (or clearing) the whole box regardless of how many materials its mesh
 * carries.
 *
 * @module chart-3d-mesh-highlight
 */
import {
	CHART_3D_SELECTED_EMISSIVE,
	CHART_3D_SELECTED_EMISSIVE_INTENSITY,
	chart3DMarkMatchesPart,
} from './chart-3d-interaction';
import type { Chart3DMarkHit } from './chart-3d-interaction';
import type { ChartPartRef } from './chart-view-model';

/** The subset of a `THREE.MeshPhongMaterial`/`MeshStandardMaterial` this needs. */
export interface HighlightableMaterial {
	emissive: { set: (color: string) => void };
	emissiveIntensity: number;
}

/** One mesh's material(s): a single material, or a per-face array (a multi-material mesh). */
export type HighlightableMaterialRef = HighlightableMaterial | readonly HighlightableMaterial[];

const CLEAR_EMISSIVE = '#000000';

/**
 * Apply (or clear) the selected-mark emissive highlight across a scene's
 * mark meshes. `entries` pairs each mesh's own (series, point) reference with
 * its material (or, for a multi-material mesh, every material in its
 * per-face array); every entry not matching `part` is reset to no highlight.
 */
export function applyChart3DMeshHighlight(
	entries: ReadonlyArray<{ mark: Chart3DMarkHit; material: HighlightableMaterialRef }>,
	part: ChartPartRef | null,
): void {
	for (const { mark, material } of entries) {
		const selected = chart3DMarkMatchesPart(mark, part);
		const materials = Array.isArray(material) ? material : [material as HighlightableMaterial];
		for (const one of materials) {
			one.emissive.set(selected ? CHART_3D_SELECTED_EMISSIVE : CLEAR_EMISSIVE);
			one.emissiveIntensity = selected ? CHART_3D_SELECTED_EMISSIVE_INTENSITY : 0;
		}
	}
}
