/**
 * `dgm:pt/@type="parTrans"|"sibTrans"` connector text.
 *
 * These transition points carry the text PowerPoint renders on an org-chart
 * relationship connector (a manager/report line label, or a sibling-order
 * annotation). The data-model loader previously excluded both from
 * `nodes` (correctly - they are not user-editable content points) but
 * preserved them XML-verbatim only, so their text was invisible to any
 * consumer of the typed model. This surfaces it as
 * `PptxSmartArtConnection.label` (parsing side) and writes an edited label
 * back onto the linked transition point (save side), without disturbing the
 * point's other preserved XML (`prSet`/`spPr`/`extLst`).
 *
 * @module smartart-connector-labels
 */

import type { PptxSmartArtConnection, XmlObject } from '../types';

type LocalName = (key: string) => string;

const TRANSITION_POINT_TYPES: ReadonlySet<string> = new Set(['parTrans', 'sibTrans']);

/**
 * Resolve `transitionPointModelId -> text` for every `parTrans`/`sibTrans`
 * point that carries non-empty text.
 *
 * @param points      Every parsed `dgm:pt` (unfiltered).
 * @param collectText Reads a point's joined `dgm:t//a:t` text (bound to the
 *                    runtime's namespace-agnostic text collector).
 */
export function collectSmartArtTransitionText(
	points: XmlObject[],
	collectText: (point: XmlObject) => string,
): Map<string, string> {
	const textById = new Map<string, string>();
	for (const pt of points) {
		if (!pt || typeof pt !== 'object') {
			continue;
		}
		if (!TRANSITION_POINT_TYPES.has(String(pt['@_type'] ?? '').trim())) {
			continue;
		}
		const id = String(pt['@_modelId'] ?? '').trim();
		if (!id) {
			continue;
		}
		const text = collectText(pt).trim();
		if (text.length > 0) {
			textById.set(id, text);
		}
	}
	return textById;
}

/** Build a minimal single-run `dgm:t` text body for a transition point. */
function simpleTextBody(text: string): XmlObject {
	return {
		'a:bodyPr': {},
		'a:lstStyle': {},
		'a:p': { 'a:r': { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': text } },
	};
}

/**
 * Set a transition point's text in place, rebuilding only as much of the
 * existing `dgm:t/a:p/a:r/a:t` chain as is missing so pre-existing run
 * properties survive an edit.
 */
function setPointText(pt: XmlObject, text: string, localName: LocalName): void {
	const tKey = Object.keys(pt).find((key) => localName(key) === 't') ?? 'dgm:t';
	const body = pt[tKey];
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		pt[tKey] = simpleTextBody(text);
		return;
	}
	const bodyObj = body as XmlObject;
	const pKey = Object.keys(bodyObj).find((key) => localName(key) === 'p');
	const paragraph = pKey ? bodyObj[pKey] : undefined;
	if (!pKey || Array.isArray(paragraph) || !paragraph || typeof paragraph !== 'object') {
		bodyObj[pKey ?? 'a:p'] = { 'a:r': { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': text } };
		return;
	}
	const paragraphObj = paragraph as XmlObject;
	const rKey = Object.keys(paragraphObj).find((key) => localName(key) === 'r');
	const run = rKey ? paragraphObj[rKey] : undefined;
	if (!rKey || Array.isArray(run) || !run || typeof run !== 'object') {
		paragraphObj[rKey ?? 'a:r'] = { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': text };
		return;
	}
	const runObj = run as XmlObject;
	const textKey = Object.keys(runObj).find((key) => localName(key) === 't');
	runObj[textKey ?? 'a:t'] = text;
}

/**
 * Write each connection's `label` back onto its linked `parTrans`/`sibTrans`
 * point, preserving every other point untouched. Only connections carrying a
 * `label` and a `parentTransitionId`/`siblingTransitionId` are considered;
 * `points` is mutated in place (matching `mergeSmartArtPointXml`'s
 * preserve-non-content-points-by-reference contract).
 */
export function applySmartArtConnectorLabels(
	points: XmlObject[],
	connections: PptxSmartArtConnection[],
	localName: LocalName,
): void {
	const pointsById = new Map<string, XmlObject>();
	for (const pt of points) {
		if (!pt || typeof pt !== 'object') {
			continue;
		}
		const id = String(pt['@_modelId'] ?? '').trim();
		if (id) {
			pointsById.set(id, pt);
		}
	}
	for (const connection of connections) {
		if (connection.label === undefined) {
			continue;
		}
		const transitionId = connection.parentTransitionId ?? connection.siblingTransitionId;
		if (!transitionId) {
			continue;
		}
		const point = pointsById.get(transitionId);
		if (point) {
			setPointText(point, connection.label, localName);
		}
	}
}
