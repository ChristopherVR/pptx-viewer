/**
 * SmartArt DiagramML interpreter - per-item role content bound to a
 * TRANSITION point instead of a data node.
 *
 * Split out of `smartart-layout-interpreter-item-role-shared.ts` (the
 * file-size budget). A layout can declare a per-item role whose `dgm:presOf`
 * targets a `sibTrans`/`parTrans` point rather than a content node - the
 * shape ECMA-376 layouts use for a per-item ordinal/position badge
 * (`NumberedDotsHorizontal`'s `numCircle`: `presOf axis="self"
 * ptType="sibTrans"`, whose "1"/"2"/"3" text lives on the item's own `parOf`
 * edge's `sibTrans` point, read via `PptxSmartArtConnection.label` -
 * `PptxHandlerRuntimeSmartArtParsing.ts`'s `parseSmartArtConnections`
 * already resolves whichever of the edge's `parTrans`/`sibTrans` points
 * actually carries text). Such a role has no `PptxSmartArtNode` id to join
 * back to, so it resolves to a LITERAL string instead of node ids - see
 * `ItemRoleContent.literalText`.
 */

import type { PptxSmartArtConnection, PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { contentIds } from './smartart-layout-interpreter-item-role-shared';

/** One resolved role, with the actual data-node ids supplying its text. */
export interface ItemRoleContent {
	role: PptxSmartArtLayoutNode;
	nodeIds: string[];
	/**
	 * Verbatim display text for a role bound to a TRANSITION point instead of
	 * a data node (see {@link resolveRoleContent}). `nodeIds` is empty
	 * whenever this is set: a transition point's text has no `PptxSmartArtNode`
	 * id to join back to.
	 */
	literalText?: string;
}

/**
 * True when `role`'s `dgm:presOf` targets a TRANSITION point
 * (`ptType="sibTrans"|"parTrans"`) rather than a content node. Such a role's
 * `axis="self"` still means "the point currently in scope", but that point
 * is the item's OWN incoming `parOf` edge's transition point, not the
 * item's data node itself - a different point `contentIds`' node-keyed axis
 * model cannot address at all.
 */
function isTransitionRole(role: PptxSmartArtLayoutNode): boolean {
	const pointTypes = role.presentationOf?.pointTypes ?? [];
	return (
		role.presentationOf?.axis?.[0] === 'self' &&
		(pointTypes.includes('sibTrans') || pointTypes.includes('parTrans'))
	);
}

/**
 * The transition point's own text for `node`'s incoming `parOf` edge
 * (`PptxSmartArtConnection.label`, which already prefers whichever of the
 * edge's `parTrans`/`sibTrans` points actually carries text - see
 * `PptxHandlerRuntimeSmartArtParsing.ts`'s `parseSmartArtConnections`).
 * `undefined` when no such edge/label exists (a top-level item's `srcId` is
 * the invisible `doc` root, which still has its own `parOf` cxn per child).
 */
function transitionLabel(
	node: PptxSmartArtNode,
	connections: PptxSmartArtConnection[] | undefined,
): string | undefined {
	return connections?.find(
		(connection) =>
			connection.destId === node.id && (!connection.type || connection.type === 'parOf'),
	)?.label;
}

/**
 * Resolve ONE role's content for `node`: a transition-bound role
 * ({@link isTransitionRole}) resolves to its edge's {@link transitionLabel}
 * (no node ids at all - see {@link ItemRoleContent.literalText}); everything
 * else resolves via `contentIds` as before. Returns `undefined` when the
 * role has no content to contribute (dropped by the caller, matching the
 * pre-existing "empty ids" behaviour).
 */
export function resolveRoleContent(
	role: PptxSmartArtLayoutNode,
	node: PptxSmartArtNode,
	childrenOf: Map<string, PptxSmartArtNode[]>,
	connections: PptxSmartArtConnection[] | undefined,
): ItemRoleContent | undefined {
	if (isTransitionRole(role)) {
		const literalText = transitionLabel(node, connections);
		return literalText ? { role, nodeIds: [], literalText } : undefined;
	}
	const ids = contentIds(role, node, childrenOf);
	return ids.length > 0 ? { role, nodeIds: ids } : undefined;
}

/**
 * Fold `resolved` into `out`, deduplicating against `used` (a data-node id
 * already claimed by an earlier role, per `resolveItemRoleContent`'s doc
 * comment) - a `literalText` entry (empty `nodeIds`) has nothing to dedupe
 * against and always survives. Shared by the flat scan
 * (`resolveItemRoleContent`) and the recursive walker's `visitOne` so both
 * apply the exact same mutual-exclusion rule.
 */
export function pushRoleContent(
	resolved: ItemRoleContent | undefined,
	used: Set<string>,
	out: ItemRoleContent[],
): void {
	if (!resolved) {
		return;
	}
	if (resolved.nodeIds.length === 0) {
		out.push(resolved);
		return;
	}
	const ids = resolved.nodeIds.filter((id) => !used.has(id));
	if (ids.length === 0) {
		return;
	}
	for (const id of ids) {
		used.add(id);
	}
	out.push({ ...resolved, nodeIds: ids });
}
