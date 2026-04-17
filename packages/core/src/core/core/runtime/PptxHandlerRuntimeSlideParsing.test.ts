import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeSlideParsing
// ---------------------------------------------------------------------------

interface XmlObject {
	[key: string]: unknown;
}

interface TextStyle {
	align?: 'left' | 'center' | 'right' | 'justify';
	vAlign?: 'top' | 'middle' | 'bottom';
}

/**
 * Extracted from parseSlide — checks whether a slide XML object has
 * a valid spTree (shape tree) for parsing.
 */
function hasSlideShapeTree(slideXml: XmlObject): boolean {
	const spTree = slideXml['p:sld']?.['p:cSld']?.['p:spTree'];
	return spTree !== undefined && spTree !== null;
}

/**
 * Helper extracted from ensureArray usage throughout the runtime.
 */
function ensureArray(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/**
 * Extracted from parseConnectorTextBody — determines paragraph
 * alignment from pPr attributes.
 */
function resolveParaAlign(alignValue: unknown): TextStyle['align'] {
	if (!alignValue) {
		return 'center';
	}
	const alignMap: Record<string, TextStyle['align']> = {
		l: 'left',
		ctr: 'center',
		r: 'right',
		just: 'justify',
		justify: 'justify',
	};
	return alignMap[String(alignValue)] || 'center';
}

/**
 * Extracted from parseConnectorTextBody — extracts text from
 * a single run element.
 */
function extractRunText(run: XmlObject): string {
	if (!run) {
		return '';
	}
	const runText = run['a:t'];
	if (typeof runText === 'string') {
		return runText;
	}
	if (runText !== undefined) {
		return String(runText);
	}
	return '';
}

/**
 * Extracted from parseConnectorTextBody — determines if the
 * parsed text body has meaningful content.
 */
function hasNonEmptyText(textParts: string[]): boolean {
	const text = textParts.join('');
	return text.trim().length > 0;
}

/**
 * Extracted from the SlideUtils — checks if a slide is hidden
 * based on slide XML and slide ID entry attributes.
 */
function isSlideHidden(slideXmlObj: XmlObject, slideIdEntry: XmlObject | undefined): boolean {
	const slideShowValue = String(slideXmlObj?.['p:sld']?.['@_show'] ?? '').toLowerCase();
	if (slideShowValue === '0' || slideShowValue === 'false') {
		return true;
	}

	const slideIdShowValue = String(slideIdEntry?.['@_show'] ?? '').toLowerCase();
	return slideIdShowValue === '0' || slideIdShowValue === 'false';
}

/**
 * Extracted from SlideUtils — extracts the showMasterShapes flag
 * from a slide's XML.
 */
function extractShowMasterShapes(slideXml: XmlObject): boolean | undefined {
	const sld = slideXml['p:sld'] as XmlObject | undefined;
	if (!sld) {
		return undefined;
	}
	const rawVal = sld['@_showMasterSp'];
	if (rawVal === undefined) {
		return undefined;
	}
	const normalized = String(rawVal).trim().toLowerCase();
	return normalized !== '0' && normalized !== 'false';
}

/**
 * Extracted from SlideUtils — extracts the background show animation flag.
 */
function extractBackgroundShowAnimation(slideXml: XmlObject): boolean | undefined {
	const sld = slideXml['p:sld'] as XmlObject | undefined;
	const bg = sld?.['p:cSld']?.['p:bg'] as XmlObject | undefined;
	if (!bg) {
		return undefined;
	}
	const rawVal = bg['@_showAnimation'];
	if (rawVal === undefined) {
		return undefined;
	}
	const normalized = String(rawVal).trim().toLowerCase();
	return normalized !== '0' && normalized !== 'false';
}

// ---------------------------------------------------------------------------
// Tests: hasSlideShapeTree
// ---------------------------------------------------------------------------
describe('hasSlideShapeTree', () => {
	it('should return true when spTree exists', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:cSld': {
					'p:spTree': { 'p:sp': [] },
				},
			},
		};
		expect(hasSlideShapeTree(slideXml)).toBeTruthy();
	});

	it('should return false when p:sld is missing', () => {
		expect(hasSlideShapeTree({})).toBeFalsy();
	});

	it('should return false when p:cSld is missing', () => {
		const slideXml: XmlObject = { 'p:sld': {} };
		expect(hasSlideShapeTree(slideXml)).toBeFalsy();
	});

	it('should return false when p:spTree is missing', () => {
		const slideXml: XmlObject = {
			'p:sld': { 'p:cSld': {} },
		};
		expect(hasSlideShapeTree(slideXml)).toBeFalsy();
	});

	it('should return true for empty spTree', () => {
		const slideXml: XmlObject = {
			'p:sld': { 'p:cSld': { 'p:spTree': {} } },
		};
		expect(hasSlideShapeTree(slideXml)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: ensureArray
// ---------------------------------------------------------------------------
describe('ensureArray', () => {
	it('should return empty array for undefined', () => {
		expect(ensureArray(undefined)).toStrictEqual([]);
	});

	it('should return empty array for null', () => {
		expect(ensureArray(null)).toStrictEqual([]);
	});

	it('should return the array as-is if already an array', () => {
		const arr = [1, 2, 3];
		expect(ensureArray(arr)).toBe(arr);
	});

	it('should wrap a single value in an array', () => {
		expect(ensureArray('hello')).toStrictEqual(['hello']);
	});

	it('should wrap a single object in an array', () => {
		const obj = { key: 'value' };
		expect(ensureArray(obj)).toStrictEqual([obj]);
	});

	it('should wrap a number in an array', () => {
		expect(ensureArray(42)).toStrictEqual([42]);
	});

	it('should wrap false in an array', () => {
		expect(ensureArray(false)).toStrictEqual([false]);
	});

	it('should wrap 0 in an array', () => {
		expect(ensureArray(0)).toStrictEqual([0]);
	});

	it('should wrap empty string in an array', () => {
		expect(ensureArray('')).toStrictEqual(['']);
	});

	it('should return empty array for nested arrays passed through correctly', () => {
		const nested = [
			[1, 2],
			[3, 4],
		];
		expect(ensureArray(nested)).toBe(nested);
	});
});

// ---------------------------------------------------------------------------
// Tests: resolveParaAlign
// ---------------------------------------------------------------------------
describe('resolveParaAlign', () => {
	it("should return 'center' for undefined", () => {
		expect(resolveParaAlign(undefined)).toBe('center');
	});

	it("should return 'center' for null", () => {
		expect(resolveParaAlign(null)).toBe('center');
	});

	it("should return 'center' for empty string", () => {
		expect(resolveParaAlign('')).toBe('center');
	});

	it("should return 'left' for 'l'", () => {
		expect(resolveParaAlign('l')).toBe('left');
	});

	it("should return 'center' for 'ctr'", () => {
		expect(resolveParaAlign('ctr')).toBe('center');
	});

	it("should return 'right' for 'r'", () => {
		expect(resolveParaAlign('r')).toBe('right');
	});

	it("should return 'justify' for 'just'", () => {
		expect(resolveParaAlign('just')).toBe('justify');
	});

	it("should return 'justify' for 'justify'", () => {
		expect(resolveParaAlign('justify')).toBe('justify');
	});

	it("should return 'center' for unknown values", () => {
		expect(resolveParaAlign('unknown')).toBe('center');
	});
});

// ---------------------------------------------------------------------------
// Tests: extractRunText
// ---------------------------------------------------------------------------
describe('extractRunText', () => {
	it('should return empty string for empty run', () => {
		expect(extractRunText({})).toBe('');
	});

	it('should extract string a:t', () => {
		expect(extractRunText({ 'a:t': 'Hello' })).toBe('Hello');
	});

	it('should convert numeric a:t to string', () => {
		expect(extractRunText({ 'a:t': 42 })).toBe('42');
	});

	it('should handle boolean a:t', () => {
		expect(extractRunText({ 'a:t': true })).toBe('true');
	});

	it('should return empty string when a:t is undefined', () => {
		expect(extractRunText({ 'a:rPr': {} })).toBe('');
	});

	it('should handle empty string a:t', () => {
		expect(extractRunText({ 'a:t': '' })).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Tests: hasNonEmptyText
// ---------------------------------------------------------------------------
describe('hasNonEmptyText', () => {
	it('should return false for empty parts array', () => {
		expect(hasNonEmptyText([])).toBeFalsy();
	});

	it('should return false for parts with only whitespace', () => {
		expect(hasNonEmptyText(['   ', '\n', '\t'])).toBeFalsy();
	});

	it('should return true for parts with text', () => {
		expect(hasNonEmptyText(['Hello'])).toBeTruthy();
	});

	it('should return true when text is spread across parts', () => {
		expect(hasNonEmptyText(['', ' ', 'X', ''])).toBeTruthy();
	});

	it('should return false for parts with only empty strings', () => {
		expect(hasNonEmptyText(['', '', ''])).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: isSlideHidden
// ---------------------------------------------------------------------------
describe('isSlideHidden', () => {
	it('should return false for visible slides (default)', () => {
		expect(isSlideHidden({ 'p:sld': {} }, undefined)).toBeFalsy();
	});

	it("should detect hidden slide from p:sld/@show='0'", () => {
		expect(isSlideHidden({ 'p:sld': { '@_show': '0' } }, undefined)).toBeTruthy();
	});

	it("should detect hidden slide from p:sld/@show='false'", () => {
		expect(isSlideHidden({ 'p:sld': { '@_show': 'false' } }, undefined)).toBeTruthy();
	});

	it("should detect hidden from slideIdEntry/@show='0'", () => {
		expect(isSlideHidden({ 'p:sld': {} }, { '@_show': '0' })).toBeTruthy();
	});

	it("should detect hidden from slideIdEntry/@show='false'", () => {
		expect(isSlideHidden({ 'p:sld': {} }, { '@_show': 'false' })).toBeTruthy();
	});

	it('should be case-insensitive', () => {
		expect(isSlideHidden({ 'p:sld': { '@_show': 'FALSE' } }, undefined)).toBeTruthy();
	});

	it("should not hide when show='1'", () => {
		expect(isSlideHidden({ 'p:sld': { '@_show': '1' } }, undefined)).toBeFalsy();
	});

	it("should not hide when show='true'", () => {
		expect(isSlideHidden({ 'p:sld': { '@_show': 'true' } }, undefined)).toBeFalsy();
	});

	it('should handle missing p:sld', () => {
		expect(isSlideHidden({}, undefined)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: extractShowMasterShapes
// ---------------------------------------------------------------------------
describe('extractShowMasterShapes', () => {
	it('should return undefined when p:sld is missing', () => {
		expect(extractShowMasterShapes({})).toBeUndefined();
	});

	it('should return undefined when @_showMasterSp is absent', () => {
		expect(extractShowMasterShapes({ 'p:sld': {} })).toBeUndefined();
	});

	it("should return false when showMasterSp is '0'", () => {
		expect(extractShowMasterShapes({ 'p:sld': { '@_showMasterSp': '0' } })).toBeFalsy();
	});

	it("should return false when showMasterSp is 'false'", () => {
		expect(extractShowMasterShapes({ 'p:sld': { '@_showMasterSp': 'false' } })).toBeFalsy();
	});

	it("should return true when showMasterSp is '1'", () => {
		expect(extractShowMasterShapes({ 'p:sld': { '@_showMasterSp': '1' } })).toBeTruthy();
	});

	it("should return true when showMasterSp is 'true'", () => {
		expect(extractShowMasterShapes({ 'p:sld': { '@_showMasterSp': 'true' } })).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: extractBackgroundShowAnimation
// ---------------------------------------------------------------------------
describe('extractBackgroundShowAnimation', () => {
	it('should return undefined when p:sld is missing', () => {
		expect(extractBackgroundShowAnimation({})).toBeUndefined();
	});

	it('should return undefined when p:bg is missing', () => {
		expect(extractBackgroundShowAnimation({ 'p:sld': { 'p:cSld': {} } })).toBeUndefined();
	});

	it('should return undefined when @_showAnimation is absent', () => {
		expect(
			extractBackgroundShowAnimation({
				'p:sld': { 'p:cSld': { 'p:bg': {} } },
			}),
		).toBeUndefined();
	});

	it("should return false when showAnimation is '0'", () => {
		expect(
			extractBackgroundShowAnimation({
				'p:sld': { 'p:cSld': { 'p:bg': { '@_showAnimation': '0' } } },
			}),
		).toBeFalsy();
	});

	it("should return false when showAnimation is 'false'", () => {
		expect(
			extractBackgroundShowAnimation({
				'p:sld': { 'p:cSld': { 'p:bg': { '@_showAnimation': 'false' } } },
			}),
		).toBeFalsy();
	});

	it("should return true when showAnimation is '1'", () => {
		expect(
			extractBackgroundShowAnimation({
				'p:sld': { 'p:cSld': { 'p:bg': { '@_showAnimation': '1' } } },
			}),
		).toBeTruthy();
	});

	it("should return true when showAnimation is 'true'", () => {
		expect(
			extractBackgroundShowAnimation({
				'p:sld': { 'p:cSld': { 'p:bg': { '@_showAnimation': 'true' } } },
			}),
		).toBeTruthy();
	});
});
