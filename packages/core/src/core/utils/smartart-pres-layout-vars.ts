/**
 * Parse DiagramML presentation layout variables.
 *
 * Presentation layout variables appear either as `dgm:prSet/dgm:presLayoutVars`
 * on a data-model point or as `dgm:varLst` (the layout definition's defaults).
 * Both share the same child elements (`dir`, `hierBranch`, `orgChart`, `chMax`,
 * `chPref`, `bulletEnabled`, `animLvl`, `animOne`, `resizeHandles`), each a
 * self-closing element carrying a single `@val` attribute.
 *
 * These variables drive the DiagramML layout interpreter (flow direction,
 * hierarchy branch style, org-chart mode). The full geometry interpreter is out
 * of scope here; this parser only lifts the variables into the typed model so
 * the fallback layout engine can consult direction / org-chart hints.
 *
 * @module smartart-pres-layout-vars
 */

import type { PptxSmartArtPresLayoutVars, XmlObject } from '../types';

const CONTAINER_LOCAL_NAMES = new Set(['presLayoutVars', 'varLst']);

function localNameOf(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

/** Depth-first search for the first `presLayoutVars`/`varLst` element. */
function findVarsContainer(node: unknown): XmlObject | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}
	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findVarsContainer(entry);
			if (found) {
				return found;
			}
		}
		return undefined;
	}
	for (const [key, value] of Object.entries(node as XmlObject)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (CONTAINER_LOCAL_NAMES.has(localNameOf(key))) {
			const container = Array.isArray(value) ? value[0] : value;
			if (container && typeof container === 'object') {
				return container as XmlObject;
			}
		}
		const nested = findVarsContainer(value);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}

/** Read the `@val` of a named child element of the variables container. */
function varValue(container: XmlObject, name: string): string | undefined {
	for (const [key, value] of Object.entries(container)) {
		if (key.startsWith('@_') || localNameOf(key) !== name) {
			continue;
		}
		const node = Array.isArray(value) ? value[0] : value;
		if (node && typeof node === 'object') {
			const raw = (node as XmlObject)['@_val'];
			const str = String(raw ?? '').trim();
			return str.length > 0 ? str : undefined;
		}
	}
	return undefined;
}

function boolValue(container: XmlObject, name: string): boolean | undefined {
	const raw = varValue(container, name);
	if (raw === undefined) {
		return undefined;
	}
	const lower = raw.toLowerCase();
	return lower === '1' || lower === 'true' || lower === 'on';
}

function intValue(container: XmlObject, name: string): number | undefined {
	const raw = varValue(container, name);
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

const DIRECTIONS = new Set(['norm', 'rev']);
const HIER_BRANCHES = new Set(['std', 'init', 'l', 'r', 'hang']);

/**
 * Parse `presLayoutVars` / `varLst` from a container (a data-model point/prSet,
 * a data-model root, or a layout definition). Returns `undefined` when no
 * variables element is present or none of its values are recognised.
 */
export function parseSmartArtPresLayoutVars(
	container: XmlObject | undefined,
): PptxSmartArtPresLayoutVars | undefined {
	if (!container) {
		return undefined;
	}
	const vars = findVarsContainer(container);
	if (!vars) {
		return undefined;
	}

	const result: PptxSmartArtPresLayoutVars = {};

	const direction = varValue(vars, 'dir');
	if (direction && DIRECTIONS.has(direction)) {
		result.direction = direction as PptxSmartArtPresLayoutVars['direction'];
	}
	const hierBranch = varValue(vars, 'hierBranch');
	if (hierBranch && HIER_BRANCHES.has(hierBranch)) {
		result.hierarchyBranch = hierBranch as PptxSmartArtPresLayoutVars['hierarchyBranch'];
	}
	const orgChart = boolValue(vars, 'orgChart');
	if (orgChart !== undefined) {
		result.orgChart = orgChart;
	}
	const chMax = intValue(vars, 'chMax');
	if (chMax !== undefined) {
		result.childMax = chMax;
	}
	const chPref = intValue(vars, 'chPref');
	if (chPref !== undefined) {
		result.childPreferred = chPref;
	}
	const bulletEnabled = boolValue(vars, 'bulletEnabled');
	if (bulletEnabled !== undefined) {
		result.bulletEnabled = bulletEnabled;
	}
	const animLvl = varValue(vars, 'animLvl');
	if (animLvl !== undefined) {
		result.animationLevel = animLvl;
	}
	const animOne = varValue(vars, 'animOne');
	if (animOne !== undefined) {
		result.animateOne = animOne;
	}
	const resizeHandles = varValue(vars, 'resizeHandles');
	if (resizeHandles !== undefined) {
		result.resizeHandles = resizeHandles;
	}

	return Object.keys(result).length > 0 ? result : undefined;
}
