import {
	hasPersistentAudio,
	registerPersistentAudio,
	stopAllPersistentAudio,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachShowVisibilityPause } from './presentation-visibility';
import type { ShowVisibilityDeps } from './presentation-visibility';

/**
 * Show visibility + cross-slide audio lifecycle. Uses the REAL shared
 * persistent-audio manager (with `HTMLMediaElement.play` mocked, since the DOM
 * test environment does not actually play media) so the tests prove the
 * binding's wiring end to end: presenting starts the visibility pause, hiding
 * the document cancels the auto-advance, becoming visible re-arms it, and the
 * end of the show (not a slide change) stops the persistent audio.
 */

function setVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

/** A minimal store stand-in with the notify semantics the real one has. */
function harness(presenting = false) {
	let state = { presenting };
	const listeners = new Set<() => void>();
	const cancelAutoAdvance = vi.fn();
	const rearmAutoAdvance = vi.fn();
	const deps: ShowVisibilityDeps = {
		getPresenting: () => state.presenting,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		root: document.body,
		cancelAutoAdvance,
		rearmAutoAdvance,
	};
	return {
		deps,
		cancelAutoAdvance,
		rearmAutoAdvance,
		setPresenting: (value: boolean) => {
			state = { presenting: value };
			for (const listener of [...listeners]) {
				listener();
			}
		},
	};
}

beforeEach(() => {
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

afterEach(() => {
	stopAllPersistentAudio();
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => 'visible',
	});
	vi.restoreAllMocks();
});

describe('attachShowVisibilityPause', () => {
	it('cancels the auto-advance when the tab hides and re-arms it when visible', () => {
		const h = harness();
		const detach = attachShowVisibilityPause(h.deps);
		h.setPresenting(true);

		setVisibility('hidden');
		expect(h.cancelAutoAdvance).toHaveBeenCalledOnce();
		expect(h.rearmAutoAdvance).not.toHaveBeenCalled();

		setVisibility('visible');
		expect(h.rearmAutoAdvance).toHaveBeenCalledOnce();
		detach();
	});

	it('ignores visibility changes while no show is running', () => {
		const h = harness();
		const detach = attachShowVisibilityPause(h.deps);

		setVisibility('hidden');
		setVisibility('visible');
		expect(h.cancelAutoAdvance).not.toHaveBeenCalled();
		expect(h.rearmAutoAdvance).not.toHaveBeenCalled();
		detach();
	});

	it('stops cross-slide persistent audio when the show ends, not before', () => {
		const h = harness();
		const detach = attachShowVisibilityPause(h.deps);
		h.setPresenting(true);

		registerPersistentAudio('bg-audio', 'data:audio/mp3;base64,AAAA', 'audio/mpeg', true, 1, 0);
		expect(hasPersistentAudio('bg-audio')).toBeTruthy();

		// Store churn during the show (slide changes and the like) leaves the
		// track alone: only the presenting flag ends it.
		h.setPresenting(true);
		expect(hasPersistentAudio('bg-audio')).toBeTruthy();

		h.setPresenting(false);
		expect(hasPersistentAudio('bg-audio')).toBeFalsy();
		expect(document.querySelectorAll('[data-pptx-persistent-audio]')).toHaveLength(0);
		detach();
	});

	it('stops persistent audio when the viewer is torn down mid-show', () => {
		const h = harness();
		const detach = attachShowVisibilityPause(h.deps);
		h.setPresenting(true);
		registerPersistentAudio('bg-audio-2', 'data:audio/mp3;base64,AAAA', undefined, false, 1, 0);
		expect(hasPersistentAudio('bg-audio-2')).toBeTruthy();

		detach();
		expect(hasPersistentAudio('bg-audio-2')).toBeFalsy();
	});
});
