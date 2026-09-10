/**
 * SmartArt DiagramML interpreter - per-item role geometry stacking.
 *
 * Split out of `smartart-layout-interpreter-item-role-shared.ts` (the
 * file-size budget): once role CONTENT is resolved (`contentIds`/
 * `resolveRoleContent`), this module turns it into actual `RenderedNode`
 * geometry, shared by the flat item-roles expander
 * (`smartart-layout-interpreter-item-roles.ts`) and the recursive
 * item-template expander (`-item-roles-recursive.ts`) so both split
 * identically.
 */

import type { ConstraintIndex } from './smartart-constraint-solver';
import {
	boundingBoxOf,
	splitEntryFields,
} from './smartart-layout-interpreter-item-role-stack-fields';
import { stackAsRect } from './smartart-layout-interpreter-item-role-stack-rect';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import { resolvePresetRenderKind } from './smartart-layout-shape-preset';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/**
 * Stack already-resolved role `content` within `original`'s box. Returns
 * `undefined` when there is nothing to do: EXACTLY one role whose own kind
 * already matches `original.kind` (the common "single text box" case, no
 * correction needed). Shared by the flat item-roles expander and the
 * recursive item-template expander so both split identically.
 *
 * When EVERY role's own declared preset resolves to a plain rect-family
 * shape ({@link resolvePresetRenderKind}), the role(s) are laid out as
 * rect(s) within `original`'s bounding box - stacked vertically in content
 * order (weighted by `heightWeight`) when there are 2+, or the FULL box
 * re-kinded to `rect` for a lone one - regardless of what `kind` the
 * arranger's own MERGED per-item shape happened to resolve to. This is what
 * makes "Meet the Team" work (and every gallery layout sharing its shape:
 * `Small Dots Horizontal/Vertical`, `Bullet Timeline`, `Circle Accent
 * Timeline`, ...): a leaf point (no child, exactly one resolved role) is
 * JUST as affected as a point with a child (2+ roles) - `compNode` collapses
 * to `kind: 'circle'` for EVERY point because `findCompositeItemShape`
 * prefers the decorative `photoCircle`'s `ellipse` (no separate box of its
 * own - a genuinely decorative accent, never a text role) over `nameText`/
 * `roleText`'s OWN declared `rect` shapes, but the cached drawing renders
 * `nameText`/`roleText` as real rect text boxes regardless, leaf or not. A
 * rendered item node's `kind` is only ITS OWN merged-shape choice, never
 * binding on what its per-item TEXT roles declare - each role becomes its
 * own shape with its own declared preset.
 *
 * Otherwise (a pyramid row's `trapezoid`/`nonIsoscelesTrapezoid` parent+
 * child accent, `arrangePyramid`) there is no generic way to split
 * `original`'s OWN geometry the way a rect splits by height - see the
 * round-3 Track S/R handoff notes. So each role's entry starts as an
 * UNCHANGED copy of `original`'s geometry (kind included), tagged with
 * `itemRoleName` (the role's own `dgm:layoutNode` name) so an
 * arranger-specific geometry pass can reposition/resize each entry by that
 * name afterwards; this function itself only guarantees the right per-role
 * TEXT and COUNT exist as separate points.
 */
export function stackRoleContent(
	content: ItemRoleContent[],
	arrangerRole: string,
	original: RenderedNode,
	index: ConstraintIndex,
	nodeTextById?: Map<string, string>,
): RenderedNode[] | undefined {
	// A LONE resolved role (a leaf point with no child, when the template
	// declares 2+ roles but this specific point's own content only fills
	// one) is deliberately left untouched even when its kind disagrees with
	// `original`'s: measured against `radial-cycle`/`basic-radial`/
	// `diverging-radial`/`radial-venn`/`converging-radial`/`hexagon-radial`
	// (hub+satellite `cycle` families), re-kinding a lone entry there
	// regressed their shape COUNT, not just geometry - the single-role path
	// is not as safe a generalisation as the 2+-role split below turned out
	// to be. Left as a follow-up: see the round-3 Track S/R handoff notes.
	if (content.length <= 1) {
		return undefined;
	}
	const asRect = (): RenderedRectNode[] =>
		stackAsRect(content, arrangerRole, original, boundingBoxOf(original), index, nodeTextById);
	// EXPLICIT declaration only: a role with NO `dgm:shape` of its own
	// (`rolePreset`'s "default to rect" fallback) must NOT count as "wants
	// rect" here - a hub+satellite `cycle` family's own roles commonly
	// declare no shape at all, correctly inheriting the arranger's real
	// `circle` merged shape; treating that fallback as "rect" mis-converted
	// them (measured: `radial-cycle`/`basic-radial`/`diverging-radial`/
	// `radial-venn`/`converging-radial`/`hexagon-radial`'s shape COUNT
	// regressed). Only a role that ACTUALLY writes `<dgm:shape type="rect">`
	// (Meet the Team's `nameText`/`roleText`, Bullet Timeline's equivalents)
	// overrides the arranger's own merged-shape choice.
	const everyRoleIsRect = content.every(
		(entry) =>
			entry.role.shape?.presetGeometry !== undefined &&
			resolvePresetRenderKind(entry.role.shape, 'circle') === 'rect',
	);
	// A genuinely MIXED-preset item template (Radial List's `parentNode`
	// ellipse self box beside its `childNode` rect - two roles EACH
	// explicitly declaring a DIFFERENT shape kind, cached as two separate
	// shapes: an `ellipse` and a `rect`) must still split even when the
	// arranger's own merged shape is `circle`. Deliberately narrower than
	// "every role has an explicit shape": a hub+satellite `cycle` family
	// (`radial-cycle`/`basic-radial`/`diverging-radial`/`radial-venn`/
	// `converging-radial`/`hexagon-radial`) has roles that EITHER declare no
	// shape at all OR all agree on the SAME explicit kind (its hub's
	// `centerShape` and a satellite's own `node` role both `ellipse`), so
	// requiring at least TWO DISTINCT resolved kinds - not merely "explicit" -
	// keeps that family declining exactly as before (measured: allowing any
	// explicit-shape role through here, not just a mixed set, regressed that
	// family's shape COUNT the same way `everyRoleIsRect`'s doc comment
	// already warns about).
	const explicitKinds = content.map((entry) =>
		entry.role.shape?.presetGeometry !== undefined
			? resolvePresetRenderKind(entry.role.shape, 'circle')
			: undefined,
	);
	const hasMixedExplicitKinds =
		explicitKinds.every((kind) => kind !== undefined) && new Set(explicitKinds).size > 1;
	// The arranger's own merged shape is ALREADY a rect (the common case: a
	// list/card item template with no separate decorative wrapper shape, or
	// one whose merged preset genuinely IS a rect-family shape) - keep the
	// pre-existing behaviour verbatim, splitting by height regardless of any
	// individual role's OWN preset (a numbered badge's `ellipse` role, say,
	// still gets its own `presetOverride` via `splitEntryFields`; only the
	// x/y/w/h geometry style stays rect-based, which is fine - the bridge
	// reads the preset STRING from `presetOverride`, not from `kind`).
	if (original.kind === 'rect') {
		return asRect();
	}
	// The arranger's merged shape is NOT a rect. Recover a rect split when
	// EVERY role EXPLICITLY declares a rect-family shape of its own (see
	// `everyRoleIsRect` above, e.g. "Meet the Team"'s `nameText`/`roleText`
	// pair, merged shape `circle`) - `stackAsRect` still gives each row its
	// OWN `presetOverride`.
	if (everyRoleIsRect) {
		return asRect();
	}
	// `polygon` (a pyramid row's `levelTx`(rect)/`acctTx`
	// (`nonIsoscelesTrapezoid`) pair, COM-verified against `basic-pyramid
	// --hier5.pptx`: cached ground truth is two SIDE-BY-SIDE trapezoids
	// sharing the band's slot, never a vertical rect stack) ALWAYS reaches
	// the "unchanged copy per role, tagged for a later arranger-specific
	// geometry pass" branch below (`repositionPyramidBands`) - unconditional
	// on `hasMixedExplicitKinds`, because `basic-pyramid`'s own two roles
	// (`levelTx`/`acctTx`) BOTH resolve to the SAME `polygon` kind (neither
	// declares an explicit rect-family shape), so `hasMixedExplicitKinds`
	// itself is FALSE for this fixture despite genuinely needing the split -
	// `polygon` never had a `stackAsRect` fallback to begin with (its own
	// geometry cannot split by height at all), so this is unaffected by
	// `hasMixedExplicitKinds` either way.
	if (original.kind === 'polygon') {
		return splitAsUnchangedCopy(content, original, nodeTextById);
	}
	// `circle` (`radial-list`'s own `parentNode`(ellipse)/`childNode`(rect)
	// ring-item pair, COM-verified against `radial-list--hier5.pptx`: cached
	// ground truth is a side-by-side ellipse+rect, never a vertical rect
	// stack) needs a MIXED explicit-kind set specifically (unlike `polygon`):
	// a genuine hub+satellite `circle` (no mixed kinds -
	// `radial-cycle`/`basic-radial`/`diverging-radial`/`radial-venn`/
	// `converging-radial`/`hexagon-radial`) has no arranger-specific geometry
	// pass to hand off to, and duplicating it per role produces IDENTICAL
	// overlapping circles instead (measured regression when this branch was
	// reached for a bare `circle` too) - only a genuinely mixed set (`circle`
	// -> the cycle ring's own composite-child repositioning,
	// `smartart-layout-interpreter-cycle-ring-item.ts`) gets the "unchanged
	// copy" treatment.
	if (original.kind === 'circle') {
		return hasMixedExplicitKinds
			? splitAsUnchangedCopy(content, original, nodeTextById)
			: undefined;
	}
	// Any OTHER merged kind with a mixed explicit-kind set keeps the
	// pre-existing `stackAsRect` behaviour (still gives each role its own
	// `presetOverride`, just without a dedicated geometry pass to hand off
	// to) - no fixture in the built-in gallery is known to reach this, but it
	// preserves the behaviour this function already had before this round.
	if (hasMixedExplicitKinds) {
		return asRect();
	}
	// Any other merged kind, no mixed roles at all: nothing to do.
	return undefined;
}

/**
 * The "unchanged copy per role, tagged with `itemRoleName`" split
 * (`polygon`/`circle`, see `stackRoleContent`'s own call sites): each role's
 * entry starts as an UNCHANGED copy of `original`'s own geometry, letting an
 * arranger-specific geometry pass (`repositionPyramidBands`,
 * `repositionCycleRingContent`) reposition/resize it afterward.
 */
function splitAsUnchangedCopy(
	content: ItemRoleContent[],
	original: RenderedNode,
	nodeTextById: Map<string, string> | undefined,
): RenderedNode[] {
	return content.map((entry, i) => {
		const fields = splitEntryFields(entry, `${original.key}-role${i}`, original, nodeTextById);
		// `polygon` ONLY: a `self`-axis role (`levelTx` in `basic-pyramid
		// --hier5.pptx`: the point's OWN text, re-presented alongside its
		// child's) is not a SEPARATE shape at all - it IS the original
		// polygon, so its preset must stay whatever the arranger already
		// decided (`original.presetOverride`, e.g. a plain pyramid band's
		// `trapezoid`), never the role's own declared `dgm:shape` (COM-verified
		// against the same fixture: `levelTx` declares a placeholder `rect`
		// with `hideGeometry="1"`, but the cached row renders `trapezoid`,
		// identical to an unaccented row's own single-role band). A `des`
		// (descendant) role, by contrast, genuinely introduces the CHILD's own
		// shape (`acctTx`'s declared `nonIsoscelesTrapezoid` matches the cached
		// accent shape exactly) and keeps its own declared preset regardless of
		// `hideGeometry`.
		//
		// `circle` (`radial-list`'s own `parentNode`/`childNode` pair): NEITHER
		// role is a `hideGeometry` placeholder - `parentNode` genuinely
		// declares its own `ellipse` shape - so BOTH roles always keep their
		// own declared preset (`fields.presetOverride`); `original`'s own
		// merged `presetOverride` is not a reliable stand-in for the self
		// role's shape the way it is for a pyramid band (measured: the merged
		// `circle` item's own `presetOverride` can be `undefined` even when
		// the self role itself declares a real shape).
		const isSelfRole =
			original.kind === 'polygon' && (entry.role.presentationOf?.axis?.includes('self') ?? false);
		const presetOverride = isSelfRole ? original.presetOverride : fields.presetOverride;
		return { ...original, ...fields, presetOverride };
	});
}
