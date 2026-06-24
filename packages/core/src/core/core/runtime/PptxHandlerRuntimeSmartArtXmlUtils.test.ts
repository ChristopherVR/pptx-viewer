import { describe, it, expect } from 'vitest';

import type {
	XmlObject,
	PptxSmartArtChrome,
	PptxSmartArtNodeStyle,
	PptxSmartArtTextRun,
} from '../../types';

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeSmartArtXmlUtils
// Pure re-implementations of helper functions for direct testing.
// ---------------------------------------------------------------------------

/**
 * Stub for parseColor: extracts hex from a:srgbClr/@_val.
 */
function parseColor(node: unknown): string | null {
	if (!node || typeof node !== 'object') {
		return null;
	}
	const obj = node as XmlObject;
	const srgb = obj['a:srgbClr'] as XmlObject | undefined;
	if (srgb?.['@_val']) {
		return `#${srgb['@_val']}`;
	}
	return null;
}

/**
 * Stub for xmlLookupService.getChildByLocalName: finds first child key
 * matching the given local name (after the colon prefix).
 */
function getChildByLocalName(
	parent: XmlObject | undefined,
	localName: string,
): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	for (const [key, value] of Object.entries(parent)) {
		const colonIdx = key.indexOf(':');
		const keyLocal = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
		if (keyLocal === localName && value && typeof value === 'object' && !Array.isArray(value)) {
			return value as XmlObject;
		}
	}
	return undefined;
}

/**
 * Stub for xmlLookupService.getChildrenArrayByLocalName: collects child
 * objects whose local name matches, normalising a single object to a 1-array.
 */
function getChildrenArrayByLocalName(
	parent: XmlObject | undefined,
	localName: string,
): XmlObject[] {
	if (!parent) {
		return [];
	}
	for (const [key, value] of Object.entries(parent)) {
		const colonIdx = key.indexOf(':');
		const keyLocal = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
		if (keyLocal !== localName) {
			continue;
		}
		if (Array.isArray(value)) {
			return value.filter(
				(entry): entry is XmlObject =>
					typeof entry === 'object' && entry !== null && !Array.isArray(entry),
			);
		}
		if (value && typeof value === 'object') {
			return [value as XmlObject];
		}
	}
	return [];
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.extractSmartArtNodeRuns.
 */
function extractSmartArtNodeRuns(point: XmlObject): PptxSmartArtTextRun[] | undefined {
	const tBody = getChildByLocalName(point, 't');
	if (!tBody) {
		return undefined;
	}
	const paragraph = getChildrenArrayByLocalName(tBody, 'p')[0];
	if (!paragraph) {
		return undefined;
	}
	const runNodes = getChildrenArrayByLocalName(paragraph, 'r');
	if (runNodes.length === 0) {
		return undefined;
	}

	const runs: PptxSmartArtTextRun[] = [];
	for (const run of runNodes) {
		const textValues: string[] = [];
		collectLocalTextValues(run, 't', textValues);
		const text = textValues.join('');
		const rPrNode = getChildByLocalName(run, 'rPr');
		const entry: PptxSmartArtTextRun = { text };
		if (rPrNode) {
			entry.rPr = JSON.parse(JSON.stringify(rPrNode)) as Record<string, unknown>;
		}
		runs.push(entry);
	}

	return runs.length > 0 ? runs : undefined;
}

/** Mirror of PptxHandlerRuntimeSmartArtXmlUtils.xmlBoolean. */
function xmlBoolean(value: unknown): boolean {
	const v = String(value ?? '')
		.trim()
		.toLowerCase();
	return v === '1' || v === 'true' || v === 'on';
}

/** Mirror of PptxHandlerRuntimeSmartArtXmlUtils.firstRunProperties. */
function firstRunProperties(point: XmlObject): XmlObject | undefined {
	const tBody = getChildByLocalName(point, 't');
	if (!tBody) {
		return undefined;
	}
	const paragraph = getChildrenArrayByLocalName(tBody, 'p')[0];
	if (!paragraph) {
		return undefined;
	}
	const run = getChildrenArrayByLocalName(paragraph, 'r')[0];
	if (!run) {
		return undefined;
	}
	return getChildByLocalName(run, 'rPr');
}

/** Mirror of PptxHandlerRuntimeSmartArtXmlUtils.extractSmartArtNodeStyle. */
function extractSmartArtNodeStyle(point: XmlObject): PptxSmartArtNodeStyle | undefined {
	const style: PptxSmartArtNodeStyle = {};
	const spPr = getChildByLocalName(point, 'spPr');
	if (spPr) {
		const fill = parseColor(getChildByLocalName(spPr, 'solidFill'));
		if (fill) {
			style.fillColor = fill;
		}
		const ln = getChildByLocalName(spPr, 'ln');
		if (ln) {
			const lineColor = parseColor(getChildByLocalName(ln, 'solidFill'));
			if (lineColor) {
				style.lineColor = lineColor;
			}
		}
	}
	const rPr = firstRunProperties(point);
	if (rPr) {
		if (xmlBoolean(rPr['@_b'])) {
			style.bold = true;
		}
		if (xmlBoolean(rPr['@_i'])) {
			style.italic = true;
		}
		const fontColor = parseColor(getChildByLocalName(rPr, 'solidFill'));
		if (fontColor) {
			style.fontColor = fontColor;
		}
	}
	return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.parseSmartArtChrome.
 */
function parseSmartArtChrome(dataModel: XmlObject | undefined): PptxSmartArtChrome | undefined {
	if (!dataModel) {
		return undefined;
	}

	const bg = getChildByLocalName(dataModel, 'bg');
	const whole = getChildByLocalName(dataModel, 'whole');
	if (!bg && !whole) {
		return undefined;
	}

	const chrome: PptxSmartArtChrome = {};

	if (bg) {
		const solidFill = getChildByLocalName(bg, 'solidFill');
		const bgColor = parseColor(solidFill);
		if (bgColor) {
			chrome.backgroundColor = bgColor;
		}
	}

	if (whole) {
		const lnNode = getChildByLocalName(whole, 'ln');
		if (lnNode) {
			const solidFill = getChildByLocalName(lnNode, 'solidFill');
			const outlineColor = parseColor(solidFill);
			if (outlineColor) {
				chrome.outlineColor = outlineColor;
			}
			const widthRaw = parseInt(String(lnNode['@_w'] || ''), 10);
			if (Number.isFinite(widthRaw) && widthRaw > 0) {
				chrome.outlineWidth = widthRaw / 12700; // EMU to pt
			}
		}
	}

	return chrome.backgroundColor || chrome.outlineColor ? chrome : undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.resolveSmartArtSchemeColor.
 */
function resolveSmartArtSchemeColor(
	schemeClr: XmlObject | undefined,
	themeColorMap: Record<string, string>,
): string | undefined {
	if (!schemeClr) {
		return undefined;
	}
	const val = String(schemeClr['@_val'] || '').trim();
	if (val.length === 0) {
		return undefined;
	}
	const mapped = themeColorMap[val];
	if (mapped) {
		return mapped.startsWith('#') ? mapped : `#${mapped}`;
	}
	return undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.collectLocalTextValues.
 */
function collectLocalTextValues(node: unknown, localName: string, output: string[]): void {
	if (node === null || node === undefined) {
		return;
	}
	if (Array.isArray(node)) {
		node.forEach((entry) => {
			collectLocalTextValues(entry, localName, output);
		});
		return;
	}
	if (typeof node !== 'object') {
		return;
	}

	const objectNode = node as XmlObject;
	for (const [key, value] of Object.entries(objectNode)) {
		const colonIdx = key.indexOf(':');
		const keyLocal = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
		if (keyLocal === localName) {
			if (typeof value === 'string' || typeof value === 'number') {
				const textValue = String(value).trim();
				if (textValue.length > 0) {
					output.push(textValue);
				}
				continue;
			}
		}
		collectLocalTextValues(value, localName, output);
	}
}

// ---------------------------------------------------------------------------
// parseSmartArtChrome
// ---------------------------------------------------------------------------
describe('parseSmartArtChrome', () => {
	it('should return undefined for undefined dataModel', () => {
		expect(parseSmartArtChrome(undefined)).toBeUndefined();
	});

	it('should return undefined when neither bg nor whole exist', () => {
		expect(parseSmartArtChrome({})).toBeUndefined();
	});

	it('should parse background color from bg solidFill', () => {
		const dataModel: XmlObject = {
			'dgm:bg': {
				'a:solidFill': {
					'a:srgbClr': { '@_val': 'AABBCC' },
				},
			},
		};
		const result = parseSmartArtChrome(dataModel);
		expect(result).toBeDefined();
		expect(result!.backgroundColor).toBe('#AABBCC');
	});

	it('should parse outline color and width from whole/ln', () => {
		const dataModel: XmlObject = {
			'dgm:whole': {
				'a:ln': {
					'@_w': '25400', // 2pt
					'a:solidFill': {
						'a:srgbClr': { '@_val': '112233' },
					},
				},
			},
		};
		const result = parseSmartArtChrome(dataModel);
		expect(result).toBeDefined();
		expect(result!.outlineColor).toBe('#112233');
		expect(result!.outlineWidth).toBeCloseTo(2);
	});

	it('should return undefined when bg has no fill and whole has no ln color', () => {
		const dataModel: XmlObject = {
			'dgm:bg': {},
			'dgm:whole': { 'a:ln': {} },
		};
		const result = parseSmartArtChrome(dataModel);
		expect(result).toBeUndefined();
	});

	it('should parse both background and outline', () => {
		const dataModel: XmlObject = {
			'dgm:bg': {
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
			},
			'dgm:whole': {
				'a:ln': {
					'@_w': '12700',
					'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } },
				},
			},
		};
		const result = parseSmartArtChrome(dataModel);
		expect(result!.backgroundColor).toBe('#FFFFFF');
		expect(result!.outlineColor).toBe('#000000');
		expect(result!.outlineWidth).toBeCloseTo(1);
	});

	it('should skip outline width when zero or invalid', () => {
		const dataModel: XmlObject = {
			'dgm:whole': {
				'a:ln': {
					'@_w': '0',
					'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
				},
			},
		};
		const result = parseSmartArtChrome(dataModel);
		expect(result!.outlineColor).toBe('#FF0000');
		expect(result!.outlineWidth).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// resolveSmartArtSchemeColor
// ---------------------------------------------------------------------------
describe('resolveSmartArtSchemeColor', () => {
	it('should return undefined for undefined schemeClr', () => {
		expect(resolveSmartArtSchemeColor(undefined, {})).toBeUndefined();
	});

	it('should return undefined when @_val is empty', () => {
		expect(resolveSmartArtSchemeColor({ '@_val': '' }, { accent1: '4472C4' })).toBeUndefined();
	});

	it('should return undefined when scheme value is not in theme map', () => {
		expect(
			resolveSmartArtSchemeColor({ '@_val': 'accent7' }, { accent1: '4472C4' }),
		).toBeUndefined();
	});

	it('should resolve scheme color from theme map (no # prefix)', () => {
		expect(resolveSmartArtSchemeColor({ '@_val': 'accent1' }, { accent1: '4472C4' })).toBe(
			'#4472C4',
		);
	});

	it('should pass through # prefix if already present', () => {
		expect(resolveSmartArtSchemeColor({ '@_val': 'dk1' }, { dk1: '#000000' })).toBe('#000000');
	});

	it('should resolve different scheme colors', () => {
		const map = {
			lt1: 'FFFFFF',
			dk1: '000000',
			accent2: 'ED7D31',
		};
		expect(resolveSmartArtSchemeColor({ '@_val': 'lt1' }, map)).toBe('#FFFFFF');
		expect(resolveSmartArtSchemeColor({ '@_val': 'accent2' }, map)).toBe('#ED7D31');
	});
});

// ---------------------------------------------------------------------------
// collectLocalTextValues
// ---------------------------------------------------------------------------
describe('collectLocalTextValues', () => {
	it('should handle null/undefined input', () => {
		const output: string[] = [];
		collectLocalTextValues(null, 't', output);
		collectLocalTextValues(undefined, 't', output);
		expect(output).toStrictEqual([]);
	});

	it('should collect text values from direct child with matching local name', () => {
		const output: string[] = [];
		collectLocalTextValues({ 'a:t': 'Hello' }, 't', output);
		expect(output).toStrictEqual(['Hello']);
	});

	it('should collect text values from nested structure', () => {
		const output: string[] = [];
		const node = {
			'a:p': {
				'a:r': {
					'a:t': 'World',
				},
			},
		};
		collectLocalTextValues(node, 't', output);
		expect(output).toStrictEqual(['World']);
	});

	it('should collect multiple text values', () => {
		const output: string[] = [];
		const node = {
			'a:p': [{ 'a:r': { 'a:t': 'Hello' } }, { 'a:r': { 'a:t': 'World' } }],
		};
		collectLocalTextValues(node, 't', output);
		expect(output).toStrictEqual(['Hello', 'World']);
	});

	it('should skip empty/whitespace-only text values', () => {
		const output: string[] = [];
		collectLocalTextValues({ 'a:t': '   ' }, 't', output);
		expect(output).toStrictEqual([]);
	});

	it('should handle numeric text values', () => {
		const output: string[] = [];
		collectLocalTextValues({ 'a:t': 42 }, 't', output);
		expect(output).toStrictEqual(['42']);
	});

	it('should handle arrays at any level', () => {
		const output: string[] = [];
		const node = [{ 'ns:t': 'A' }, { 'ns:t': 'B' }];
		collectLocalTextValues(node, 't', output);
		expect(output).toStrictEqual(['A', 'B']);
	});

	it('should ignore non-matching local names', () => {
		const output: string[] = [];
		collectLocalTextValues({ 'a:r': 'NotText' }, 't', output);
		expect(output).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// extractSmartArtNodeRuns
// ---------------------------------------------------------------------------
describe('extractSmartArtNodeRuns', () => {
	it('returns undefined when the point has no dgm:t body', () => {
		expect(extractSmartArtNodeRuns({ '@_modelId': '1' })).toBeUndefined();
	});

	it('captures a single run with its rPr', () => {
		const point: XmlObject = {
			'dgm:t': {
				'a:bodyPr': {},
				'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'Bold' } },
			},
		};
		const runs = extractSmartArtNodeRuns(point);
		expect(runs).toHaveLength(1);
		expect(runs![0].text).toBe('Bold');
		expect(runs![0].rPr).toStrictEqual({ '@_b': '1' });
	});

	it('captures multiple runs with per-run properties', () => {
		const point: XmlObject = {
			'dgm:t': {
				'a:p': {
					'a:r': [
						{ 'a:rPr': { '@_b': '1' }, 'a:t': 'Bold' },
						{ 'a:rPr': { '@_i': '1' }, 'a:t': 'Italic' },
					],
				},
			},
		};
		const runs = extractSmartArtNodeRuns(point);
		expect(runs).toHaveLength(2);
		expect(runs![0].text).toBe('Bold');
		expect(runs![1].text).toBe('Italic');
		expect(runs![1].rPr).toStrictEqual({ '@_i': '1' });
	});

	it('captures a run without rPr (no rPr field set)', () => {
		const point: XmlObject = {
			'dgm:t': { 'a:p': { 'a:r': { 'a:t': 'Plain' } } },
		};
		const runs = extractSmartArtNodeRuns(point);
		expect(runs).toHaveLength(1);
		expect(runs![0].text).toBe('Plain');
		expect(runs![0].rPr).toBeUndefined();
	});

	it('only reads the first paragraph', () => {
		const point: XmlObject = {
			'dgm:t': {
				'a:p': [{ 'a:r': { 'a:t': 'One' } }, { 'a:r': { 'a:t': 'Two' } }],
			},
		};
		const runs = extractSmartArtNodeRuns(point);
		expect(runs).toHaveLength(1);
		expect(runs![0].text).toBe('One');
	});

	it('deep-clones rPr so later edits do not mutate the source tree', () => {
		const rPr = { '@_sz': '1800' };
		const point: XmlObject = { 'dgm:t': { 'a:p': { 'a:r': { 'a:rPr': rPr, 'a:t': 'X' } } } };
		const runs = extractSmartArtNodeRuns(point)!;
		(runs[0].rPr as Record<string, unknown>)['@_sz'] = '9999';
		expect(rPr['@_sz']).toBe('1800');
	});
});

// ---------------------------------------------------------------------------
// extractSmartArtNodeStyle
// ---------------------------------------------------------------------------
describe('extractSmartArtNodeStyle', () => {
	it('returns undefined for a bare point with no spPr / rPr', () => {
		expect(extractSmartArtNodeStyle({ '@_modelId': '1' })).toBeUndefined();
	});

	it('reads spPr fill and line colour', () => {
		const point: XmlObject = {
			'dgm:spPr': {
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
				'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': '00FF00' } } },
			},
		};
		expect(extractSmartArtNodeStyle(point)).toStrictEqual({
			fillColor: '#FF0000',
			lineColor: '#00FF00',
		});
	});

	it('reads bold / italic / font colour from the first run rPr', () => {
		const point: XmlObject = {
			'dgm:t': {
				'a:p': {
					'a:r': {
						'a:rPr': {
							'@_b': '1',
							'@_i': 'true',
							'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } },
						},
						'a:t': 'X',
					},
				},
			},
		};
		expect(extractSmartArtNodeStyle(point)).toStrictEqual({
			bold: true,
			italic: true,
			fontColor: '#112233',
		});
	});

	it('combines shape and run overrides', () => {
		const point: XmlObject = {
			'dgm:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'ABCDEF' } } },
			'dgm:t': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'X' } } },
		};
		expect(extractSmartArtNodeStyle(point)).toStrictEqual({ fillColor: '#ABCDEF', bold: true });
	});

	it('ignores bold="0" (treats only truthy OOXML booleans as set)', () => {
		const point: XmlObject = {
			'dgm:t': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '0' }, 'a:t': 'X' } } },
		};
		expect(extractSmartArtNodeStyle(point)).toBeUndefined();
	});
});
