import { describe, expect, it } from 'vitest';

import { computeAnchoredPopupPosition } from './anchored-popup-position';

describe('computeAnchoredPopupPosition', () => {
	it('aligns from the left edge by default', () => {
		const pos = computeAnchoredPopupPosition({ left: 40, right: 96, bottom: 120 });
		expect(pos).toStrictEqual({ top: 120, left: 40, right: null });
	});

	it('aligns from the right edge when alignRight is set', () => {
		const pos = computeAnchoredPopupPosition(
			{ left: 40, right: 96, bottom: 120 },
			{ alignRight: true, viewportWidth: 800 },
		);
		expect(pos).toStrictEqual({ top: 120, left: null, right: 704 });
	});

	it('bakes in no gap: top is exactly the anchor bottom', () => {
		const pos = computeAnchoredPopupPosition({ left: 0, right: 0, bottom: 55.5 });
		expect(pos.top).toBe(55.5);
	});
});
