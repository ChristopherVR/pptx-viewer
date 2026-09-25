/**
 * Tests for PK-H2: `xmlns:a16` declared on the slide root and `mc:Ignorable`
 * extended to include `a16`, rather than the namespace declared on the
 * leaf `<a16:colId>` element.
 */
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	A16_NAMESPACE,
	ensureA16NamespaceOnSlideRoot,
	rebuildTableXmlFromData,
	slideContainsA16Element,
} from './table-xml-rebuild';

const ensureArray = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

describe('rebuildTableXmlFromData — a16 namespace placement', () => {
	it('omits xmlns:a16 from the leaf <a16:colId>', () => {
		const tbl: XmlObject = {};
		rebuildTableXmlFromData(
			tbl,
			{
				rows: [{ cells: [{ text: 'A' }] }],
				columnWidths: [1],
			},
			9525,
			ensureArray,
		);
		const gridCol = tbl['a:tblGrid']['a:gridCol'];
		const colIdNode = gridCol['a:extLst']['a:ext']['a16:colId'];
		expect(colIdNode['@_xmlns:a16']).toBeUndefined();
		expect(colIdNode['@_val']).toMatch(/^\d+$/);
	});
});

describe('ensureA16NamespaceOnSlideRoot', () => {
	it('declares xmlns:a16, xmlns:mc, and adds a16 to mc:Ignorable on a fresh slide root', () => {
		const slideRoot: XmlObject = {};
		ensureA16NamespaceOnSlideRoot(slideRoot);
		expect(slideRoot['@_xmlns:a16']).toBe(A16_NAMESPACE);
		expect(slideRoot['@_xmlns:mc']).toBe(
			'http://schemas.openxmlformats.org/markup-compatibility/2006',
		);
		expect(slideRoot['@_mc:Ignorable']).toBe('a16');
	});

	it('appends a16 to an existing mc:Ignorable list', () => {
		const slideRoot: XmlObject = { '@_mc:Ignorable': 'p14 p15' };
		ensureA16NamespaceOnSlideRoot(slideRoot);
		expect(slideRoot['@_mc:Ignorable']).toBe('p14 p15 a16');
	});

	it('is idempotent', () => {
		const slideRoot: XmlObject = { '@_mc:Ignorable': 'a16' };
		ensureA16NamespaceOnSlideRoot(slideRoot);
		ensureA16NamespaceOnSlideRoot(slideRoot);
		expect(slideRoot['@_mc:Ignorable']).toBe('a16');
	});
});

describe('slideContainsA16Element', () => {
	it('detects a16:* descendants', () => {
		const slide = {
			'p:cSld': {
				'p:spTree': {
					'p:graphicFrame': {
						'a:graphic': {
							'a:graphicData': {
								'a:tbl': {
									'a:tblGrid': {
										'a:gridCol': {
											'a:extLst': {
												'a:ext': { 'a16:colId': { '@_val': '1' } },
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};
		expect(slideContainsA16Element(slide)).toBeTruthy();
	});

	it('returns false for slides without a16 elements', () => {
		const slide = { 'p:cSld': { 'p:spTree': { 'p:sp': [] } } };
		expect(slideContainsA16Element(slide)).toBeFalsy();
	});

	it('returns false for a self-declaring a16:creationId (parser-produced input)', () => {
		// PowerPoint's own "Insert" UI stamps every shape with a stable
		// a16:creationId inside a URI-guarded a:ext, declaring xmlns:a16
		// locally. A reader that does not know the URI skips the whole
		// a:ext block, so this needs no root-level mc:Ignorable, and
		// treating it as needing one materialized mc:Ignorable="a16" on
		// every slide with authored creation-id metadata.
		const slide = {
			'p:cSld': {
				'p:spTree': {
					'p:sp': {
						'p:nvSpPr': {
							'p:cNvPr': {
								'a:extLst': {
									'a:ext': {
										'@_uri': '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}',
										'a16:creationId': {
											'@_xmlns:a16': 'http://schemas.microsoft.com/office/drawing/2014/main',
											'@_id': '{00000000-0000-0000-0000-000000000000}',
										},
									},
								},
							},
						},
					},
				},
			},
		};
		expect(slideContainsA16Element(slide)).toBeFalsy();
	});

	it('still returns true when a bare a16:colId sits alongside a self-declaring a16:creationId', () => {
		const slide = {
			'p:cSld': {
				'p:spTree': {
					'p:graphicFrame': {
						'a:graphic': {
							'a:graphicData': {
								'a:tbl': {
									'a:tblGrid': {
										'a:gridCol': {
											'a:extLst': {
												'a:ext': { 'a16:colId': { '@_val': '1' } },
											},
										},
									},
								},
							},
						},
					},
					'p:sp': {
						'p:nvSpPr': {
							'p:cNvPr': {
								'a:extLst': {
									'a:ext': {
										'a16:creationId': {
											'@_xmlns:a16': 'http://schemas.microsoft.com/office/drawing/2014/main',
											'@_id': '{00000000-0000-0000-0000-000000000000}',
										},
									},
								},
							},
						},
					},
				},
			},
		};
		expect(slideContainsA16Element(slide)).toBeTruthy();
	});
});
