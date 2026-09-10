/**
 * SmartArt DiagramML interpreter - per-item role split-entry fields.
 *
 * Split out of `smartart-layout-interpreter-item-role-stack.ts` (the
 * file-size budget): this half computes the fields shared by every split row
 * `stackAsRect` produces (node id, preset, text) and the bounding box a
 * non-rect `original` seeds a rect split from. Pure TypeScript - no
 * framework code.
 */

import { rolePreset } from './smartart-layout-interpreter-item-role-shared';
import type { ItemRoleContent } from './smartart-layout-interpreter-item-role-transition';
import type { RenderedNode } from './smartart-layout-types';

/**
 * A role's own RENDERED preset: its declared shape, UNLESS it is a
 * `self`-axis role with no VISIBLE shape of its own (no `dgm:shape` element
 * at all, or one marked `hideGeom`) - such a role is not a separate shape, it
 * IS the arranger's own item box (`detailed-process--hier5.pptx`'s
 * `parentNode`: `alg type="tx"`, no `dgm:shape` at all), so it must inherit
 * the arranger's own MERGED preset (`original.presetOverride`, e.g.
 * `bgRect`'s `roundRect`) instead of {@link rolePreset}'s bare "no shape ->
 * rect" fallback, which otherwise wins over the composite-level decorative
 * preset a non-split point at the SAME arranger correctly gets (measured:
 * `detailed-process`/`grouped-list`/`accent-process--hier5.pptx`'s "Node
 * One"/"Node Four" - the two points with a child, hence split - rendered
 * `rect` where every unsplit point, and the cached drawing, has `roundRect`).
 * Mirrors the identical, already-proven rule `stackRoleContent`'s `polygon`
 * branch applies for the same reason (see its own doc comment on
 * `isSelfRole`).
 */
export function roleRenderPreset(entry: ItemRoleContent, original: RenderedNode): string {
	const isSelfRole = entry.role.presentationOf?.axis?.includes('self') ?? false;
	const hasVisibleShape =
		entry.role.shape?.presetGeometry !== undefined && !entry.role.shape.hideGeometry;
	if (isSelfRole && !hasVisibleShape && original.presetOverride) {
		return original.presetOverride;
	}
	return rolePreset(entry.role);
}

/**
 * `entry.nodeIds`' own text, joined `\n`-separated when there is more than
 * one (matching the fold convention `smartart-interpreter-drawing-
 * bridge.ts`'s `collectFoldedDescendants` already uses elsewhere) -
 * `undefined` when `nodeTextById` is not supplied (a caller that has not
 * been updated yet) or none of `nodeIds` resolves (a `self`-axis role: its
 * OWN id is the point itself, never a descendant, so it is never IN
 * `nodeTextById` - `original.text` is already correct for it).
 */
export function textFromNodeIds(
	nodeIds: string[],
	nodeTextById: Map<string, string> | undefined,
): string | undefined {
	if (!nodeTextById) {
		return undefined;
	}
	const texts = nodeIds
		.map((id) => nodeTextById.get(id))
		.filter((text): text is string => text !== undefined);
	return texts.length > 0 ? texts.join('\n') : undefined;
}

/**
 * Fields every split entry shares, regardless of `original.kind`: the role's
 * own node id(s), preset, and text - see `stackRoleContent`'s doc comment
 * for `itemRoleName`.
 *
 * @param nodeTextById - Round 20: `id -> text` for the point's own
 *   descendants ({@link descendantTextById}), so a `ch`/`des`-axis role
 *   (`childText`, "the point's own child's text") renders ITS real content
 *   instead of silently duplicating `original.text` (the point's OWN text) -
 *   see {@link descendantTextById}'s doc comment for the concrete bug this
 *   closes. Omit to keep the pre-existing (duplicating) fallback, for a
 *   caller not yet updated to supply it.
 */
export function splitEntryFields(
	entry: ItemRoleContent,
	key: string,
	original: RenderedNode,
	nodeTextById?: Map<string, string>,
) {
	return {
		key,
		nodeId: entry.nodeIds[0],
		// Always set (possibly empty), even for a single-id role: this
		// role's content is fully resolved, so the bridge must not ALSO
		// run its own descendant-folding inference for it.
		foldedNodeIds: entry.nodeIds.slice(1),
		presetOverride: roleRenderPreset(entry, original),
		itemRoleName: entry.role.name,
		literalText: entry.literalText,
		// Also update the live-preview `.text` field (normally the arranger's
		// own top-level text, inherited unchanged by every split entry
		// otherwise): a transition-bound role has no node id to join back to,
		// so its OWN text would render blank without `literalText`; a
		// `ch`/`des`-axis role's OWN resolved descendant(s) need
		// `textFromNodeIds` for the same reason (round 20) - only a bare
		// `self`-axis role (nothing in `nodeTextById`) falls all the way
		// through to `original.text`, correctly.
		text: entry.literalText ?? textFromNodeIds(entry.nodeIds, nodeTextById) ?? original.text,
	};
}

/**
 * `original`'s own bounding box, regardless of `kind` - a `circle` measures
 * its `rx`/`ry` (or plain `r`) around `cx`/`cy`; a `polygon` measures its own
 * `points`. Used only to seed a RECT split of a non-rect original
 * (`stackRoleContent`): the arranger's own merged preset (e.g. a decorative
 * photo circle preferred over the item's REAL text roles - see the round-3
 * Track S/R handoff notes) is not what the per-item TEXT roles themselves
 * declare, so this recovers a usable extent to stack them in.
 */
export function boundingBoxOf(node: RenderedNode): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	if (node.kind === 'rect') {
		return { x: node.x, y: node.y, width: node.width, height: node.height };
	}
	if (node.kind === 'circle') {
		const halfWidth = node.rx ?? node.r;
		const halfHeight = node.ry ?? node.r;
		return {
			x: node.cx - halfWidth,
			y: node.cy - halfHeight,
			width: halfWidth * 2,
			height: halfHeight * 2,
		};
	}
	const pairs = node.points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => pair.split(',').map(Number) as [number, number]);
	const xs = pairs.map(([x]) => x);
	const ys = pairs.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	return {
		x: minX,
		y: minY,
		width: Math.max(1, Math.max(...xs) - minX),
		height: Math.max(1, Math.max(...ys) - minY),
	};
}
