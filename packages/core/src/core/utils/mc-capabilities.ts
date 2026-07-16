import type { XmlObject } from '../types';

const MC_NAMESPACE_CAPABILITIES: Readonly<Record<string, ReadonlySet<string>>> = {
	p14: new Set([
		'transition',
		'conveyor',
		'pan',
		'glitter',
		'prism',
		'vortex',
		'switch',
		'flip',
		'gallery',
		'honeycomb',
		'flash',
		'shred',
		'warp',
		'flythrough',
		'doors',
		'window',
		'ferris',
		'newsflash',
		'wheelReverse',
		'rotate',
		'orbit',
		'cube',
		'media',
		'trim',
		'fade',
		'bmkLst',
		'bmk',
		'hiddenFill',
		'hiddenLine',
	]),
	a14: new Set(['m', 'hiddenFill', 'hiddenLine', 'imgEffect', 'imgLayer']),
	a16: new Set(['svgBlip', 'colId']),
	asvg: new Set(['svgBlip']),
	aink: new Set(['ink', 'inkBrush', 'trace']),
	p16: new Set(['model3D', 'spPr', 'model3Drel', 'posterImage']),
	pslz: new Set(['sldZm', 'sldZmObj', 'zmPr', 'extLst']),
	psezm: new Set(['sectionZm', 'sectionZmObj', 'zmPr', 'extLst']),
	psuz: new Set(['summaryZm', 'summaryZmObj', 'zmPr', 'gridLayout', 'fixedLayout', 'extLst']),
	cx: new Set(['chart', 'plotArea', 'plotAreaRegion', 'series', 'data', 'numDim', 'strDim']),
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
