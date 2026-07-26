import { describe, it, expect, vi } from 'vitest';

import { endAudienceDisplay, isAudienceDisplayHash, mayLeaveSlideShow } from './audience-display';

describe('isAudienceDisplayHash', () => {
	it('matches the bare audience hash and the nonce form', () => {
		expect(isAudienceDisplayHash('#pptx-audience')).toBeTruthy();
		expect(isAudienceDisplayHash('#pptx-audience&nonce=1a2b')).toBeTruthy();
	});

	it('rejects anything else', () => {
		expect(isAudienceDisplayHash('')).toBeFalsy();
		expect(isAudienceDisplayHash('#slide-3')).toBeFalsy();
		expect(isAudienceDisplayHash(undefined)).toBeFalsy();
	});
});

describe('mayLeaveSlideShow', () => {
	it('refuses for an audience display', () => {
		expect(mayLeaveSlideShow(true)).toBeFalsy();
	});

	it('allows for an ordinary presenter tab', () => {
		expect(mayLeaveSlideShow(false)).toBeTruthy();
	});
});

describe('endAudienceDisplay', () => {
	it('closes the tab and reports that no fallback screen is needed', () => {
		const close = vi.fn();
		const win = { close, closed: true } as unknown as Window;
		expect(endAudienceDisplay(win)).toBeFalsy();
		expect(close).toHaveBeenCalledOnce();
	});

	it('asks for the end-of-show screen when the tab stays open', () => {
		const win = { close: vi.fn(), closed: false } as unknown as Window;
		expect(endAudienceDisplay(win)).toBeTruthy();
	});

	it('asks for the end-of-show screen when close() is refused', () => {
		const win = {
			close: () => {
				throw new Error('refused');
			},
			closed: false,
		} as unknown as Window;
		expect(endAudienceDisplay(win)).toBeTruthy();
	});
});
