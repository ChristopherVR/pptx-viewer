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
 * `pyraLvlNode` actually narrowing a band by a genuine sub-1 ratio is dropped
 * (sanitized away) rather than applied above, since no fixture in the
 * 229-fixture gallery corpus declares one.
 *
 * ## `pyraAcctRatio` accent-column split (`applyPyraAccentSplit`)
 *
 * Real "Basic Pyramid"/"Inverted Pyramid" also declare `pyraAcctRatio`
 * (`dgm:constr type="pyraAcctRatio"`, `for="self"` on the `pyra` node
 * itself, `dgm:choose`-gated on `func="maxDepth" op="gte" val="2"` - true
 * whenever ANY point in the whole diagram has a child), ported here from the
 * legacy interpreter's COM-verified `repositionPyramidBands` (see
 * `smartart-layout-interpreter-pyramid.ts`'s own module doc comment for the
 * full derivation this mirrors). Once active, EVERY row's own `pyraLvlNode`
 * ("level") shrinks to `(1 - pyraAcctRatio)` of its natural width, anchored
 * at the diagram box's own LEFT edge, even a row with no accent (the ratio is
 * diagram-wide, not per-row, so an unaccented row is left with a visible gap
 * on its right rather than staying full width - COM-verified). A row whose
 * own data point has a child (so the layout definition actually created
 * `pyraAcctBkgdNode`/`pyraAcctTxNode` - "acctBkgd"/"acctTx" by default -
 * instances for it) then has that accent column fill the remainder of the
 * row's natural slot, out to the diagram box's own right edge (see the
 * "accent column's own LEFT edge" section below for exactly where that
 * remainder starts).
 *
 * This has to run as a POST-pass, after `pyraLvlNode`'s own subtree
 * (including a text overlay like "levelTx", positioned by the composite
 * fill idiom relative to "level"'s box) has already been laid out by the
 * generic composite algorithm: only then does "level" have a final box to
 * shrink. `applyPyraAccentSplit` therefore scales every box in
 * `pyraLvlNode`'s own subtree by the SAME (anchor, scale) affine transform,
 * not just `pyraLvlNode`'s own box: since a fill-idiom child's box is
 * already some fraction of "level"'s box under a uniform x-scale, applying
 * the identical transform to it preserves that fraction and its centring
 * exactly, without needing to know each child's own derivation.
 *
 * ### The accent column's own LEFT edge is not `pyraLvlNode`'s shrunk right edge
 *
 * Each row is itself a trapezoid (`arrangePyramid`'s legacy geometry has a
 * narrower top edge and a wider bottom edge within the SAME row, `fTop =
 * effectiveI/n` vs `fBot = (effectiveI+1)/n`); `arrangePyra`'s own item box
 * already collapses that to its tight bounding box using the WIDE (`fBot`)
 * edge only (see the module doc comment above), so `pyraLvlNode`'s shrunk
 * right edge is the scaled WIDE corner, not the narrow one. COM-verified
 * (`basic-pyramid--hier5.pptx`/`--hier8.pptx`): the accent column's own left
 * edge is the scaled NARROW (`fTop`) corner, which sits to the LEFT of the
 * shrunk level's own right edge, not flush against it - recomputed
 * independently here (mirroring the legacy interpreter's own
 * `pyramidRowGeometry`) since the row's narrow-edge fraction isn't
 * recoverable from the item's already-collapsed wide-edge box alone.
 */

import type { Box, EngineNode } from './engine-node';
import { flattenEngineTree } from './engine-node';

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

/** Scale `x` by `scale`, anchored at `anchorX` (`anchorX` itself is a fixed point). */
function scaleFromAnchor(x: number, anchorX: number, scale: number): number {
	return anchorX + scale * (x - anchorX);
}

/**
 * `pyraAcctRatio` band-splitting post-pass (see the module doc comment for
 * the full derivation). Run by the layout driver AFTER `node`'s children
 * (the per-point composite items) and their whole subtrees have already been
 * laid out, so `pyraLvlNode`'s own subtree has a final box to shrink.
 */
export function applyPyraAccentSplit(node: EngineNode): void {
	const box = node.box;
	const ratio = node.values.get('pyraAcctRatio') ?? 0;
	if (!box || ratio <= 0) {
		return;
	}
	const scale = 1 - ratio;
	const bkgdName = node.alg.params.pyraAcctBkgdNode ?? 'acctBkgd';
	const txName = node.alg.params.pyraAcctTxNode ?? 'acctTx';
	const inverted = node.alg.params.linDir === 'fromT';
	const items = contentChildren(node);
	const n = items.length;
	const bandCx = box.x + box.w / 2;
	items.forEach((item, i) => {
		const itemBox = item.box;
		if (!itemBox) {
			return;
		}
		// "acctBkgd"/"acctTx" (only present on a row whose own data point has a
		// child) are the ONLY item descendants that must NOT shrink with the
		// self-role content: everything else - "level" (the visible band) and
		// a sibling text overlay like "levelTx", positioned by Name8's OWN
		// composite constraints relative to "level", not nested inside it -
		// is self-role content and shrinks together.
		const accentRoots = [
			findNamedDescendant(item, bkgdName),
			findNamedDescendant(item, txName),
		].filter((candidate): candidate is EngineNode => Boolean(candidate));
		const accentSubtree = new Set<EngineNode>();
		for (const root of accentRoots) {
			for (const descendant of flattenEngineTree(root)) {
				accentSubtree.add(descendant);
			}
		}
		// Scale every self-role descendant's box by the same transform: a
		// uniform x-scale anchored at a fixed point preserves each one's own
		// natural centring and width fraction of the item's (unshrunk) box
		// exactly, whether it fills that box outright ("level") or occupies a
		// fraction of it ("levelTx", `fact="0.65"` on later rows).
		for (const descendant of flattenEngineTree(item)) {
			if (descendant === item || accentSubtree.has(descendant) || !descendant.box) {
				continue;
			}
			descendant.box = {
				x: scaleFromAnchor(descendant.box.x, box.x, scale),
				y: descendant.box.y,
				w: descendant.box.w * scale,
				h: descendant.box.h,
			};
		}
		// The accent column's own left edge is this row's scaled NARROW
		// (`fTop`) corner, not `pyraLvlNode`'s own shrunk right edge (the
		// scaled WIDE, `fBot`, corner `newSelfRight` below) - see the module
		// doc comment. Recomputed from `i`/`n`/`inverted` the same way
		// `arrangePyra` derived the row's wide edge, since the narrow edge
		// isn't recoverable from the item's already-collapsed box alone.
		const effectiveI = inverted ? n - 1 - i : i;
		const halfNarrow = (box.w * effectiveI) / n / 2;
		const accentLeft = scaleFromAnchor(bandCx + halfNarrow, box.x, scale);
		const accentRight = box.x + box.w;
		for (const root of accentRoots) {
			const filled: Box = {
				x: accentLeft,
				y: itemBox.y,
				w: Math.max(0, accentRight - accentLeft),
				h: itemBox.h,
			};
			root.box = filled;
		}
	});
}
