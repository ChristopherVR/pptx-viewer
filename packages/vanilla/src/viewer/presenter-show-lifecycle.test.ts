import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPptxViewer, PptxViewer } from './PptxViewer';
import type { PptxViewerInstance } from './types';

/**
 * The audience popup must not end the show.
 *
 * `openPresenterView()` opens a `window.open` popup, which drops this window out
 * of fullscreen; the `fullscreenchange` announcing it lands a task later. The
 * old code read `store.presenting` right after the `window.open`, found it still
 * `true` because the event had not arrived yet, concluded the show was fine and
 * did nothing. The event then landed, the generic "left fullscreen, so end the
 * show" branch ran, and the presenter's deck collapsed into the editor the
 * instant they asked for presenter view.
 *
 * These tests drive the seam that decides it: `classifyPresentationExit()`,
 * which the chrome's fullscreen handler consults before tearing anything down.
 */

let active: PptxViewerInstance[] = [];

function mount(): { container: HTMLElement; viewer: PptxViewerInstance } {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container);
	active.push(viewer);
	return { container, viewer };
}

/** The class exposes the seam; `PptxViewerInstance` deliberately does not. */
function asViewer(viewer: PptxViewerInstance): PptxViewer {
	return viewer as PptxViewer;
}

beforeEach(() => {
	// happy-dom's `window.open` resolves to null, which the viewer correctly
	// reads as a blocked popup and which disarms the latch. Stand in a window
	// stub so these tests exercise the popup-opened path they are about.
	vi.spyOn(window, 'open').mockReturnValue({
		closed: false,
		close: () => undefined,
		location: { replace: () => undefined },
	} as unknown as Window);
});

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('presenter-view show lifecycle', () => {
	it('treats an unexplained fullscreen exit as the presenter leaving', () => {
		const { viewer } = mount();
		expect(asViewer(viewer).classifyPresentationExit()).toBe('end-show');
	});

	it('keeps the show alive across the audience popup opening mid-show', () => {
		const { viewer } = mount();
		const instance = asViewer(viewer);
		instance.store.set({ presenting: true });
		instance.openAudienceWindow();

		expect(instance.classifyPresentationExit()).toBe('restore-show');
	});

	it('only forgives one bounce, so the next Escape still ends the show', () => {
		const { viewer } = mount();
		const instance = asViewer(viewer);
		instance.store.set({ presenting: true });
		instance.openAudienceWindow();

		expect(instance.classifyPresentationExit()).toBe('restore-show');
		expect(instance.classifyPresentationExit()).toBe('end-show');
	});

	it('does not arm the latch when the audience display is opened from the editor', () => {
		// Nothing was fullscreen, so there is no bounce to forgive; a latch left
		// armed here would swallow the presenter's first real Escape instead.
		const { viewer } = mount();
		const instance = asViewer(viewer);
		instance.openAudienceWindow();

		expect(instance.classifyPresentationExit()).toBe('end-show');
	});

	it('disarms when the popup is blocked, since no bounce will follow', () => {
		const { viewer } = mount();
		const instance = asViewer(viewer);
		vi.spyOn(window, 'open').mockReturnValue(null);
		instance.store.set({ presenting: true });
		instance.openAudienceWindow();

		expect(instance.classifyPresentationExit()).toBe('end-show');
	});
});
