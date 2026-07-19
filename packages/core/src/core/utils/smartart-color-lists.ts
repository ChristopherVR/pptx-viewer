/**
 * SmartArt colour-list resolution for `ppt/diagrams/colors*.xml`.
 *
 * A `dgm:styleLbl` may carry multi-colour lists (`fillClrLst`, `linClrLst`,
 * `txFillClrLst`, `txLinClrLst`, `effectClrLst`, `txEffectClrLst`), each with a
 * `meth` (span/cycle/repeat) and `hueDir` (cw/ccw) attribute driving how the
 * palette spreads across sibling nodes. The legacy parser only kept the first
 * colour of the fill/line lists, collapsing schemes like "Colorful - Accent
 * Colors" (which spread accent1..accent6 from a single styleLbl) down to one
 * accent. These helpers resolve the FULL ordered colour lists so the fallback
 * renderer can cycle/interpolate them across nodes.
 *
 * Pure functions over injected XML accessors + the runtime's colour codec, so
 * they stay unit-testable without a live `PptxHandler`.
 *
 * @module smartart-color-lists
 */

import type { XmlObject } from '../types';
import type { PptxSmartArtColorListMetadata } from '../types/smart-art-style-definition';

/** Injected XML/colour accessors so this module needs no runtime instance. */
export interface SmartArtColorListDeps {
	/** First child element by local name. */
	getChild: (node: XmlObject | undefined, name: string) => XmlObject | undefined;
	/**
	 * Resolve a single DrawingML colour container (e.g. `{ 'a:schemeClr': … }`)
	 * to a hex string, applying lum/shade/tint transforms. Mirrors the runtime
	 * `parseColor` / `parseColorChoice`.
	 */
	parseColorChoice: (colorChoice: XmlObject | undefined) => string | undefined;
	/** Fallback: resolve a bare `schemeClr`/`srgbClr` node against the theme map. */
	resolveScheme: (colorNode: XmlObject | undefined) => string | undefined;
}

/** Resolved colour lists + interpolation metadata for the primary node styleLbl. */
export interface SmartArtColorLists {
	fillColors: string[];
	lineColors: string[];
	textFillColors?: string[];
	textLineColors?: string[];
	effectColors?: string[];
	textEffectColors?: string[];
	fillInterpolation?: PptxSmartArtColorListMetadata;
	lineInterpolation?: PptxSmartArtColorListMetadata;
}

const COLOR_LOCAL_NAMES = new Set([
	'srgbClr',
	'schemeClr',
	'scrgbClr',
	'sysClr',
	'prstClr',
	'hslClr',
]);
const COLOR_METHODS = new Set(['span', 'cycle', 'repeat']);
const HUE_DIRECTIONS = new Set(['cw', 'ccw']);

/** Node-style label names, most-specific first, that define the fill palette. */
const PRIMARY_LABEL_PRIORITY = ['node0', 'node1', 'node2', 'node3', 'node4', 'node'];

function localNameOf(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

/**
 * Resolve every colour entry of a `dgm:*ClrLst` node, in document order, to a
 * hex string. Unlike the legacy single-colour read, this keeps the full list so
 * multi-colour ("colorful") schemes spread instead of collapsing.
 */
export function parseSmartArtColorListHexes(
	list: XmlObject | undefined,
	deps: SmartArtColorListDeps,
): string[] {
	if (!list) {
		return [];
	}
	const out: string[] = [];
	for (const [key, value] of Object.entries(list)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const local = localNameOf(key);
		if (!COLOR_LOCAL_NAMES.has(local)) {
			continue;
		}
		const nodes = Array.isArray(value) ? value : [value];
		for (const node of nodes) {
			if (!node || typeof node !== 'object') {
				continue;
			}
			const wrapper = { [`a:${local}`]: node } as XmlObject;
			const hex = deps.parseColorChoice(wrapper) ?? deps.resolveScheme(node as XmlObject);
			if (hex) {
				out.push(hex);
			}
		}
	}
	return out;
}

/** Read the `meth`/`hueDir` interpolation metadata off a colour-list node. */
function listInterpolation(list: XmlObject | undefined): PptxSmartArtColorListMetadata | undefined {
	if (!list) {
		return undefined;
	}
	const method = String(list['@_meth'] ?? '').trim();
	const hueDir = String(list['@_hueDir'] ?? '').trim();
	const meta: PptxSmartArtColorListMetadata = {};
	if (COLOR_METHODS.has(method)) {
		meta.method = method as PptxSmartArtColorListMetadata['method'];
	}
	if (HUE_DIRECTIONS.has(hueDir)) {
		meta.hueDirection = hueDir as PptxSmartArtColorListMetadata['hueDirection'];
	}
	return meta.method || meta.hueDirection ? meta : undefined;
}

interface ParsedLabel {
	name: string;
	fill: string[];
	line: string[];
	textFill: string[];
	textLine: string[];
	effect: string[];
	textEffect: string[];
	fillInterpolation?: PptxSmartArtColorListMetadata;
	lineInterpolation?: PptxSmartArtColorListMetadata;
}

function parseLabel(lbl: XmlObject, deps: SmartArtColorListDeps): ParsedLabel {
	const fillList = deps.getChild(lbl, 'fillClrLst');
	const lineList = deps.getChild(lbl, 'linClrLst');
	return {
		name: String(lbl['@_name'] ?? '').trim(),
		fill: parseSmartArtColorListHexes(fillList, deps),
		line: parseSmartArtColorListHexes(lineList, deps),
		textFill: parseSmartArtColorListHexes(deps.getChild(lbl, 'txFillClrLst'), deps),
		textLine: parseSmartArtColorListHexes(deps.getChild(lbl, 'txLinClrLst'), deps),
		effect: parseSmartArtColorListHexes(deps.getChild(lbl, 'effectClrLst'), deps),
		textEffect: parseSmartArtColorListHexes(deps.getChild(lbl, 'txEffectClrLst'), deps),
		fillInterpolation: listInterpolation(fillList),
		lineInterpolation: listInterpolation(lineList),
	};
}

/** Pick the styleLbl that defines the node fill palette. */
function selectPrimary(parsed: ParsedLabel[]): ParsedLabel | undefined {
	const byName = new Map(parsed.map((p) => [p.name, p]));
	for (const name of PRIMARY_LABEL_PRIORITY) {
		const candidate = byName.get(name);
		if (candidate && candidate.fill.length > 0) {
			return candidate;
		}
	}
	for (const name of PRIMARY_LABEL_PRIORITY) {
		const candidate = byName.get(name);
		if (candidate && (candidate.line.length > 0 || candidate.fill.length > 0)) {
			return candidate;
		}
	}
	return parsed.find((p) => p.fill.length > 0) ?? parsed.find((p) => p.line.length > 0);
}

/**
 * Resolve the SmartArt colour palette from a colour-transform part's styleLbls.
 *
 * The primary node styleLbl's FULL fill list becomes the cycling palette (so a
 * 3-colour "colorful" list spreads across 3 nodes instead of collapsing). When
 * no node styleLbl is recognised, falls back to the legacy behaviour of taking
 * the first colour of each styleLbl's list.
 */
export function buildSmartArtColorLists(
	styleLbls: XmlObject[],
	deps: SmartArtColorListDeps,
): SmartArtColorLists {
	const parsed = styleLbls.map((lbl) => parseLabel(lbl, deps));
	const primary = selectPrimary(parsed);

	let fillColors = primary?.fill ?? [];
	let lineColors = primary?.line ?? [];
	if (fillColors.length === 0) {
		fillColors = parsed.map((p) => p.fill[0]).filter((c): c is string => Boolean(c));
	}
	if (lineColors.length === 0) {
		lineColors = parsed.map((p) => p.line[0]).filter((c): c is string => Boolean(c));
	}

	const result: SmartArtColorLists = { fillColors, lineColors };
	if (primary?.textFill.length) {
		result.textFillColors = primary.textFill;
	}
	if (primary?.textLine.length) {
		result.textLineColors = primary.textLine;
	}
	if (primary?.effect.length) {
		result.effectColors = primary.effect;
	}
	if (primary?.textEffect.length) {
		result.textEffectColors = primary.textEffect;
	}
	if (primary?.fillInterpolation) {
		result.fillInterpolation = primary.fillInterpolation;
	}
	if (primary?.lineInterpolation) {
		result.lineInterpolation = primary.lineInterpolation;
	}
	return result;
}
