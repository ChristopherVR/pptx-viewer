/**
 * Regression coverage for wiring `a:tcStyle/a:cell3D` into
 * {@link parseTableStyleEntry} (issue G5): the per-section parse loop used to
 * extract fill/text/border only, silently dropping a style-level bevel.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { parseTableStyleEntry } from './table-style-entry-parse';

describe('parseTableStyleEntry - a:tcStyle/a:cell3D (issue G5)', () => {
	it('parses a whole-table cell3D bevel into wholeTblCell3D', () => {
		const style: XmlObject = {
			'@_styleId': '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}',
			'a:wholeTbl': {
				'a:tcStyle': {
					'a:cell3D': {
						'@_prstMaterial': 'metal',
						'a:bevel': { '@_w': '9525', '@_h': '9525', '@_prst': 'relaxedInset' },
					},
				},
			},
		};
		const entry = parseTableStyleEntry(style);
		expect(entry?.wholeTblCell3D).toStrictEqual({
			material: 'metal',
			bevelWidth: 1,
			bevelHeight: 1,
			bevelPreset: 'relaxedInset',
		});
	});

	it('leaves wholeTblCell3D undefined when no section defines one', () => {
		const style: XmlObject = { '@_styleId': '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}' };
		const entry = parseTableStyleEntry(style);
		expect(entry?.wholeTblCell3D).toBeUndefined();
	});
});
