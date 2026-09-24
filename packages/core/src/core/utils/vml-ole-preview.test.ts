/**
 * Tests for {@link findVmlOlePreviewRelationshipId}.
 */
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types/common';
import { findVmlOlePreviewRelationshipId } from './vml-ole-preview';

describe('findVmlOlePreviewRelationshipId', () => {
	it('finds a v:imagedata/@r:id nested under p:pic > v:shape', () => {
		const oleObject: XmlObject = {
			'@_progId': 'Package',
			'p:embed': {},
			'p:pic': {
				'v:shape': {
					'@_id': '_x0000_i1027',
					'v:imagedata': { '@_r:id': 'rId3', '@_o:title': '' },
				},
			},
		};
		expect(findVmlOlePreviewRelationshipId(oleObject, undefined)).toBe('rId3');
	});

	it('falls back to the legacy @o:relid attribute when @r:id is absent', () => {
		const oleObject: XmlObject = {
			'p:pic': {
				'v:shape': {
					'v:imagedata': { '@_o:relid': 'rId9' },
				},
			},
		};
		expect(findVmlOlePreviewRelationshipId(oleObject, undefined)).toBe('rId9');
	});

	it('returns undefined when there is no v:imagedata anywhere', () => {
		const oleObject: XmlObject = {
			'p:pic': {
				'p:blipFill': { 'a:blip': { '@_r:embed': 'rId1' } },
			},
		};
		expect(findVmlOlePreviewRelationshipId(oleObject, undefined)).toBeUndefined();
	});

	it('checks the other mc:AlternateContent branch when the resolved node has no VML preview', () => {
		const fallbackOleObject: XmlObject = {
			'@_progId': 'Package',
			'p:embed': {},
			// No p:pic at all in this branch.
		};
		const graphicData: XmlObject = {
			'mc:AlternateContent': {
				'mc:Choice': {
					'@_Requires': 'v',
					'p:oleObj': {
						'@_progId': 'Package',
						'p:embed': {},
						'v:shape': {
							'v:imagedata': { '@_r:id': 'rId3' },
						},
					},
				},
				'mc:Fallback': {
					'p:oleObj': fallbackOleObject,
				},
			},
		};
		expect(findVmlOlePreviewRelationshipId(fallbackOleObject, graphicData)).toBe('rId3');
	});

	it('returns undefined when neither the resolved node nor other branches carry a VML preview', () => {
		const fallbackOleObject: XmlObject = { '@_progId': 'Package', 'p:embed': {} };
		const graphicData: XmlObject = {
			'mc:AlternateContent': {
				'mc:Choice': { '@_Requires': 'v', 'p:oleObj': { '@_progId': 'Package', 'p:embed': {} } },
				'mc:Fallback': { 'p:oleObj': fallbackOleObject },
			},
		};
		expect(findVmlOlePreviewRelationshipId(fallbackOleObject, graphicData)).toBeUndefined();
	});
});
