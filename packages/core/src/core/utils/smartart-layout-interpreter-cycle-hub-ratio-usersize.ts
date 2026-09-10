/**
 * SmartArt DiagramML interpreter - `userS`-declared hub/ring-item ratio.
 *
 * Split out of `smartart-layout-interpreter-cycle-hub-ratio.ts` (the repo's
 * per-file line budget): {@link resolveHubToNodeRatioViaUserSize} is the
 * `resolveHubToNodeRatio` fallback for a ring item that declares its own
 * size INDIRECTLY through `userS` ("user specified size") rather than a
 * direct `w for="ch" forName="<item>" refFor="ch" refForName="<hub>"`
 * cross-reference. Pure constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveByAncestorChain } from './smartart-constraint-declared-by';
import type { ConstraintIndex } from './smartart-constraint-solver';

function finiteFactor(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * `node.w = fact * <hubName>.w`, declared INDIRECTLY through `userS` ("user
 * specified size") - `radial-cluster`'s own `singleCycle`/`text0`: `text0`'s
 * own `w` constraint is a BARE `refType="userS"` self-reference (no hub
 * mentioned at all in THIS constraint), and the actual hub-relative factor
 * lives on a SEPARATE constraint declared on the ARRANGER itself (`userS
 * for="ch" ptType="node" refType="w" refFor="ch" refForName="singleCenter"
 * fact="0.67"` - targeted by `ptType`, the DiagramML convention for "every
 * child node point", not by `forName`, since `userS` is declared once for
 * the whole repeated item template rather than by its specific layoutNode
 * name). COM-verified the `0.67` fact is IDENTICAL across every live
 * `dgm:choose` branch this construct's own `cnt`-gated `constrLst` declares
 * (`cnt=1`/`cnt>=2` both declare the SAME `userS ... fact="0.67"` - only the
 * HUB's own size differs per branch, never this ratio), so reading it
 * without evaluating the choose's own `cnt` condition (`buildConstraintIndex`
 * does not model `dgm:choose` scoping at all - see its own doc comment) is
 * not a guess: whichever live branch's copy this finds, the fact is the
 * same.
 *
 * `index`/`declaringRoleChain` (nearest ancestor first): when the LOCAL
 * `arrangerConstraints` carries no `userS` declaration at all, the actual
 * one may live at a DISTANT ancestor's own `constrLst` instead - a genuinely
 * nested arranger (`radial-cluster--hier5.pptx`'s `cycle_3`, itself a child
 * of the composite root `Name0`, two levels above the ring item `text3`)
 * whose own `userS` reference is declared once, diagram-wide, at `Name0`
 * (`userS for="des" ptType="node" refType="w" refFor="ch"
 * refForName="textCenter" fact="0.67"`), never repeated locally on
 * `cycle_3`. `resolveByAncestorChain` (`smartart-constraint-declared-by.ts`)
 * searches the WHOLE `ConstraintIndex` for a `userS` declaration, but ONLY
 * accepts one whose `declaringRole` is in this chain - `radial-cluster`
 * itself also declares an UNRELATED `userS` at its own `singleCycle`
 * alternative branch (its `n=1` structure, never an ancestor of `cycle_3`),
 * which a plain "first `userS` found" scan would wrongly prefer or collide
 * with; the chain is what tells the two apart.
 */
export function resolveHubToNodeRatioViaUserSize(
	ringItem: PptxSmartArtLayoutNode,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
	index?: ConstraintIndex,
	declaringRoleChain?: readonly string[],
): { hubName: string; factor: number } | undefined {
	const itemConstraints = ringItem.allConstraints ?? ringItem.constraints ?? [];
	const bareUserSizeRef = itemConstraints.some(
		(c) =>
			c.type === 'w' &&
			c.referenceType === 'userS' &&
			c.referenceFor === undefined &&
			c.referenceForName === undefined &&
			c.referencePointType === undefined,
	);
	if (!bareUserSizeRef) {
		return undefined;
	}
	const userSizeDecl = (arrangerConstraints ?? []).find(
		(c) => c.type === 'userS' && typeof c.referenceForName === 'string' && finiteFactor(c.factor),
	);
	if (userSizeDecl) {
		return {
			hubName: userSizeDecl.referenceForName as string,
			factor: userSizeDecl.factor as number,
		};
	}
	if (index && declaringRoleChain && declaringRoleChain.length > 0) {
		const ancestorDecl = resolveByAncestorChain(
			index,
			'userS',
			declaringRoleChain,
			(c) => typeof c.referenceForName === 'string' && finiteFactor(c.factor),
		);
		if (ancestorDecl) {
			return {
				hubName: ancestorDecl.constraint.referenceForName as string,
				factor: ancestorDecl.constraint.factor as number,
			};
		}
	}
	return undefined;
}
