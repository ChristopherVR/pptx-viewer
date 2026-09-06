/**
 * The DOM axis-label overlay + per-frame 3D->2D projection every interactive
 * three.js chart scene with axis labels (bar3D, line3D, area3D, surface3D)
 * repeats: create the overlay nodes ({@link createLabelOverlay}), then each
 * RAF frame project each label's world anchor through the camera and
 * position its `<div>` in CSS pixels (or hide it when behind the camera).
 * Extracted so a scene's own mount function only calls `update` from its
 * render loop instead of re-deriving this maths.
 *
 * @module chart-3d-label-projection
 */
import type * as THREE from 'three';

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type { SurfaceLabel } from './surface-chart-3d-geom';
import { createLabelOverlay } from './surface-chart-3d-label-overlay';

/** A mounted label overlay: append `layer` to the scene's container, call `update` every frame. */
export interface Chart3DLabelProjector {
	layer: HTMLDivElement;
	/** Re-project every label to screen space for the given camera + CSS-pixel viewport size. */
	update: (camera: THREE.Camera, width: number, height: number) => void;
	/** Apply (or clear) a font-style emphasis override across every label. */
	applyTextStyle: (style: TextStyleAnimationDescriptor | undefined) => void;
}

/** Build the label overlay and its per-frame projector for one scene. */
export function createChart3DLabelProjector(
	three: typeof THREE,
	doc: Document,
	labels: ReadonlyArray<SurfaceLabel>,
): Chart3DLabelProjector {
	const overlay = createLabelOverlay(doc, labels);
	const anchors = labels.map((l) => new three.Vector3(...l.anchor));
	const projected = new three.Vector3();
	return {
		layer: overlay.layer,
		applyTextStyle: overlay.applyTextStyle,
		update(camera, width, height) {
			for (let i = 0; i < overlay.nodes.length; i++) {
				projected.copy(anchors[i]).project(camera);
				const node = overlay.nodes[i];
				if (projected.z > 1) {
					node.style.display = 'none';
					continue;
				}
				node.style.display = '';
				node.style.left = `${((projected.x + 1) / 2) * width}px`;
				node.style.top = `${((-projected.y + 1) / 2) * height}px`;
			}
		},
	};
}
