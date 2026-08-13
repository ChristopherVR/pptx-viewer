/**
 * Parsing helpers for Office 2010 (p14 namespace) slide transitions
 * stored in the `p:extLst` within a `p:transition` node.
 */
import type { PptxSplitOrientation, PptxTransitionType, XmlObject } from '../types';
import { prismFamilyTypeOfNode } from './p14-prism-family';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

/** Office 2010 (p14 namespace) transition type names. */
export const P14_TRANSITION_TYPES: ReadonlySet<string> = new Set([
	'conveyor',
	'doors',
	'ferris',
	'flash',
	'flythrough',
	'gallery',
	'glitter',
	'honeycomb',
	'pan',
	'prism',
	'reveal',
	'ripple',
	'shred',
	'switch',
	'vortex',
	'warp',
	'wheelReverse',
	'window',
	'cube',
	'flip',
	'rotate',
	'orbit',
	// `box` has no p14 element of its own (it is a `p14:prism` flag combination,
	// see `p14-prism-family`), but the set doubles as "types that serialize
	// through the p14 path", so leaving it out would write `<p:box/>`.
	'box',
]);

export interface P14ParseResult {
	type: PptxTransitionType;
	direction?: string;
	orient?: PptxSplitOrientation;
	pattern?: string;
}

/** Read the `@dir` / `@orient` / `@pattern` details off a p14 transition element. */
function readP14Details(localName: string, value: unknown): P14ParseResult {
	const detail =
		value && typeof value === 'object' && !Array.isArray(value) ? (value as XmlObject) : undefined;
	// Cube, Rotate, Box and Orbit share one element and are told apart by its
	// `isContent`/`isInverted` flags. Ignoring them collapsed all four onto the
	// generic `prism` type, so a Rotate reopened as something else and the next
	// save wrote Cube.
	const type = (
		localName === 'prism' ? prismFamilyTypeOfNode(detail) : localName
	) as PptxTransitionType;
	let direction: string | undefined;
	let orient: PptxSplitOrientation | undefined;
	let pattern: string | undefined;

	if (detail) {
		const rawDir = String(detail['@_dir'] || '').trim();
		if (rawDir.length > 0) {
			direction = rawDir;
		}
		const rawOrient = String(detail['@_orient'] || '').trim();
		if (rawOrient === 'horz' || rawOrient === 'vert') {
			orient = rawOrient;
		}
		const rawPattern = String(detail['@_pattern'] || '').trim();
		if (rawPattern.length > 0) {
			pattern = rawPattern;
		}
	}

	return { type, direction, orient, pattern };
}

/**
 * Parse a p14 transition written as a DIRECT child of `p:transition`.
 *
 * Inside an `mc:Choice Requires="p14"` envelope the requirement is already
 * declared by the envelope, so PowerPoint emits e.g. `<p14:reveal dir="r"/>`
 * straight onto `p:transition` instead of routing it through the `p:extLst`
 * escape hatch (mirroring how `p159:morph` is written in its Choice form).
 */
export function parseP14DirectChild(
	transitionNode: XmlObject,
	getXmlLocalName: (xmlKey: string) => string,
): P14ParseResult | undefined {
	for (const [key, value] of Object.entries(transitionNode)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const localName = getXmlLocalName(key);
		if (P14_TRANSITION_TYPES.has(localName)) {
			return readP14Details(localName, value);
		}
	}
	return undefined;
}

/**
 * Parse p14 transition elements from the extLst XML node.
 * Structure: `<p:extLst><p:ext uri="..."><p14:XXX @dir @pattern /></p:ext></p:extLst>`
 */
export function parseP14FromExtLst(
	extLstNode: XmlObject,
	xmlLookupService: IPptxXmlLookupService,
	getXmlLocalName: (xmlKey: string) => string,
): P14ParseResult | undefined {
	const extEntries = xmlLookupService.getChildrenArrayByLocalName(extLstNode, 'ext');

	for (const ext of extEntries) {
		if (!ext) {
			continue;
		}
		for (const [key, value] of Object.entries(ext)) {
			if (key.startsWith('@_')) {
				continue;
			}
			const localName = getXmlLocalName(key);
			if (!P14_TRANSITION_TYPES.has(localName)) {
				continue;
			}

			return readP14Details(localName, value);
		}
	}
	return undefined;
}

/**
 * Build the extLst XML node for a p14 transition, preserving any
 * existing rawExtLst content alongside the p14 transition element.
 */
export function buildP14ExtLst(
	transitionType: string,
	direction: string | undefined,
	orient: string | undefined,
	pattern: string | undefined,
	rawExtLst: XmlObject | undefined,
	xmlLookupService: IPptxXmlLookupService,
	getXmlLocalName: (xmlKey: string) => string,
): XmlObject {
	const p14Child: XmlObject = {};
	const dir = String(direction || '').trim();
	if (dir.length > 0) {
		p14Child['@_dir'] = dir;
	}
	if (orient) {
		p14Child['@_orient'] = orient;
	}
	if (pattern) {
		p14Child['@_pattern'] = pattern;
	}

	const transitionExt = {
		'@_uri': '{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}',
		[`p14:${transitionType}`]: p14Child,
	} as unknown as XmlObject;

	if (rawExtLst) {
		const existing = xmlLookupService.getChildrenArrayByLocalName(rawExtLst, 'ext');
		const otherExts = existing.filter((ext) => {
			if (!ext) {
				return false;
			}
			for (const key of Object.keys(ext)) {
				if (key.startsWith('@_')) {
					continue;
				}
				const localName = getXmlLocalName(key);
				if (P14_TRANSITION_TYPES.has(localName)) {
					return false;
				}
			}
			return true;
		});
		const allExts = [transitionExt, ...otherExts];
		return { 'p:ext': allExts.length === 1 ? allExts[0] : allExts };
	}

	return { 'p:ext': transitionExt };
}
