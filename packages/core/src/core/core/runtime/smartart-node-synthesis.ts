import type { XmlObject } from '../../types';
import type { PptxSmartArtNode, PptxSmartArtConnection } from '../../types/smart-art';
import {
	isContentPoint,
	buildPointText,
	buildPointFromParagraphs,
	buildPointFromRuns,
	shouldRebuildFromParagraphs,
	shouldRebuildFromRuns,
	newSmartArtGuid,
} from './smartart-xml-builders';

/** The parsed `dgm:pt`'s `dgm:prSet` child, or an empty object when absent. */
function prSetOf(pt: XmlObject): XmlObject {
	const prSet = pt['dgm:prSet'];
	return prSet && typeof prSet === 'object' && !Array.isArray(prSet) ? (prSet as XmlObject) : {};
}

/** The `pres`-type point whose `prSet/@_presAssocID` matches `assocId`. */
function findPresPointForAssoc(pts: XmlObject[], assocId: string): XmlObject | undefined {
	return pts.find(
		(pt) => pt['@_type'] === 'pres' && String(prSetOf(pt)['@_presAssocID'] || '') === assocId,
	);
}

/** Highest `@_srcOrd` among `presParOf` connections sourced from `srcId`, or -1 when none exist. */
function maxPresParOfOrd(cxns: XmlObject[], srcId: string): number {
	return cxns
		.filter((c) => c['@_type'] === 'presParOf' && c['@_srcId'] === srcId)
		.reduce((max, c) => Math.max(max, parseInt(String(c['@_srcOrd'] ?? ''), 10) || 0), -1);
}

/** Count of `pres`-type points presenting a content node (`presName === 'node'`). */
function countNodePresPoints(pts: XmlObject[]): number {
	return pts.filter((pt) => pt['@_type'] === 'pres' && prSetOf(pt)['@_presName'] === 'node').length;
}

/** An empty `dgm:t` text body, used for `parTrans`/`sibTrans` support points. */
function emptyTextBody(): XmlObject {
	return { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': { 'a:endParaRPr': { '@_lang': 'en-US' } } };
}

function buildContentPoint(node: PptxSmartArtNode): XmlObject {
	const pt: XmlObject = { '@_modelId': node.id };
	pt['dgm:prSet'] = node.text ? {} : { '@_phldrT': '[Text]' };
	pt['dgm:spPr'] = {};
	pt['dgm:t'] = shouldRebuildFromParagraphs(node)
		? buildPointFromParagraphs(node.paragraphs, node.text)
		: shouldRebuildFromRuns(node)
			? buildPointFromRuns(node.runs)
			: buildPointText(node.text ?? '');
	return pt;
}

function buildTransPoint(id: string, type: 'parTrans' | 'sibTrans'): XmlObject {
	return { '@_modelId': id, '@_type': type, 'dgm:prSet': {}, 'dgm:t': emptyTextBody() };
}

function buildPresNodePoint(id: string, assocId: string, idx: number, cnt: number): XmlObject {
	return {
		'@_modelId': id,
		'@_type': 'pres',
		'dgm:prSet': {
			'dgm:presLayoutVars': { 'dgm:bulletEnabled': { '@_val': '1' } },
			'@_presAssocID': assocId,
			'@_presName': 'node',
			'@_presStyleLbl': 'node1',
			'@_presStyleIdx': String(idx),
			'@_presStyleCnt': String(cnt),
		},
		'dgm:spPr': {},
	};
}

function buildPresSibTransPoint(id: string, assocId: string): XmlObject {
	return {
		'@_modelId': id,
		'@_type': 'pres',
		'dgm:prSet': { '@_presAssocID': assocId, '@_presName': 'sibTrans', '@_presStyleCnt': '0' },
		'dgm:spPr': {},
	};
}

function buildParOfConnection(
	srcId: string,
	destId: string,
	srcOrd: number,
	parTransId: string,
	sibTransId: string,
): XmlObject {
	return {
		'@_modelId': newSmartArtGuid(),
		'@_srcId': srcId,
		'@_destId': destId,
		'@_srcOrd': String(srcOrd),
		'@_destOrd': '0',
		'@_parTransId': parTransId,
		'@_sibTransId': sibTransId,
	};
}

function buildPresOfConnection(srcId: string, destId: string, presId: string): XmlObject {
	return {
		'@_modelId': newSmartArtGuid(),
		'@_type': 'presOf',
		'@_srcId': srcId,
		'@_destId': destId,
		'@_srcOrd': '0',
		'@_destOrd': '0',
		'@_presId': presId,
	};
}

function buildPresParOfConnection(
	srcId: string,
	destId: string,
	srcOrd: number,
	presId: string,
): XmlObject {
	return {
		'@_modelId': newSmartArtGuid(),
		'@_type': 'presParOf',
		'@_srcId': srcId,
		'@_destId': destId,
		'@_srcOrd': String(srcOrd),
		'@_destOrd': '0',
		'@_presId': presId,
	};
}

/**
 * Graft the full point/connection family a brand-new SmartArt content node
 * needs onto the EXISTING parsed `dgm:ptLst` / `dgm:cxnLst`, for every node
 * present in `nodes` that has no matching content point in `existingPts`.
 *
 * PowerPoint's diagram data model does not let a content point stand alone:
 * per ECMA-376, every content point needs a `parTrans` + `sibTrans` support
 * point pair (referenced from its `parOf` connection), and a `pres`-type
 * presentation point wired under its parent's own `pres` point via
 * `presOf` + `presParOf` connections. A content point added without this
 * scaffolding (e.g. via {@link mergeSmartArtPointXml} alone) is schema-valid
 * XML but PowerPoint's loader still rejects the file as corrupt on open --
 * confirmed empirically via PowerPoint COM automation. This synthesises that
 * scaffolding so the subsequent surgical merges
 * ({@link import('./smartart-xml-builders').mergeSmartArtPointXml} /
 * {@link import('./smartart-xml-builders').mergeSmartArtConnectionXml}) see
 * the new node as already present and pass it through untouched.
 *
 * Nodes with no resolvable parent (no `parentId`, or a `parentId` whose own
 * `pres` point can't be found) are skipped rather than grafted incompletely:
 * an incomplete graft is exactly the corrupting state this function exists
 * to avoid.
 *
 * `connections` (the in-memory model the editing UI mutates) only ever tracks
 * the data-graph `parOf` edges -- it has no concept of the presentation-layer
 * `presOf` / `presParOf` connections this function grafts in. Those grafted
 * connections are therefore invisible to
 * {@link import('./smartart-xml-builders').mergeSmartArtConnectionXml}'s
 * desired-vs-existing matching (which only preserves an existing connection
 * that has a counterpart in `connections`) and would otherwise be silently
 * dropped again immediately after being grafted. `extraConnections` reports
 * them back as {@link PptxSmartArtConnection} descriptors so the caller can
 * append them to `connections` before running that merge.
 *
 * @param existingPts Parsed `dgm:pt` objects from the loaded data model.
 * @param existingCxns Parsed `dgm:cxn` objects from the loaded data model.
 * @param nodes Current in-memory content nodes (desired end state).
 * @param connections Current in-memory connections (desired end state), used
 *   to look up the `srcOrd` a new node's `parOf` connection should carry.
 * @returns New `pts` / `cxns` arrays with synthesised entries appended, plus
 *   `extraConnections` describing the presentation-layer connections among
 *   them that `connections` doesn't already represent.
 */
export function synthesizeNewSmartArtStructuralPoints(
	existingPts: XmlObject[],
	existingCxns: XmlObject[],
	nodes: PptxSmartArtNode[],
	connections: PptxSmartArtConnection[] | undefined,
): { pts: XmlObject[]; cxns: XmlObject[]; extraConnections: PptxSmartArtConnection[] } {
	const existingContentIds = new Set(
		existingPts.filter(isContentPoint).map((pt) => String(pt['@_modelId'] || '')),
	);
	const newNodes = nodes.filter((n) => n.id && !existingContentIds.has(n.id));
	if (newNodes.length === 0) {
		return { pts: existingPts, cxns: existingCxns, extraConnections: [] };
	}

	// Every presOf / presParOf connection carries the same layout-definition
	// URN; reuse whichever one already exists rather than guessing at it.
	const presId = existingCxns.find((c) => c['@_presId'])?.['@_presId'] as string | undefined;
	if (!presId) {
		return { pts: existingPts, cxns: existingCxns, extraConnections: [] };
	}

	const pts = [...existingPts];
	const cxns = [...existingCxns];
	const extraConnections: PptxSmartArtConnection[] = [];

	// The parent-child edge is untyped in real PowerPoint files, but the
	// in-memory node-ops helpers stamp it as `type: 'parOf'` explicitly --
	// both forms mean the same thing, so match either.
	const connectionByChildId = new Map<string, PptxSmartArtConnection>();
	for (const conn of connections ?? []) {
		if (!conn.type || conn.type === 'parOf') {
			connectionByChildId.set(conn.destId, conn);
		}
	}

	for (const node of newNodes) {
		const parentId = node.parentId;
		const parentPres = parentId ? findPresPointForAssoc(pts, parentId) : undefined;
		if (!parentId || !parentPres) {
			continue;
		}

		const parTransId = newSmartArtGuid();
		const sibTransId = newSmartArtGuid();
		const presNodeId = newSmartArtGuid();
		const presSibTransId = newSmartArtGuid();

		pts.push(buildContentPoint(node));
		pts.push(buildTransPoint(parTransId, 'parTrans'));
		pts.push(buildTransPoint(sibTransId, 'sibTrans'));

		const idx = countNodePresPoints(pts);
		pts.push(buildPresNodePoint(presNodeId, node.id, idx, idx + 1));
		pts.push(buildPresSibTransPoint(presSibTransId, sibTransId));

		// Every "node" pres point must agree on the total count.
		const total = idx + 1;
		for (const pt of pts) {
			if (pt['@_type'] === 'pres' && prSetOf(pt)['@_presName'] === 'node') {
				prSetOf(pt)['@_presStyleCnt'] = String(total);
			}
		}

		const srcOrd = connectionByChildId.get(node.id)?.srcOrd ?? 0;
		cxns.push(buildParOfConnection(parentId, node.id, srcOrd, parTransId, sibTransId));
		cxns.push(buildPresOfConnection(node.id, presNodeId, presId));
		extraConnections.push({
			sourceId: node.id,
			destId: presNodeId,
			type: 'presOf',
			srcOrd: 0,
			destOrd: 0,
		});

		const parentPresId = String(parentPres['@_modelId']);
		const baseOrd = maxPresParOfOrd(cxns, parentPresId) + 1;
		cxns.push(buildPresParOfConnection(parentPresId, presNodeId, baseOrd, presId));
		cxns.push(buildPresParOfConnection(parentPresId, presSibTransId, baseOrd + 1, presId));
		extraConnections.push(
			{
				sourceId: parentPresId,
				destId: presNodeId,
				type: 'presParOf',
				srcOrd: baseOrd,
				destOrd: 0,
			},
			{
				sourceId: parentPresId,
				destId: presSibTransId,
				type: 'presParOf',
				srcOrd: baseOrd + 1,
				destOrd: 0,
			},
		);
	}

	return { pts, cxns, extraConnections };
}
