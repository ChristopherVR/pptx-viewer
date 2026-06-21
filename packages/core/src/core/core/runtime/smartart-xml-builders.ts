import type { XmlObject } from '../../types';
import type { PptxSmartArtNode, PptxSmartArtConnection } from '../../types/smart-art';

/**
 * Point `@_type` values that are NOT user-editable content nodes.
 *
 * Per ECMA-376 (DrawingML diagrams) the data model carries structural and
 * presentation points alongside the content points the user types into:
 *   - `doc`      the root document point
 *   - `pres`     presentation points produced by the layout engine
 *   - `parTrans` / `sibTrans` parent / sibling transition points
 *
 * These MUST be preserved verbatim on round-trip: PowerPoint relies on them
 * (and on each point's `prSet` / `spPr` / `extLst`) to re-render the diagram.
 * Content points are everything else (no `@_type`, or `type="node"`/`"asst"`).
 */
const NON_CONTENT_POINT_TYPES: ReadonlySet<string> = new Set([
	'doc',
	'pres',
	'parTrans',
	'sibTrans',
]);

/** Read the `@_type` of a parsed `dgm:pt`, normalised to a trimmed string. */
function pointType(pt: XmlObject): string {
	return String(pt['@_type'] || '').trim();
}

/** Read the `@_modelId` of a parsed `dgm:pt`, normalised to a trimmed string. */
function pointModelId(pt: XmlObject): string {
	return String(pt['@_modelId'] || '').trim();
}

/** True when a parsed `dgm:pt` is a user-editable content point. */
function isContentPoint(pt: XmlObject): boolean {
	return !NON_CONTENT_POINT_TYPES.has(pointType(pt));
}

/**
 * Build the `dgm:t` text body for a SmartArt content point.
 */
function buildPointText(text: string): XmlObject {
	return {
		'a:bodyPr': {},
		'a:lstStyle': {},
		'a:p': {
			'a:r': {
				'a:rPr': { '@_lang': 'en-US', '@_dirty': '0' },
				'a:t': text,
			},
		},
	};
}

/**
 * Replace the run text of an EXISTING point's `dgm:t` in place while keeping
 * the rest of the point (prSet, spPr, extLst, run properties, etc.) intact.
 *
 * When the point has no recognisable run, the whole `dgm:t` is rebuilt; that
 * only happens for points that never carried editable text, so nothing of
 * value is lost.
 */
function applyTextToExistingPoint(pt: XmlObject, text: string): void {
	const tKey = Object.keys(pt).find((k) => stripPrefix(k) === 't');
	if (!tKey) {
		pt['dgm:t'] = buildPointText(text);
		return;
	}

	const body = pt[tKey];
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		pt[tKey] = buildPointText(text);
		return;
	}

	const bodyObj = body as XmlObject;
	const pKey = Object.keys(bodyObj).find((k) => stripPrefix(k) === 'p');
	const paragraph = pKey ? bodyObj[pKey] : undefined;
	// Multiple paragraphs / runs are uncommon for SmartArt content points; the
	// simplest faithful behaviour is to rewrite the single-run body, preserving
	// the surrounding bodyPr / lstStyle keys that already exist on the point.
	if (!pKey || Array.isArray(paragraph) || !paragraph || typeof paragraph !== 'object') {
		bodyObj[pKey ?? 'a:p'] = {
			'a:r': {
				'a:rPr': { '@_lang': 'en-US', '@_dirty': '0' },
				'a:t': text,
			},
		};
		return;
	}

	const paragraphObj = paragraph as XmlObject;
	const rKey = Object.keys(paragraphObj).find((k) => stripPrefix(k) === 'r');
	const run = rKey ? paragraphObj[rKey] : undefined;
	if (!rKey || Array.isArray(run) || !run || typeof run !== 'object') {
		paragraphObj[rKey ?? 'a:r'] = {
			'a:rPr': { '@_lang': 'en-US', '@_dirty': '0' },
			'a:t': text,
		};
		return;
	}

	const runObj = run as XmlObject;
	const textKey = Object.keys(runObj).find((k) => stripPrefix(k) === 't');
	runObj[textKey ?? 'a:t'] = text;
}

/** Strip the namespace prefix from an XML key (e.g. `dgm:t` -> `t`). */
function stripPrefix(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

/**
 * Build XML point-node objects (`dgm:pt`) from in-memory SmartArt nodes.
 *
 * NOTE: this produces content points only and is NOT used for the round-trip
 * save path (which uses {@link mergeSmartArtPointXml} to preserve presentation
 * and structural points). It remains for callers that synthesise a brand-new
 * point list from scratch.
 */
export function buildSmartArtPointXml(nodes: PptxSmartArtNode[]): XmlObject[] {
	return nodes.map((node) => {
		const ptNode: XmlObject = {
			'@_modelId': node.id,
		};
		if (node.nodeType) {
			ptNode['@_type'] = node.nodeType;
		}
		ptNode['dgm:t'] = buildPointText(node.text);
		return ptNode;
	});
}

/**
 * Surgically merge in-memory content nodes into the EXISTING parsed point
 * list, preserving every non-content point (doc / pres / parTrans / sibTrans)
 * and every point's `prSet` / `spPr` / `extLst` untouched.
 *
 * Rules:
 *  - Update the text of existing content points matched by `@_modelId`.
 *  - Append newly-added content points (those whose id is not already present),
 *    preserving their `nodeType` when set.
 *  - Drop content points whose `@_modelId` is no longer in `nodes`.
 *  - Leave all non-content points exactly where they are, in order.
 *
 * @param existingPts Parsed `dgm:pt` objects from the loaded data model.
 * @param nodes Current in-memory content nodes.
 * @returns A new ordered array of `dgm:pt` objects for the saved data model.
 */
export function mergeSmartArtPointXml(
	existingPts: XmlObject[],
	nodes: PptxSmartArtNode[],
): XmlObject[] {
	const desiredById = new Map<string, PptxSmartArtNode>();
	for (const node of nodes) {
		const id = String(node.id || '').trim();
		if (id.length > 0) {
			desiredById.set(id, node);
		}
	}

	const seenContentIds = new Set<string>();
	const merged: XmlObject[] = [];

	for (const pt of existingPts) {
		if (!pt || typeof pt !== 'object') {
			continue;
		}
		if (!isContentPoint(pt)) {
			// Preserve doc / pres / parTrans / sibTrans verbatim.
			merged.push(pt);
			continue;
		}

		const modelId = pointModelId(pt);
		const desired = modelId.length > 0 ? desiredById.get(modelId) : undefined;
		if (!desired) {
			// Content point whose model id was deleted: drop it.
			continue;
		}

		// Update the text in place, keeping prSet / spPr / extLst intact.
		applyTextToExistingPoint(pt, desired.text);
		seenContentIds.add(modelId);
		merged.push(pt);
	}

	// Append newly-added content points that had no existing counterpart.
	for (const node of nodes) {
		const id = String(node.id || '').trim();
		if (id.length === 0 || seenContentIds.has(id)) {
			continue;
		}
		const ptNode: XmlObject = { '@_modelId': id };
		if (node.nodeType && !NON_CONTENT_POINT_TYPES.has(node.nodeType)) {
			ptNode['@_type'] = node.nodeType;
		}
		ptNode['dgm:t'] = buildPointText(node.text);
		merged.push(ptNode);
	}

	return merged;
}

/**
 * Build XML connection-node objects (`dgm:cxn`) from in-memory connections.
 */
export function buildSmartArtConnectionXml(connections: PptxSmartArtConnection[]): XmlObject[] {
	return connections.map((conn) => {
		const cxnNode: XmlObject = {
			'@_srcId': conn.sourceId,
			'@_destId': conn.destId,
		};
		if (conn.type) {
			cxnNode['@_type'] = conn.type;
		}
		if (conn.srcOrd !== undefined) {
			cxnNode['@_srcOrd'] = String(conn.srcOrd);
		}
		if (conn.destOrd !== undefined) {
			cxnNode['@_destOrd'] = String(conn.destOrd);
		}
		return cxnNode;
	});
}
