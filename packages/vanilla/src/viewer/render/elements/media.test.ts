import type { PptxElement } from 'pptx-viewer-core';
import { hasPersistentAudio, stopAllPersistentAudio } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { applyMediaPresentingState, renderMediaElement } from './media';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MP4_DATA_URL = 'data:video/mp4;base64,AAAA';
const MP3_DATA_URL = 'data:audio/mpeg;base64,AAAA';

function makeContext(
	mediaDataUrls = new Map<string, string>(),
	presenting = false,
	// Defaults to the AUTHORING canvas, the surface these cases model. A still
	// of a slide (thumbnail rail, presenter console pane) is `interactive: false`
	// and is covered separately below.
	interactive = true,
): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls,
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting,
		interactive,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function mediaElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'media',
		id: 'm1',
		x: 40,
		y: 60,
		width: 320,
		height: 180,
		...overrides,
	} as PptxElement;
}

describe('renderMediaElement', () => {
	it('returns null for non-media elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderMediaElement(el, 0, makeContext())).toBeNull();
	});

	it('renders a native <video> with controls and poster from embedded data', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL, posterFrameData: PNG_DATA_URL }),
			2,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('m1');
		expect(node.style.left).toBe('40px');
		expect(node.style.zIndex).toBe('2');

		const video = node.querySelector<HTMLVideoElement>('video');
		expect(video).toBeTruthy();
		expect(video?.getAttribute('src')).toBe(MP4_DATA_URL);
		expect(video?.controls).toBeTruthy();
		expect(video?.getAttribute('poster')).toBe(PNG_DATA_URL);
	});

	it('resolves mediaPath through the mediaDataUrls map', () => {
		const urls = new Map([['ppt/media/movie.mp4', 'blob:movie']]);
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', mediaPath: 'ppt/media/movie.mp4' }),
			0,
			makeContext(urls),
		) as HTMLElement;
		expect(node.querySelector('video')?.getAttribute('src')).toBe('blob:movie');
	});

	it('renders a native <audio controls> for audio media', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;
		const audio = node.querySelector<HTMLAudioElement>('audio');
		expect(audio).toBeTruthy();
		expect(audio?.getAttribute('src')).toBe(MP3_DATA_URL);
		expect(audio?.controls).toBeTruthy();
		expect(node.querySelector('video')).toBeNull();
	});

	it('falls back to the poster image when no playable source exists', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('video')).toBeNull();
		expect(node.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
	});

	it('renders a labelled fallback box when the media is unavailable', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video' }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('video')).toBeNull();
		expect(node.querySelector('img')).toBeNull();
		expect(node.classList.contains('pptxv-placeholder')).toBeTruthy();
		// The clip type, not the flat "Media" every unplayable element used to get.
		expect(node.textContent).toContain('Video clip');
		expect(node.getAttribute('data-pptx-media-chrome')).toBe('typed');
	});

	// Reading a boolean `badge` as "paint a badge" drew a PLAY triangle over
	// media the package had failed to find - the opposite of what React said.
	it('marks missing media as not found, never with a play badge', () => {
		const node = renderMediaElement(
			mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL, mediaMissing: true }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('[data-pptx-media-chrome="play"]')).toBeNull();
		expect(node.querySelector('[data-pptx-media-chrome="missing"]')?.textContent).toContain(
			'Media not found',
		);
		expect(node.querySelector('img')?.style.opacity).toBe('0.5');
	});

	// Issue #147: a slide-transition overlay is a STILL of the outgoing slide, so
	// media chrome painted there rides along inside the transition - the reporter
	// caught a play triangle drifting through a morph out of a background video.
	describe('media chrome on a still of a slide (issue #147)', () => {
		const still = (): ElementRenderContext => makeContext(new Map(), false, false);

		it('paints the poster frame with no play badge over it', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }),
				0,
				still(),
			) as HTMLElement;
			expect(node.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URL);
			expect(node.querySelector('[data-pptx-media-chrome]')).toBeNull();
		});

		it('paints no labelled placeholder box for unresolvable media', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video' }),
				0,
				still(),
			) as HTMLElement;
			expect(node.classList.contains('pptxv-placeholder')).toBeFalsy();
			expect(node.textContent).toBe('');
		});

		it('still paints the badge on the authoring canvas', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video', posterFrameData: PNG_DATA_URL }),
				0,
				makeContext(),
			) as HTMLElement;
			expect(node.querySelector('[data-pptx-media-chrome="play"]')).toBeTruthy();
		});
	});

	describe('presentation-mode autoplay', () => {
		it('autoplays the mounted <video> when context.presenting is true', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			const video = node.querySelector<HTMLVideoElement>('video');
			expect(video).toBeTruthy();
			// happy-dom's play() flips `paused` synchronously, mirroring real
			// browsers closely enough to assert autoplay actually started.
			expect(video?.paused).toBeFalsy();
		});

		it('autoplays the mounted <audio> when context.presenting is true', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			const audio = node.querySelector<HTMLAudioElement>('audio');
			expect(audio).toBeTruthy();
			expect(audio?.paused).toBeFalsy();
		});

		// A full-bleed background video with `controls` paints Chrome's own black
		// transport across the bottom of the presented slide, over the show
		// toolbar. React suppresses it (`controls={!isPresentationMode}`).
		it('hides the native transport while presenting, and restores it after', () => {
			const presented = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			expect(presented.querySelector<HTMLVideoElement>('video')?.controls).toBeFalsy();

			const edited = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				0,
				makeContext(new Map(), false),
			) as HTMLElement;
			expect(edited.querySelector<HTMLVideoElement>('video')?.controls).toBeTruthy();
		});

		it('paints no transport on a STILL of a slide (a console pane or thumbnail)', () => {
			// Neither interactive nor presenting: the presenter console's panes and
			// the thumbnail rail. `!presenting` alone put Chrome's scrubber across
			// all of them, so the console drew a control bar over a slide the
			// speaker cannot play.
			const still = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				0,
				makeContext(new Map(), false, false),
			) as HTMLElement;
			expect(still.querySelector<HTMLVideoElement>('video')?.controls).toBeFalsy();

			const stillAudio = renderMediaElement(
				mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
				0,
				makeContext(new Map(), false, false),
			) as HTMLElement;
			expect(stillAudio.querySelector<HTMLAudioElement>('audio')?.controls).toBeFalsy();
		});

		it('does not autoplay when context.presenting is false', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL }),
				0,
				makeContext(new Map(), false),
			) as HTMLElement;
			const video = node.querySelector<HTMLVideoElement>('video');
			expect(video?.paused).toBeTruthy();
		});

		it('seeks to the trim-start point before autoplaying', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'video', mediaData: MP4_DATA_URL, trimStartMs: 2500 }),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			const video = node.querySelector<HTMLVideoElement>('video');
			expect(video?.currentTime).toBe(2.5);
		});

		it('applyMediaPresentingState pauses an element that is already playing when presenting flips to false', () => {
			const video = document.createElement('video');
			video.play();
			expect(video.paused).toBeFalsy();

			applyMediaPresentingState(video, false, {});

			expect(video.paused).toBeTruthy();
		});

		it('applyMediaPresentingState is a no-op pause-wise for an element already paused', () => {
			const video = document.createElement('video');
			const pauseSpy = vi.spyOn(video, 'pause');

			applyMediaPresentingState(video, false, {});

			expect(pauseSpy).not.toHaveBeenCalled();
		});

		it('applyMediaPresentingState starts playback (with trim seek) when presenting is true', () => {
			const video = document.createElement('video');

			applyMediaPresentingState(video, true, { trimStartMs: 1000 });

			expect(video.currentTime).toBe(1);
			expect(video.paused).toBeFalsy();
		});

		it('carries the deck loop flag onto the node', () => {
			// A looping short clip that never got `loop` played once and froze on
			// its last frame, which reads as media that never started at all.
			const video = document.createElement('video');

			applyMediaPresentingState(video, true, { loop: true });

			expect(video.loop).toBeTruthy();
		});

		it('honours a silent deck rather than playing at full volume', () => {
			const video = document.createElement('video');

			applyMediaPresentingState(video, true, { volume: 0 });

			expect(video.volume).toBe(0);
		});

		// G20: trim-end stop + fade in/out, previously React-only, now shared
		// via `scheduleMediaTrimAndFade`. The scheduling maths is covered
		// directly in `media-trim-fade-scheduler.test.ts`; this proves the
		// wiring reaches the live element while presenting.
		it('stops at duration - trimEndMs (distance from the tail), not at trimEndMs itself', async () => {
			vi.useFakeTimers();
			const video = document.createElement('video');
			Object.defineProperty(video, 'duration', { value: 20, configurable: true });
			const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {
				Object.defineProperty(video, 'paused', { value: true, configurable: true });
			});

			applyMediaPresentingState(video, true, { trimEndMs: 5000 });
			Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
			video.dispatchEvent(new Event('play'));
			await vi.advanceTimersByTimeAsync(15_000);

			expect(pauseSpy).toHaveBeenCalledWith();
			expect(video.currentTime).toBe(15);
			vi.useRealTimers();
		});
	});

	describe('cross-slide ("play across slides") audio', () => {
		afterEach(() => {
			stopAllPersistentAudio();
		});

		const crossSlideAudio = () =>
			mediaElement({
				mediaType: 'audio',
				mediaData: MP3_DATA_URL,
				mediaMimeType: 'audio/mpeg',
				playAcrossSlides: true,
				loop: true,
				volume: 0.5,
				trimStartMs: 2000,
			});

		it('registers the track with the persistent manager while presenting', () => {
			const node = renderMediaElement(crossSlideAudio(), 0, makeContext(new Map(), true));
			expect(node).toBeTruthy();
			expect(hasPersistentAudio('m1')).toBeTruthy();

			const persistent = document.querySelector<HTMLAudioElement>(
				'[data-pptx-persistent-audio="m1"]',
			);
			expect(persistent?.getAttribute('src')).toBe(MP3_DATA_URL);
			expect(persistent?.loop).toBeTruthy();
			expect(persistent?.volume).toBe(0.5);
		});

		it('keeps the slide-local copy silent so the track never doubles', () => {
			const node = renderMediaElement(
				crossSlideAudio(),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			const audio = node.querySelector<HTMLAudioElement>('audio');
			expect(audio?.muted).toBeTruthy();
			// The autoplay path is skipped: the persistent element plays instead.
			expect(audio?.paused).toBeTruthy();
			// The authored settings still land on the visible node.
			expect(audio?.loop).toBeTruthy();
		});

		it('survives the stage rebuild a slide change performs, without restarting', () => {
			renderMediaElement(crossSlideAudio(), 0, makeContext(new Map(), true));
			const persistent = document.querySelector<HTMLAudioElement>(
				'[data-pptx-persistent-audio="m1"]',
			);
			// The vanilla renderer rebuilds the whole stage per navigation; the old
			// slide-local <audio> is discarded, and re-rendering the owning slide
			// re-registers, which must be a no-op (same element, not a restart).
			renderMediaElement(crossSlideAudio(), 0, makeContext(new Map(), true));
			expect(document.querySelectorAll('[data-pptx-persistent-audio="m1"]')).toHaveLength(1);
			expect(document.querySelector('[data-pptx-persistent-audio="m1"]')).toBe(persistent);
		});

		it('does not register outside a running show', () => {
			renderMediaElement(crossSlideAudio(), 0, makeContext(new Map(), false));
			expect(hasPersistentAudio('m1')).toBeFalsy();
		});

		it('plays a plain (non-cross-slide) audio inline as before', () => {
			const node = renderMediaElement(
				mediaElement({ mediaType: 'audio', mediaData: MP3_DATA_URL }),
				0,
				makeContext(new Map(), true),
			) as HTMLElement;
			expect(hasPersistentAudio('m1')).toBeFalsy();
			expect(node.querySelector<HTMLAudioElement>('audio')?.paused).toBeFalsy();
		});
	});
});
