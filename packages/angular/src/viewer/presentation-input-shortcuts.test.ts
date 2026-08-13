/**
 * Ctrl+H and Ctrl+S during a show, pinned at the dispatch layer.
 *
 * Both keys have resolved in the shared slide-show map for as long as it has
 * existed (`toggleChrome` and `showAllSlides`), and only React and Vue ever
 * acted on them. Angular's controller `preventDefault()`ed the press and then
 * fell through its `default` branch, so the show ATE the key and did nothing:
 * strictly worse than leaving it unbound, because the browser never got it back
 * either. These assert the two actions reach a callback, which is exactly the
 * link that was missing.
 */
import { describe, expect, it, vi } from 'vitest';

import { PresentationInputController } from './presentation-input-controller';
import type { PresentationInputDeps } from './presentation-input-controller';

/** A controller whose collaborators are all stubs; only the two keys matter. */
function controllerWith(overrides: Partial<PresentationInputDeps> = {}): {
	controller: PresentationInputController;
	toggleChrome: ReturnType<typeof vi.fn>;
	showAllSlides: ReturnType<typeof vi.fn>;
} {
	const toggleChrome = vi.fn();
	const showAllSlides = vi.fn();
	const controller = new PresentationInputController({
		slides: () => [],
		currentSlide: () => undefined,
		root: () => null,
		navigator: { navigate: vi.fn(), goToSlide: vi.fn() } as never,
		playback: {} as never,
		annotations: { setTool: vi.fn(), clearAnnotations: vi.fn(), tool: () => 'none' } as never,
		presenterWindow: { snapshot: () => ({ blackout: 'none' }), updateSnapshot: vi.fn() } as never,
		toggleInkMarkup: vi.fn(),
		toggleSubtitles: vi.fn(),
		toggleChrome,
		showAllSlides,
		requestClose: vi.fn(),
		...overrides,
	});
	return { controller, toggleChrome, showAllSlides };
}

/** A keydown the controller can consume, with `preventDefault` observable. */
function press(key: string): KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> } {
	return { key, ctrlKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent & {
		preventDefault: ReturnType<typeof vi.fn>;
	};
}

describe('slide-show chrome shortcuts', () => {
	it('the Ctrl+H chord toggles the show chrome', () => {
		const { controller, toggleChrome } = controllerWith();

		controller.handleKeyDown(press('h'));

		expect(toggleChrome).toHaveBeenCalledOnce();
	});

	it('the Ctrl+S chord raises the "See All Slides" navigator', () => {
		const { controller, showAllSlides } = controllerWith();

		controller.handleKeyDown(press('s'));

		expect(showAllSlides).toHaveBeenCalledOnce();
	});

	it('does not swallow a chord the map does not claim', () => {
		const { controller, toggleChrome, showAllSlides } = controllerWith();
		const event = press('q');

		controller.handleKeyDown(event);

		expect(event.preventDefault, 'an unmapped chord must reach the browser').not.toHaveBeenCalled();
		expect(toggleChrome).not.toHaveBeenCalled();
		expect(showAllSlides).not.toHaveBeenCalled();
	});
});
