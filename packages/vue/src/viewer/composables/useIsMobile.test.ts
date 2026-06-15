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

	it('uses the provided breakpoint in the media query', () => {
		const { mql } = installMatchMedia(false);
		const scope = effectScope();
		scope.run(() => useIsMobile(640));
		expect(mql.media).toBe('(max-width: 640px)');
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
	});
});
