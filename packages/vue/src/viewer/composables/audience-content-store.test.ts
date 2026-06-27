import { afterEach, describe, expect, it } from 'vitest';

import {
	AUDIENCE_HASH,
	clearAudienceContent,
	isAudienceTab,
	loadAudienceContent,
} from './audience-content-store';

describe('audience-content-store', () => {
	afterEach(() => {
		window.location.hash = '';
	});

	it('uses the same audience hash as React for wire compatibility', () => {
		expect(AUDIENCE_HASH).toBe('#pptx-audience');
	});

	it('detects an audience tab from the URL hash', () => {
		window.location.hash = '';
		expect(isAudienceTab()).toBeFalsy();
		window.location.hash = `${AUDIENCE_HASH}&nonce=abc`;
		expect(isAudienceTab()).toBeTruthy();
	});

	it('loadAudienceContent resolves null when nothing is stored / IndexedDB is unavailable', async () => {
		await expect(loadAudienceContent()).resolves.toBeNull();
	});

	it('clearAudienceContent resolves without throwing', async () => {
		await expect(clearAudienceContent()).resolves.toBeUndefined();
	});
});
