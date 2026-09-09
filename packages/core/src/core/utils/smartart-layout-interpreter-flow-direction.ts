/**
 * SmartArt DiagramML interpreter - arranger algorithm parameters + linear
 * flow direction.
 *
 * Split out of `smartart-layout-interpreter-model.ts` (the repo's per-file
 * line budget): small, generic `dgm:param` readers and the `linDir`/
 * `presLayoutVars.direction` flow-direction resolver, re-exported from that
 * module so every existing import site keeps working unchanged. Pure
 * TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars } from '../types';

/** The first nested item `layoutNode` under an arranger (the per-point shape). */
export function itemNode(arranger: PptxSmartArtLayoutNode): PptxSmartArtLayoutNode | undefined {
	return arranger.children?.[0];
}

/** Read an algorithm parameter value by its `dgm:param` type. */
export function algorithmParam(node: PptxSmartArtLayoutNode, type: string): string | undefined {
	return node.algorithm?.parameters?.find((param) => param.type === type)?.value;
}

/** Read a numeric algorithm parameter, returning `fallback` when absent/invalid. */
export function numericParam(node: PptxSmartArtLayoutNode, type: string, fallback: number): number {
	const raw = algorithmParam(node, type);
	if (raw === undefined) {
		return fallback;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/** Orientation + ordering resolved from `linDir` and presentation variables. */
export interface FlowDirection {
	orientation: 'horizontal' | 'vertical';
	reverse: boolean;
}

/**
 * Resolve linear flow direction from the arranger's `linDir` param and the
 * data model's `dgm:dir` (`presLayoutVars.direction`). `fromR`/`fromB` and a
 * reversed direction both flip the placement order.
 */
export function resolveFlowDirection(
	arranger: PptxSmartArtLayoutNode,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): FlowDirection {
	const linDir = algorithmParam(arranger, 'linDir');
	const vertical = linDir === 'fromT' || linDir === 'fromB';
	let reverse = linDir === 'fromR' || linDir === 'fromB';
	if (presLayoutVars?.direction === 'rev') {
		reverse = !reverse;
	}
	return { orientation: vertical ? 'vertical' : 'horizontal', reverse };
}
