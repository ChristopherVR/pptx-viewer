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

/** Read a `p15:prstTrans` element's `@prst` / `@invX` / `@invY` details. */
function readPrstTrans(value: unknown): P15ParseResult | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const detail = value as XmlObject;
	const prst = String(detail['@_prst'] || '').trim();
	if (!P15_TRANSITION_PRESETS.has(prst)) {
		return undefined;
	}
	return {
		type: prst as PptxTransitionType,
		invX: optionalBoolean(detail['@_invX']),
		invY: optionalBoolean(detail['@_invY']),
	};
}

/**
 * Parse a `p15:prstTrans` written as a DIRECT child of `p:transition`.
 *
 * Inside an `mc:Choice Requires="p15"` envelope the requirement is already
 * declared by the envelope, so PowerPoint emits
 * `<p15:prstTrans prst="origami"/>` straight onto `p:transition` instead of
 * routing it through the `p:extLst` escape hatch (mirroring how
 * `p159:morph` is written in its Choice form).
 */
export function parseP15DirectChild(
	transitionNode: XmlObject,
	getXmlLocalName: (xmlKey: string) => string,
): P15ParseResult | undefined {
	for (const [key, value] of Object.entries(transitionNode)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (getXmlLocalName(key) !== 'prstTrans') {
			continue;
		}
		const result = readPrstTrans(value);
		if (result) {
			return result;
		}
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
			const result = readPrstTrans(value);
			if (result) {
				return result;
			}
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
	return { 'p:ext': buildP15Ext(transitionType, invX, invY) };
}

function buildP15Ext(transitionType: string, invX?: boolean, invY?: boolean): XmlObject {
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
	return {
		'@_uri': PRSTTRANS_EXT_URI,
		'p15:prstTrans': prstTrans,
	} as unknown as XmlObject;
}

/**
 * Write a p15 preset transition into the transition's `p:extLst`, reusing the
 * deck's own `p15:prstTrans` element rather than the caller's fabricated one.
 *
 * Preserving `rawExtLst` verbatim (the previous behaviour) meant an EDIT was a
 * silent no-op: the preserved element still carried the old `@prst`, so a deck
 * that stored its transition in the extLst form re-emitted the original preset
 * however many times the user changed it. Patching `@prst` in place keeps
 * everything the model does not carry - `@invX`/`@invY`, the deck's own
 * extension URI, sibling extensions - while making the edit land. A stale p14
 * transition extension is dropped, because it would declare a second,
 * contradictory transition next to the preset.
 */
export function applyP15PresetToExtLst(args: {
	transitionType: string;
	rawExtLst: XmlObject | undefined;
	xmlLookupService: IPptxXmlLookupService;
	getXmlLocalName: (xmlKey: string) => string;
	isP14TransitionElement: (localName: string) => boolean;
}): XmlObject {
	const { transitionType, rawExtLst, xmlLookupService, getXmlLocalName } = args;
	if (!rawExtLst) {
		return buildP15ExtLst(transitionType);
	}

	const others: XmlObject[] = [];
	let patched: XmlObject | undefined;

	for (const ext of xmlLookupService.getChildrenArrayByLocalName(rawExtLst, 'ext')) {
		if (!ext) {
			continue;
		}
		const elementKeys = Object.keys(ext).filter((key) => !key.startsWith('@_'));
		const prstKey = elementKeys.find((key) => getXmlLocalName(key) === 'prstTrans');
		if (prstKey) {
			if (!patched) {
				const child = ext[prstKey];
				const updated =
					child && typeof child === 'object' && !Array.isArray(child)
						? { ...(child as XmlObject), '@_prst': transitionType }
						: { '@_prst': transitionType };
				patched = { ...ext, [prstKey]: updated } as unknown as XmlObject;
			}
			continue;
		}
		if (elementKeys.some((key) => args.isP14TransitionElement(getXmlLocalName(key)))) {
			continue;
		}
		others.push(ext);
	}

	const all = [patched ?? buildP15Ext(transitionType), ...others];
	return { 'p:ext': all.length === 1 ? all[0]! : all };
}
