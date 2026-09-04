import type { MediaPptxElement } from 'pptx-viewer-core';
import * as shared from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import {
	buildTrimFragment,
	hasPersistentAudio,
	pauseAllPersistentAudio,
	registerPersistentAudio,
	resumeAllPersistentAudio,
	stopAllPersistentAudio,
} from './media-persistent-audio';

// ---------------------------------------------------------------------------
// The persistent-audio manager moved into pptx-viewer-shared; this module is
// now a re-export shim. These tests pin the shim to the shared implementation
// so a second, React-local manager cannot silently reappear (two managers
// means stopAllPersistentAudio only silences one of them).
// ---------------------------------------------------------------------------

describe('media-persistent-audio re-export shim', () => {
	it('re-exports the shared manager functions, not local copies', () => {
		expect(registerPersistentAudio).toBe(shared.registerPersistentAudio);
		expect(stopAllPersistentAudio).toBe(shared.stopAllPersistentAudio);
		expect(pauseAllPersistentAudio).toBe(shared.pauseAllPersistentAudio);
		expect(resumeAllPersistentAudio).toBe(shared.resumeAllPersistentAudio);
		expect(hasPersistentAudio).toBe(shared.hasPersistentAudio);
	});
});

// ---------------------------------------------------------------------------
// buildTrimFragment stays React-local (it feeds the JSX src attributes).
// ---------------------------------------------------------------------------

function mediaElement(overrides: Partial<MediaPptxElement>): MediaPptxElement {
	return {
		id: 'media-1',
		type: 'media',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		mediaType: 'audio',
		...overrides,
	} as MediaPptxElement;
}

describe('buildTrimFragment', () => {
	it('returns an empty string when there is no trim', () => {
		expect(buildTrimFragment(mediaElement({}))).toBe('');
	});

	it('builds a start-only fragment', () => {
		expect(buildTrimFragment(mediaElement({ trimStartMs: 2500 }))).toBe('#t=2.500');
	});

	// G19/G20: trimEndMs is a distance-from-the-tail value, not an absolute
	// stop time, and the Media Fragments URI spec only accepts an absolute
	// end; it can never be expressed here without the clip's real duration
	// (unknown before the browser fetches this very `src`). The fragment must
	// therefore never include an `end` component; trim-end enforcement is
	// `scheduleMediaTrimAndFade`'s job.
	it('never includes an end component, even when trimEndMs is set', () => {
		expect(buildTrimFragment(mediaElement({ trimStartMs: 1000, trimEndMs: 4000 }))).toBe(
			'#t=1.000',
		);
		expect(buildTrimFragment(mediaElement({ trimEndMs: 3000 }))).toBe('');
	});
});
