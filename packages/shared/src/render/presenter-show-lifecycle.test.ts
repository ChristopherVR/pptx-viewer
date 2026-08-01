import { describe, expect, it } from 'vitest';

import {
	AUDIENCE_FULLSCREEN_BOUNCE_MS,
	createPresenterShowGuard,
} from './presenter-show-lifecycle';

describe('createPresenterShowGuard', () => {
	it('ends the show for a fullscreen exit nobody asked for', () => {
		const guard = createPresenterShowGuard();
		expect(guard.classifyFullscreenExit(1_000)).toBe('end-show');
	});

	it('restores the show for the bounce the audience popup causes', () => {
		const guard = createPresenterShowGuard();
		guard.expectAudienceBounce(1_000);
		expect(guard.isExpectingBounce(1_000)).toBeTruthy();
		expect(guard.classifyFullscreenExit(1_010)).toBe('restore-show');
	});

	it('is one-shot: a second exit is the presenter, not the popup', () => {
		const guard = createPresenterShowGuard();
		guard.expectAudienceBounce(1_000);
		expect(guard.classifyFullscreenExit(1_005)).toBe('restore-show');
		expect(guard.classifyFullscreenExit(1_006)).toBe('end-show');
	});

	it('expires so a later Escape is never swallowed', () => {
		const guard = createPresenterShowGuard();
		guard.expectAudienceBounce(1_000);
		const late = 1_000 + AUDIENCE_FULLSCREEN_BOUNCE_MS + 1;
		expect(guard.isExpectingBounce(late)).toBeFalsy();
		expect(guard.classifyFullscreenExit(late)).toBe('end-show');
	});

	it('honours a custom grace window', () => {
		const guard = createPresenterShowGuard({ graceMs: 5 });
		guard.expectAudienceBounce(0);
		expect(guard.classifyFullscreenExit(20)).toBe('end-show');
	});

	it('disarms without consuming, so ending the show still ends it', () => {
		const guard = createPresenterShowGuard();
		guard.expectAudienceBounce(1_000);
		guard.disarm();
		expect(guard.isExpectingBounce(1_001)).toBeFalsy();
		expect(guard.classifyFullscreenExit(1_001)).toBe('end-show');
	});

	it('re-arms for a second audience display open', () => {
		const guard = createPresenterShowGuard();
		guard.expectAudienceBounce(1_000);
		expect(guard.classifyFullscreenExit(1_001)).toBe('restore-show');
		guard.expectAudienceBounce(9_000);
		expect(guard.classifyFullscreenExit(9_001)).toBe('restore-show');
	});
});
