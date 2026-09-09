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
import { heightWeight } from './smartart-layout-interpreter-item-role-shared';
import {
	boundingBoxOf,
	splitEntryFields,
} from './smartart-layout-interpreter-item-role-stack-fields';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import { resolveRoleFontSize } from './smartart-layout-item-font-size';
import { resolvePresetRenderKind } from './smartart-layout-shape-preset';
import type { RenderedNode, RenderedRectNode } from './smartart-layout-types';

/** Split `content` vertically within `box`, each row weighted by {@link heightWeight}. */
function stackAsRect(
	content: ItemRoleContent[],
	arrangerRole: string,
	original: RenderedNode,
	box: { x: number; y: number; width: number; height: number },
	index: ConstraintIndex,
): RenderedRectNode[] {
	const weights = content.map((entry) => heightWeight(index, arrangerRole, entry.role));
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || content.length;
	let cursor = box.y;
	return content.map((entry, i) => {
		const rowHeight = (weights[i] / totalWeight) * box.height;
		// Each role's OWN `primFontSz`, not the arranger's single shared size -
		// see `resolveRoleFontSize`'s doc comment ("Numbered Card List"'s
		// numbered-badge role declares an INDEPENDENT, much larger ceiling than
		// its body-text sibling). `entry.literalText ?? original.text` is the
		// same text `splitEntryFields` below bakes into this row's own
		// `.text` field, so the size is fit against exactly what renders.
		const fontSize = resolveRoleFontSize(entry.role, index, [
			{ text: entry.literalText ?? original.text, width: box.width, height: rowHeight },
		]);
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
			...splitEntryFields(entry, `${original.key}-role${i}`, original),
		};
		cursor += rowHeight;
		return rect;
	});
}

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
		return stackAsRect(content, arrangerRole, original, boundingBoxOf(original), index);
	}
	// The arranger's merged shape is NOT a rect. Recover a rect split only
	// when EVERY role EXPLICITLY declares a rect-family shape of its own, OR
	// the roles explicitly declare two-or-more DISTINCT shape kinds (see
	// `hasMixedExplicitKinds` above) - either way `stackAsRect` still gives
	// each row its OWN `presetOverride`, so a mixed set keeps its real
	// per-role presets even though the geometry style here is rect-based.
	//
	// EXCEPT `polygon`: a pyramid row's `levelTx`(rect)/`acctTx`
	// (`nonIsoscelesTrapezoid`) pair is ALSO a "mixed explicit kinds" set by
	// the check above, but its cached ground truth (COM-verified against
	// `basic-pyramid--hier5.pptx`) is two TRAPEZOID shapes sharing the band's
	// slot, never a `rect` sidebar - `stackAsRect` here produced a uniform
	// vertical rect stack that matched neither the accented rows' preset NOR
	// even the UNACCENTED rows in the same diagram (which have only one role
	// and never reach this function at all, so seeing them wrong too was the
	// tell that `original`'s own geometry was being discarded). `polygon`
	// already has its own dedicated "unchanged copy per role, tagged for a
	// later arranger-specific geometry pass" branch below (see this
	// function's own doc comment); `everyRoleIsRect`/`hasMixedExplicitKinds`
	// must never preempt it.
	if (original.kind !== 'polygon' && (everyRoleIsRect || hasMixedExplicitKinds)) {
		return stackAsRect(content, arrangerRole, original, boundingBoxOf(original), index);
	}
	// A `circle` original with roles that do NOT explicitly want rect stays
	// exactly as before this round: declined entirely (`undefined`, keeping
	// the caller's single already-correct circle). Only `polygon` (a
	// pyramid row's trapezoid parent+child accent) gets the "unchanged copy
	// per role, tagged for a later geometry pass" treatment - a genuine
	// hub+satellite `circle` has no such geometry pass to hand off to, and
	// duplicating it per role produces IDENTICAL overlapping circles instead
	// (measured: `radial-cycle`/`basic-radial`/`diverging-radial`/
	// `radial-venn`/`converging-radial`/`hexagon-radial` regressed when this
	// branch was reached for `circle` too).
	if (original.kind !== 'polygon') {
		return undefined;
	}
	return content.map((entry, i) => {
		const fields = splitEntryFields(entry, `${original.key}-role${i}`, original);
		// A `self`-axis role (`levelTx` in `basic-pyramid--hier5.pptx`: the
		// point's OWN text, re-presented alongside its child's) is not a
		// SEPARATE shape at all - it IS the original polygon, so its preset
		// must stay whatever the arranger already decided
		// (`original.presetOverride`, e.g. a plain pyramid band's
		// `trapezoid`), never the role's own declared `dgm:shape` (COM-verified
		// against the same fixture: `levelTx` declares a placeholder `rect`
		// with `hideGeometry="1"`, but the cached row renders `trapezoid`,
		// identical to an unaccented row's own single-role band). A `des`
		// (descendant) role, by contrast, genuinely introduces the CHILD's own
		// shape (`acctTx`'s declared `nonIsoscelesTrapezoid` matches the cached
		// accent shape exactly) and keeps its own declared preset regardless of
		// `hideGeometry`.
		const isSelfRole = entry.role.presentationOf?.axis?.includes('self') ?? false;
		const presetOverride = isSelfRole ? original.presetOverride : fields.presetOverride;
		return { ...original, ...fields, presetOverride };
	});
}
