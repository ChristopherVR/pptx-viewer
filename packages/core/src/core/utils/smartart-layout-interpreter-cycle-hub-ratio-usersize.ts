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
import { resolveConstraint } from './smartart-constraint-solver';
import { isUserSizeHubRole } from './smartart-layout-interpreter-composite-aspect';
import type { BoundingBox } from './smartart-layout-types';

function finiteFactor(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * `resolveHubToNodeRatio`'s resolved ring-item:hub ratio, tagged with WHERE
 * it was found - `viaUserSize` (round 46) marks a ratio resolved through
 * {@link resolveHubToNodeRatioViaUserSize} (a `userS` diagram-wide fact, e.g.
 * `radial-cluster--hier5.pptx`'s `textCenter`-anchored `fact="0.67"`) rather
 * than a DIRECT local cross-role reference (`radial-list`'s own `centerShape`
 * reference). The two carry different structural meaning for a caller
 * deciding whether this composite already names its own hub: a direct
 * reference genuinely means "this ring already has a structurally-named hub,
 * do not also peel `nodes[0]`"; a `userS`-ancestor-chain resolution carries no
 * such meaning at all (it is just "some diagram-wide ratio happens to
 * exist") - see `arrangeCycle`'s own `hasHub` gate.
 */
export interface HubToNodeRatio {
	hubName: string;
	factor: number;
	viaUserSize?: boolean;
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
): HubToNodeRatio | undefined {
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
			viaUserSize: true,
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
				viaUserSize: true,
			};
		}
	}
	return undefined;
}

/**
 * The absolute pixel width (and, by construction, height - {@link
 * HubToNodeRatio} only ever tags a SQUARE `userS` item, see
 * `resolveUserSizeItemBoxPx`'s own `isSquareHeightConstraint` gate) a
 * `viaUserSize`-tagged hub ratio's ring item resolves to - the SAME
 * computation `resolveUserSizeItemBoxPx` (`smartart-layout-interpreter-
 * composite-children.ts`) already performs for a flat repeater slot, reused
 * here for a genuinely NESTED ring's degenerate single-satellite case
 * (`arrangeCycle`'s own `n===1` branch), which has no independent box-fit to
 * derive a node width from at all. `undefined` when the hub's own `w` does
 * not resolve (defensive; not expected once `ratio.viaUserSize` is true).
 */
export function resolveViaUserSizeNodeWidthPx(
	ratio: HubToNodeRatio,
	index: ConstraintIndex,
	box: BoundingBox,
	sizeBox: BoundingBox,
): number | undefined {
	const hubW = resolveConstraint(index, ratio.hubName, 'w');
	if (hubW === undefined) {
		return undefined;
	}
	const hubExtent = isUserSizeHubRole(ratio.hubName, index) ? sizeBox.width : box.width;
	const side = ratio.factor * hubW * hubExtent;
	return side > 0 ? side : undefined;
}
