/**
 * SmartArt DiagramML interpreter - `cycle` ring `sibTrans` connector
 * clearance (SESSION 21).
 *
 * `radial-cycle--{hier5,hier8}.pptx`'s own ~9% scale residual is NOT a
 * hub-ratio bug (the hub:item ratio, and the ring's own `r0`, both already
 * match cached geometry within 0.5% - see `smartart-track-r-successor.md`'s
 * own SESSION 20 section for the full measurement). The remaining gap is
 * that `radial-cycle` uniquely (among the gallery's hub+ring family)
 * declares a `sibTrans` `dgm:layoutNode` - a CURVED connector between
 * adjacent satellite CENTRES (`dgm:alg type="conn"`, `connRout="curve"`,
 * `begPts="ctr"`, `endPts="ctr"`) - that neither `basic-radial` (no
 * connector layoutNode at all) nor `diverging-radial`/`converging-radial`
 * (a `parTrans`, hub-to-satellite, not satellite-to-satellite) declare.
 * `basic-cycle`'s own hub-less ring ALSO declares a `sibTrans`, but its own
 * `connRout` is a plain straight line there (not `curve`), so it needs no
 * extra clearance - the `curve` routing specifically is what bulges past
 * the chord between two adjacent satellite centres, needing extra room in
 * the ring's own natural bounding box beyond what the satellites' own
 * edges already reserve.
 *
 * The bulge amount is declared directly: `h for="ch" forName="sibTrans"
 * refType="w" refFor="ch" refForName="<item>" fact="0.24"` (radial-cycle's
 * own value) - the connector's own natural "height" (perpendicular bulge),
 * as a fraction of the ring item's own natural width (unit 1 in
 * `smartart-layout-interpreter-cycle-ring.ts`'s own natural space).
 *
 * Pure constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

/** Depth-first search (bounded: `cycle`-family composites nest only a few levels) for a `dgm:layoutNode` whose own algorithm is a `curve`-routed, centre-to-centre connector (`sibTrans`'s own real structural signature, not its layout name). */
function findCurveSiblingConnector(
	node: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNode | undefined {
	if (!node) {
		return undefined;
	}
	if (
		node.algorithm?.type === 'conn' &&
		node.algorithm.parameters?.some((p) => p.type === 'connRout' && p.value === 'curve') &&
		node.algorithm.parameters?.some((p) => p.type === 'begPts' && p.value === 'ctr') &&
		node.algorithm.parameters?.some((p) => p.type === 'endPts' && p.value === 'ctr')
	) {
		return node;
	}
	for (const child of node.children ?? []) {
		const found = findCurveSiblingConnector(child);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/**
 * The `sibTrans` curve connector's own natural bulge, as a fraction of the
 * ring item's own natural width - `undefined` when this composite declares
 * no curve-routed, centre-to-centre sibling connector at all (every
 * hub+ring family checked except `radial-cycle`, and `basic-cycle`'s own
 * straight-routed `sibTrans`). See the module doc comment for the full
 * derivation.
 */
export function resolveSibTransBulgeRatio(
	constraintNode: PptxSmartArtLayoutNode,
	arrangerConstraints: PptxSmartArtLayoutNode['constraints'],
	itemName: string | undefined,
): number | undefined {
	if (!itemName) {
		return undefined;
	}
	const connector = findCurveSiblingConnector(constraintNode);
	if (!connector?.name) {
		return undefined;
	}
	const match = (arrangerConstraints ?? []).find(
		(c) =>
			c.type === 'h' &&
			c.for === 'ch' &&
			c.forName === connector.name &&
			c.referenceType === 'w' &&
			c.referenceFor === 'ch' &&
			c.referenceForName === itemName &&
			typeof c.factor === 'number' &&
			c.factor > 0,
	);
	return match?.factor;
}
