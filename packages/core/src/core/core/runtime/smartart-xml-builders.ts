import type { XmlObject } from '../../types';
import type {
	PptxSmartArtNode,
	PptxSmartArtConnection,
	PptxSmartArtTextParagraph,
	PptxSmartArtTextRun,
} from '../../types/smart-art';
import { generateFontGuid } from '../../utils/font-deobfuscation';
import {
	applySmartArtConnectionAttributes,
	applySmartArtPointAttributes,
} from '../../utils/smartart-data-model-attributes';
import { applySmartArtNodeStyleToPoint } from './smartart-style-xml';
import { buildSmartArtTextParagraph, smartArtParagraphsText } from './smartart-text-paragraphs';
import { reconcileSmartArtTextParagraphs } from './smartart-text-reconciliation';

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
export function isContentPoint(pt: XmlObject): boolean {
	return !NON_CONTENT_POINT_TYPES.has(pointType(pt));
}

/**
 * Build the `dgm:t` text body for a SmartArt content point.
 */
export function buildPointText(text: string): XmlObject {
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

/** Join the text of an in-memory run list. */
function joinRunText(runs: PptxSmartArtTextRun[] | undefined): string {
	return (runs ?? []).map((run) => run.text).join('');
}

/**
 * Build a multi-run `a:p` body from preserved per-run text + properties,
 * keeping each run's `a:rPr` verbatim so per-run formatting survives.
 */
function buildMultiRunParagraph(runs: PptxSmartArtTextRun[]): XmlObject {
	const runObjects: XmlObject[] = runs.map((run) => {
		const rObj: XmlObject = {};
		rObj['a:rPr'] = (run.rPr as XmlObject | undefined) ?? { '@_lang': 'en-US', '@_dirty': '0' };
		rObj['a:t'] = run.text;
		return rObj;
	});
	return { 'a:r': runObjects.length === 1 ? runObjects[0] : runObjects };
}

/**
 * Decide whether the node's preserved per-run formatting should be rebuilt.
 *
 * Runs are only honoured when there is genuine per-run structure to preserve
 * (more than one run, or a single run carrying its own `a:rPr`) AND the joined
 * run text still equals the node's current text. When the user edits the node,
 * `node.text` diverges from the joined run text, so we fall back to the
 * single-run path and do not resurrect stale runs.
 */
export function shouldRebuildFromRuns(node: PptxSmartArtNode): node is PptxSmartArtNode & {
	runs: PptxSmartArtTextRun[];
} {
	const runs = node.runs;
	if (!runs || runs.length === 0) {
		return false;
	}
	const hasRichRun = runs.length > 1 || Boolean(runs[0]?.rPr);
	if (!hasRichRun) {
		return false;
	}
	return joinRunText(runs) === node.text;
}

/** True when the complete typed paragraph model still represents node text. */
export function shouldRebuildFromParagraphs(
	node: PptxSmartArtNode,
): node is PptxSmartArtNode & { paragraphs: PptxSmartArtTextParagraph[] } {
	return Boolean(node.paragraphs?.length);
}

/**
 * Build a `dgm:t` text body from preserved per-run text + properties.
 */
export function buildPointFromRuns(runs: PptxSmartArtTextRun[]): XmlObject {
	return {
		'a:bodyPr': {},
		'a:lstStyle': {},
		'a:p': buildMultiRunParagraph(runs),
	};
}

/** Build a complete `dgm:t` body from typed SmartArt paragraphs. */
export function buildPointFromParagraphs(
	paragraphs: PptxSmartArtTextParagraph[],
	desiredText = smartArtParagraphsText(paragraphs),
): XmlObject {
	const built = reconcileSmartArtTextParagraphs(paragraphs, desiredText).map(
		buildSmartArtTextParagraph,
	);
	return {
		'a:bodyPr': {},
		'a:lstStyle': {},
		'a:p': built.length === 1 ? built[0] : built,
	};
}

/**
 * Rebuild the first paragraph of an EXISTING `dgm:t` body from preserved runs
 * while keeping the surrounding `a:bodyPr` / `a:lstStyle` keys that already
 * exist on the point.
 */
function applyRunsToExistingBody(pt: XmlObject, tKey: string, runs: PptxSmartArtTextRun[]): void {
	const body = pt[tKey];
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		pt[tKey] = buildPointFromRuns(runs);
		return;
	}
	const bodyObj = body as XmlObject;
	const pKey = Object.keys(bodyObj).find((k) => stripPrefix(k) === 'p');
	bodyObj[pKey ?? 'a:p'] = buildMultiRunParagraph(runs);
}

function applyParagraphsToExistingBody(
	pt: XmlObject,
	tKey: string,
	paragraphs: PptxSmartArtTextParagraph[],
): void {
	const body = pt[tKey];
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		pt[tKey] = buildPointFromParagraphs(paragraphs);
		return;
	}
	const bodyObj = body as XmlObject;
	const pKey = Object.keys(bodyObj).find((key) => stripPrefix(key) === 'p') ?? 'a:p';
	const built = paragraphs.map(buildSmartArtTextParagraph);
	bodyObj[pKey] = built.length === 1 ? built[0] : built;
}

/**
 * Replace the run text of an EXISTING point's `dgm:t` in place while keeping
 * the rest of the point (prSet, spPr, extLst, run properties, etc.) intact.
 *
 * When the node carries preserved per-run formatting whose joined text still
 * matches the current node text, the paragraph is rebuilt from those runs so
 * per-run rich text is not flattened to a single run. Otherwise the existing
 * single-run text is updated in place.
 *
 * When the point has no recognisable run, the whole `dgm:t` is rebuilt; that
 * only happens for points that never carried editable text, so nothing of
 * value is lost.
 */
function applyTextToExistingPoint(pt: XmlObject, node: PptxSmartArtNode): void {
	const text = node.text;
	const rebuildFromParagraphs = shouldRebuildFromParagraphs(node);
	const rebuildFromRuns = shouldRebuildFromRuns(node);
	const tKey = Object.keys(pt).find((k) => stripPrefix(k) === 't');
	if (!tKey) {
		pt['dgm:t'] = rebuildFromParagraphs
			? buildPointFromParagraphs(node.paragraphs, node.text)
			: rebuildFromRuns
				? buildPointFromRuns(node.runs)
				: buildPointText(text);
		return;
	}

	if (rebuildFromParagraphs) {
		applyParagraphsToExistingBody(
			pt,
			tKey,
			reconcileSmartArtTextParagraphs(node.paragraphs, node.text),
		);
		return;
	}

	if (rebuildFromRuns) {
		applyRunsToExistingBody(pt, tKey, node.runs);
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
	if (node.paragraphs?.length) {
		bodyObj[pKey ?? 'a:p'] = buildPointText(text)['a:p'];
		return;
	}
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
		applySmartArtPointAttributes(ptNode, node);
		ptNode['dgm:t'] = shouldRebuildFromParagraphs(node)
			? buildPointFromParagraphs(node.paragraphs, node.text)
			: shouldRebuildFromRuns(node)
				? buildPointFromRuns(node.runs)
				: buildPointText(node.text);
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

		// Update the text in place, keeping prSet / spPr / extLst intact and
		// preserving per-run formatting when the node was not text-edited.
		applyTextToExistingPoint(pt, desired);
		applySmartArtPointAttributes(pt, desired);
		// Write any per-node colour / emphasis override so it round-trips.
		applySmartArtNodeStyleToPoint(pt, desired.style);
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
		applySmartArtPointAttributes(ptNode, node);
		ptNode['dgm:t'] = shouldRebuildFromParagraphs(node)
			? buildPointFromParagraphs(node.paragraphs, node.text)
			: shouldRebuildFromRuns(node)
				? buildPointFromRuns(node.runs)
				: buildPointText(node.text);
		applySmartArtNodeStyleToPoint(ptNode, node.style);
		merged.push(ptNode);
	}

	return merged;
}

/**
 * Generate a `{GUID}`-formatted id matching the format PowerPoint uses for
 * `dgm:pt`/`dgm:cxn` `@_modelId` values. Every `dgm:cxn` requires a unique
 * `@_modelId`, just like `dgm:pt` does.
 */
export function newSmartArtGuid(): string {
	return `{${generateFontGuid()}}`;
}

/**
 * Build XML connection-node objects (`dgm:cxn`) from in-memory connections.
 *
 * NOT used for the round-trip save path (which uses
 * {@link mergeSmartArtConnectionXml} to preserve each existing connection's
 * `modelId` / `parTransId` / `sibTransId` / `presId`). It remains for callers
 * that synthesise a brand-new connection list from scratch.
 */
export function buildSmartArtConnectionXml(connections: PptxSmartArtConnection[]): XmlObject[] {
	return connections.map((conn) => {
		const cxnNode: XmlObject = {};
		applySmartArtConnectionAttributes(cxnNode, conn, newSmartArtGuid);
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

/**
 * Normalise a connection `@_type` for identity matching. `parOf` is the
 * schema default when `@_type` is omitted (real PowerPoint files always omit
 * it for parent/child edges), but the in-memory node-ops helpers
 * (`smartart-editing-node-ops.ts`) stamp new parent/child connections with an
 * explicit `type: 'parOf'`. Without this normalisation those connections
 * never match their on-disk counterpart by identity.
 */
function normalizeConnType(type: string | undefined): string {
	return type && type !== 'parOf' ? type : '';
}

/** Build a lookup key identifying a connection's identity for merge matching. */
function connectionKey(conn: {
	srcId: string;
	destId: string;
	type?: string;
	srcOrd?: number;
	destOrd?: number;
}): string {
	return [
		conn.srcId,
		conn.destId,
		normalizeConnType(conn.type),
		conn.srcOrd ?? '',
		conn.destOrd ?? '',
	].join(' ');
}

/**
 * Surgically merge in-memory connections into the EXISTING parsed
 * `dgm:cxn` list, preserving every unchanged connection's `@_modelId` and any
 * other attributes (`parTransId`, `sibTransId`, `presId`, etc.) verbatim.
 *
 * `dgm:cxn/@_modelId` is REQUIRED per ECMA-376 (`CT_Connection`): rebuilding
 * the list from scratch with only `srcId`/`destId`/`type`/`srcOrd`/`destOrd`
 * (as {@link buildSmartArtConnectionXml} does) drops it on every connection,
 * which PowerPoint rejects as a corrupt file.
 *
 * Existing connections are matched to desired connections by identity
 * (srcId + destId + type + srcOrd + destOrd), which is exactly how the loader
 * derives {@link PptxSmartArtConnection} from a parsed `dgm:cxn` in the first
 * place, so an unedited connection always matches itself and is preserved
 * verbatim. Only genuinely new connections (from node add / promote / demote)
 * get a freshly generated `modelId`.
 *
 * @param existingCxns Parsed `dgm:cxn` objects from the loaded data model.
 * @param connections Current in-memory connections.
 * @returns A new ordered array of `dgm:cxn` objects for the saved data model.
 */
export function mergeSmartArtConnectionXml(
	existingCxns: XmlObject[],
	connections: PptxSmartArtConnection[],
): XmlObject[] {
	const existingByKey = new Map<string, XmlObject[]>();
	const existingByModelId = new Map<string, XmlObject>();
	for (const cxn of existingCxns) {
		if (!cxn || typeof cxn !== 'object') {
			continue;
		}
		const srcOrdRaw = parseInt(String(cxn['@_srcOrd'] ?? ''), 10);
		const destOrdRaw = parseInt(String(cxn['@_destOrd'] ?? ''), 10);
		const key = connectionKey({
			srcId: String(cxn['@_srcId'] || ''),
			destId: String(cxn['@_destId'] || ''),
			type: cxn['@_type'] ? String(cxn['@_type']) : undefined,
			srcOrd: Number.isFinite(srcOrdRaw) ? srcOrdRaw : undefined,
			destOrd: Number.isFinite(destOrdRaw) ? destOrdRaw : undefined,
		});
		const modelId = String(cxn['@_modelId'] || '').trim();
		if (modelId) {
			existingByModelId.set(modelId, cxn);
		}
		const queue = existingByKey.get(key);
		if (queue) {
			queue.push(cxn);
		} else {
			existingByKey.set(key, [cxn]);
		}
	}

	return connections.map((conn) => {
		const key = connectionKey({
			srcId: conn.sourceId,
			destId: conn.destId,
			type: conn.type,
			srcOrd: conn.srcOrd,
			destOrd: conn.destOrd,
		});
		const queue = existingByKey.get(key);
		const matchById = conn.modelId ? existingByModelId.get(conn.modelId) : undefined;
		const match = matchById ?? queue?.shift();
		if (match) {
			applySmartArtConnectionAttributes(match, conn, newSmartArtGuid);
			return match;
		}

		const cxnNode: XmlObject = {};
		applySmartArtConnectionAttributes(cxnNode, conn, newSmartArtGuid);
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
