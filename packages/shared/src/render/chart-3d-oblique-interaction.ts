/**
 * Pointer interaction for the oblique `bar3D` scene (`chart-3d-view-scene.ts`):
 * the {@link Chart3DMarkAdapter} for its boxes, on the shared hover/select/
 * drag handling of `chart-3d-mark-interaction.ts`.
 *
 * Bars come from the right-angle-axes layout (`chart-3d-oblique-layout.ts`);
 * a value drag moves along that layout's value axis with its own scale
 * (`chart-3d-oblique-drag.ts`), vertically for columns and horizontally for
 * a `c:barDir="bar"` chart. As in the 2D chart, stacked segments select but
 * never drag.
 *
 * @module chart-3d-oblique-interaction
 */
import type { PptxChartData } from 'pptx-viewer-core';
import type * as THREE from 'three';

import type { ThreeViewContext } from '../three-view/types';
import { placeObliqueBarMesh } from './chart-3d-bar-mesh';
import { attachChart3DMarkInteraction } from './chart-3d-mark-interaction';
import type { Chart3DMarkInteraction, Chart3DPoint } from './chart-3d-mark-interaction';
import {
	isObliqueBarDraggable,
	obliqueBarAtValue,
	obliqueDragValue,
} from './chart-3d-oblique-drag';
import type { ObliqueChartLayout } from './chart-3d-oblique-layout';

/** Colour of the selected box's outline (matches the 2D selected-mark accent). */
const SELECTED_OUTLINE_COLOR = 0x2563eb;

export interface ObliqueBarInteractionOptions {
	ctx: ThreeViewContext;
	camera: THREE.Camera;
	meshes: ReadonlyArray<THREE.Mesh>;
	layout: ObliqueChartLayout;
	/** Chart px size of the view-box the scene frame is centred on. */
	svgWidth: number;
	svgHeight: number;
	chartData: PptxChartData;
	categoryLabels: ReadonlyArray<string>;
	seriesNames: ReadonlyArray<string>;
	/** Scene the selection outline is added to. */
	scene: THREE.Object3D;
}

export type ObliqueBarInteraction = Chart3DMarkInteraction;

/** Attach hover/select/drag to an oblique bar scene's boxes. */
export function attachObliqueBarInteraction(
	options: ObliqueBarInteractionOptions,
): ObliqueBarInteraction {
	const { ctx, meshes, layout } = options;
	const bars = layout.bars;
	const three = ctx.three;

	const outline = new three.LineSegments(
		new three.EdgesGeometry(new three.BoxGeometry(1, 1, 1)),
		new three.LineBasicMaterial({ color: SELECTED_OUTLINE_COLOR }),
	);
	outline.visible = false;
	options.scene.add(outline);
	let selected = -1;

	const indexOf = (point: Chart3DPoint): number =>
		bars.findIndex(
			(b) => b.seriesIndex === point.seriesIndex && b.categoryIndex === point.pointIndex,
		);

	function syncOutline(): void {
		outline.visible = selected >= 0;
		if (selected >= 0) {
			outline.position.copy(meshes[selected].position);
			outline.scale.copy(meshes[selected].scale);
		}
	}

	return attachChart3DMarkInteraction({
		ctx,
		camera: options.camera,
		scene: options.scene,
		svgHeight: options.svgHeight,
		chartData: options.chartData,
		categoryLabels: options.categoryLabels,
		seriesNames: options.seriesNames,
		adapter: {
			targets: meshes,
			pointAt(hit) {
				const data = hit.object.userData as { seriesIndex?: number; categoryIndex?: number };
				if (data.seriesIndex === undefined || data.categoryIndex === undefined) {
					return null;
				}
				return { seriesIndex: data.seriesIndex, pointIndex: data.categoryIndex };
			},
			valueOf(point) {
				return bars[indexOf(point)]?.value;
			},
			beginDrag(point) {
				const index = indexOf(point);
				if (index < 0 || !isObliqueBarDraggable(layout)) {
					return null;
				}
				const start = bars[index];
				return {
					preview(dx, dy) {
						const value = obliqueDragValue(layout, start.value, dx, dy);
						placeObliqueBarMesh(
							three,
							meshes[index],
							layout,
							options.svgWidth,
							options.svgHeight,
							obliqueBarAtValue(layout, start, value),
						);
						syncOutline();
						return value;
					},
				};
			},
			highlight(point) {
				selected = point ? indexOf(point) : -1;
				syncOutline();
			},
			dispose() {
				outline.geometry.dispose();
				(outline.material as THREE.Material).dispose();
				outline.removeFromParent();
			},
		},
	});
}
