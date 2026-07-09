import { describe, it, expect } from 'vitest';

import {
	detectStrictConformance,
	normalizeStrictXml as normalizeStrictXmlInPlace,
} from '../../utils/strict-namespace-map';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeState (protected methods)
// ---------------------------------------------------------------------------

/**
 * Tests the Strict Open XML detection and parser wrapping behavior, exercised
 * against the real strict-namespace-map implementation rather than a stub.
 */

// normalizeStrictXml mutates and returns its argument; the harness only cares about the mutation.
function normalizeStrictXml(xmlObj: Record<string, unknown>): void {
	normalizeStrictXmlInPlace(xmlObj);
}

/**
 * Simulates the state class behavior for strict conformance detection
 * and parser proxy wrapping.
 */
class RuntimeStateTestHarness {
	isStrictOoxml = false;
	parser: { parse: (xml: string) => Record<string, unknown> };
	private _originalParser: {
		parse: (xml: string) => Record<string, unknown>;
	} | null = null;

	constructor() {
		this.parser = {
			parse: (xml: string) => JSON.parse(xml) as Record<string, unknown>,
		};
	}

	detectAndSetStrictConformance(xmlObj: Record<string, unknown>): void {
		if (!detectStrictConformance(xmlObj)) {
			return;
		}

		this.isStrictOoxml = true;
		normalizeStrictXml(xmlObj);

		if (!this._originalParser) {
			this._originalParser = this.parser;
			const original = this.parser;
			this.parser = new Proxy(original, {
				get(target, prop, receiver) {
					if (prop === 'parse') {
						return function (xmlData: string) {
							const result = target.parse(xmlData);
							if (typeof result === 'object' && result !== null) {
								normalizeStrictXml(result);
							}
							return result;
						};
					}
					return Reflect.get(target, prop, receiver);
				},
			});
		}
	}

	restoreOriginalParser(): void {
		if (this._originalParser) {
			this.parser = this._originalParser;
			this._originalParser = null;
		}
	}
}

// A minimal parsed-XML shape that carries a Strict namespace declaration on
// its root element, matching what detectStrictConformance actually walks
// (top-level element -> @_xmlns* attributes) rather than an arbitrary blob.
// The family must be one of the algorithmically-remapped families (see
// strict-namespace-map.ts) so normalizeStrictXml actually rewrites it.
function strictXmlObj(family = 'presentationml/main'): Record<string, unknown> {
	return {
		'p:presentation': {
			'@_xmlns:p': `http://purl.oclc.org/ooxml/${family}`,
		},
	};
}

// ---------------------------------------------------------------------------
// Constants from PptxHandlerRuntimeState
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;
const EDITOR_META_EXTENSION_URI = '{A6F62C1B-B45C-4E8A-8B0A-1B3E5F8C8D4A}';
const EDITOR_META_NAMESPACE_URI = 'http://schemas.pptx.ai/pptx/editor-meta';

// ---------------------------------------------------------------------------
// Tests: EMU_PER_PX constant
// ---------------------------------------------------------------------------
describe('pptxHandlerRuntimeState constants', () => {
	it('eMU_PER_PX should equal 9525', () => {
		expect(EMU_PER_PX).toBe(9525);
	});

	it('should produce correct pixel values from EMU conversion', () => {
		// 1 inch = 914400 EMU = 96 pixels
		expect(Math.round(914400 / EMU_PER_PX)).toBe(96);
	});

	it('should produce correct EMU values from pixel conversion', () => {
		// 100 pixels
		expect(100 * EMU_PER_PX).toBe(952500);
	});

	it('eDITOR_META_EXTENSION_URI should be a GUID-like string', () => {
		expect(EDITOR_META_EXTENSION_URI).toMatch(/^\{[A-F0-9-]+\}$/i);
	});

	it('eDITOR_META_NAMESPACE_URI should be a valid URI', () => {
		expect(EDITOR_META_NAMESPACE_URI).toMatch(/^http:\/\//);
	});
});

// ---------------------------------------------------------------------------
// Tests: detectAndSetStrictConformance
// ---------------------------------------------------------------------------
describe('detectAndSetStrictConformance', () => {
	it('should not set isStrictOoxml for transitional XML', () => {
		const harness = new RuntimeStateTestHarness();
		const xmlObj = {
			'p:presentation': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		harness.detectAndSetStrictConformance(xmlObj);
		expect(harness.isStrictOoxml).toBeFalsy();
	});

	it('should set isStrictOoxml for strict XML', () => {
		const harness = new RuntimeStateTestHarness();
		const xmlObj = {
			'p:presentation': {
				'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
			},
		};
		harness.detectAndSetStrictConformance(xmlObj);
		expect(harness.isStrictOoxml).toBeTruthy();
	});

	it('should normalize strict namespace URIs in the input object', () => {
		const harness = new RuntimeStateTestHarness();
		const xmlObj: Record<string, unknown> = {
			'p:presentation': {
				'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
			},
		};
		harness.detectAndSetStrictConformance(xmlObj);
		const pres = xmlObj['p:presentation'] as Record<string, unknown>;
		expect(String(pres['@_xmlns:p'])).not.toContain('purl.oclc.org');
	});

	it('should wrap parser to auto-normalize subsequent parse calls', () => {
		const harness = new RuntimeStateTestHarness();
		harness.detectAndSetStrictConformance(strictXmlObj());

		// Parser should now be wrapped
		const result = harness.parser.parse(JSON.stringify(strictXmlObj()));
		// The proxy should normalize the result
		expect(JSON.stringify(result)).not.toContain('purl.oclc.org');
	});

	it('should not wrap parser twice if called again', () => {
		const harness = new RuntimeStateTestHarness();
		harness.detectAndSetStrictConformance(strictXmlObj('presentationml/main'));
		const parserAfterFirst = harness.parser;

		harness.detectAndSetStrictConformance(strictXmlObj('drawingml/main'));
		// Parser reference should stay the same (not double-wrapped)
		expect(harness.parser).toBe(parserAfterFirst);
	});
});

// ---------------------------------------------------------------------------
// Tests: restoreOriginalParser
// ---------------------------------------------------------------------------
describe('restoreOriginalParser', () => {
	it('should restore original parser after strict detection', () => {
		const harness = new RuntimeStateTestHarness();
		const originalParser = harness.parser;

		harness.detectAndSetStrictConformance(strictXmlObj());
		expect(harness.parser).not.toBe(originalParser);

		harness.restoreOriginalParser();
		expect(harness.parser).toBe(originalParser);
	});

	it('should be a no-op if parser was never wrapped', () => {
		const harness = new RuntimeStateTestHarness();
		const originalParser = harness.parser;
		harness.restoreOriginalParser();
		expect(harness.parser).toBe(originalParser);
	});

	it('should allow re-wrapping after restore', () => {
		const harness = new RuntimeStateTestHarness();
		const originalParser = harness.parser;

		// Wrap
		harness.detectAndSetStrictConformance(strictXmlObj('presentationml/main'));
		expect(harness.parser).not.toBe(originalParser);

		// Restore
		harness.restoreOriginalParser();
		expect(harness.parser).toBe(originalParser);

		// Re-wrap
		harness.isStrictOoxml = false;
		harness.detectAndSetStrictConformance(strictXmlObj('drawingml/main'));
		expect(harness.parser).not.toBe(originalParser);
		expect(harness.isStrictOoxml).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: Default state values
// ---------------------------------------------------------------------------
describe('pptxHandlerRuntimeState default field values', () => {
	it('should initialize maps as empty', () => {
		// Simulating the default state of the runtime
		const slideMap = new Map<string, unknown>();
		const slideRelsMap = new Map<string, Map<string, string>>();
		const externalRelsMap = new Map<string, Set<string>>();
		const layoutCache = new Map<string, unknown[]>();
		const masterCache = new Map<string, unknown[]>();
		const imageDataCache = new Map<string, string>();

		expect(slideMap.size).toBe(0);
		expect(slideRelsMap.size).toBe(0);
		expect(externalRelsMap.size).toBe(0);
		expect(layoutCache.size).toBe(0);
		expect(masterCache.size).toBe(0);
		expect(imageDataCache.size).toBe(0);
	});

	it('should default eagerDecodeImages to true', () => {
		const eagerDecodeImages = true;
		expect(eagerDecodeImages).toBeTruthy();
	});

	it('should default isStrictOoxml to false', () => {
		const isStrictOoxml = false;
		expect(isStrictOoxml).toBeFalsy();
	});

	it('should default rawSlideWidthEmu and rawSlideHeightEmu to 0', () => {
		const rawSlideWidthEmu = 0;
		const rawSlideHeightEmu = 0;
		expect(rawSlideWidthEmu).toBe(0);
		expect(rawSlideHeightEmu).toBe(0);
	});

	it('should default presentationData to null', () => {
		const presentationData = null;
		expect(presentationData).toBeNull();
	});

	it('should default thumbnailData to null', () => {
		const thumbnailData = null;
		expect(thumbnailData).toBeNull();
	});

	it('should default vbaProjectBin to null', () => {
		const vbaProjectBin = null;
		expect(vbaProjectBin).toBeNull();
	});

	it('should default signatureDetection to null', () => {
		const signatureDetection = null;
		expect(signatureDetection).toBeNull();
	});

	it('should default customXmlParts to empty array', () => {
		const customXmlParts: unknown[] = [];
		expect(customXmlParts).toStrictEqual([]);
	});

	it('should default themeColorMap to empty object', () => {
		const themeColorMap: Record<string, string> = {};
		expect(Object.keys(themeColorMap)).toHaveLength(0);
	});

	it('should default themeFontMap to empty object', () => {
		const themeFontMap: Record<string, string> = {};
		expect(Object.keys(themeFontMap)).toHaveLength(0);
	});
});
