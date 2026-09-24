/**
 * Algorithm registry: maps a `dgm:alg/@type` to the function that places a
 * node's children.
 */

import { arrangeComposite } from './alg-composite';
import { arrangeConnector } from './alg-connector';
import { arrangeCycle } from './alg-cycle';
import { arrangeLinear } from './alg-linear';
import { applyPyraAccentSplit, arrangePyra } from './alg-pyra';
import { arrangeSnake } from './alg-snake';
import type { ArrangeAlgorithm, LayoutRegistry } from './layout-driver';
import { fillChildren } from './layout-driver';

const ALGORITHMS: Record<string, ArrangeAlgorithm> = {
	composite: arrangeComposite,
	lin: arrangeLinear,
	conn: arrangeConnector,
	snake: arrangeSnake,
	cycle: arrangeCycle,
	pyra: arrangePyra,
	tx: fillChildren,
	sp: fillChildren,
};

/** Post-layout corrections that need a child subtree's FINAL box (see `LayoutRegistry.resolvePost`). */
const POST_ALGORITHMS: Record<string, ArrangeAlgorithm> = {
	pyra: applyPyraAccentSplit,
};

export const DEFAULT_REGISTRY: LayoutRegistry = {
	resolve(type: string): ArrangeAlgorithm {
		return ALGORITHMS[type] ?? arrangeComposite;
	},
	resolvePost(type: string): ArrangeAlgorithm | undefined {
		return POST_ALGORITHMS[type];
	},
};
