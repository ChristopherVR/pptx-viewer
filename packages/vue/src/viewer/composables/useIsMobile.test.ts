// oxlint-disable react-hooks/rules-of-hooks
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { useIsMobile } from './useIsMobile';

interface FakeMediaQueryList {
	matches: boolean;
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
	media: string;
}

type ChangeHandler = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean): {
	mql: FakeMediaQueryList;
	emit: (matches: boolean) => void;
} {
	let handler: ChangeHandler | undefined;
	const mql: FakeMediaQueryList = {
		matches: initialMatches,
		media: '',
		addEventListener: vi.fn((_event: string, cb: ChangeHandler) => {
			handler = cb;
		}),
		removeEventListener: vi.fn(),
	};
	const matchMedia = vi.fn((media: string) => {
		mql.media = media;
		return mql as unknown as MediaQueryList;
	});
	vi.stubGlobal('matchMedia', matchMedia);
	// `window.matchMedia` is what the composable feature-detects.
	Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });

	const emit = (matches: boolean): void => {
		mql.matches = matches;
		handler?.({ matches } as MediaQueryListEvent);
	};
	return { mql, emit };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
	it('reflects the initial matchMedia result', () => {
		installMatchMedia(true);
		const scope = effectScope();
		const result = scope.run(() => useIsMobile())!;
		expect(result.isMobile.value).toBeTruthy();
		scope.stop();
	});

	it('uses the provided breakpoint + a landscape-phone clause in the media query', () => {
		const { mql } = installMatchMedia(false);
		const scope = effectScope();
		scope.run(() => useIsMobile(640));
		// Width breakpoint OR a short, coarse-pointer, sub-tablet viewport (landscape phone).
		expect(mql.media).toBe(
			'(max-width: 640px), (max-height: 499px) and (pointer: coarse) and (max-width: 1023px)',
		);
		scope.stop();
	});

	it('updates reactively when the media query changes', () => {
		const { emit } = installMatchMedia(false);
		const scope = effectScope();
		const result = scope.run(() => useIsMobile())!;
		expect(result.isMobile.value).toBeFalsy();
		emit(true);
		expect(result.isMobile.value).toBeTruthy();
		emit(false);
		expect(result.isMobile.value).toBeFalsy();
		scope.stop();
	});

	it('removes the change listener on scope dispose', () => {
		const { mql } = installMatchMedia(true);
		const scope = effectScope();
		scope.run(() => useIsMobile());
		expect(mql.addEventListener).toHaveBeenCalledOnce();
		scope.stop();
		expect(mql.removeEventListener).toHaveBeenCalledOnce();
	});

	describe('without matchMedia (SSR / unstubbed test)', () => {
		beforeEach(() => {
			Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true });
		});

		it('defaults to false and wires no listener', () => {
			const scope = effectScope();
			const result = scope.run(() => useIsMobile())!;
			expect(result.isMobile.value).toBeFalsy();
			scope.stop();
		});

		it('exposes the additive signals with safe defaults', () => {
			const scope = effectScope();
			const result = scope.run(() => useIsMobile())!;
			expect(result.isTouchDevice.value).toBeFalsy();
			expect(['portrait', 'landscape']).toContain(result.orientation.value);
			expect(result.isVirtualKeyboardOpen.value).toBeFalsy();
			scope.stop();
		});
	});

	describe('additive signals', () => {
		it('reports touch capability from navigator.maxTouchPoints', () => {
			installMatchMedia(false);
			Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
			const scope = effectScope();
			const result = scope.run(() => useIsMobile())!;
			expect(result.isTouchDevice.value).toBeTruthy();
			scope.stop();
			Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
		});

		it('derives orientation from the viewport aspect ratio', () => {
			installMatchMedia(false);
			const scope = effectScope();
			const result = scope.run(() => useIsMobile())!;
			const expected = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
			expect(result.orientation.value).toBe(expected);
			scope.stop();
		});
	});
});
