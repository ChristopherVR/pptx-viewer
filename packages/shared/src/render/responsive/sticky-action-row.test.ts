import { describe, expect, it } from 'vitest';

import { shouldStickyActionRow } from './sticky-action-row';

describe('shouldStickyActionRow', () => {
	it('is sticky at 360x640 (narrow and short)', () => {
		expect(shouldStickyActionRow(360, 640)).toBeTruthy();
	});

	it('is sticky on a narrow but tall viewport (width drives it)', () => {
		expect(shouldStickyActionRow(360, 900)).toBeTruthy();
	});

	it('is sticky on a wide but short viewport (height drives it)', () => {
		expect(shouldStickyActionRow(1280, 600)).toBeTruthy();
	});

	it('is not sticky on a comfortable desktop viewport', () => {
		expect(shouldStickyActionRow(1280, 800)).toBeFalsy();
	});
});
