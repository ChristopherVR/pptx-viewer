// @vitest-environment happy-dom
/**
 * The slide-show shortcuts Svelte used to swallow.
 *
 * `mapPresentationKey` has resolved Ctrl+H (`toggleChrome`) and Ctrl+S
 * (`showAllSlides`) for as long as it has existed, and `handleShowKey` had no
 * case for either: they fell into its `default`, which returns `true`. So the
 * show reported the key as handled, `preventDefault()` had already run, and
 * nothing happened - the browser did not get the chord back either.
 */
import { describe, expect, it, vi } from 'vitest';

import { createViewportHandlers } from './viewport-handlers';
import type { ViewportHandlersDeps } from './viewport-handlers';

/** Handlers over stub collaborators; only the two chords under test matter. */
function harness(overrides: Partial<ViewportHandlersDeps> = {}): {
	handlers: ReturnType<typeof createViewportHandlers>;
	toggleChrome: ReturnType<typeof vi.fn>;
	showAllSlides: ReturnType<typeof vi.fn>;
} {
	const toggleChrome = vi.fn();
	const showAllSlides = vi.fn();
	const handlers = createViewportHandlers({
		getRootEl: () => undefined,
		viewer: { isFullscreen: true, slideCount: 3, goTo: vi.fn(), handleNavigationKey: () => false },
		controller: { onKeyDown: vi.fn(), capturesKeyboard: () => false },
		getEditingActive: () => false,
		presentation: { advance: vi.fn(), retreat: () => false, previousSlide: vi.fn() },
		toggleChrome,
		showAllSlides,
		...overrides,
	} as unknown as ViewportHandlersDeps);
	return { handlers, toggleChrome, showAllSlides };
}

/** One Ctrl chord; reports whether the show consumed it. */
function press(handlers: ReturnType<typeof createViewportHandlers>, key: string): boolean {
	const event = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
	handlers.onKeydown(event);
	return event.defaultPrevented;
}

describe('slide-show chrome shortcuts', () => {
	it('the Ctrl+H chord toggles the show chrome', () => {
		const { handlers, toggleChrome } = harness();

		expect(press(handlers, 'h'), 'the map claims Ctrl+H, so the show consumes it').toBeTruthy();
		expect(toggleChrome).toHaveBeenCalledOnce();
	});

	it('the Ctrl+S chord raises the "See All Slides" navigator', () => {
		const { handlers, showAllSlides } = harness();

		expect(press(handlers, 's')).toBeTruthy();
		expect(showAllSlides).toHaveBeenCalledOnce();
	});

	it('leaves both chords alone outside a running show', () => {
		const { handlers, toggleChrome, showAllSlides } = harness({
			viewer: {
				isFullscreen: false,
				slideCount: 3,
				goTo: vi.fn(),
				handleNavigationKey: () => false,
			} as unknown as ViewportHandlersDeps['viewer'],
		});

		expect(press(handlers, 's'), 'Ctrl+S is the browser save dialog in the editor').toBeFalsy();
		expect(showAllSlides).not.toHaveBeenCalled();
		expect(toggleChrome).not.toHaveBeenCalled();
	});
});

/**
 * F5 / Shift+F5 start-a-show keys (`mapSlideShowStartKey`). Must fire even
 * with editing disabled and even though `handleShowKey`/the editor keymap sit
 * behind gates F5 must ignore, per `packages/shared/src/render/slide-show-start-keymap.ts`.
 */
describe('the F5/Shift+F5 start-show keys', () => {
	function startHarness(overrides: Partial<ViewportHandlersDeps> = {}) {
		const onStartFromBeginning = vi.fn();
		const onStartFromCurrent = vi.fn();
		const handlers = createViewportHandlers({
			getRootEl: () => undefined,
			viewer: {
				isFullscreen: false,
				slideCount: 3,
				goTo: vi.fn(),
				handleNavigationKey: () => false,
			},
			controller: { onKeyDown: vi.fn(), capturesKeyboard: () => false },
			getEditingActive: () => false,
			presentation: { advance: vi.fn(), retreat: () => false, previousSlide: vi.fn() },
			onStartFromBeginning,
			onStartFromCurrent,
			...overrides,
		} as unknown as ViewportHandlersDeps);
		return { handlers, onStartFromBeginning, onStartFromCurrent };
	}

	it('a bare F5 starts the show from the beginning and prevents the page reload', () => {
		const { handlers, onStartFromBeginning, onStartFromCurrent } = startHarness();
		const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });

		handlers.onKeydown(event);

		expect(event.defaultPrevented).toBeTruthy();
		expect(onStartFromBeginning).toHaveBeenCalledOnce();
		expect(onStartFromCurrent).not.toHaveBeenCalled();
	});

	it('shift+F5 starts the show from the current slide', () => {
		const { handlers, onStartFromBeginning, onStartFromCurrent } = startHarness();
		const event = new KeyboardEvent('keydown', { key: 'F5', shiftKey: true, cancelable: true });

		handlers.onKeydown(event);

		expect(event.defaultPrevented).toBeTruthy();
		expect(onStartFromCurrent).toHaveBeenCalledOnce();
		expect(onStartFromBeginning).not.toHaveBeenCalled();
	});

	it('a bare F5 does nothing and leaves the reload alone while a show is already presenting', () => {
		const { handlers, onStartFromBeginning, onStartFromCurrent } = startHarness({
			viewer: {
				isFullscreen: true,
				slideCount: 3,
				goTo: vi.fn(),
				handleNavigationKey: () => false,
			} as unknown as ViewportHandlersDeps['viewer'],
		});
		const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });

		handlers.onKeydown(event);

		expect(event.defaultPrevented).toBeFalsy();
		expect(onStartFromBeginning).not.toHaveBeenCalled();
		expect(onStartFromCurrent).not.toHaveBeenCalled();
	});

	it('starts the show from F5 even with editing disabled, ahead of the editor keymap gate', () => {
		const onKeyDown = vi.fn();
		const { handlers, onStartFromBeginning } = startHarness({
			controller: {
				onKeyDown,
				capturesKeyboard: () => false,
			} as unknown as ViewportHandlersDeps['controller'],
			getEditingActive: () => false,
		});
		const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });

		handlers.onKeydown(event);

		expect(onStartFromBeginning).toHaveBeenCalledOnce();
		// Never reached the editor's own keydown handler, which the editing branch
		// would only have called anyway if `getEditingActive()` were true.
		expect(onKeyDown).not.toHaveBeenCalled();
	});
});

/**
 * Wave-4 B1: entering the show must open on a slide the show actually
 * includes, not the raw active slide. `onFullscreenToggle` is the single
 * chokepoint every entry surface (status-bar button, ribbon "From Current
 * Slide", `setMode('present')`, the mobile toolbar) funnels through, so
 * fixing it here fixes all of them at once. `getRootEl` returns `undefined`
 * so the real fullscreen API is never reached; only the navigation matters.
 */
describe('onFullscreenToggle: presentation entry slide', () => {
	function toggleHarness(entryIndex: number, current: number) {
		const goTo = vi.fn();
		const handlers = createViewportHandlers({
			getRootEl: () => undefined,
			viewer: {
				isFullscreen: false,
				current,
				slideCount: 5,
				goTo,
				handleNavigationKey: () => false,
			},
			controller: { onKeyDown: vi.fn(), capturesKeyboard: () => false },
			getEditingActive: () => false,
			presentation: {
				advance: vi.fn(),
				retreat: () => false,
				previousSlide: vi.fn(),
				entryIndex: vi.fn().mockReturnValue(entryIndex),
			},
		} as unknown as ViewportHandlersDeps);
		return { handlers, goTo };
	}

	it('navigates to the resolved entry index when it differs from the active slide', () => {
		const { handlers, goTo } = toggleHarness(2, 0);
		handlers.onFullscreenToggle();
		expect(goTo).toHaveBeenCalledWith(2);
	});

	it('does not navigate when the active slide is already in the show', () => {
		const { handlers, goTo } = toggleHarness(0, 0);
		handlers.onFullscreenToggle();
		expect(goTo).not.toHaveBeenCalled();
	});

	it('does not resolve an entry index while already presenting (a plain exit toggle)', () => {
		const goTo = vi.fn();
		const entryIndex = vi.fn().mockReturnValue(3);
		const handlers = createViewportHandlers({
			getRootEl: () => undefined,
			viewer: {
				isFullscreen: true,
				current: 0,
				slideCount: 5,
				goTo,
				handleNavigationKey: () => false,
			},
			controller: { onKeyDown: vi.fn(), capturesKeyboard: () => false },
			getEditingActive: () => false,
			presentation: { advance: vi.fn(), retreat: () => false, previousSlide: vi.fn(), entryIndex },
		} as unknown as ViewportHandlersDeps);
		handlers.onFullscreenToggle();
		expect(entryIndex).not.toHaveBeenCalled();
		expect(goTo).not.toHaveBeenCalled();
	});
});
