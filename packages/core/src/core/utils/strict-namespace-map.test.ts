import { describe, it, expect } from 'vitest';

import {
	normalizeNamespaceUri,
	isStrictNamespaceUri,
	detectStrictConformance,
	normalizeStrictXml,
	toStrictNamespaceUri,
	isTransitionalNamespaceUri,
	convertXmlToStrict,
} from './strict-namespace-map';

// ---------------------------------------------------------------------------
// normalizeNamespaceUri
// ---------------------------------------------------------------------------

describe('normalizeNamespaceUri', () => {
	it('converts Strict PresentationML URI to Transitional', () => {
		expect(normalizeNamespaceUri('http://purl.oclc.org/ooxml/presentationml/main')).toBe(
			'http://schemas.openxmlformats.org/presentationml/2006/main',
		);
	});

	it('converts Strict DrawingML URI to Transitional', () => {
		expect(normalizeNamespaceUri('http://purl.oclc.org/ooxml/drawingml/main')).toBe(
			'http://schemas.openxmlformats.org/drawingml/2006/main',
		);
	});

	it('converts Strict Relationships URI to Transitional', () => {
		expect(normalizeNamespaceUri('http://purl.oclc.org/ooxml/officeDocument/relationships')).toBe(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
		);
	});

	it('returns Transitional URI unchanged', () => {
		const uri = 'http://schemas.openxmlformats.org/presentationml/2006/main';
		expect(normalizeNamespaceUri(uri)).toBe(uri);
	});

	it('returns unknown URIs unchanged', () => {
		const uri = 'http://example.com/custom-namespace';
		expect(normalizeNamespaceUri(uri)).toBe(uri);
	});

	it('converts Strict SpreadsheetML URI', () => {
		expect(normalizeNamespaceUri('http://purl.oclc.org/ooxml/spreadsheetml/main')).toBe(
			'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
		);
	});

	it('converts Strict WordprocessingML URI', () => {
		expect(normalizeNamespaceUri('http://purl.oclc.org/ooxml/wordprocessingml/main')).toBe(
			'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
		);
	});

	it('converts Strict image relationship URI', () => {
		expect(
			normalizeNamespaceUri('http://purl.oclc.org/ooxml/officeDocument/relationships/image'),
		).toBe('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
	});
});

// ---------------------------------------------------------------------------
// isStrictNamespaceUri
// ---------------------------------------------------------------------------

describe('isStrictNamespaceUri', () => {
	it('returns true for Strict namespace URIs', () => {
		expect(isStrictNamespaceUri('http://purl.oclc.org/ooxml/presentationml/main')).toBeTruthy();
		expect(isStrictNamespaceUri('http://purl.oclc.org/ooxml/drawingml/main')).toBeTruthy();
	});

	it('returns false for Transitional namespace URIs', () => {
		expect(
			isStrictNamespaceUri('http://schemas.openxmlformats.org/presentationml/2006/main'),
		).toBeFalsy();
	});

	it('returns false for arbitrary URIs', () => {
		expect(isStrictNamespaceUri('http://example.com/ns')).toBeFalsy();
	});

	it('returns false for empty string', () => {
		expect(isStrictNamespaceUri('')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// detectStrictConformance
// ---------------------------------------------------------------------------

describe('detectStrictConformance', () => {
	it('returns true when root element has Strict namespace', () => {
		const xml = {
			'p:presentation': {
				'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeTruthy();
	});

	it('returns false when root element has Transitional namespace', () => {
		const xml = {
			'p:presentation': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeFalsy();
	});

	it('returns false for empty object', () => {
		expect(detectStrictConformance({})).toBeFalsy();
	});

	it('returns true when @_xmlns (default namespace) is Strict', () => {
		const xml = {
			'p:presentation': {
				'@_xmlns': 'http://purl.oclc.org/ooxml/presentationml/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeTruthy();
	});

	it('ignores non-xmlns attributes', () => {
		const xml = {
			'p:presentation': {
				'@_id': 'http://purl.oclc.org/ooxml/drawingml/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeFalsy();
	});

	it('detects Strict in any xmlns attribute', () => {
		const xml = {
			'p:presentation': {
				'@_xmlns:a': 'http://purl.oclc.org/ooxml/drawingml/main',
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeTruthy();
	});

	it('skips ?xml declaration and array children', () => {
		const xml = {
			'?xml': { '@_version': '1.0' },
			'p:sld': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		expect(detectStrictConformance(xml)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// normalizeStrictXml
// ---------------------------------------------------------------------------

describe('normalizeStrictXml', () => {
	it('normalizes xmlns attributes in-place', () => {
		const xml: Record<string, unknown> = {
			'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
		};
		normalizeStrictXml(xml);
		expect(xml['@_xmlns:p']).toBe('http://schemas.openxmlformats.org/presentationml/2006/main');
	});

	it('normalizes @_Type attributes (relationship types)', () => {
		const xml: Record<string, unknown> = {
			'@_Type': 'http://purl.oclc.org/ooxml/officeDocument/relationships/slide',
		};
		normalizeStrictXml(xml);
		expect(xml['@_Type']).toBe(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
		);
	});

	it('normalizes @_uri attributes', () => {
		const xml: Record<string, unknown> = {
			'@_uri': 'http://purl.oclc.org/ooxml/drawingml/main',
		};
		normalizeStrictXml(xml);
		expect(xml['@_uri']).toBe('http://schemas.openxmlformats.org/drawingml/2006/main');
	});

	it('does not modify Transitional URIs', () => {
		const xml: Record<string, unknown> = {
			'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
		};
		normalizeStrictXml(xml);
		expect(xml['@_xmlns:p']).toBe('http://schemas.openxmlformats.org/presentationml/2006/main');
	});

	it('recurses into child objects', () => {
		const xml: Record<string, unknown> = {
			child: {
				'@_xmlns:a': 'http://purl.oclc.org/ooxml/drawingml/main',
			},
		};
		normalizeStrictXml(xml);
		expect((xml['child'] as Record<string, unknown>)['@_xmlns:a']).toBe(
			'http://schemas.openxmlformats.org/drawingml/2006/main',
		);
	});

	it('recurses into arrays of objects', () => {
		const xml: Record<string, unknown> = {
			items: [
				{ '@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main' },
				{ '@_xmlns:a': 'http://purl.oclc.org/ooxml/drawingml/main' },
			],
		};
		normalizeStrictXml(xml);
		const items = xml['items'] as Record<string, unknown>[];
		expect(items[0]['@_xmlns:p']).toBe(
			'http://schemas.openxmlformats.org/presentationml/2006/main',
		);
		expect(items[1]['@_xmlns:a']).toBe('http://schemas.openxmlformats.org/drawingml/2006/main');
	});

	it('returns the input node', () => {
		const xml: Record<string, unknown> = { '@_id': '1' };
		const result = normalizeStrictXml(xml);
		expect(result).toBe(xml);
	});

	it('skips non-xmlns scalar attributes', () => {
		const xml: Record<string, unknown> = {
			'@_id': 'http://purl.oclc.org/ooxml/presentationml/main',
			'@_name': 'test',
		};
		normalizeStrictXml(xml);
		// @_id is not xmlns/Type/uri so it should remain unchanged
		expect(xml['@_id']).toBe('http://purl.oclc.org/ooxml/presentationml/main');
	});
});

// ---------------------------------------------------------------------------
// toStrictNamespaceUri
// ---------------------------------------------------------------------------

describe('toStrictNamespaceUri', () => {
	it('converts Transitional PresentationML URI to Strict', () => {
		expect(toStrictNamespaceUri('http://schemas.openxmlformats.org/presentationml/2006/main')).toBe(
			'http://purl.oclc.org/ooxml/presentationml/main',
		);
	});

	it('converts Transitional DrawingML URI to Strict', () => {
		expect(toStrictNamespaceUri('http://schemas.openxmlformats.org/drawingml/2006/main')).toBe(
			'http://purl.oclc.org/ooxml/drawingml/main',
		);
	});

	it('converts Transitional Relationships URI to Strict', () => {
		expect(
			toStrictNamespaceUri('http://schemas.openxmlformats.org/officeDocument/2006/relationships'),
		).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships');
	});

	it('converts Transitional slide relationship URI to Strict', () => {
		expect(
			toStrictNamespaceUri(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
			),
		).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/slide');
	});

	it('converts Transitional image relationship URI to Strict', () => {
		expect(
			toStrictNamespaceUri(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			),
		).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/image');
	});

	it('leaves the OPC package relationships namespace unchanged (conformance-independent)', () => {
		const opc = 'http://schemas.openxmlformats.org/package/2006/relationships';
		expect(toStrictNamespaceUri(opc)).toBe(opc);
	});

	it('converts Transitional SchemaLibrary URI to Strict', () => {
		expect(toStrictNamespaceUri('http://schemas.openxmlformats.org/schemaLibrary/2006/main')).toBe(
			'http://purl.oclc.org/ooxml/schemaLibrary/main',
		);
	});

	it('converts Transitional content-type description URIs to Strict', () => {
		expect(toStrictNamespaceUri('http://descriptions.openxmlformats.org/description/base')).toBe(
			'http://purl.oclc.org/ooxml/descriptions/base',
		);
		expect(toStrictNamespaceUri('http://descriptions.openxmlformats.org/description/full')).toBe(
			'http://purl.oclc.org/ooxml/descriptions/full',
		);
	});

	it('converts Transitional SpreadsheetML URI to Strict', () => {
		expect(toStrictNamespaceUri('http://schemas.openxmlformats.org/spreadsheetml/2006/main')).toBe(
			'http://purl.oclc.org/ooxml/spreadsheetml/main',
		);
	});

	it('converts Transitional WordprocessingML URI to Strict', () => {
		expect(
			toStrictNamespaceUri('http://schemas.openxmlformats.org/wordprocessingml/2006/main'),
		).toBe('http://purl.oclc.org/ooxml/wordprocessingml/main');
	});

	it('converts Transitional chart relationship URI to Strict', () => {
		expect(
			toStrictNamespaceUri(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
			),
		).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/chart');
	});

	it('leaves the Markup Compatibility namespace unchanged (conformance-independent)', () => {
		const mce = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
		expect(toStrictNamespaceUri(mce)).toBe(mce);
	});

	it('returns Strict URI unchanged', () => {
		const uri = 'http://purl.oclc.org/ooxml/presentationml/main';
		expect(toStrictNamespaceUri(uri)).toBe(uri);
	});

	it('returns unknown URIs unchanged', () => {
		const uri = 'http://example.com/custom-namespace';
		expect(toStrictNamespaceUri(uri)).toBe(uri);
	});

	it('returns empty string unchanged', () => {
		expect(toStrictNamespaceUri('')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// isTransitionalNamespaceUri
// ---------------------------------------------------------------------------

describe('isTransitionalNamespaceUri', () => {
	it('returns true for Transitional PresentationML URI', () => {
		expect(
			isTransitionalNamespaceUri('http://schemas.openxmlformats.org/presentationml/2006/main'),
		).toBeTruthy();
	});

	it('returns true for Transitional DrawingML URI', () => {
		expect(
			isTransitionalNamespaceUri('http://schemas.openxmlformats.org/drawingml/2006/main'),
		).toBeTruthy();
	});

	it('returns true for Transitional relationships URI', () => {
		expect(
			isTransitionalNamespaceUri(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
			),
		).toBeTruthy();
	});

	it('returns true for Transitional SchemaLibrary URI', () => {
		expect(
			isTransitionalNamespaceUri('http://schemas.openxmlformats.org/schemaLibrary/2006/main'),
		).toBeTruthy();
	});

	it('returns false for the conformance-independent OPC relationships namespace', () => {
		expect(
			isTransitionalNamespaceUri('http://schemas.openxmlformats.org/package/2006/relationships'),
		).toBeFalsy();
	});

	it('returns false for the conformance-independent Markup Compatibility namespace', () => {
		expect(
			isTransitionalNamespaceUri('http://schemas.openxmlformats.org/markup-compatibility/2006'),
		).toBeFalsy();
	});

	it('returns false for Strict namespace URIs', () => {
		expect(
			isTransitionalNamespaceUri('http://purl.oclc.org/ooxml/presentationml/main'),
		).toBeFalsy();
		expect(isTransitionalNamespaceUri('http://purl.oclc.org/ooxml/drawingml/main')).toBeFalsy();
	});

	it('returns false for arbitrary URIs', () => {
		expect(isTransitionalNamespaceUri('http://example.com/ns')).toBeFalsy();
	});

	it('returns false for empty string', () => {
		expect(isTransitionalNamespaceUri('')).toBeFalsy();
	});

	it('returns false for Microsoft-specific URIs not in the mapping', () => {
		expect(
			isTransitionalNamespaceUri(
				'http://schemas.microsoft.com/office/2006/relationships/vbaProject',
			),
		).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// convertXmlToStrict
// ---------------------------------------------------------------------------

describe('convertXmlToStrict', () => {
	it('converts xmlns attributes to Strict in-place', () => {
		const xml: Record<string, unknown> = {
			'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
		};
		convertXmlToStrict(xml);
		expect(xml['@_xmlns:p']).toBe('http://purl.oclc.org/ooxml/presentationml/main');
	});

	it('converts @_Type attributes to Strict', () => {
		const xml: Record<string, unknown> = {
			'@_Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
		};
		convertXmlToStrict(xml);
		expect(xml['@_Type']).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/slide');
	});

	it('converts @_uri attributes to Strict', () => {
		const xml: Record<string, unknown> = {
			'@_uri': 'http://schemas.openxmlformats.org/drawingml/2006/main',
		};
		convertXmlToStrict(xml);
		expect(xml['@_uri']).toBe('http://purl.oclc.org/ooxml/drawingml/main');
	});

	it('does not modify Strict URIs that are already strict', () => {
		const xml: Record<string, unknown> = {
			'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
		};
		convertXmlToStrict(xml);
		expect(xml['@_xmlns:p']).toBe('http://purl.oclc.org/ooxml/presentationml/main');
	});

	it('does not modify unknown URIs', () => {
		const xml: Record<string, unknown> = {
			'@_xmlns:custom': 'http://example.com/custom-namespace',
		};
		convertXmlToStrict(xml);
		expect(xml['@_xmlns:custom']).toBe('http://example.com/custom-namespace');
	});

	it('recurses into child objects', () => {
		const xml: Record<string, unknown> = {
			child: {
				'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			},
		};
		convertXmlToStrict(xml);
		expect((xml['child'] as Record<string, unknown>)['@_xmlns:a']).toBe(
			'http://purl.oclc.org/ooxml/drawingml/main',
		);
	});

	it('recurses into arrays of objects', () => {
		const xml: Record<string, unknown> = {
			items: [
				{ '@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main' },
				{ '@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main' },
			],
		};
		convertXmlToStrict(xml);
		const items = xml['items'] as Record<string, unknown>[];
		expect(items[0]['@_xmlns:p']).toBe('http://purl.oclc.org/ooxml/presentationml/main');
		expect(items[1]['@_xmlns:a']).toBe('http://purl.oclc.org/ooxml/drawingml/main');
	});

	it('returns the input node', () => {
		const xml: Record<string, unknown> = { '@_id': '1' };
		const result = convertXmlToStrict(xml);
		expect(result).toBe(xml);
	});

	it('skips non-xmlns scalar attributes', () => {
		const xml: Record<string, unknown> = {
			'@_id': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			'@_name': 'test',
		};
		convertXmlToStrict(xml);
		// @_id is not xmlns/Type/uri so it should remain unchanged
		expect(xml['@_id']).toBe('http://schemas.openxmlformats.org/presentationml/2006/main');
	});

	it('sets conformance=strict on p:presentation when setConformance is true', () => {
		const xml: Record<string, unknown> = {
			'p:presentation': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
				'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			},
		};
		convertXmlToStrict(xml, true);
		const presentation = xml['p:presentation'] as Record<string, unknown>;
		expect(presentation['@_conformance']).toBe('strict');
		expect(presentation['@_xmlns:p']).toBe('http://purl.oclc.org/ooxml/presentationml/main');
		expect(presentation['@_xmlns:a']).toBe('http://purl.oclc.org/ooxml/drawingml/main');
	});

	it('does not set conformance when setConformance is false (default)', () => {
		const xml: Record<string, unknown> = {
			'p:presentation': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		convertXmlToStrict(xml);
		const presentation = xml['p:presentation'] as Record<string, unknown>;
		expect(presentation['@_conformance']).toBeUndefined();
	});

	it('does not set conformance if there is no p:presentation element', () => {
		const xml: Record<string, unknown> = {
			'p:sld': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			},
		};
		convertXmlToStrict(xml, true);
		const slide = xml['p:sld'] as Record<string, unknown>;
		expect(slide['@_conformance']).toBeUndefined();
	});

	it('handles non-object/array input gracefully', () => {
		// @ts-expect-error - testing defensive behavior with non-object input
		const result = convertXmlToStrict(null);
		expect(result).toBeNull();

		// @ts-expect-error
		const result2 = convertXmlToStrict('string');
		expect(result2).toBe('string');
	});

	it('handles deeply nested relationship XML structures', () => {
		const xml: Record<string, unknown> = {
			Relationships: {
				'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
				Relationship: [
					{
						'@_Id': 'rId1',
						'@_Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
						'@_Target': 'slides/slide1.xml',
					},
					{
						'@_Id': 'rId2',
						'@_Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
						'@_Target': 'theme/theme1.xml',
					},
					{
						'@_Id': 'rId3',
						'@_Type':
							'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
						'@_Target': 'slideLayouts/slideLayout1.xml',
					},
				],
			},
		};
		convertXmlToStrict(xml);
		const root = xml['Relationships'] as Record<string, unknown>;
		// The OPC relationships namespace is conformance-independent: it stays.
		expect(root['@_xmlns']).toBe('http://schemas.openxmlformats.org/package/2006/relationships');
		const rels = root['Relationship'] as Record<string, unknown>[];
		expect(rels[0]['@_Type']).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/slide');
		expect(rels[1]['@_Type']).toBe('http://purl.oclc.org/ooxml/officeDocument/relationships/theme');
		expect(rels[2]['@_Type']).toBe(
			'http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout',
		);
		// Non-namespace attributes should be untouched
		expect(rels[0]['@_Target']).toBe('slides/slide1.xml');
		expect(rels[0]['@_Id']).toBe('rId1');
	});
});

// ---------------------------------------------------------------------------
// Algorithmic derivation for namespaces outside the explicit map
// ---------------------------------------------------------------------------

describe('algorithmic Strict <-> Transitional derivation', () => {
	// Strict URIs in remapped families that are NOT enumerated in the explicit
	// map. Each should still normalize on load and round-trip back on save.
	const unmappedFamilyPairs: ReadonlyArray<[string, string]> = [
		// A relationship type not in the map
		[
			'http://purl.oclc.org/ooxml/officeDocument/relationships/calcChain',
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain',
		],
		// A DrawingML sub-namespace not in the map
		[
			'http://purl.oclc.org/ooxml/drawingml/compatibility',
			'http://schemas.openxmlformats.org/drawingml/2006/compatibility',
		],
		// A deeper officeDocument content namespace not in the map
		[
			'http://purl.oclc.org/ooxml/officeDocument/customXml',
			'http://schemas.openxmlformats.org/officeDocument/2006/customXml',
		],
		// A SpreadsheetML sub-namespace not in the map
		[
			'http://purl.oclc.org/ooxml/spreadsheetml/sheetMetadata',
			'http://schemas.openxmlformats.org/spreadsheetml/2006/sheetMetadata',
		],
	];

	it('normalizes unmapped Strict family URIs to Transitional', () => {
		for (const [strict, transitional] of unmappedFamilyPairs) {
			expect(normalizeNamespaceUri(strict)).toBe(transitional);
		}
	});

	it('converts unmapped Transitional family URIs back to Strict', () => {
		for (const [strict, transitional] of unmappedFamilyPairs) {
			expect(toStrictNamespaceUri(transitional)).toBe(strict);
		}
	});

	it('round-trips unmapped family URIs losslessly (Strict -> Transitional -> Strict)', () => {
		for (const [strict] of unmappedFamilyPairs) {
			expect(toStrictNamespaceUri(normalizeNamespaceUri(strict))).toBe(strict);
		}
	});

	it('recognises derived Transitional family URIs', () => {
		for (const [, transitional] of unmappedFamilyPairs) {
			expect(isTransitionalNamespaceUri(transitional)).toBeTruthy();
		}
	});

	it('does NOT derive OPC / package family URIs outside the explicit map', () => {
		// Open Packaging Conventions are conformance-independent; an unmapped
		// package URI must be left untouched, not structurally rewritten.
		const unmappedPackage = 'http://purl.oclc.org/ooxml/package/relationships/metadata/thumbnail';
		expect(normalizeNamespaceUri(unmappedPackage)).toBe(unmappedPackage);

		const unmappedPackageTransitional =
			'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
		expect(toStrictNamespaceUri(unmappedPackageTransitional)).toBe(unmappedPackageTransitional);
		expect(isTransitionalNamespaceUri(unmappedPackageTransitional)).toBeFalsy();
	});

	it('does NOT derive markup-compatibility outside the explicit map', () => {
		// MCE carries its own trailing version segment; only the explicit map
		// entry (terminal 2006) converts it, never the structural rule.
		const mcStrict = 'http://purl.oclc.org/ooxml/markup-compatibility/2007';
		expect(normalizeNamespaceUri(mcStrict)).toBe(mcStrict);
	});

	it('leaves non-OOXML namespaces untouched in both directions', () => {
		const microsoft = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
		const dublinCore = 'http://purl.org/dc/elements/1.1/';
		expect(normalizeNamespaceUri(microsoft)).toBe(microsoft);
		expect(toStrictNamespaceUri(microsoft)).toBe(microsoft);
		expect(normalizeNamespaceUri(dublinCore)).toBe(dublinCore);
		expect(toStrictNamespaceUri(dublinCore)).toBe(dublinCore);
		expect(isTransitionalNamespaceUri(microsoft)).toBeFalsy();
	});

	it('normalizes unmapped family namespaces inside an XML tree', () => {
		const xml: Record<string, unknown> = {
			'p:sld': {
				'@_xmlns:cc': 'http://purl.oclc.org/ooxml/drawingml/compatibility',
				rel: { '@_Type': 'http://purl.oclc.org/ooxml/officeDocument/relationships/calcChain' },
			},
		};
		normalizeStrictXml(xml);
		const slide = xml['p:sld'] as Record<string, unknown>;
		expect(slide['@_xmlns:cc']).toBe(
			'http://schemas.openxmlformats.org/drawingml/2006/compatibility',
		);
		expect((slide['rel'] as Record<string, unknown>)['@_Type']).toBe(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain',
		);
	});

	it('converts unmapped family namespaces inside an XML tree back to Strict', () => {
		const xml: Record<string, unknown> = {
			'p:sld': {
				'@_xmlns:cc': 'http://schemas.openxmlformats.org/drawingml/2006/compatibility',
				rel: {
					'@_Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain',
				},
			},
		};
		convertXmlToStrict(xml);
		const slide = xml['p:sld'] as Record<string, unknown>;
		expect(slide['@_xmlns:cc']).toBe('http://purl.oclc.org/ooxml/drawingml/compatibility');
		expect((slide['rel'] as Record<string, unknown>)['@_Type']).toBe(
			'http://purl.oclc.org/ooxml/officeDocument/relationships/calcChain',
		);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: normalizeStrictXml -> convertXmlToStrict
// ---------------------------------------------------------------------------

describe('round-trip: Strict -> Transitional -> Strict', () => {
	it('round-trips a presentation root element', () => {
		const original: Record<string, unknown> = {
			'p:presentation': {
				'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
				'@_xmlns:a': 'http://purl.oclc.org/ooxml/drawingml/main',
				'@_xmlns:r': 'http://purl.oclc.org/ooxml/officeDocument/relationships',
				'@_conformance': 'strict',
				'p:sldSz': { '@_cx': '9144000', '@_cy': '6858000' },
			},
		};

		// Deep clone for comparison
		const originalClone = JSON.parse(JSON.stringify(original));

		// Normalize to Transitional
		normalizeStrictXml(original);
		const presentation = original['p:presentation'] as Record<string, unknown>;
		expect(presentation['@_xmlns:p']).toBe(
			'http://schemas.openxmlformats.org/presentationml/2006/main',
		);
		expect(presentation['@_xmlns:a']).toBe('http://schemas.openxmlformats.org/drawingml/2006/main');
		expect(presentation['@_xmlns:r']).toBe(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
		);

		// Convert back to Strict (with conformance attribute)
		convertXmlToStrict(original, true);
		expect(presentation['@_xmlns:p']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:p'],
		);
		expect(presentation['@_xmlns:a']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:a'],
		);
		expect(presentation['@_xmlns:r']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:r'],
		);
		expect(presentation['@_conformance']).toBe('strict');
	});

	it('round-trips a slide element', () => {
		const original: Record<string, unknown> = {
			'p:sld': {
				'@_xmlns:p': 'http://purl.oclc.org/ooxml/presentationml/main',
				'@_xmlns:a': 'http://purl.oclc.org/ooxml/drawingml/main',
				'p:cSld': {
					'p:spTree': {
						'p:sp': {
							'@_xmlns:r': 'http://purl.oclc.org/ooxml/officeDocument/relationships',
						},
					},
				},
			},
		};

		const originalClone = JSON.parse(JSON.stringify(original));

		normalizeStrictXml(original);
		convertXmlToStrict(original);

		expect(JSON.stringify(original)).toBe(JSON.stringify(originalClone));
	});

	it('round-trips a realistic strict relationships file', () => {
		// Mirrors a real Office "Strict Open XML" package-level .rels: the OPC
		// namespace and the OPC-defined core-properties relationship type stay in
		// their canonical (schemas.openxmlformats.org) form, while the
		// officeDocument relationship type uses the Strict (purl.oclc.org) form.
		const original: Record<string, unknown> = {
			Relationships: {
				'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
				Relationship: [
					{
						'@_Id': 'rId1',
						'@_Type': 'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument',
						'@_Target': 'ppt/presentation.xml',
					},
					{
						'@_Id': 'rId2',
						'@_Type':
							'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
						'@_Target': 'docProps/core.xml',
					},
				],
			},
		};

		const originalClone = JSON.parse(JSON.stringify(original));

		// Loading normalizes the Strict officeDocument rel type to Transitional;
		// the OPC namespace and core-properties type are left untouched.
		normalizeStrictXml(original);
		const root = original['Relationships'] as Record<string, unknown>;
		expect(root['@_xmlns']).toBe('http://schemas.openxmlformats.org/package/2006/relationships');
		const rels = root['Relationship'] as Record<string, unknown>[];
		expect(rels[0]['@_Type']).toBe(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
		);
		expect(rels[1]['@_Type']).toBe(
			'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
		);

		// Saving converts the officeDocument rel type back to Strict, restoring
		// the original document byte-for-byte.
		convertXmlToStrict(original);
		expect(JSON.stringify(original)).toBe(JSON.stringify(originalClone));
	});

	it('round-trips all namespace pairs consistently', () => {
		// Build an XML tree that uses every Strict URI in an xmlns attribute
		const strictUris = [
			'http://purl.oclc.org/ooxml/presentationml/main',
			'http://purl.oclc.org/ooxml/drawingml/main',
			'http://purl.oclc.org/ooxml/drawingml/chart',
			'http://purl.oclc.org/ooxml/officeDocument/relationships',
			'http://purl.oclc.org/ooxml/officeDocument/relationships/slide',
			'http://purl.oclc.org/ooxml/schemaLibrary/main',
			'http://purl.oclc.org/ooxml/descriptions/base',
			'http://purl.oclc.org/ooxml/spreadsheetml/main',
			'http://purl.oclc.org/ooxml/wordprocessingml/main',
		];

		for (const strictUri of strictUris) {
			// Test via xmlns
			const xmlNs: Record<string, unknown> = { '@_xmlns:test': strictUri };
			normalizeStrictXml(xmlNs);
			expect(xmlNs['@_xmlns:test']).not.toBe(strictUri); // should have changed
			convertXmlToStrict(xmlNs);
			expect(xmlNs['@_xmlns:test']).toBe(strictUri); // should be back

			// Test via @_Type (relationship types)
			const xmlType: Record<string, unknown> = { '@_Type': strictUri };
			normalizeStrictXml(xmlType);
			convertXmlToStrict(xmlType);
			expect(xmlType['@_Type']).toBe(strictUri);
		}
	});
});

// ---------------------------------------------------------------------------
// Round-trip: Transitional -> Strict -> Transitional
// ---------------------------------------------------------------------------

describe('round-trip: Transitional -> Strict -> Transitional', () => {
	it('round-trips a transitional presentation root', () => {
		const original: Record<string, unknown> = {
			'p:presentation': {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
				'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
				'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
			},
		};

		const originalClone = JSON.parse(JSON.stringify(original));

		// Convert to Strict
		convertXmlToStrict(original);
		const presentation = original['p:presentation'] as Record<string, unknown>;
		expect(presentation['@_xmlns:p']).toBe('http://purl.oclc.org/ooxml/presentationml/main');

		// Normalize back to Transitional
		normalizeStrictXml(original);
		expect(presentation['@_xmlns:p']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:p'],
		);
		expect(presentation['@_xmlns:a']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:a'],
		);
		expect(presentation['@_xmlns:r']).toBe(
			(originalClone['p:presentation'] as Record<string, unknown>)['@_xmlns:r'],
		);
	});
});
