import { toggleSheet } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { nextMobileSheet } from './MobileChromeOverlay';

describe('mobileChromeOverlay sheet-toggle priority', () => {
	it('opens a sheet from closed', () => {
		expect(nextMobileSheet(null, 'slides')).toBe('slides');
	});

	it('closes the sheet that is already open (tapping it again)', () => {
		expect(nextMobileSheet('inspector', 'inspector')).toBeNull();
	});

	it('switches to a different sheet, closing the previous one', () => {
		expect(nextMobileSheet('slides', 'comments')).toBe('comments');
		expect(nextMobileSheet('notes', 'inspector')).toBe('inspector');
	});

	it('matches shared toggleSheet for every pair, the same priority order every binding shares', () => {
		const keys = ['slides', 'inspector', 'comments', 'notes'] as const;
		for (const current of [...keys, null]) {
			for (const tapped of keys) {
				expect(nextMobileSheet(current, tapped)).toBe(toggleSheet(current, tapped));
			}
		}
	});
});
