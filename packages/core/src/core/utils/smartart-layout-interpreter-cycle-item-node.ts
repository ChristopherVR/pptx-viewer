/**
 * SmartArt DiagramML interpreter - cycle ring ITEM node resolution.
 *
 * Split out of `smartart-layout-interpreter-cycle-constraints.ts` (repo
 * per-file line budget): the ring's real per-point item template, when it is
 * NOT simply the arranger's first child. Pure constraint/tree reading; no
 * framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { itemNode } from './smartart-layout-interpreter-model';

/**
 * The ring's real per-point item template, when it is NOT simply
 * `constraintNode.children[0]` (`itemNode`'s own naive assumption).
 *
 * A hub+satellite composite ring (`radial-cycle`, `basic-radial`,
 * `diverging-radial`, `converging-radial`) declares its own `constrLst`
 * directly on the composite's TOP node (`centerShape`/`node`/`dummy`/
 * `sibTrans`/`oneComp`/... all as SIBLING children, not nested inside a
 * `"cycle"`-named descendant `resolveCycleConstraintNode` would find), so
 * `itemNode()` picks up whichever child happens to be FIRST in document
 * order - `centerShape` (the hub) for every sample checked, never the actual
 * repeating ring item (`node`). `sibSp` ("minimum distance between SIBLING
 * shapes") only has meaning between the REPEATING ring item, so whichever
 * name its own `referenceForName` points to - when that name matches one of
 * `constraintNode`'s actual children - is a genuine declarative signal for
 * "this is the ring's real per-point template", not a per-layout-name guess.
 * `basic-cycle`/`multidirectional-cycle` decline this path (their own
 * `sibSp` references `composite`/`w`, not one of their own children's
 * literal names) and keep `itemNode()`'s original children[0] behaviour,
 * which was already COM-verified exact for them.
 *
 * The name match alone is not sufficient, though: `radial-list--hier5.pptx`
 * ("Radial List") declares its `sibSp` as a fraction of the HUB's own width
 * (`sibSp refType="w" refFor="ch" refForName="centerShape" fact="0.08"`, the
 * per-satellite GAP sized off the hub, not the ring item) - the name match
 * picks `centerShape` itself, a SINGULAR node reached only through a
 * `dgm:choose` gate (never repeats per point), feeding the ring math the
 * hub's own near-square aspect instead of the true, much wider
 * ellipse+gap+rect ring-item aspect and corrupting every non-full-circle arc.
 * A genuine repeating ring item is reached through an ENCLOSING `dgm:forEach`
 * (`forEachOrigin` set - see that field's own doc comment on
 * `PptxSmartArtLayoutNode`; `centerShape` has none, `node` does, reached via
 * `forEach axis="ch"` then `forEach axis="self" ptType="node"`), so the name
 * match is only trusted when it also carries one; otherwise this falls back
 * to the first child that genuinely repeats, before `itemNode()`'s original
 * children[0] guess.
 *
 * A connector (`alg.type==='conn'`) can ALSO carry `forEachOrigin` (it
 * repeats once per transition point too) and sit BEFORE the real text item
 * in document order (`radial-cluster`'s own `singleCycle`: its `Name56`
 * connector precedes `text0`) - skip a repeating connector when a repeating
 * NON-connector sibling exists, falling back to the old first-match
 * behaviour only when every repeating child is a connector (unchanged for
 * every fixture already measured, where the first repeating child was never
 * a connector).
 */
export function resolveRingItemNode(
	constraintNode: PptxSmartArtLayoutNode,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
): PptxSmartArtLayoutNode | undefined {
	const sibSpName = (arrangerConstraints ?? []).find(
		(c) => c.type === 'sibSp' && typeof c.referenceForName === 'string',
	)?.referenceForName;
	const named = sibSpName
		? (constraintNode.children ?? []).find((child) => child.name === sibSpName)
		: undefined;
	if (named?.forEachOrigin) {
		return named;
	}
	const children = constraintNode.children ?? [];
	const repeating =
		children.find((child) => child.forEachOrigin && child.algorithm?.type !== 'conn') ??
		children.find((child) => child.forEachOrigin);
	return repeating ?? named ?? itemNode(constraintNode);
}
