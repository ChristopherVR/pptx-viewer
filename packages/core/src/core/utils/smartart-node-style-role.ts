/**
 * Resolve each SmartArt content node's own presentation `styleLbl` role
 * (e.g. `node1`, `asst2`, `bgShp`, `revTx`) from the data model's `pres`
 * points and `presOf` connections.
 *
 * A content point (`dgm:pt/@type="node"|"asst"`, or no `@_type`) carries no
 * `styleLbl` of its own: PowerPoint's layout engine assigns the quick-style
 * role to the PRESENTATION point (`dgm:pt/@type="pres"`) it produces, wired
 * back to the content point by a `presOf`-typed `dgm:cxn`. A content point
 * commonly has SEVERAL `presOf` destinations (its primary shape, plus
 * decorative background/reversed-text shapes some quick styles add); the
 * primary shape's presentation point is the one whose `dgm:prSet/@presName`
 * is `"node"`, which this prefers.
 *
 * @module smartart-node-style-role
 */

import type { PptxSmartArtConnection, XmlObject } from '../types';

type LocalName = (key: string) => string;

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value)
		? (value[0] as XmlObject | undefined)
		: (value as XmlObject | undefined);
}

interface PresPointRole {
	styleRole: string;
	isPrimary: boolean;
}

/** Read a `pres`-type point's own `presStyleLbl` / whether it is the primary shape. */
function presPointRole(pt: XmlObject, localName: LocalName): PresPointRole | undefined {
	const prSet = child(pt, 'prSet', localName);
	const styleRole = String(prSet?.['@_presStyleLbl'] ?? '').trim();
	if (!styleRole) {
		return undefined;
	}
	const presName = String(prSet?.['@_presName'] ?? '').trim();
	return { styleRole, isPrimary: presName === 'node' };
}

/**
 * Resolve `contentNodeId -> presStyleLbl` for every content point that has a
 * `presOf` association with a `styleLbl`-carrying presentation point.
 *
 * @param points      Every parsed `dgm:pt` (unfiltered - `pres` points must
 *                     be present alongside content points).
 * @param connections  Parsed `dgm:cxn` list (from {@link parseSmartArtConnection}).
 * @param localName    Local-name resolver for prefixed XML keys.
 */
export function resolveSmartArtNodeStyleRoles(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	localName: LocalName,
): Map<string, string> {
	const presPointsById = new Map<string, XmlObject>();
	for (const pt of points) {
		if (!pt || typeof pt !== 'object') {
			continue;
		}
		if (String(pt['@_type'] ?? '').trim() !== 'pres') {
			continue;
		}
		const id = String(pt['@_modelId'] ?? '').trim();
		if (id) {
			presPointsById.set(id, pt);
		}
	}
	if (presPointsById.size === 0) {
		return new Map();
	}

	const roleByNodeId = new Map<string, string>();
	const primaryByNodeId = new Set<string>();
	for (const connection of connections) {
		if (connection.type !== 'presOf') {
			continue;
		}
		const presPoint = presPointsById.get(connection.destId);
		if (!presPoint) {
			continue;
		}
		const role = presPointRole(presPoint, localName);
		if (!role) {
			continue;
		}
		const nodeId = connection.sourceId;
		if (primaryByNodeId.has(nodeId)) {
			// Already resolved from this node's primary ("node"-presName) shape;
			// a later decorative presOf (bg/revTx/...) must not override it.
			continue;
		}
		if (role.isPrimary || !roleByNodeId.has(nodeId)) {
			roleByNodeId.set(nodeId, role.styleRole);
			if (role.isPrimary) {
				primaryByNodeId.add(nodeId);
			}
		}
	}
	return roleByNodeId;
}
