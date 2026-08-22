/**
 * Overlay each node's own quick-style role colour onto the DiagramML
 * interpreter's output.
 *
 * `nodeFill` (`smartart-layout-style-helpers.ts`) cycles every rendered node
 * through ONE flat palette by rendered-order index, regardless of the node's
 * own role: an org-chart's assistant nodes (`presStyleLbl="asst1"`, etc.) get
 * the same generic cycled colour as an ordinary report instead of the "asst"
 * role's own colour list from `ppt/diagrams/colors*.xml`. This post-pass
 * corrects that, joining each rendered node back to its source
 * `PptxSmartArtNode` by {@link RenderedNode.nodeId} (every arranger sets it)
 * and swapping in the resolved role's own cycled fill colour - without
 * disturbing an EXPLICIT per-node `node.style.fillColor` override (still
 * applied earlier, inside `nodeFill`) or a node with no recognised role.
 *
 * @module smartart-node-role-colors
 */

import type { PptxSmartArtNode } from '../types';
import type { RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** Per-styleLbl-role resolved colour lists (from a diagram colour transform). */
export type SmartArtColorRoleMap = Record<string, { fill: string[]; line: string[] }>;

/**
 * Overlay each node's own quick-style role fill colour onto the interpreter
 * output. Returns `result` unchanged when `colorRoles` is empty/absent.
 */
export function applySmartArtRoleColors(
	result: SmartArtLayoutResult,
	flat: PptxSmartArtNode[],
	colorRoles: SmartArtColorRoleMap | undefined,
): SmartArtLayoutResult {
	if (!colorRoles || Object.keys(colorRoles).length === 0) {
		return result;
	}
	const nodeById = new Map(flat.map((node) => [node.id, node]));
	const roleOccurrence = new Map<string, number>();
	const nodes = result.nodes.map((node): RenderedNode => {
		const source = node.nodeId ? nodeById.get(node.nodeId) : undefined;
		const role = source?.styleRole;
		if (!role || source?.style?.fillColor) {
			return node;
		}
		const roleFillColors = colorRoles[role]?.fill;
		if (!roleFillColors || roleFillColors.length === 0) {
			return node;
		}
		const index = roleOccurrence.get(role) ?? 0;
		roleOccurrence.set(role, index + 1);
		return { ...node, fill: roleFillColors[index % roleFillColors.length]! };
	});
	return { ...result, nodes };
}
