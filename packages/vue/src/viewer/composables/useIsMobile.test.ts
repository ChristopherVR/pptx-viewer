// oxlint-disable react-hooks/rules-of-hooks
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

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

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

interface ResizeObserverHandle {
	/** Drive an observed-size change through the most recent observer. */
	emit: (width: number, height: number) => void;
	disconnect: ReturnType<typeof vi.fn>;
	observe: ReturnType<typeof vi.fn>;
}

/**
 * happy-dom does not implement `ResizeObserver`, so stub a minimal one that
 * lets a test push contentRect dimensions into the composable's callback.
 */
function installResizeObserver(): ResizeObserverHandle {
	let callback: ResizeCallback | undefined;
	const disconnect = vi.fn();
	const observe = vi.fn();
	class FakeResizeObserver {
		constructor(cb: ResizeCallback) {
			callback = cb;
		}
		observe = observe;
		unobserve = vi.fn();
		disconnect = disconnect;
	}
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);

	const emit = (width: number, height: number): void => {
		const entry = { contentRect: { width, height } } as ResizeObserverEntry;
		callback?.([entry]);
	};
	return { emit, disconnect, observe };
}

function makeContainer(width: number, height: number): HTMLElement {
	const el = document.createElement('div');
	Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
	Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
	return el;
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

	describe('container-ref path (ResizeObserver-driven breakpoints)', () => {
		it('classifies a narrow container as mobile and exposes its width', () => {
			installMatchMedia(false);
			const ro = installResizeObserver();
			const container = ref<HTMLElement | null>(makeContainer(320, 600));
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, container))!;
			expect(ro.observe).toHaveBeenCalledExactlyOnceWith(container.value);
			expect(result.containerWidth.value).toBe(320);
			expect(result.isMobile.value).toBeTruthy();
			expect(result.isTablet.value).toBeFalsy();
			expect(result.isDesktop.value).toBeFalsy();
			scope.stop();
		});

		it('classifies a mid-width container as tablet', () => {
			installMatchMedia(false);
			installResizeObserver();
			const container = ref<HTMLElement | null>(makeContainer(900, 700));
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, container))!;
			expect(result.isMobile.value).toBeFalsy();
			expect(result.isTablet.value).toBeTruthy();
			expect(result.isDesktop.value).toBeFalsy();
			expect(result.containerWidth.value).toBe(900);
			scope.stop();
		});

		it('classifies a wide container as desktop', () => {
			installMatchMedia(false);
			installResizeObserver();
			const container = ref<HTMLElement | null>(makeContainer(1280, 800));
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, container))!;
			expect(result.isMobile.value).toBeFalsy();
			expect(result.isTablet.value).toBeFalsy();
			expect(result.isDesktop.value).toBeTruthy();
			scope.stop();
		});

		it('reclassifies when the observed container width changes', () => {
			installMatchMedia(false);
			const ro = installResizeObserver();
			const container = ref<HTMLElement | null>(makeContainer(1280, 800));
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, container))!;
			expect(result.isDesktop.value).toBeTruthy();

			ro.emit(500, 600);
			expect(result.containerWidth.value).toBe(500);
			expect(result.isMobile.value).toBeTruthy();
			expect(result.isDesktop.value).toBeFalsy();

			ro.emit(900, 700);
			expect(result.isTablet.value).toBeTruthy();
			expect(result.isMobile.value).toBeFalsy();
			scope.stop();
		});

		it('accepts a plain getter as the container source', () => {
			installMatchMedia(false);
			installResizeObserver();
			const el = makeContainer(400, 600);
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, () => el))!;
			expect(result.containerWidth.value).toBe(400);
			expect(result.isMobile.value).toBeTruthy();
			scope.stop();
		});

		it('disconnects the observer on scope dispose', () => {
			installMatchMedia(false);
			const ro = installResizeObserver();
			const container = ref<HTMLElement | null>(makeContainer(1280, 800));
			const scope = effectScope();
			scope.run(() => useIsMobile(768, container));
			scope.stop();
			expect(ro.disconnect).toHaveBeenCalledOnce();
		});

		it('uses a temporary viewport fallback when the ref is initially empty', () => {
			installMatchMedia(true);
			installResizeObserver();
			const container = ref<HTMLElement | null>(null);
			const scope = effectScope();
			const result = scope.run(() => useIsMobile(768, container))!;
			// Container is null: uses window dimensions as interim fallback
			// (does NOT fall through to the matchMedia path because it will
			// upgrade to ResizeObserver once the ref populates).
			expect(result.containerWidth.value).toBe(window.innerWidth);
			scope.stop();
		});
	});
});
