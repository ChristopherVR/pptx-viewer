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
});
