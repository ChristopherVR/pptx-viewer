import { describe, expect, it } from 'vitest';

import { buildPresentationTouchControlState } from './presentation-touch-controls';

describe('buildPresentationTouchControlState', () => {
	it('disables both directions for an empty presentation', () => {
		expect(buildPresentationTouchControlState(0, 0)).toStrictEqual({
			previousDisabled: true,
			nextDisabled: true,
			counterLabel: '0 / 0',
		});
	});

	it('disables previous on the first slide', () => {
		expect(buildPresentationTouchControlState(0, 3)).toStrictEqual({
			previousDisabled: true,
			nextDisabled: false,
			counterLabel: '1 / 3',
		});
	});

	it('disables next on the final slide', () => {
		expect(buildPresentationTouchControlState(2, 3)).toStrictEqual({
			previousDisabled: false,
			nextDisabled: true,
			counterLabel: '3 / 3',
		});
	});
});
