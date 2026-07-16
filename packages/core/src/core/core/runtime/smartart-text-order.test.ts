import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	annotateSmartArtTextOrder,
	orderedSmartArtTextEntries,
	smartArtChildOrder,
} from './smartart-text-order';

describe('smartArt text order annotation', () => {
	it.each([null, undefined, '', 0, false])('ignores primitive parser result %j', (parsed) => {
		expect(() => annotateSmartArtTextOrder('<a:txBody><a:p/></a:txBody>', parsed)).not.toThrow();
	});

	it('filters primitive paragraph array values before WeakMap annotation', () => {
		const paragraph: XmlObject = {
			'a:r': [{ 'a:t': 'First' }, { 'a:t': 'Second' }],
			'a:tab': '',
		};
		const parsed = {
			'a:txBody': {
				'a:p': [null, '', 7, paragraph],
			},
		};

		expect(() =>
			annotateSmartArtTextOrder(
				'<a:txBody><a:p><a:r><a:t>First</a:t></a:r><a:tab/><a:r><a:t>Second</a:t></a:r></a:p></a:txBody>',
				parsed,
			),
		).not.toThrow();
		expect(smartArtChildOrder(paragraph)).toStrictEqual(['r', 'tab', 'r']);
		expect(orderedSmartArtTextEntries(paragraph).map(([key]) => key)).toStrictEqual([
			'a:r',
			'a:tab',
			'a:r',
		]);
	});
});
