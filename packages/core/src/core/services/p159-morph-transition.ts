/**
 * Parsing and building helpers for the PowerPoint 2016+ (p159 namespace)
 * `morph` slide transition. Morph is written either as a
 * `p:transition/p:extLst/p:ext/p159:morph` extension or, inside an
 * `mc:Choice Requires="p159"` envelope, as a direct `<p159:morph/>` child
 * of `p:transition`.
 */
import type { PptxMorphOption, XmlObject } from '../types';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';
import { normalizeMorphOption } from './slide-transition-xml';

/**
 * Extension URI for the PowerPoint 2016+ `morph` slide transition.
 * Stored in `p:transition/p:extLst/p:ext[@uri="{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}"]/p159:morph`.
 */
export const MORPH_EXT_URI = '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}';

/**
 * Detects the PowerPoint 2016+ `morph` transition stored as a p159 extension
 * inside the transition's extLst.
 */
export function parseMorphFromExtLst(
	extLstNode: XmlObject,
	xmlLookupService: IPptxXmlLookupService,
	getXmlLocalName: (xmlKey: string) => string,
): { morphOption: PptxMorphOption | undefined } | undefined {
	const extEntries = xmlLookupService.getChildrenArrayByLocalName(extLstNode, 'ext');
	for (const ext of extEntries) {
		if (!ext) {
			continue;
		}
		for (const [key, value] of Object.entries(ext)) {
			if (key.startsWith('@_')) {
				continue;
			}
			// Accept the morph element on its own: real packages vary the
			// `@uri` casing/whitespace, and the element name is unambiguous.
			if (getXmlLocalName(key) === 'morph') {
				return {
					morphOption: normalizeMorphOption((value as XmlObject | undefined)?.['@_option']),
				};
			}
		}
	}
	return undefined;
}

/**
 * True when the (preserved) transition node already carries a `morph`
 * element as a direct child, in any namespace prefix.
 */
export function hasDirectMorphChild(
	node: XmlObject,
	getXmlLocalName: (xmlKey: string) => string,
): boolean {
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_') && getXmlLocalName(key) === 'morph') {
			return true;
		}
	}
	return false;
}

/**
 * Build the extLst XML node for a morph (p159) transition, preserving any
 * non-morph extensions from rawExtLst.
 */
export function buildMorphExtLst(
	rawExtLst: XmlObject | undefined,
	morphOption: PptxMorphOption | undefined,
	xmlLookupService: IPptxXmlLookupService,
	getXmlLocalName: (xmlKey: string) => string,
): XmlObject {
	const morphNode: XmlObject = {
		'@_xmlns:p159': 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
	};
	if (morphOption) {
		morphNode['@_option'] = morphOption;
	}
	const morphExt: XmlObject = {
		'@_uri': MORPH_EXT_URI,
		'p159:morph': morphNode,
	};

	if (!rawExtLst) {
		return { 'p:ext': morphExt };
	}

	const existing = xmlLookupService.getChildrenArrayByLocalName(rawExtLst, 'ext');
	const otherExts = existing.filter((ext) => {
		if (!ext) {
			return false;
		}
		const uri = String(ext['@_uri'] || '').trim();
		if (uri.toUpperCase() === MORPH_EXT_URI.toUpperCase()) {
			return false;
		}
		for (const key of Object.keys(ext)) {
			if (key.startsWith('@_')) {
				continue;
			}
			if (getXmlLocalName(key) === 'morph') {
				return false;
			}
		}
		return true;
	});
	const allExts = [morphExt, ...otherExts];
	return { 'p:ext': allExts.length === 1 ? allExts[0] : allExts };
}
