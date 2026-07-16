import { describe, expect, it } from 'vitest';

import { reorderAnimationEntries } from './animation-timeline-editing';

describe('reorderAnimationEntries', () => {
	it('moves a dragged animation and rewrites stable order values', () => {
		const result = reorderAnimationEntries(
			[
				{ elementId: 'a', order: 4 },
				{ elementId: 'b', order: 8 },
				{ elementId: 'c', order: 9 },
			],
			'c',
			'a',
		);
		expect(result.map((entry) => [entry.elementId, entry.order])).toStrictEqual([
			['c', 0],
			['a', 1],
			['b', 2],
		]);
	});
});
