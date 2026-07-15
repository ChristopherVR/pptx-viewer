import { describe, expect, it } from 'vitest';

import {
	buildPresentationAudienceUrl,
	createInitialPresentationSnapshot,
	isPresentationAudience,
	isPresentationSessionMessage,
	parsePresentationSessionId,
	resolveAudienceScreenPlacement,
} from './presentation-session';

describe('presentation session', () => {
	it('builds and parses a session-scoped audience URL', () => {
		const url = buildPresentationAudienceUrl('https://example.test/deck?mode=edit', 'session-1');
		expect(url).toBe('https://example.test/deck?mode=edit#pptx-audience&nonce=session-1');
		expect(parsePresentationSessionId(new URL(url).hash)).toBe('session-1');
		expect(isPresentationAudience(new URL(url).hash)).toBeTruthy();
	});

	it('rejects legacy audience hashes without a session', () => {
		expect(parsePresentationSessionId('#pptx-audience')).toBeNull();
		expect(isPresentationAudience('#other')).toBeFalsy();
	});

	it('creates a complete initial snapshot', () => {
		expect(createInitialPresentationSnapshot(3)).toStrictEqual({
			slideIndex: 3,
			buildStep: 0,
			sequence: 0,
			blackout: 'none',
			paused: false,
			elapsedMs: 0,
			pointer: { tool: 'none', x: 0.5, y: 0.5, color: '#ef4444' },
			inkStrokes: [],
			zoom: { scale: 1, originX: 0.5, originY: 0.5 },
			subtitlesVisible: false,
			caption: '',
		});
	});

	it('validates ready, state, and exit messages', () => {
		const origin = 'pptx-viewer-presenter';
		expect(
			isPresentationSessionMessage({ origin, type: 'audience-ready', sessionId: 'a' }),
		).toBeTruthy();
		expect(
			isPresentationSessionMessage({
				origin,
				type: 'presenter-state',
				sessionId: 'a',
				snapshot: createInitialPresentationSnapshot(),
			}),
		).toBeTruthy();
		expect(
			isPresentationSessionMessage({ origin, type: 'presenter-exit', sessionId: 'a' }),
		).toBeTruthy();
		expect(
			isPresentationSessionMessage({
				origin,
				type: 'presenter-state',
				sessionId: 'a',
				snapshot: {},
			}),
		).toBeFalsy();
	});

	it('selects a non-current external display when window management is available', async () => {
		const current = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 };
		const external = {
			availLeft: 1920,
			availTop: 0,
			availWidth: 2560,
			availHeight: 1440,
			label: 'Projector',
		};
		const sourceWindow = {
			getScreenDetails: async () => ({ currentScreen: current, screens: [current, external] }),
		} as unknown as Window;
		await expect(resolveAudienceScreenPlacement(sourceWindow)).resolves.toStrictEqual({
			left: 1920,
			top: 0,
			width: 2560,
			height: 1440,
			label: 'Projector',
		});
	});

	it('falls back cleanly when window management is unavailable', async () => {
		await expect(resolveAudienceScreenPlacement({} as Window)).resolves.toBeNull();
	});
});
