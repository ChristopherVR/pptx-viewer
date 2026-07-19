import { afterEach, describe, expect, it } from 'vitest';

import {
	AUDIENCE_HASH,
	clearAudienceContent,
	isAudienceTab,
	loadAudienceContent,
	parseAudienceNonce,
} from './audience-content-store';

describe('audience-content-store', () => {
	afterEach(() => {
		if (typeof window !== 'undefined') {
			window.location.hash = '';
		}
	});

	it('uses a stable audience hash for cross-binding wire compatibility', () => {
		expect(AUDIENCE_HASH).toBe('#pptx-audience');
	});

	it('detects an audience tab from the URL hash', () => {
		if (typeof window === 'undefined') {
			expect(isAudienceTab()).toBeFalsy();
			return;
		}
		window.location.hash = '';
		expect(isAudienceTab()).toBeFalsy();
		window.location.hash = `${AUDIENCE_HASH}&nonce=abc`;
		expect(isAudienceTab()).toBeTruthy();
	});

	it('parses the session nonce from the audience hash', () => {
		if (typeof window === 'undefined') {
			expect(parseAudienceNonce()).toBeNull();
			return;
		}
		window.location.hash = '';
		expect(parseAudienceNonce()).toBeNull();
		window.location.hash = `${AUDIENCE_HASH}&nonce=session-123`;
		expect(parseAudienceNonce()).toBe('session-123');
	});

	it('loadAudienceContent resolves null when nothing is stored', async () => {
		await expect(loadAudienceContent()).resolves.toBeNull();
	});

	it('clearAudienceContent resolves without throwing', async () => {
		await expect(clearAudienceContent()).resolves.toBeUndefined();
	});
});
