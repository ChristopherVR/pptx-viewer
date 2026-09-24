/**
 * `pyra` algorithm (ECMA-376 Part 1, 21.4.2.x): stacks the data points as
 * equal-height horizontal bands along the node's box, each band's width
 * proportional to its position in the stack (`i/n` at the narrow edge,
 * `(i+1)/n` at the wide edge), forming a triangle. `linDir="fromT"` (real
 * "Inverted Pyramid") points the apex DOWN instead of the default
 * `"fromB"` apex-up; `sibSp` (rare - neither real "Basic Pyramid" nor
 * "Inverted Pyramid" declares one) adds absolute spacing between bands, the
 * same convention `alg-linear.ts` uses for its own flow spacing.
 *
 * Mirrors the legacy family interpreter's band derivation
 * (`smartart-layout-interpreter-pyramid.ts`'s `arrangePyramid`, itself
 * COM-verified against real PowerPoint output), but only the band-stacking
 * geometry: each item's own `<dgm:layoutNode name="Name8" alg="composite">`
 * subtree still sizes and positions its "level"/"levelTx" (and, when a data
 * point has a child, "acctBkgd"/"acctTx") shapes itself through the engine's
 * ordinary constraint pipeline (including the `ctrX`/`w` "fill and centre"
 * idiom `constraint-fill-idiom.ts` now reads correctly), the same way every
 * other per-point algorithm here delegates to its children's own subtrees.
 *
 * Each band is given its TIGHT bounding box (the wide edge's half-width,
 * spanning the full band height): `scoreAgainstCached`
 * (`measure-smartart-engine-vs-legacy.ts`) and the acceptance gate compare a
 * shape's bounding box, not its exact polygon outline, and the composite
 * child's own `dgm:shape type="trapezoid"` (carried through verbatim as
 * `presetOverride`) supplies the actual tapered geometry from that box at
 * render time - so the bounding box below must already be the trapezoid's
 * own tightest box, not the full (untapered) slot.
 *
 * ## `pyraLvlNode`'s own self-scoped `w`/`h` must be sanitized before layout
 *
 * `dgm:param[@type="pyraLvlNode"]` (default `"level"`) names the per-item
 * layoutNode representing each band's own shape. Real "Basic Pyramid"
 * declares `<dgm:constr type="h" val="500"/>` / `<dgm:constr type="w"
 * val="1"/>` directly on "level"'s OWN `constrLst` (`for="self"`, no
 * `refType`) - COM-verified as a no-op: neither is a valid ratio (`500` is
 * not less than 1), so "level" should keep whatever size the composite fill
 * idiom already gave it (see the module doc comment there). But
 * `preferred-size.ts`'s `preferredSize` (called from `alg-composite.ts`'s
 * `compositeChildBoxes` to size EVERY composite child, "level" included)
 * deliberately RE-APPLIES a child's own self-scoped `w`/`h` constraints
 * on top of whatever its ancestor already assigned it, by design, so a
 * child's genuine self-declared aspect ratio (`h refType="w" fact="0.6"`)
 * survives - that reapplication has no way to tell "level"'s `val="500"`
 * apart from a genuine, tiny, deliberate anchor-point marker (the SAME
 * bare-literal-`w`/`h`-only shape `dummyConnPt`/`wedge*` layoutNodes declare
 * on themselves in `radial-cycle`/`segmented-cycle`/`vertical-chevron-list`,
 * where it MUST stay a real ~2.83pt point: their own position comes from a
 * SIBLING `for="ch"` declaration elsewhere, exactly the shape "level"'s own
 * declaration has, so no generic rule distinguishes them). Since only THIS
 * algorithm's own `pyraLvlNode` convention has the context to know "level"'s
 * declaration is a no-op-or-ratio, not a marker, this sanitizes it here,
 * scoped to exactly the named node `pyra` itself points at, before the rest
 * of the tree lays out: any bare-literal (`refType="none"`) self-scoped `w`/
 * `h` constraint on it is dropped outright, letting the composite fill idiom
 * decide "level"'s size undisturbed.
 *
 * NOT ported: `pyraAcctPos`/`pyraAcctRatio` accent-column splitting (an
 * accented row's "level" shrinking to make room for a sibling "acctTx", real
 * "Basic Pyramid"/"Inverted Pyramid"'s `hier5`/`hier8` datasets) and
 * `pyraLvlNode` actually narrowing a band by a genuine sub-1 ratio (dropped
 * above rather than applied - no fixture in the 229-fixture gallery corpus
 * declares one). Both are genuinely per-item-role, POST-composite geometry
 * passes in the legacy interpreter (`repositionPyramidBands`), not attempted
 * here; a `hier5`/`hier8` measurement regressing relative to legacy on this
 * account is expected and tracked, not a silent correctness gap.
 */

import type { EngineNode } from './engine-node';

/** `node`'s own content children: the per-data-point `Name8` composite instances. */
function contentChildren(node: EngineNode): EngineNode[] {
	return node.children.filter(
		(child) => child.point.type === 'node' || child.point.type === 'asst',
	);
}

/** Depth-first search of `node`'s own subtree for a descendant layoutNode named `name`. */
function findNamedDescendant(node: EngineNode, name: string): EngineNode | undefined {
	for (const child of node.children) {
		if (child.name === name) {
			return child;
		}
		const found = findNamedDescendant(child, name);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/**
 * Drops `lvlNode`'s own bare-literal (`refType="none"`), self-scoped `w`/`h`
 * constraints - see the module doc comment for why only THIS specifically
 * named node's declaration is safe to sanitize this way.
 */
function sanitizeLvlNode(lvlNode: EngineNode): void {
	lvlNode.constraints = lvlNode.constraints.filter(
		(constraint) =>
			!(
				constraint.for === 'self' &&
				!constraint.forName &&
				(constraint.type === 'w' || constraint.type === 'h') &&
				constraint.refType === 'none'
			),
	);
}

export function arrangePyra(node: EngineNode): void {
	const box = node.box;
	const children = contentChildren(node);
	const n = children.length;
	if (!box || n === 0) {
		return;
	}
	const lvlNodeName = node.alg.params.pyraLvlNode ?? 'level';
	for (const item of children) {
		const lvlNode = findNamedDescendant(item, lvlNodeName);
		if (lvlNode) {
			sanitizeLvlNode(lvlNode);
		}
	}
	const inverted = node.alg.params.linDir === 'fromT';
	const gap = Math.max(0, node.values.get('sibSp') ?? node.values.get('sp') ?? 0);
	const bandH = Math.max(0, (box.h - gap * (n - 1)) / n);
	const bandCx = box.x + box.w / 2;
	children.forEach((child, i) => {
		const top = box.y + i * (bandH + gap);
		const effectiveI = inverted ? n - 1 - i : i;
		// The wide edge of this band, at (effectiveI + 1) / n of the full base.
		const halfWide = (box.w * (effectiveI + 1)) / n / 2;
		child.box = { x: bandCx - halfWide, y: top, w: halfWide * 2, h: bandH };
	});
}
