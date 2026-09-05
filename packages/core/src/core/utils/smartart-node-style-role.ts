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

/** Index every `pres`-type point by its `modelId`, or `undefined` when there are none. */
function indexPresPoints(points: XmlObject[]): Map<string, XmlObject> | undefined {
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
	return presPointsById.size > 0 ? presPointsById : undefined;
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
	const presPointsById = indexPresPoints(points);
	if (!presPointsById) {
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

/**
 * Resolve the set of content node ids whose presentation point declares
 * `dgm:prSet/@coherent3DOff="1"` (`CT_ElemPropSet`): PowerPoint lets a
 * SmartArt author break one node out of the diagram's overall coherent-3D
 * scene rotation (used with `dgm:scene3d`/`dgm:sp3d` bevel quick styles). See
 * `smartart-effect-intensity.ts`'s theme-resolved style refs, which honour
 * this flag when applying a quick style's `scene3d`/`sp3d` variation.
 *
 * Mirrors {@link resolveSmartArtNodeStyleRoles}'s presOf resolution (a
 * content point carries no attributes of its own; PowerPoint always writes
 * this on the presentation point instead), kept as a separate pass so the
 * (far more common) style-role resolution never pays for it.
 */
export function resolveSmartArtNodeCoherent3DOff(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	localName: LocalName,
): Set<string> {
	const presPointsById = indexPresPoints(points);
	if (!presPointsById) {
		return new Set();
	}

	const nodeIds = new Set<string>();
	for (const connection of connections) {
		if (connection.type !== 'presOf') {
			continue;
		}
		const presPoint = presPointsById.get(connection.destId);
		if (!presPoint) {
			continue;
		}
		const prSet = child(presPoint, 'prSet', localName);
		const raw = String(prSet?.['@_coherent3DOff'] ?? '')
			.trim()
			.toLowerCase();
		if (raw === '1' || raw === 'true') {
			nodeIds.add(connection.sourceId);
		}
	}
	return nodeIds;
}
