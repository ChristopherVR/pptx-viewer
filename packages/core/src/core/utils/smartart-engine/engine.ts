/**
 * SmartArt DiagramML layout engine entry point: parse the layout definition,
 * expand it per data point into the presentation tree, and lay the tree out
 * in the diagram frame.
 */

import type { PptxSmartArtData } from '../../types';
import { buildDataModel } from './data-points';
import { setLayoutContext } from './engine-context';
import type { EngineLayoutContext } from './engine-context';
import type { EngineNode } from './engine-node';
import { toEngineTree } from './engine-node';
import { parseLayoutDefinitionXml } from './layout-def-parse';
import { layoutTree } from './layout-driver';
import { buildPresentationTree } from './pres-tree';
import { DEFAULT_REGISTRY } from './registry';

export interface EngineRun {
	root: EngineNode;
}

/**
 * Run the engine for `data` in a `width` x `height` point frame, measuring
 * text through `context` where the layout depends on it. Returns
 * `undefined` when the diagram carries no layout-definition source.
 */
export function runSmartArtEngine(
	data: PptxSmartArtData,
	layoutXml: string,
	width: number,
	height: number,
	context?: EngineLayoutContext,
): EngineRun | undefined {
	const def = parseLayoutDefinitionXml(layoutXml);
	if (!def) {
		return undefined;
	}
	const model = buildDataModel(data.nodes, data.connections);
	const tree = buildPresentationTree(def, model.doc, {
		direction: data.presLayoutVars?.direction === 'rev' ? 'rev' : undefined,
	});
	if (!tree) {
		return undefined;
	}
	const root = toEngineTree(tree);
	if (context) {
		setLayoutContext(root, context);
	}
	layoutTree(root, { x: 0, y: 0, w: width, h: height }, DEFAULT_REGISTRY);
	return { root };
}
