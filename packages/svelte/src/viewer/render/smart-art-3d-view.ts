import type { PptxElement, SmartArtStyle } from 'pptx-viewer-core';
import type { SmartArt3DModel } from 'pptx-viewer-shared';
import {
	buildSmartArt3DModel,
	collectCoherent3DOffNodeIds,
	computeSmartArtElementLayout,
	resolvePalette,
} from 'pptx-viewer-shared';

/**
 * Pure model resolution for the Three.js SmartArt renderer (Svelte port of
 * Vue's `SmartArt3DRenderer.vue` `model` computed). Builds the 2D fallback
 * layout via the shared engine, resolved with the same palette the SVG
 * `SmartArtView` uses, then extrudes it into a spatial 3D model. The vanilla
 * three.js scene mounter that consumes this lives behind the
 * `pptx-viewer-shared/smartart-3d` subpath so `three` stays optional; this
 * module has no `three` import and stays unit-testable without a DOM.
 */

/**
 * Build the 3D model for `element`, or `undefined` when it is not a SmartArt
 * diagram or has no renderable nodes (the caller should fall back to the SVG
 * `SmartArtView` in that case).
 */
export function buildSmartArt3DViewModel(element: PptxElement): SmartArt3DModel | undefined {
	if (element.type !== 'smartArt') {
		return undefined;
	}
	const data = element.smartArtData;
	if (!data || data.nodes.length === 0) {
		return undefined;
	}
	const style: SmartArtStyle = data.style ?? 'flat';
	const layout = computeSmartArtElementLayout(
		data,
		data.nodes,
		{ width: element.width, height: element.height },
		resolvePalette(data),
		style,
		element.id,
	);
	return buildSmartArt3DModel(layout, {
		spatial: true,
		coherent3DOffNodeIds: collectCoherent3DOffNodeIds(data.nodes),
	});
}
