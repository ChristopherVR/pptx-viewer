import { P14_TRANSITION_TYPES } from '../services/p14-transition-parser';
import type { XmlObject } from '../types';

/** The ChartEx (2014 chartex) elements this package understands. */
const CHART_EX_ELEMENTS = [
	'chart',
	'plotArea',
	'plotAreaRegion',
	'series',
	'data',
	'numDim',
	'strDim',
] as const;

/**
 * Highest numbered ChartEx prefix PowerPoint is known to allocate. Each chartex
 * part in a deck gets its own binding (`cx1`, `cx2`, ...).
 */
const MAX_CHART_EX_PREFIX = 8;

/** Register `cx1` .. `cx8` with the same capability set as bare `cx`. */
function chartExPrefixCapabilities(): Record<string, ReadonlySet<string>> {
	const entries: Record<string, ReadonlySet<string>> = {};
	for (let n = 1; n <= MAX_CHART_EX_PREFIX; n++) {
		entries[`cx${n}`] = new Set(CHART_EX_ELEMENTS);
	}
	return entries;
}

const MC_NAMESPACE_CAPABILITIES: Readonly<Record<string, ReadonlySet<string>>> = {
	// Office 2010 (p14) transitions are shared with the parser's canonical
	// list (`P14_TRANSITION_TYPES`) so the two can never drift apart again:
	// this set used to be a hand-copied subset that was missing `reveal` and
	// `ripple`, so every `mc:Choice Requires="p14"` carrying one of them
	// reported `UNSUPPORTED_ALTERNATE_CONTENT_CHOICE` and silently used the
	// fallback fade even though the parser handles both. The extra names are
	// the non-transition p14 features we also parse.
	p14: new Set([
		...P14_TRANSITION_TYPES,
		'transition',
		'newsflash',
		'media',
		'trim',
		'fade',
		'bmkLst',
		'bmk',
		'hiddenFill',
		'hiddenLine',
		// Ink. PowerPoint writes every inked stroke as
		// `mc:Choice Requires="p14"` wrapping a `p:contentPart r:id` whose
		// CHILDREN are all p14-qualified, with a rasterized `mc:Fallback`
		// beside it. Verified against PowerPoint's own SaveAs output:
		//
		//   <mc:AlternateContent xmlns:mc="..." xmlns:p14="...">
		//     <mc:Choice Requires="p14">
		//       <p:contentPart p14:bwMode="auto" r:id="rId2">
		//         <p14:nvContentPartPr>
		//           <p14:cNvPr id="7" name="Ink 6"/>
		//           <p14:cNvContentPartPr/><p14:nvPr/>
		//         </p14:nvContentPartPr>
		//         <p14:xfrm><a:off .../><a:ext .../></p14:xfrm>
		//       </p:contentPart>
		//     </mc:Choice>
		//     <mc:Fallback>...</mc:Fallback>
		//   </mc:AlternateContent>
		//
		// Without these five local names the Choice was rejected, the raster
		// Fallback was taken, and the InkML decoder - which works - never once
		// saw a stroke from a real deck.
		'contentPart',
		'nvContentPartPr',
		'cNvContentPartPr',
		'cNvPr',
		'nvPr',
		'xfrm',
	]),
	// PowerPoint 2013+ writes its preset transitions (Origami, Fracture, Peel
	// Off, Page Curl, ...) as `<p15:prstTrans prst="...">`, either inside an
	// `mc:Choice Requires="p15"` or in a `p:transition/p:extLst` extension.
	// Both forms are parsed (see `PptxSlideTransitionService`), so the choice
	// IS supported: without this entry every p15 slide reported
	// `UNSUPPORTED_ALTERNATE_CONTENT_CHOICE`, which reads as "the transition
	// was dropped and the fallback fade was used" when in fact the preset
	// plays. `prstTrans` alone is listed on purpose: any OTHER `p15:*`
	// element still makes the choice unsupported and falls back, which is
	// the honest answer.
	p15: new Set(['prstTrans']),
	// PowerPoint 2016+ writes the Morph transition as `<p159:morph @option>`,
	// either inside an `mc:Choice Requires="p159"` or in a `p:transition/p:extLst`
	// extension. Both forms are parsed (see `PptxSlideTransitionService`), so the
	// choice IS supported: without this entry every morph slide reported
	// `UNSUPPORTED_ALTERNATE_CONTENT_CHOICE`, which reads as "the transition was
	// dropped and the fallback fade was used" when in fact the morph plays.
	// `morph` alone is listed on purpose: any OTHER `p159:*` element still makes
	// the choice unsupported and falls back, which is the honest answer.
	p159: new Set(['morph']),
	a14: new Set(['m', 'hiddenFill', 'hiddenLine', 'imgEffect', 'imgLayer']),
	a16: new Set(['svgBlip', 'colId']),
	asvg: new Set(['svgBlip']),
	aink: new Set(['ink', 'inkBrush', 'trace']),
	p16: new Set(['model3D', 'spPr', 'model3Drel', 'posterImage']),
	pslz: new Set(['sldZm', 'sldZmObj', 'zmPr', 'extLst']),
	psezm: new Set(['sectionZm', 'sectionZmObj', 'zmPr', 'extLst']),
	psuz: new Set(['summaryZm', 'summaryZmObj', 'zmPr', 'gridLayout', 'fixedLayout', 'extLst']),
	cx: new Set(CHART_EX_ELEMENTS),
	// PowerPoint does not settle on the bare `cx` prefix for ChartEx. A deck
	// with more than one chartex part binds each to its own numbered prefix,
	// so real files carry `Requires="cx1"` .. `Requires="cx8"` on the very same
	// element set. Registering only `cx` made every one of those branches
	// report UNSUPPORTED_ALTERNATE_CONTENT_CHOICE and fall back.
	...chartExPrefixCapabilities(),
};

const SUPPORTED_MC_NAMESPACES = new Set(Object.keys(MC_NAMESPACE_CAPABILITIES));

export function areNamespacesSupported(requires: string): boolean {
	if (!requires || requires.trim().length === 0) {
		return true;
	}
	return requires
		.trim()
		.split(/\s+/)
		.every((ns) => SUPPORTED_MC_NAMESPACES.has(ns));
}

export function isAlternateContentChoiceSupported(choice: XmlObject): boolean {
	const requires = String(choice?.['@_Requires'] ?? '').trim();
	if (!areNamespacesSupported(requires)) {
		return false;
	}
	return hasOnlySupportedExtensionElements(choice, new Set(requires.split(/\s+/).filter(Boolean)));
}

export function isAlternateContentChoiceXmlSupported(requires: string, branchXml: string): boolean {
	if (!areNamespacesSupported(requires)) {
		return false;
	}
	const required = new Set(requires.trim().split(/\s+/).filter(Boolean));
	const tagPattern = /<(?!\/|\?|!)([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)\b/g;
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(branchXml)) !== null) {
		if (required.has(match[1]) && !isExtensionElementSupported(match[1], match[2])) {
			return false;
		}
	}
	return true;
}

function hasOnlySupportedExtensionElements(node: unknown, required: ReadonlySet<string>): boolean {
	if (!node || typeof node !== 'object') {
		return true;
	}
	if (Array.isArray(node)) {
		return node.every((item) => hasOnlySupportedExtensionElements(item, required));
	}
	for (const [key, value] of Object.entries(node as XmlObject)) {
		if (!key.startsWith('@_')) {
			const separator = key.indexOf(':');
			if (separator > 0) {
				const prefix = key.slice(0, separator);
				if (
					required.has(prefix) &&
					!isExtensionElementSupported(prefix, key.slice(separator + 1))
				) {
					return false;
				}
			}
		}
		if (!hasOnlySupportedExtensionElements(value, required)) {
			return false;
		}
	}
	return true;
}

function isExtensionElementSupported(prefix: string, localName: string): boolean {
	return MC_NAMESPACE_CAPABILITIES[prefix]?.has(localName) ?? false;
}

export function isNamespaceSupported(ns: string): boolean {
	return SUPPORTED_MC_NAMESPACES.has(ns);
}

export function getSupportedNamespaces(): ReadonlySet<string> {
	return new Set(SUPPORTED_MC_NAMESPACES);
}
