/**
 * Build the {@link SmartArt3DModel} for a SmartArt element: the one place
 * every binding (and `<pptx-three-view>`) turns an element into its 3D scene
 * input, instead of each binding repeating the layout-resolution steps.
 *
 * @module smartart-3d-element
 */
import type { PptxElement } from 'pptx-viewer-core';

import { resolveSmartArt3DLayout } from './smartart-3d-layout-source';
import { collectCoherent3DOffNodeIds, buildSmartArt3DModel } from './smartart-3d-model';
import type { SmartArt3DModel } from './smartart-3d-types';
import { resolvePalette } from './smartart-drawing';

/** Options for {@link buildSmartArt3DSpecForElement}. */
export interface SmartArt3DElementOptions {
	/**
	 * Opt into the non-PowerPoint "spatial" arrangements (cycle carousel,
	 * receding hierarchy). Off by default: the default 3D view matches what
	 * PowerPoint draws for the diagram's quick style.
	 */
	spatial?: boolean;
}

/** The 3D model for a SmartArt element, or `null` when it has nothing to draw. */
export function buildSmartArt3DSpecForElement(
	element: PptxElement,
	options: SmartArt3DElementOptions = {},
): SmartArt3DModel | null {
	if (element.type !== 'smartArt') {
		return null;
	}
	const data = element.smartArtData;
	if (!data || data.nodes.length === 0) {
		return null;
	}
	const layout = resolveSmartArt3DLayout(
		data,
		data.nodes,
		{ width: element.width, height: element.height },
		resolvePalette(data),
		data.style ?? 'flat',
		element.id,
	);
	const model = buildSmartArt3DModel(layout, {
		background: data.chrome?.backgroundColor,
		spatial: options.spatial ?? false,
		coherent3DOffNodeIds: collectCoherent3DOffNodeIds(data.nodes),
	});
	return model.meshes.length > 0 ? model : null;
}
