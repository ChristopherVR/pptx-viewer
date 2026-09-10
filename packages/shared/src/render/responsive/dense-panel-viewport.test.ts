import { describe, expect, it } from 'vitest';

import { MOBILE_BREAKPOINT } from '../mobile-viewport';
import { isDensePanelCompact } from './dense-panel-viewport';

describe('isDensePanelCompact', () => {
	it('is compact at a phone width (360px)', () => {
		expect(isDensePanelCompact(360)).toBeTruthy();
	});

	it('is compact right up to the mobile breakpoint', () => {
		expect(isDensePanelCompact(MOBILE_BREAKPOINT - 1)).toBeTruthy();
	});

	it('is not compact at or above the mobile breakpoint', () => {
		expect(isDensePanelCompact(MOBILE_BREAKPOINT)).toBeFalsy();
		expect(isDensePanelCompact(1280)).toBeFalsy();
	});
});
