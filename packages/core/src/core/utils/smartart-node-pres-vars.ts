/**
 * Per-node layout variables from the data model's presentation points.
 *
 * PowerPoint writes one `dgm:pt[@type="pres"]` per layout node instance, tied
 * to its content point by `dgm:prSet/@presAssocID` and to the layout node by
 * `@presName`; its `dgm:presLayoutVars` holds the variables that instance
 * runs with. A user's per-node choice lives there and nowhere else: "Left
 * Hanging" on one org-chart manager is `<dgm:hierBranch val="l"/>` on that
 * manager's `presName="hierRoot1"` point (`smartart-orgchart-hierbranch.pptx`),
 * while every other manager's point keeps the definition's `init`.
 *
 * @module smartart-node-pres-vars
 */

import type { XmlObject } from '../types';

type LocalName = (key: string) => string;

function children(node: XmlObject | undefined, name: string, localName: LocalName): XmlObject[] {
	if (!node) {
		return [];
	}
	const out: XmlObject[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') || localName(key) !== name) {
			continue;
		}
		for (const entry of Array.isArray(value) ? value : [value]) {
			if (entry && typeof entry === 'object') {
				out.push(entry as XmlObject);
			}
		}
	}
	return out;
}

/** The `val` of every variable element inside a `presLayoutVars`. */
function variablesOf(vars: XmlObject, localName: LocalName): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(vars)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const entry = (Array.isArray(value) ? value[0] : value) as XmlObject | undefined;
		const val = entry && typeof entry === 'object' ? entry['@_val'] : undefined;
		if (val !== undefined && String(val).trim() !== '') {
			out[localName(key)] = String(val).trim();
		}
	}
	return out;
}

/**
 * Resolve `contentNodeId -> presName -> { variable: value }` from every
 * presentation point that declares any layout variable.
 */
export function resolveSmartArtNodePresVars(
	points: XmlObject[],
	localName: LocalName,
): Map<string, Record<string, Record<string, string>>> {
	const out = new Map<string, Record<string, Record<string, string>>>();
	for (const pt of points) {
		if (!pt || typeof pt !== 'object' || String(pt['@_type'] ?? '').trim() !== 'pres') {
			continue;
		}
		const prSet = children(pt, 'prSet', localName)[0];
		const nodeId = String(prSet?.['@_presAssocID'] ?? '').trim();
		const presName = String(prSet?.['@_presName'] ?? '').trim();
		const vars = children(prSet, 'presLayoutVars', localName)[0];
		if (!nodeId || !presName || !vars) {
			continue;
		}
		const values = variablesOf(vars, localName);
		if (Object.keys(values).length === 0) {
			continue;
		}
		const byName = out.get(nodeId) ?? {};
		byName[presName] = values;
		out.set(nodeId, byName);
	}
	return out;
}
