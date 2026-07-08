/**
 * smart-art-preset-data.ts: builds the in-memory SmartArt data model for an
 * insert-gallery preset. Single source of truth shared by every binding's
 * insert handler and its dialog preview, so the gallery preview always shows
 * exactly the diagram that insertion produces.
 */

import type { PptxSmartArtData, PptxSmartArtNode, SmartArtLayout } from 'pptx-viewer-core';

/** Produces the node id for the preset item at `index`. */
export type SmartArtPresetNodeIdFactory = (index: number) => string;

const defaultIdFactory: SmartArtPresetNodeIdFactory = (index) => `preset-node-${index}`;

/**
 * Build the node tree a preset inserts: one node per default item, with
 * hierarchy layouts parenting every later node under the first (root) node.
 */
export function buildSmartArtPresetNodes(
	layout: SmartArtLayout,
	defaultItems: string[],
	idFor: SmartArtPresetNodeIdFactory = defaultIdFactory,
): PptxSmartArtNode[] {
	const ids = defaultItems.map((_, i) => idFor(i));
	return defaultItems.map((text, i) => {
		const node: PptxSmartArtNode = { id: ids[i]!, text };
		if (layout === 'hierarchy' && i > 0) {
			node.parentId = ids[0];
		}
		return node;
	});
}

/**
 * Build the complete `PptxSmartArtData` for a preset, using the same default
 * colour scheme and style intensity the insert handlers apply.
 */
export function buildSmartArtPresetData(
	layout: SmartArtLayout,
	defaultItems: string[],
	idFor?: SmartArtPresetNodeIdFactory,
): PptxSmartArtData {
	return {
		layout,
		colorScheme: 'colorful1',
		style: 'flat',
		nodes: buildSmartArtPresetNodes(layout, defaultItems, idFor),
	};
}
