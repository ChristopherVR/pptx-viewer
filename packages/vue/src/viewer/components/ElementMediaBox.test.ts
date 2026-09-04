import { mount } from '@vue/test-utils';
import type { MediaPptxElement } from 'pptx-viewer-core';
import { hasPersistentAudio, stopAllPersistentAudio } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import ElementMediaBox from './ElementMediaBox.vue';

function makeMedia(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
	return {
		type: 'media',
		id: 'media_1',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		mediaData: 'data:video/mp4;base64,AAAA',
		...overrides,
	};
}

function mountMedia(
	element: MediaPptxElement,
	surface: { interactive?: boolean; presenting?: boolean } = {},
) {
	return mount(ElementMediaBox, {
		props: {
			element,
			mediaDataUrls: new Map<string, string>(),
			zIndex: 1,
			// Defaults to the AUTHORING canvas, the surface most cases model.
			interactive: surface.interactive ?? true,
			presenting: surface.presenting ?? false,
		},
	});
}

describe('elementMediaBox playback settings', () => {
	it("honours the deck's authored volume and playback speed", async () => {
		// solution-explorer.pptx slide 2 authors vol="0"; Vue played it at full
		// volume because volume/playbackRate are IDL-only and were never applied.
		const wrapper = mountMedia(makeMedia({ volume: 0, playbackSpeed: 1.5, loop: true }));
		// The settings land once the media node's template ref resolves.
		await nextTick();
		const video = wrapper.find('video').element;
		expect(video.volume).toBe(0);
		expect(video.playbackRate).toBe(1.5);
		expect(video.loop).toBeTruthy();
	});

	it('defaults to full volume at normal speed when the deck says nothing', async () => {
		const wrapper = mountMedia(makeMedia());
		await nextTick();
		const video = wrapper.find('video').element;
		expect(video.volume).toBe(1);
		expect(video.playbackRate).toBe(1);
		expect(wrapper.find('video').attributes('loop')).toBeUndefined();
	});
});

describe('elementMediaBox native transport', () => {
	it('paints one on the authoring canvas', () => {
		expect(mountMedia(makeMedia()).find('video').attributes('controls')).toBeDefined();
	});

	it('paints none during a show', () => {
		// PowerPoint shows no control bar, and a full-bleed background video
		// otherwise draws Chrome's own scrubber across the presented slide.
		const wrapper = mountMedia(makeMedia(), { interactive: false, presenting: true });
		expect(wrapper.find('video').attributes('controls')).toBeUndefined();
	});

	it('paints none on a STILL of a slide (a console pane or thumbnail)', () => {
		// Neither interactive nor presenting: the presenter console's panes and the
		// thumbnail rail. `!presenting` alone put Chrome's scrubber across all of
		// them, so the console drew a control bar over a slide the speaker cannot
		// play.
		const wrapper = mountMedia(makeMedia(), { interactive: false, presenting: false });
		expect(wrapper.find('video').attributes('controls')).toBeUndefined();
	});
});

describe('elementMediaBox cross-slide ("play across slides") audio', () => {
	afterEach(() => {
		stopAllPersistentAudio();
	});

	function makeCrossSlideAudio(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
		return makeMedia({
			mediaType: 'audio',
			mediaData: 'data:audio/mpeg;base64,AAAA',
			mediaMimeType: 'audio/mpeg',
			playAcrossSlides: true,
			loop: true,
			volume: 0.5,
			trimStartMs: 2000,
			...overrides,
		});
	}

	it('registers the track with the persistent manager while presenting and keeps the slide-local copy silent', async () => {
		const wrapper = mountMedia(makeCrossSlideAudio(), { interactive: false, presenting: true });
		await nextTick();

		expect(hasPersistentAudio('media_1')).toBeTruthy();
		const persistent = document.querySelector<HTMLAudioElement>(
			'[data-pptx-persistent-audio="media_1"]',
		);
		expect(persistent?.getAttribute('src')).toBe('data:audio/mpeg;base64,AAAA');
		expect(persistent?.loop).toBeTruthy();
		expect(persistent?.volume).toBe(0.5);

		// The slide-local copy must stay silent, or the track doubles.
		const local = wrapper.find('audio').element;
		expect(local.muted).toBeTruthy();
		expect(local.paused).toBeTruthy();
		wrapper.unmount();
	});

	it('is NOT stopped by the slide-local element unmounting on slide change', async () => {
		const wrapper = mountMedia(makeCrossSlideAudio(), { interactive: false, presenting: true });
		await nextTick();
		expect(hasPersistentAudio('media_1')).toBeTruthy();

		// Advancing the show unmounts the owning slide's DOM; the persistent
		// (document-level) track keeps playing.
		wrapper.unmount();
		expect(hasPersistentAudio('media_1')).toBeTruthy();
		expect(document.querySelector('[data-pptx-persistent-audio="media_1"]')).not.toBeNull();
	});

	it('does not register outside a running show', async () => {
		const wrapper = mountMedia(makeCrossSlideAudio());
		await nextTick();
		expect(hasPersistentAudio('media_1')).toBeFalsy();
		wrapper.unmount();
	});

	it('does not register cross-slide playback for video', async () => {
		const wrapper = mountMedia(makeMedia({ playAcrossSlides: true }), {
			interactive: false,
			presenting: true,
		});
		await nextTick();
		expect(hasPersistentAudio('media_1')).toBeFalsy();
		wrapper.unmount();
	});
});

/**
 * Issue #147: a slide-transition overlay is a STILL of the outgoing slide, so
 * media chrome painted there rides along inside the transition - the reporter
 * caught a play triangle drifting through a morph out of a background video.
 */
describe('elementMediaBox unplayable-media fallback', () => {
	const POSTER = 'data:image/png;base64,AAAA';
	const still = { interactive: false, presenting: false };

	it('paints the poster frame with no play badge on a still', () => {
		const wrapper = mountMedia(makeMedia({ mediaData: undefined, posterFrameData: POSTER }), still);
		expect(wrapper.find('img').attributes('src')).toBe(POSTER);
		expect(wrapper.find('[data-pptx-media-chrome]').exists()).toBeFalsy();
	});

	it('paints no labelled placeholder box on a still', () => {
		const wrapper = mountMedia(makeMedia({ mediaData: undefined }), still);
		expect(wrapper.find('[data-pptx-media-chrome]').exists()).toBeFalsy();
		expect(wrapper.text()).toBe('');
	});

	it('paints none during a show either', () => {
		const wrapper = mountMedia(makeMedia({ mediaData: undefined, posterFrameData: POSTER }), {
			interactive: false,
			presenting: true,
		});
		expect(wrapper.find('img').exists()).toBeTruthy();
		expect(wrapper.find('[data-pptx-media-chrome]').exists()).toBeFalsy();
	});

	it('paints the play badge over the poster on the authoring canvas', () => {
		const wrapper = mountMedia(makeMedia({ mediaData: undefined, posterFrameData: POSTER }));
		expect(wrapper.find('[data-pptx-media-chrome="play"]').exists()).toBeTruthy();
	});

	it('falls back to the typed placeholder box on the authoring canvas', () => {
		const wrapper = mountMedia(makeMedia({ mediaData: undefined }));
		expect(wrapper.find('[data-pptx-media-chrome="typed"]').exists()).toBeTruthy();
		// The clip type, not the flat "Media" every unplayable element used to get.
		expect(wrapper.text()).toBe('Video clip');
	});

	// Reading a boolean `badge` as "paint a badge" drew a PLAY triangle over
	// media the package had failed to find - the opposite of what React said.
	it('marks missing media as not found, never with a play badge', () => {
		const wrapper = mountMedia(
			makeMedia({ mediaData: undefined, posterFrameData: POSTER, mediaMissing: true }),
		);
		expect(wrapper.find('[data-pptx-media-chrome="play"]').exists()).toBeFalsy();
		expect(wrapper.find('[data-pptx-media-chrome="missing"]').exists()).toBeTruthy();
		expect(wrapper.text()).toBe('Media not found');
	});
});

// ---------------------------------------------------------------------------
// Trim-end stop + fade (G20): previously React-only; now shared via
// `scheduleMediaTrimAndFade`. Maths itself is covered directly in
// `packages/shared/src/render/media-trim-fade-scheduler.test.ts`; this proves
// the wiring reaches the live <video> element while presenting.
// ---------------------------------------------------------------------------
describe('elementMediaBox trim-end + fade wiring', () => {
	it('stops at duration - trimEndMs (distance from the tail), not at trimEndMs itself', async () => {
		vi.useFakeTimers();
		const wrapper = mountMedia(makeMedia({ trimEndMs: 5000 }), {
			interactive: false,
			presenting: true,
		});
		await nextTick();
		const video = wrapper.find('video').element;
		Object.defineProperty(video, 'duration', { value: 20, configurable: true });
		Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
		const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {
			Object.defineProperty(video, 'paused', { value: true, configurable: true });
		});

		video.dispatchEvent(new Event('play'));
		await vi.advanceTimersByTimeAsync(15_000);

		expect(pauseSpy).toHaveBeenCalledWith();
		expect(video.currentTime).toBe(15);
		vi.useRealTimers();
	});
});
