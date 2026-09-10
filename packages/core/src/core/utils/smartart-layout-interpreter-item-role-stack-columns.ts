/**
 * SmartArt DiagramML interpreter - per-item role COLUMN stacking.
 *
 * Round 27: sibling to `smartart-layout-interpreter-item-role-stack-rect.ts`'s
 * `stackAsRect` - splits `content` roles SIDE BY SIDE (weighted by each
 * role's own `w` share, `widthWeight`) instead of top-to-bottom, for an item
 * template whose roles are nested inside their own explicitly horizontal
 * `lin` sub-arranger (`smartart-layout-interpreter-item-role-orientation.ts`'s
 * `resolveItemRoleLayoutScope`, `orientation: 'column'`) - "Vertical Bracket
 * List"'s `parTx`/`desTx` pair, cached as a narrow left label column beside a
 * wide right descendant column, never a vertical stack.
 */

import { siblingRolesDeclaringType } from './smartart-constraint-sibling-roles';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { widthWeight } from './smartart-layout-interpreter-item-role-shared';
import {
	splitEntryFields,
	textFromNodeIds,
} from './smartart-layout-interpreter-item-role-stack-fields';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import { resolveRoleFontSize } from './smartart-layout-item-font-size';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/**
 * `declaringRole`'s own `w`-weighted children, in the SAME left-to-right
 * document order its `constrLst` declares them in ({@link
 * siblingRolesDeclaringType}, whose own `ConstraintIndex` iteration order
 * mirrors document order) - NEVER `content`'s own order, which comes from
 * `resolveItemTextRoles`'s role-collection walk and does not necessarily
 * match it: measured against "Vertical Bracket List", `linNode.children`
 * parses as `[desTx, parTx, bracket, spH]` (the descendant-axis role
 * first), the OPPOSITE of its real `constrLst` declaration order (`parTx`
 * 0.25 declared first, `desTx` 0.68 last) that the cached drawing's own
 * left-to-right column order (narrow `parTx` label on the LEFT, wide
 * `desTx` box on the RIGHT) actually follows. Includes DECORATIVE roles
 * (`bracket`/`spH`, never resolving text content) too - a caller that walks
 * the WHOLE sequence, not just `content`, reserves their real width as a
 * gap between the columns that DO carry text (see `stackAsColumns`'s own
 * cursor loop) instead of collapsing the columns together. Falls back to
 * `content`'s own order (declaring nothing at all - should not happen for
 * this construct) when `declaringRole` has no `w`-weighted children.
 */
function declaredColumnSequence(
	index: ConstraintIndex,
	declaringRole: string,
	content: ItemRoleContent[],
): readonly string[] {
	const declared = siblingRolesDeclaringType(index, declaringRole, 'w');
	return declared.length > 0 ? declared : content.map((entry) => entry.role.name ?? '');
}

/** Split `content` HORIZONTALLY within `box`, each column (plus any decorative gap between two content columns) weighted by {@link widthWeight}, left to right in `declaringRole`'s own declared order. */
export function stackAsColumns(
	content: ItemRoleContent[],
	declaringRole: string,
	original: RenderedNode,
	box: { x: number; y: number; width: number; height: number },
	index: ConstraintIndex,
	nodeTextById: Map<string, string> | undefined,
): RenderedRectNode[] {
	const contentByRoleName = new Map(content.map((entry) => [entry.role.name ?? '', entry]));
	const sequence = declaredColumnSequence(index, declaringRole, content);
	const weights = sequence.map((name) =>
		widthWeight(index, declaringRole, contentByRoleName.get(name)?.role ?? { name }),
	);
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || sequence.length;
	let cursor = box.x;
	const out: RenderedRectNode[] = [];
	sequence.forEach((name, i) => {
		const columnWidth = (weights[i] / totalWeight) * box.width;
		const entry = contentByRoleName.get(name);
		if (entry) {
			const columnText =
				entry.literalText ?? textFromNodeIds(entry.nodeIds, nodeTextById) ?? original.text;
			const fontSize = resolveRoleFontSize(entry.role, index, [
				{ text: columnText, width: columnWidth, height: box.height },
			]);
			out.push({
				kind: 'rect',
				fontColor: original.fontColor,
				fontWeight: original.fontWeight,
				fontStyle: original.fontStyle,
				x: cursor,
				y: box.y,
				width: columnWidth,
				height: box.height,
				rx: original.kind === 'rect' ? original.rx : 0,
				fill: original.fill,
				stroke: original.stroke,
				strokeWidth: original.strokeWidth,
				opacity: original.opacity,
				fontSize,
				textX: cursor + columnWidth / 2,
				textY: box.y + box.height / 2,
				rotation: original.rotation,
				...splitEntryFields(entry, `${original.key}-role${out.length}`, original, nodeTextById),
			});
		}
		cursor += columnWidth;
	});
	return out;
}
