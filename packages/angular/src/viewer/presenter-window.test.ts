/**
 * presenter-window.test.ts: Pure-helper coverage for the audience handoff.
 *
 * Guards the wire-compatible constants and the framework-agnostic helpers used
 * by both the presenter side (open audience window) and the audience side
 * (parse nonce, detect audience tab). The stateful window/IndexedDB paths need
 * a browser and are exercised via e2e, not here.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { AUDIENCE_HASH, isAudienceTab } from './audience-content-store';
import {
	AUDIENCE_NONCE_KEY,
	PRESENTER_CHANNEL_NAME,
	PRESENTER_MSG_ORIGIN,
	isPresenterMessage,
	parseAudienceNonce,
} from './presenter-window.service';

afterEach(() => {
	window.location.hash = '';
});

describe('audience constants', () => {
	it('match the React/Vue wire contract', () => {
		expect(AUDIENCE_HASH).toBe('#pptx-audience');
		expect(PRESENTER_CHANNEL_NAME).toBe('pptx-viewer-presenter');
		expect(PRESENTER_MSG_ORIGIN).toBe('pptx-viewer-presenter');
		expect(AUDIENCE_NONCE_KEY).toBe('nonce');
	});
});

describe('isAudienceTab', () => {
	it('is false without the audience hash', () => {
		window.location.hash = '';
		expect(isAudienceTab()).toBeFalsy();
	});

	it('is true when the hash starts with the audience marker', () => {
		window.location.hash = `${AUDIENCE_HASH}&nonce=abc`;
		expect(isAudienceTab()).toBeTruthy();
	});
});

describe('parseAudienceNonce', () => {
	it('returns null when the hash is not an audience hash', () => {
		window.location.hash = '#something-else';
		expect(parseAudienceNonce()).toBeNull();
	});

	it('extracts the nonce from the audience hash', () => {
		window.location.hash = `${AUDIENCE_HASH}&nonce=session-123`;
		expect(parseAudienceNonce()).toBe('session-123');
	});

	it('returns null when the hash carries no nonce', () => {
		window.location.hash = AUDIENCE_HASH;
		expect(parseAudienceNonce()).toBeNull();
	});
});

describe('isPresenterMessage', () => {
	it('accepts a well-formed slide-change message', () => {
		expect(
			isPresenterMessage({
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex: 2,
				sessionId: 's1',
			}),
		).toBeTruthy();
	});

	it('accepts a well-formed exit message', () => {
		expect(
			isPresenterMessage({
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-exit',
				sessionId: 's1',
			}),
		).toBeTruthy();
	});

	it('rejects foreign or malformed payloads', () => {
		expect(isPresenterMessage(null)).toBeFalsy();
		expect(
			isPresenterMessage({ origin: 'other', type: 'presenter-exit', sessionId: 's1' }),
		).toBeFalsy();
		expect(
			isPresenterMessage({ origin: PRESENTER_MSG_ORIGIN, type: 'presenter-exit' }),
		).toBeFalsy();
	});
});
