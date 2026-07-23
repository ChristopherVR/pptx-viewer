/**
 * Parsing helpers for PowerPoint 2013+/365 (p15 namespace) slide
 * transitions stored as a `p15:prstTrans` element inside the
 * `p:extLst` within a `p:transition` node.
 *
 * These "preset" transitions (Fracture, Peel Off, Page Curl, Airplane,
 * Origami, Fall Over, Drape, Curtains, Wind, Prestige, Crush) are not
 * standard OOXML transition children: they live in an extension list and
 * carry their effect name in the `@prst` attribute, e.g.
 * `<p15:prstTrans prst="fracture"/>`.
 */
import type { PptxTransitionType, XmlObject } from '../types';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

/**
 * Preset transition names carried by `p15:prstTrans/@prst`.
 * Values mirror `ST_PresetTransition` from the p15 schema
 * (`http://schemas.microsoft.com/office/powerpoint/2012/main`).
 */
export const P15_TRANSITION_PRESETS: ReadonlySet<string> = new Set([
	'fallOver',
	'drape',
	'curtains',
	'wind',
	'prestige',
	'fracture',
	'crush',
	'peelOff',
	'pageCurlDouble',
	'pageCurlSingle',
	'airplane',
	'origami',
]);

/**
 * Well-known extension URI PowerPoint uses for the preset-transition
 * extension. Only used when fabricating an extLst for a p15 transition
 * that has no preserved `rawExtLst`; real files round-trip their own URI
 * via `rawExtLst`.
 */
export const PRSTTRANS_EXT_URI = '{D42A27DB-BD31-4B8C-83A1-F6EECF244321}';

export interface P15ParseResult {
	type: PptxTransitionType;
	invX?: boolean;
	invY?: boolean;
}

function optionalBoolean(value: unknown): boolean | undefined {
	const valueToken =
		value === undefined || value === null ? '' : String(value).trim().toLowerCase();
	if (valueToken === '1' || valueToken === 'true') {
		return true;
	}
	if (valueToken === '0' || valueToken === 'false') {
		return false;
	}
	return undefined;
}

/**
 * Parse a `p15:prstTrans` preset transition from the transition's extLst
 * XML node. Walks the `p:ext` entries (mirroring the p14 parser) and, for
 * the first `prstTrans` child found, maps its `@prst` value to a
 * transition type.
 */
export function parseP15FromExtLst(
	extLstNode: XmlObject,
	xmlLookupService: IPptxXmlLookupService,
	getXmlLocalName: (xmlKey: string) => string,
): P15ParseResult | undefined {
	const extEntries = xmlLookupService.getChildrenArrayByLocalName(extLstNode, 'ext');

	for (const ext of extEntries) {
		if (!ext) {
			continue;
		}
		for (const [key, value] of Object.entries(ext)) {
			if (key.startsWith('@_')) {
				continue;
			}
			if (getXmlLocalName(key) !== 'prstTrans') {
				continue;
			}
			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				continue;
			}
			const detail = value as XmlObject;
			const prst = String(detail['@_prst'] || '').trim();
			if (!P15_TRANSITION_PRESETS.has(prst)) {
				continue;
			}
			return {
				type: prst as PptxTransitionType,
				invX: optionalBoolean(detail['@_invX']),
				invY: optionalBoolean(detail['@_invY']),
			};
		}
	}
	return undefined;
}

/**
 * Build a fabricated extLst node carrying a `p15:prstTrans` element for
 * the given preset. Used only when serializing a p15 transition that has
 * no preserved `rawExtLst` (e.g. one constructed programmatically); when
 * `rawExtLst` is present the caller preserves those bytes verbatim.
 */
export function buildP15ExtLst(transitionType: string, invX?: boolean, invY?: boolean): XmlObject {
	const prstTrans: XmlObject = {
		'@_xmlns:p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main',
		'@_prst': transitionType,
	};
	if (invX === true) {
		prstTrans['@_invX'] = '1';
	}
	if (invY === true) {
		prstTrans['@_invY'] = '1';
	}
	const ext = {
		'@_uri': PRSTTRANS_EXT_URI,
		'p15:prstTrans': prstTrans,
	} as unknown as XmlObject;
	return { 'p:ext': ext };
}
