/**
 * SmartArt DiagramML interpreter - `primFontSz` bounds resolution.
 *
 * Split out of `smartart-layout-item-font-size.ts` (the file-size budget):
 * this half resolves WHICH layoutNode a font-fit call should key its
 * `primFontSz` ceiling/floor off, and what those bounds are in pixels; that
 * module's `resolveSharedItemFontSize`/`resolveRoleFontSize` consume
 * {@link nodeFontBounds}, `smartart-layout-interpreter-linear.ts` consumes
 * {@link primFontSzCeilingPx} directly.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveConstraint, roleOf } from './smartart-constraint-solver';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { itemNode } from './smartart-layout-interpreter-model';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

/** Points per CSS pixel at PowerPoint's 96 DPI convention. */
const POINTS_TO_PIXELS = 96 / 72;

/** Legacy per-node heuristic bounds (pixels), kept as the fallback when a layoutDef declares no `primFontSz`. */
const DEFAULT_CEILING_PX = 12;
const DEFAULT_FLOOR_PX = 6;

/**
 * The item template's OWN self-scoped `h`/`w` aspect ratio (`<dgm:constr
 * type="h" refType="w" fact="0.6"/>`, no `for` attribute at all - a
 * self-reference, not an arranger-declared per-item constraint), when one is
 * declared. `undefined` when the item declares no such self-scoped aspect.
 *
 * This is DELIBERATELY a different question from `arrangeLinear`'s own
 * `itemAspect` (`smartart-layout-interpreter-linear.ts`), which intentionally
 * ignores this exact same self-scoped constraint for DISPLAY geometry: measured
 * against `basic-process--flat3.pptx`, a genuinely UNCONSTRAINED (no
 * arranger-declared aspect) item's cached box spans the container's FULL
 * cross-axis extent, so applying its OWN self-scoped `h refType="w" fact="0.6"`
 * there would shrink the DISPLAYED box wrongly (regressing the ~2-4% geometry
 * deviation to 70-90%, per `resolveConstraintDeclaredBy`'s doc comment). Font
 * FIT, however, is a SEPARATE question PowerPoint solves against a smaller
 * effective text box even when the displayed box fills the container: using
 * this self-scoped aspect as a font-fit-only height cap (instead of the full
 * cross-axis extent) moves the computed size from roughly 2x the cached
 * `a:rPr/@sz` to within a few points of it on that same fixture.
 *
 * A layoutDef can declare this SAME self-scoped relationship in either
 * direction: `h refType="w"` (height as a factor of width, `factor` IS the
 * h/w aspect directly) or the inverse, `w refType="h"` (width as a factor of
 * height, so the h/w aspect is `1/factor`) - "Vertical Process"'s real
 * `layout1.xml` declares `<dgm:constr type="w" refType="h" fact="1.8"/>`
 * (self-scoped, no `for`), which the h-only search above always missed,
 * leaving `naturalAspect` `undefined` and the font fitter solving against
 * the item's full, un-capped column height instead - measured: this item's
 * font landed at ~34pt against a cached 24pt (`smartart-gallery-ground-
 * truth.test.ts`), NOT the `dgm:choose`-branch-selection bug round 4
 * originally suspected (this layoutDef declares no `primFontSz` `dgm:choose`
 * at all; there is exactly one ceiling, `val="65"`, for the `node` role).
 * Recognising the inverted form too (`1.8` -> aspect `1/1.8` = `0.5556`)
 * fixes it generally, for any layoutDef using either authoring direction.
 */
export function resolveItemSelfAspect(
	item: PptxSmartArtLayoutNode | undefined,
): number | undefined {
	const constraints = item?.constraints ?? [];
	const hOverW = constraints.find(
		(constraint) =>
			constraint.type === 'h' &&
			constraint.referenceType === 'w' &&
			constraint.for === undefined &&
			typeof constraint.factor === 'number' &&
			constraint.factor > 0,
	);
	if (hOverW) {
		return hOverW.factor;
	}
	const wOverH = constraints.find(
		(constraint) =>
			constraint.type === 'w' &&
			constraint.referenceType === 'h' &&
			constraint.for === undefined &&
			typeof constraint.factor === 'number' &&
			constraint.factor > 0,
	);
	return wOverH?.factor !== undefined ? 1 / wOverH.factor : undefined;
}

/**
 * Every `primFontSz` shrink-floor `dgm:rule` value that applies to `role`:
 * the item template's OWN `dgm:ruleLst` (a self-scoped rule with no `for`),
 * PLUS any rule the ARRANGER declares scoped to this role via `for="ch"
 * forName="<role>"`/`ptType="<role>"` - measured against "Vertical Bullet
 * List": its shrink floor (`val="5"`) is declared on the ARRANGER's
 * (`linear`) OWN `dgm:ruleLst` as `<dgm:rule type="primFontSz" for="ch"
 * forName="parentText" val="5"/>`, not on `parentText`'s own `dgm:ruleLst`
 * (which carries only an unrelated `h` rule) - a self-scoped-only read misses
 * it entirely and falls back to the generic `DEFAULT_FLOOR_PX`, which can sit
 * far below the arranger's real, deliberately shallow floor.
 */
function primFontSzFloorRuleValues(
	item: PptxSmartArtLayoutNode | undefined,
	arranger: PptxSmartArtLayoutNode,
	role: string,
): number[] {
	const isPrimFontSzRule = (
		rule: NonNullable<PptxSmartArtLayoutNode['rules']>[number],
	): rule is NonNullable<PptxSmartArtLayoutNode['rules']>[number] & { value: number } =>
		rule.type === 'primFontSz' && typeof rule.value === 'number';
	const ownRules = (item?.rules ?? []).filter(isPrimFontSzRule).map((rule) => rule.value);
	const arrangerRules = (arranger.rules ?? [])
		.filter(isPrimFontSzRule)
		.filter((rule) => rule.for === 'ch' && (rule.forName === role || rule.pointType === role))
		.map((rule) => rule.value);
	return [...ownRules, ...arrangerRules];
}

/** `dgm:alg` types that never carry a node's own text, whatever `presOf` they happen to declare. */
const DECORATIVE_FONT_ALGORITHM_TYPES = new Set(['sp', 'composite', 'conn']);

/**
 * Depth-first search through an item template's subtree for the layoutNode
 * whose `primFontSz` the shared font-fit should key off, when the top-level
 * item itself declares no text of its own (a bare `composite` wrapper -
 * e.g. "Text Card Short Line"'s item template is a `compNode` composite
 * with no `presOf`, whose CHILDREN `titleText`/`bodyText` are the real text
 * roles, each with its OWN declared `primFontSz`: `<dgm:constr
 * type="primFontSz" for="des" forName="titleText" val="18"/>` /
 * `forName="bodyText" val="14"`).
 *
 * Querying the wrapper's OWN role (as `itemNode(plan.node)` would) finds no
 * `primFontSz` constraint at all and silently falls back to the generic
 * `DEFAULT_CEILING_PX` (12px) - measured against "Text Card Short Line":
 * that produces 12px against a cached 24px (18pt), a systematic 2x-plus
 * miss repeated across every composite-wrapped item template in the
 * gallery. The FIRST text-bearing descendant in document order (matching
 * `smartart-layout-interpreter-item-roles.ts`'s own `isTextRole` axis/
 * algorithm test) is the role whose ceiling PowerPoint's cached box
 * actually rendered at, when the item collapses to a single box (no
 * secondary role content to split into its own box) - the common case for
 * a `flat` dataset with no descendant text.
 *
 * `undefined` when nothing in the subtree carries a text `presOf` at all
 * (a layout this interpreter cannot see any text role for), so the caller
 * keeps its own top-level-item fallback.
 */
function findFontRoleNode(
	item: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNode | undefined {
	if (!item) {
		return undefined;
	}
	const isTextRole = (node: PptxSmartArtLayoutNode): boolean =>
		(node.presentationOf?.axis?.length ?? 0) > 0 &&
		!DECORATIVE_FONT_ALGORITHM_TYPES.has(node.algorithm?.type ?? '');
	if (isTextRole(item)) {
		return item;
	}
	for (const child of item.children ?? []) {
		const found = findFontRoleNode(child);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/** The `primFontSz` ceiling and `dgm:ruleLst` shrink floor for a resolved role, in PIXELS. */
export interface FontBounds {
	ceilingPx: number;
	floorPx: number;
	role: string;
}

/**
 * The `primFontSz` ceiling and `dgm:ruleLst` shrink floor for `fontRoleCandidate`
 * (or the first genuine text-role descendant found under it, see
 * {@link findFontRoleNode}), in PIXELS. `arranger` supplies the fallback role
 * name when nothing resolves, and the ARRANGER-scoped floor-rule extension
 * ({@link primFontSzFloorRuleValues}'s `for="ch"` search) - for a per-role
 * caller (`resolveRoleFontSize` in `smartart-layout-item-font-size.ts`) that
 * has no separate arranger node to offer, passing the role node itself for
 * both parameters is safe: a self-scoped `dgm:rule` carries no `for`
 * attribute, so the arranger-scoped search over the SAME node's own rules
 * simply finds nothing extra.
 */
export function nodeFontBounds(
	fontRoleCandidate: PptxSmartArtLayoutNode | undefined,
	arranger: PptxSmartArtLayoutNode,
	index: ConstraintIndex,
): FontBounds {
	const fontRoleNode = findFontRoleNode(fontRoleCandidate) ?? fontRoleCandidate;
	const role = fontRoleNode ? roleOf(fontRoleNode) : roleOf(arranger);
	const declared = resolveConstraint(index, role, 'primFontSz');
	const ceilingPx =
		typeof declared === 'number' && declared > 0 ? declared * POINTS_TO_PIXELS : DEFAULT_CEILING_PX;
	const floorRuleValues = primFontSzFloorRuleValues(fontRoleNode, arranger, role);
	const floorPx =
		floorRuleValues.length > 0 ? Math.min(...floorRuleValues) * POINTS_TO_PIXELS : DEFAULT_FLOOR_PX;
	return { ceilingPx, floorPx: Math.min(floorPx, ceilingPx), role };
}

/** The item role's declared `primFontSz` ceiling and `dgm:ruleLst` shrink floor, in PIXELS. */
export function itemFontBoundsPx(plan: ArrangementPlan, index: ConstraintIndex): FontBounds {
	return nodeFontBounds(itemNode(plan.node), plan.node, index);
}

/**
 * The item role's declared `primFontSz` ceiling, in PIXELS - exposed for a
 * caller (`smartart-layout-interpreter-linear.ts`) that needs the SAME
 * ceiling `resolveSharedItemFontSize` uses, to convert an ABSOLUTE
 * `refType="primFontSz"` main-axis gap/extent (e.g. "Vertical Bullet List"'s
 * `spacer` role, `<dgm:constr type="h" ... refType="primFontSz" fact="0.08"/>`)
 * into pixels before it participates in that axis's geometry.
 */
export function primFontSzCeilingPx(plan: ArrangementPlan, index: ConstraintIndex): number {
	return itemFontBoundsPx(plan, index).ceilingPx;
}
