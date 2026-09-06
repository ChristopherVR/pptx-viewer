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
 * ## Genuine PowerPoint markup scatters these across MULTIPLE containers
 *
 * A hand-built fixture puts every variable in one `dgm:presLayoutVars` block,
 * which is what the generic depth-first scan below finds. A real
 * PowerPoint-authored org chart does NOT: its data model's `dgm:ptLst` carries
 * one `dgm:pt[@type="pres"]` PER NODE in the presentation tree (`hierChild1`,
 * `hierRoot1`, `rootText1`, `hierChild2`, `hierRoot2`, ...), and each one's own
 * `dgm:prSet/dgm:presLayoutVars` carries only the subset of variables that
 * layout scope defines. Measured against five genuine COM-authored org-chart
 * fixtures (`smartart-orgchart-hierbranch.pptx` / `smartart-orgchart-many.pptx`
 * in the corpus):
 *
 *   - `hierBranch` (the actual Standard/Both/Left/Right Hanging choice) lives
 *     on the `presName="hierRoot1"` point, NOT on the generic first container
 *     (`hierChild1`, which never carries `hierBranch` at all). A plain
 *     depth-first scan that stops at the first match therefore NEVER sees
 *     `hierBranch` in genuine PowerPoint output.
 *   - Every non-root `hierRootN` (a manager's own subtree, once you are two
 *     generations deep) defaults to `hierBranch="init"` REGARDLESS of what the
 *     diagram root's own branch is: this is baked into the org-chart layout
 *     definition's nested `varLst`, not a per-document choice. When
 *     `hierRoot1` itself carries no explicit `hierBranch` (the "Standard"
 *     choice), the rendered result still matches `init` (root's own children
 *     fan out; everything deeper hangs), because that nested default is what
 *     actually governs it.
 *   - `chMax`/`chPref` on the generic first container (`hierChild1`) is a
 *     structural stub value (`chPref="1"`, associated with the invisible
 *     document root) and is NOT the manager's own wrap threshold. The real
 *     value (`chPref="3"` in every sampled fixture; it is a layout-definition
 *     constant, not user-adjustable) lives on `presName="rootText1"`.
 *
 * `findNamedPresVars` below targets those two specific presentation-tree
 * names directly, overriding whatever the generic scan found. It is additive:
 * when a data model has no `hierRoot1`/`rootText1` (a hand-built fixture, or a
 * non-org-chart layout), the lookups simply find nothing and the generic scan
 * result stands, so existing simple-fixture behaviour is unchanged.
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

/** The `dgm:prSet/@presName` of a `dgm:pt`, when it has one. */
function presNameOf(pt: XmlObject): string | undefined {
	for (const [key, value] of Object.entries(pt)) {
		if (key.startsWith('@_') || localNameOf(key) !== 'prSet') {
			continue;
		}
		const prSet = Array.isArray(value) ? value[0] : value;
		if (prSet && typeof prSet === 'object') {
			const name = (prSet as XmlObject)['@_presName'];
			return typeof name === 'string' ? name : undefined;
		}
	}
	return undefined;
}

/**
 * Depth-first search for a `dgm:pt` whose own `dgm:prSet/@presName` equals
 * `presName` (e.g. `"hierRoot1"`, `"rootText1"`), returning ITS
 * `presLayoutVars`/`varLst` container. See the module doc comment: genuine
 * PowerPoint markup scatters presentation-tree-scoped variables across many
 * such points, keyed by this name, rather than one shared container.
 */
function findNamedPresVars(node: unknown, presName: string): XmlObject | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}
	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findNamedPresVars(entry, presName);
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
		if (localNameOf(key) === 'pt') {
			for (const pt of Array.isArray(value) ? value : [value]) {
				if (pt && typeof pt === 'object' && presNameOf(pt as XmlObject) === presName) {
					const vars = findVarsContainer(pt);
					if (vars) {
						return vars;
					}
				}
			}
		}
		const nested = findNamedPresVars(value, presName);
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

	// Genuine PowerPoint org-chart markup scopes `hierBranch` to the
	// `hierRoot1` presentation point and `chMax`/`chPref` to `rootText1`; see
	// the module doc comment. Override whatever the generic scan above found
	// (or fill the gap it left) when this data model has that shape.
	const hierRootVars = findNamedPresVars(container, 'hierRoot1');
	if (hierRootVars) {
		const rootHierBranch = varValue(hierRootVars, 'hierBranch');
		if (rootHierBranch && HIER_BRANCHES.has(rootHierBranch)) {
			result.hierarchyBranch = rootHierBranch as PptxSmartArtPresLayoutVars['hierarchyBranch'];
		} else if (result.hierarchyBranch === undefined) {
			// "Standard" (no explicit override on the root) still renders with
			// a hanging tail past the root's own children, because deeper
			// `hierRootN` points default to `hierBranch="init"` unconditionally
			// (a layout-definition constant, not a per-document choice).
			// Measured against `smartart-orgchart-hierbranch.pptx`.
			result.hierarchyBranch = 'init';
		}
	}
	const rootTextVars = findNamedPresVars(container, 'rootText1');
	if (rootTextVars) {
		const rootChMax = intValue(rootTextVars, 'chMax');
		if (rootChMax !== undefined) {
			result.childMax = rootChMax;
		}
		const rootChPref = intValue(rootTextVars, 'chPref');
		if (rootChPref !== undefined) {
			result.childPreferred = rootChPref;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}
