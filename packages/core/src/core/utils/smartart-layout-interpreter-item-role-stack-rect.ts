/**
 * SmartArt DiagramML interpreter - per-item role rect stacking.
 *
 * Split out of `smartart-layout-interpreter-item-role-stack.ts` (the
 * file-size budget): `stackRoleContent` there dispatches to `stackAsRect`
 * here whenever a role split can be expressed as a plain vertical rect
 * stack - see that module's own doc comment for the other (non-rect)
 * splits it handles directly.
 */

import {
	isDesRootedFontRole,
	isPrimFontSzRoleSplitItem,
	siblingRolesDeclaringType,
} from './smartart-constraint-sibling-roles';
import { roleOf } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { heightWeight } from './smartart-layout-interpreter-item-role-shared';
import {
	splitEntryFields,
	textFromNodeIds,
} from './smartart-layout-interpreter-item-role-stack-fields';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import { resolveRoleFontSize } from './smartart-layout-item-font-size';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/**
 * The arranger's OWN declared `h`-weight total across EVERY named child role
 * it declares one for - not just roles resolving actual TEXT content this
 * point (`content`). Round 20: summing over `content` alone dropped a
 * non-text sibling's own reserved share ("Vertical Bullet List"'s `spacer`,
 * `h = primFontSz(parentText) * 0.08`, never a text role). COM-verified
 * against `vertical-bullet-list--hier8.pptx`'s "Branch A Root": including
 * `spacer` moves the size from 41pt toward the cached 35pt (not exact).
 */
function totalDeclaredWeight(
	index: ConstraintIndex,
	arrangerRole: string,
	content: ItemRoleContent[],
): number {
	const declaredRoles = siblingRolesDeclaringType(index, arrangerRole, 'h');
	if (declaredRoles.length === 0) {
		return content.reduce((sum, entry) => sum + heightWeight(index, arrangerRole, entry.role), 0);
	}
	return declaredRoles.reduce(
		(sum, role) => sum + heightWeight(index, arrangerRole, { name: role }),
		0,
	);
}

/**
 * The declared role, among `content`, whose `h` every sibling role is
 * `primFontSz`-relative to (`isPrimFontSzRoleSplitItem`'s doc comment) -
 * `arrangeLinear`'s own `original.fontSize`/`descendantFontSize` are
 * ALREADY the correctly-fitted values for this exact construct (round 23:
 * the two-tier fit, fixed to skip the root's spurious `spcAft` term for a
 * descendant that is really a separate box), so `stackAsRect` reuses them
 * directly instead of re-fitting independently per point. `undefined` when
 * `content`'s roles do not match this pattern at all.
 */
function primFontSzDrivingEntryRole(
	content: ItemRoleContent[],
	arrangerRole: string,
	index: ConstraintIndex,
): string | undefined {
	const driving = content.find((entry) =>
		isPrimFontSzRoleSplitItem(index, arrangerRole, roleOf(entry.role)),
	);
	return driving ? roleOf(driving.role) : undefined;
}

/** Split `content` vertically within `box`, each row weighted by {@link heightWeight}. */
export function stackAsRect(
	content: ItemRoleContent[],
	arrangerRole: string,
	original: RenderedNode,
	box: { x: number; y: number; width: number; height: number },
	index: ConstraintIndex,
	nodeTextById: Map<string, string> | undefined,
): RenderedRectNode[] {
	const weights = content.map((entry) => heightWeight(index, arrangerRole, entry.role));
	const totalWeight = totalDeclaredWeight(index, arrangerRole, content) || content.length;
	const drivingRole = primFontSzDrivingEntryRole(content, arrangerRole, index);
	let cursor = box.y;
	return content.map((entry, i) => {
		const rowHeight = (weights[i] / totalWeight) * box.height;
		// Each role's OWN `primFontSz`, not the arranger's single shared size -
		// see `resolveRoleFontSize`'s doc comment ("Numbered Card List"'s badge
		// role has an INDEPENDENT, much larger ceiling than its body sibling).
		// The SAME text `splitEntryFields` bakes into `.text` (round 20:
		// `textFromNodeIds`, not `original.text` - see `descendantTextById`).
		const rowText =
			entry.literalText ?? textFromNodeIds(entry.nodeIds, nodeTextById) ?? original.text;
		const fontSize =
			drivingRole === undefined
				? resolveRoleFontSize(entry.role, index, [
						{ text: rowText, width: box.width, height: rowHeight },
					])
				: roleOf(entry.role) === drivingRole ||
					  // Round 25: a `des`-rooted driving role (`isDesRootedFontRole`'s own
					  // doc comment) makes every OTHER matched role a genuinely SEPARATE,
					  // independently content-sized box, not a flat-sibling weight-split
					  // of the driving role's box - it shares the driving role's FULL,
					  // undiminished font size, not the 0.78x `descendantFontSize`
					  // "Vertical Bullet List"'s `ch`-rooted split needs.
					  isDesRootedFontRole(index, arrangerRole, drivingRole)
					? original.fontSize
					: (original.descendantFontSize ?? original.fontSize);
		const rect: RenderedRectNode = {
			kind: 'rect',
			fontColor: original.fontColor,
			fontWeight: original.fontWeight,
			fontStyle: original.fontStyle,
			x: box.x,
			y: cursor,
			width: box.width,
			height: rowHeight,
			rx: original.kind === 'rect' ? original.rx : 0,
			fill: original.fill,
			stroke: original.stroke,
			strokeWidth: original.strokeWidth,
			opacity: original.opacity,
			fontSize,
			textX: box.x + box.width / 2,
			textY: cursor + rowHeight / 2,
			rotation: original.rotation,
			...splitEntryFields(entry, `${original.key}-role${i}`, original, nodeTextById),
		};
		cursor += rowHeight;
		return rect;
	});
}
