/**
 * SmartArt DiagramML interpreter - per-item role stacking orientation.
 *
 * Round 27: `stackRoleContent`/`stackAsRect` (`smartart-layout-interpreter-
 * item-role-stack{,-rect}.ts`) always stack a role-split item's content roles
 * VERTICALLY, weighted by each role's own arranger-declared `h` constraint,
 * scoped against the OUTER arranger's own role name. That is correct for a
 * FLAT-sibling item template ("Vertical Bullet List"'s `parentText`/
 * `childText`, direct children of the arranger itself - cached ground truth
 * genuinely stacks them top-to-bottom), but wrong for an item template whose
 * roles are nested inside their OWN horizontally-oriented `lin` sub-arranger
 * ("Vertical Bracket List"'s `linNode`, `linDir="fromL"`, wrapping `parTx`/
 * `bracket`/`spH`/`desTx` side by side - cached ground truth is two COLUMNS,
 * a narrow label on the left and a wide descendant box on the right, never a
 * vertical stack). Round 25 found the root cause (`itemAspect`'s own
 * same-axis-inherit squash) and the shape of the missing mechanism (a
 * `stackAsColumns` sibling to `stackAsRect`) but did not build it - see that
 * round's own successor-doc section for the measured regression its narrower
 * `itemAspect` attempt caused, and why a dedicated column mechanism, not an
 * `itemAspect` exemption, is the safer fix.
 *
 * This module resolves, for a role-split item template, WHICH layoutNode's
 * own `constrLst` declares each role's `w`/`h` share (the `declaringRole`
 * {@link resolveConstraintDeclaredBy} needs), and whether the roles should
 * stack as ROWS (the pre-existing, unchanged default) or COLUMNS.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtPresLayoutVars, XmlObject } from '../types';
import { roleOf } from './smartart-constraint-solver';
import { chooseAlgorithm } from './smartart-layout-interpreter-choose-algorithm';
import { activeBranch, localName } from './smartart-layout-interpreter-choose-branch';
import { unwrapTextRoles } from './smartart-layout-interpreter-item-roles-unwrap';

/** How a role-split item's content roles are laid out within the item's box. */
export interface ItemRoleLayoutScope {
	/** The layoutNode whose `for="ch"/"des" forName="<role>"` constraints size each role - see {@link resolveConstraintDeclaredBy}. */
	declaringRole: string;
	orientation: 'row' | 'column';
}

const MAX_WRAPPER_DEPTH = 3;

/**
 * The closest (narrowest) wrapper layoutNode, reachable from `node`, whose
 * own {@link unwrapTextRoles} output contains EVERY one of `roles` - the
 * item template's own nested sub-arranger that directly declares each
 * role's `w`/`h` share, when one exists. `undefined` when no single wrapper
 * contains the whole role set (the flat-sibling case: `roles` are direct
 * children of `node` itself, with no narrower common wrapper at all).
 */
function findRoleWrapper(
	node: PptxSmartArtLayoutNode,
	roles: readonly PptxSmartArtLayoutNode[],
	depth: number,
): PptxSmartArtLayoutNode | undefined {
	if (depth > MAX_WRAPPER_DEPTH) {
		return undefined;
	}
	for (const child of node.children ?? []) {
		if (roles.includes(child)) {
			continue;
		}
		const unwrapped = unwrapTextRoles(child);
		if (unwrapped.length > 0 && roles.every((role) => unwrapped.includes(role))) {
			return findRoleWrapper(child, roles, depth + 1) ?? child;
		}
	}
	return undefined;
}

/**
 * `node`'s own resolved algorithm: the DIRECT `dgm:alg` child when present,
 * else (round 27) the winning branch of a `dgm:choose`-wrapped one
 * (`chooseAlgorithm`) - "Vertical Bracket List"'s own `linNode` wraps its
 * `lin`/`linDir="fromL"|"fromR"` choice in a `dir="norm"`/`else` choose
 * (mirroring LTR/RTL), the common real-world shape every OTHER `dgm:alg`
 * reader in this interpreter already has to see through (see
 * `smartart-layout-interpreter-choose-algorithm.ts`'s own module doc
 * comment). `undefined` when neither resolves (a genuinely plain wrapper, or
 * an undecidable choose with no `presLayoutVars` supplied).
 */
function resolvedAlgorithm(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
) {
	return node.algorithm ?? chooseAlgorithm(node, nodeCount, { presLayoutVars });
}

/**
 * True only for an EXPLICIT horizontal `lin` (`dgm:param type="linDir"
 * val="fromL"|"fromR"`) - never the ECMA default-when-absent (which would
 * also read as "horizontal" per `resolveFlowDirection`'s own convention).
 * Deliberately narrower: the overwhelming majority of `lin`-wrapped item
 * templates in the gallery corpus declare no `linDir` of their own at all
 * and genuinely want the pre-existing vertical row stack - only a wrapper
 * that SAYS so explicitly should switch to columns (round 25's own
 * "narrower trigger" lead, applied here instead of `itemAspect`). Exported
 * for `smartart-layout-interpreter-linear.ts`'s own `itemAspect` (round 25's
 * REVERTED same-axis-inherit exemption regressed ~25 unrelated fixtures with
 * no orientation check at all - this narrower, ALREADY-corpus-safe signal is
 * the "narrower trigger" that section's own doc comment asked for).
 */
export function isExplicitHorizontalLin(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): boolean {
	const alg = resolvedAlgorithm(node, nodeCount, presLayoutVars);
	if (alg?.type !== 'lin') {
		return false;
	}
	const linDir = alg.parameters?.find((param) => param.type === 'linDir')?.value;
	return linDir === 'fromL' || linDir === 'fromR';
}

/**
 * A raw `dgm:shape` element's own `@_type`/`@_rot` attributes, found by
 * scanning `branch` (one winning `dgm:choose` branch's raw XML - see
 * {@link resolvedShapeIsPlainRect}) for a direct `shape` child. `undefined`
 * when `branch` declares no shape of its own at all.
 */
function rawShapeAttributes(
	branch: XmlObject | undefined,
): { type?: string; rot?: string } | undefined {
	if (!branch) {
		return undefined;
	}
	for (const [key, value] of Object.entries(branch)) {
		if (key.startsWith('@_') || localName(key) !== 'shape') {
			continue;
		}
		const shapeXml = (Array.isArray(value) ? value[0] : value) as XmlObject | undefined;
		if (!shapeXml || typeof shapeXml !== 'object') {
			continue;
		}
		return {
			type: shapeXml['@_type'] as string | undefined,
			rot: shapeXml['@_rot'] as string | undefined,
		};
	}
	return undefined;
}

/**
 * True when `role`'s own resolved shape is a genuinely PLAIN, axis-aligned
 * box: no shape declared at all (defaults to `rect`), or an EXPLICIT LITERAL
 * `rect` preset with no rotation - never merely a same-render-KIND preset
 * like `roundRect`/`round2SameRect` ({@link resolvePresetRenderKind} groups
 * those together for the pre-existing row-split's own `everyRoleIsRect`
 * check, but a column split additionally needs a genuinely plain box).
 * Resolves a `dgm:choose`-wrapped `dgm:shape` too (the SAME parsing gap
 * `resolvedAlgorithm` sees through for `dgm:alg` - `role.shape` is `undefined`
 * at parse time whenever the shape lives entirely inside a `dgm:choose`,
 * e.g. mirroring `dir="rtl"`), via {@link rawShapeAttributes}.
 *
 * Distinguishes "Vertical Bracket List" (columns: `desTx` declares literal
 * `rect`, `parTx` declares none) from "Vertical Block List" (NOT columns,
 * despite an identically-shaped explicit-horizontal `linNode` wrapper:
 * `descendantText` declares a CHOOSE-WRAPPED, ROTATED (`rot="90"`)
 * `round2SameRect` - a decorative bracket-style connector whose cached
 * geometry spans OUTSIDE a single point's own row entirely, `y`/`height`
 * reaching into neighbouring points - not a real column at all). Measured:
 * without this guard (and without seeing through the choose), the column
 * mechanism ALSO reroutes "Vertical Block List" through `stackAsColumns`,
 * moving its FONT/GEOM terms further from cached (round 27's own
 * full-corpus sweep) - the SAME false-positive risk `isExplicitHorizontalLin`
 * already had to guard against for the wrapper's own algorithm.
 */
function resolvedShapeIsPlainRect(
	role: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): boolean {
	if (role.shape) {
		return role.shape.presetGeometry === undefined || role.shape.presetGeometry === 'rect';
	}
	if (!role.choose || role.choose.length === 0) {
		return true;
	}
	for (const choose of role.choose) {
		const attrs = rawShapeAttributes(activeBranch(choose, nodeCount, { presLayoutVars }));
		if (attrs) {
			const rotated = attrs.rot !== undefined && attrs.rot !== '0';
			return !rotated && (attrs.type === undefined || attrs.type === 'rect');
		}
	}
	return true;
}

/**
 * True when `node` is a genuine COLUMN-ORIENTED item wrapper: an EXPLICIT
 * horizontal `lin` ({@link isExplicitHorizontalLin}) whose own text roles
 * ({@link unwrapTextRoles}) are 2+ and EVERY one resolves a genuinely plain,
 * axis-aligned box ({@link resolvedShapeIsPlainRect}). The SINGLE shared
 * check both `resolveItemRoleLayoutScope` (below, the role-split geometry
 * itself) and `smartart-layout-interpreter-linear.ts`'s `itemAspect` (the
 * item's own OVERALL box shape) need to agree on - round 27 first built
 * these as two SEPARATE checks (`itemAspect` consulting only
 * `isExplicitHorizontalLin`, without the shape guard) and measured a real
 * regression from the split: "Vertical Block List" shares "Vertical Bracket
 * List"'s exact explicit-horizontal-`linNode` wrapper shape, so
 * `itemAspect`'s own (unguarded) exemption widened ITS box too, even after
 * the role-split guard correctly kept its ROLE geometry as a row - a
 * genuinely wrong box shape from a check `resolveItemRoleLayoutScope` had
 * already correctly declined. Consolidated into one function so both
 * call sites can never disagree again.
 */
export function isColumnWrapper(
	node: PptxSmartArtLayoutNode,
	nodeCount: number,
	presLayoutVars: PptxSmartArtPresLayoutVars | undefined,
): boolean {
	if (!isExplicitHorizontalLin(node, nodeCount, presLayoutVars)) {
		return false;
	}
	const roles = unwrapTextRoles(node);
	return (
		roles.length >= 2 &&
		roles.every((role) => resolvedShapeIsPlainRect(role, nodeCount, presLayoutVars))
	);
}

/**
 * Resolve `roles`' own layout scope within `arranger`'s item template.
 * Default (no qualifying wrapper, or the wrapper is not a genuine {@link
 * isColumnWrapper}): `arrangerRole` itself declares the constraints and
 * stacking stays a ROW split - IDENTICAL to every pre-existing `stackAsRect`
 * caller's behaviour before this module existed. `nodeCount`/`presLayoutVars`
 * resolve a `dgm:choose`-wrapped wrapper's own algorithm/shape - omitted, an
 * undecidable choose simply stays a ROW split, never a false-positive column
 * one.
 */
export function resolveItemRoleLayoutScope(
	arranger: PptxSmartArtLayoutNode,
	arrangerRole: string,
	roles: readonly PptxSmartArtLayoutNode[],
	nodeCount = 0,
	presLayoutVars?: PptxSmartArtPresLayoutVars,
): ItemRoleLayoutScope {
	if (roles.length < 2) {
		return { declaringRole: arrangerRole, orientation: 'row' };
	}
	const wrapper = findRoleWrapper(arranger, roles, 0);
	if (wrapper && isColumnWrapper(wrapper, nodeCount, presLayoutVars)) {
		return { declaringRole: roleOf(wrapper), orientation: 'column' };
	}
	return { declaringRole: arrangerRole, orientation: 'row' };
}
