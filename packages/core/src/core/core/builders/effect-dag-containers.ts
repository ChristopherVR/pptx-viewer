/**
 * Parsing and serialisation helpers for the structural container nodes
 * inside an `a:effectDag` (CT_EffectContainer):
 *
 *   * `a:cont`        — CT_EffectContainer  (recursive, `@type` = sib|tree)
 *   * `a:blend`       — CT_BlendEffect      (`@blend`, single `a:cont` child)
 *   * `a:xfrmEffect`  — CT_TransformEffect  (`@sx @sy @kx @ky @tx @ty`)
 *   * `a:relOff`      — CT_RelativeOffsetEffect (`@tx @ty`)
 *
 * Anything that isn't one of those four is preserved verbatim as a
 * {@link EffectDagRawLeaf} — we never recurse into the broader effect
 * taxonomy here. Leaf parsing is handled elsewhere (see
 * {@link PptxEffectDagExtractor}, alpha primitives in image effects, etc.).
 *
 * All four structural nodes appear under either `a:spPr/a:effectDag`
 * (shape level) or `a:rPr/a:effectDag` (run level). The helpers below are
 * agnostic of context — pass in the inner XML object of the `<a:effectDag>`
 * element and you get the typed root container back.
 */

import type {
	EffectDagBlend,
	EffectDagBlendMode,
	EffectDagContainer,
	EffectDagContainerType,
	EffectDagNode,
	EffectDagRawLeaf,
	EffectDagRelOff,
	EffectDagXfrm,
	XmlObject,
} from '../../types';

const STRUCTURAL_TAGS = new Set<string>(['a:cont', 'a:blend', 'a:xfrmEffect', 'a:relOff']);
const VALID_BLEND_MODES = new Set<EffectDagBlendMode>([
	'darken',
	'lighten',
	'mult',
	'over',
	'screen',
]);
const VALID_CONTAINER_TYPES = new Set<EffectDagContainerType>(['sib', 'tree']);

/**
 * Build an {@link EffectDagContainer} from an `a:effectDag` element body, or
 * from an `a:cont` child. Returns `undefined` when the input is missing or
 * empty.
 *
 * The top-level `<a:effectDag>` element is itself a CT_EffectContainer and
 * carries the same `@type` / `@name` attributes as a nested `<a:cont>`.
 */
export function parseEffectDagContainer(node: unknown): EffectDagContainer | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}
	const xml = node as XmlObject;
	const typeAttr = String(xml['@_type'] ?? '').trim();
	const type: EffectDagContainerType = VALID_CONTAINER_TYPES.has(typeAttr as EffectDagContainerType)
		? (typeAttr as EffectDagContainerType)
		: 'sib';
	const nameAttr = String(xml['@_name'] ?? '').trim();
	const children = parseChildren(xml);
	const container: EffectDagContainer = {
		kind: 'cont',
		type,
		children,
	};
	if (nameAttr) {
		container.name = nameAttr;
	}
	return container;
}

/**
 * Build a typed effect graph from the raw XML of an `<a:effectDag>` element.
 * Convenience wrapper around {@link parseEffectDagContainer} for callers
 * that already have the raw blob preserved by the legacy code path.
 */
export function buildEffectDagTreeFromXml(
	effectDagXml: XmlObject | undefined,
): EffectDagContainer | undefined {
	return parseEffectDagContainer(effectDagXml);
}

/**
 * Serialise a typed {@link EffectDagContainer} back to an XML object suitable
 * for assignment to either `spPr['a:effectDag']` (shape-level) or
 * `rPr['a:effectDag']` (run-level). Returns `undefined` for empty inputs so
 * callers can elide the element entirely.
 */
export function serializeEffectDagContainer(
	container: EffectDagContainer | undefined,
): XmlObject | undefined {
	if (!container) {
		return undefined;
	}
	return serializeContainer(container, /*omitTypeIfDefault*/ false);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function parseChildren(xml: XmlObject): EffectDagNode[] {
	const children: EffectDagNode[] = [];
	for (const [key, rawValue] of Object.entries(xml)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (key === '#text') {
			continue;
		}
		const values = ensureArray(rawValue);
		for (const value of values) {
			const child = parseChild(key, value);
			if (child) {
				children.push(child);
			}
		}
	}
	return children;
}

function parseChild(tag: string, value: unknown): EffectDagNode | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	if (tag === 'a:cont') {
		return parseEffectDagContainer(value);
	}
	if (tag === 'a:blend') {
		return parseBlend(value);
	}
	if (tag === 'a:xfrmEffect') {
		return parseXfrm(value);
	}
	if (tag === 'a:relOff') {
		return parseRelOff(value);
	}
	// Anything else — preserve verbatim. Leaf parsing (outerShdw, glow,
	// alphaInv, etc.) is delegated to the existing extractors so we don't
	// duplicate the entire effect taxonomy here.
	if (STRUCTURAL_TAGS.has(tag)) {
		return undefined;
	}
	const localTag = tag.startsWith('a:') ? tag.slice(2) : tag;
	const xml =
		typeof value === 'object' ? (value as Record<string, unknown>) : { '#text': String(value) };
	const leaf: EffectDagRawLeaf = {
		kind: 'raw',
		tag: localTag,
		xml,
	};
	return leaf;
}

function parseBlend(value: unknown): EffectDagBlend | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const xml = value as XmlObject;
	const modeAttr = String(xml['@_blend'] ?? '')
		.trim()
		.toLowerCase();
	const mode: EffectDagBlendMode = VALID_BLEND_MODES.has(modeAttr as EffectDagBlendMode)
		? (modeAttr as EffectDagBlendMode)
		: 'over';
	const contNode = xml['a:cont'];
	const container = parseEffectDagContainer(Array.isArray(contNode) ? contNode[0] : contNode) ?? {
		kind: 'cont',
		type: 'sib',
		children: [],
	};
	return {
		kind: 'blend',
		mode,
		container,
	};
}

function parseXfrm(value: unknown): EffectDagXfrm | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const xml = value as XmlObject;
	const node: EffectDagXfrm = { kind: 'xfrmEffect' };
	const sx = parseIntAttr(xml['@_sx']);
	if (sx !== undefined) {
		node.sx = sx;
	}
	const sy = parseIntAttr(xml['@_sy']);
	if (sy !== undefined) {
		node.sy = sy;
	}
	const kx = parseIntAttr(xml['@_kx']);
	if (kx !== undefined) {
		node.kx = kx;
	}
	const ky = parseIntAttr(xml['@_ky']);
	if (ky !== undefined) {
		node.ky = ky;
	}
	const tx = parseIntAttr(xml['@_tx']);
	if (tx !== undefined) {
		node.tx = tx;
	}
	const ty = parseIntAttr(xml['@_ty']);
	if (ty !== undefined) {
		node.ty = ty;
	}
	return node;
}

function parseRelOff(value: unknown): EffectDagRelOff | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const xml = value as XmlObject;
	const node: EffectDagRelOff = { kind: 'relOff' };
	const tx = parseIntAttr(xml['@_tx']);
	if (tx !== undefined) {
		node.tx = tx;
	}
	const ty = parseIntAttr(xml['@_ty']);
	if (ty !== undefined) {
		node.ty = ty;
	}
	return node;
}

function parseIntAttr(raw: unknown): number | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const parsed = Number.parseInt(String(raw), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

function serializeContainer(container: EffectDagContainer, omitTypeIfDefault: boolean): XmlObject {
	const xml: XmlObject = {};
	// `@type` is required on CT_EffectContainer per ECMA-376 §20.1.8.20 —
	// emit it even when "sib" is the schema default so PowerPoint never has
	// to fall back to its repair dialog.
	if (!omitTypeIfDefault || container.type !== 'sib') {
		xml['@_type'] = container.type;
	}
	if (container.name) {
		xml['@_name'] = container.name;
	}
	for (const child of container.children) {
		appendChild(xml, child);
	}
	return xml;
}

function appendChild(parent: XmlObject, child: EffectDagNode): void {
	switch (child.kind) {
		case 'cont': {
			pushKeyed(parent, 'a:cont', serializeContainer(child, /*omitTypeIfDefault*/ false));
			return;
		}
		case 'blend': {
			pushKeyed(parent, 'a:blend', serializeBlend(child));
			return;
		}
		case 'xfrmEffect': {
			pushKeyed(parent, 'a:xfrmEffect', serializeXfrm(child));
			return;
		}
		case 'relOff': {
			pushKeyed(parent, 'a:relOff', serializeRelOff(child));
			return;
		}
		case 'raw': {
			const tag = child.tag.startsWith('a:') ? child.tag : `a:${child.tag}`;
			pushKeyed(parent, tag, child.xml as XmlObject);
			return;
		}
		default: {
			// Exhaustiveness check.
			const _exhaustive: never = child;
			void _exhaustive;
		}
	}
}

function pushKeyed(parent: XmlObject, key: string, value: XmlObject): void {
	const existing = parent[key];
	if (existing === undefined) {
		parent[key] = value;
		return;
	}
	if (Array.isArray(existing)) {
		(existing as XmlObject[]).push(value);
		return;
	}
	parent[key] = [existing as XmlObject, value];
}

function serializeBlend(node: EffectDagBlend): XmlObject {
	return {
		'@_blend': node.mode,
		'a:cont': serializeContainer(node.container, /*omitTypeIfDefault*/ false),
	};
}

function serializeXfrm(node: EffectDagXfrm): XmlObject {
	const xml: XmlObject = {};
	if (node.sx !== undefined) {
		xml['@_sx'] = String(node.sx);
	}
	if (node.sy !== undefined) {
		xml['@_sy'] = String(node.sy);
	}
	if (node.kx !== undefined) {
		xml['@_kx'] = String(node.kx);
	}
	if (node.ky !== undefined) {
		xml['@_ky'] = String(node.ky);
	}
	if (node.tx !== undefined) {
		xml['@_tx'] = String(node.tx);
	}
	if (node.ty !== undefined) {
		xml['@_ty'] = String(node.ty);
	}
	return xml;
}

function serializeRelOff(node: EffectDagRelOff): XmlObject {
	const xml: XmlObject = {};
	if (node.tx !== undefined) {
		xml['@_tx'] = String(node.tx);
	}
	if (node.ty !== undefined) {
		xml['@_ty'] = String(node.ty);
	}
	return xml;
}
