import type { MediaPptxElement } from 'pptx-viewer-core';
import {
	MEDIA_CHROME_ATTRIBUTE,
	MEDIA_PLAY_BADGE_POINTS,
	applyMediaPlaybackAttributes,
	getContainerStyle,
	getImageSrc,
	mediaFallbackVisual,
	mediaPlaybackAttributes,
	mediaSurfaceOf,
	mediaTransportVisible,
	registerPersistentAudio,
	startMediaAutoplay,
} from 'pptx-viewer-shared';
import type { MediaPlaybackSource } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `media` (audio / video) elements, vanilla port of Vue's
 * `ElementMediaBox.vue`, viewer subset:
 *
 * - Playable source resolved exactly like Vue: `mediaData` (data-URL embedded
 *   by the load pipeline) first, then `mediaPath` looked up in
 *   `context.mediaDataUrls`.
 * - Video renders a native `<video controls>` (with the poster frame when one
 *   is available); audio renders a native `<audio controls>`.
 * - No playable source: the poster / thumbnail image alone (shared
 *   `getImageSrc` resolves `posterFrameData` / `posterFramePath`).
 * - Nothing at all: a graceful typed fallback box labelled "Media".
 * - Presentation-mode autoplay: when `context.presenting` is true the element
 *   starts playing right after it is appended to the DOM (matching Vue's
 *   mounted-watcher via the shared `startMediaAutoplay`), and the native
 *   transport is suppressed there, as React does (`controls={!isPresentationMode}`).
 */

/**
 * Apply the deck's playback settings and the presentation-mode play/pause state
 * to a mounted `<video>`/`<audio>`. Since the vanilla renderer rebuilds the
 * whole stage on every state change (no persistent element to `watch`), this
 * runs once right after the element is appended: start autoplay when
 * presenting, otherwise make sure a (rare, already-playing) element is paused.
 * Exported for direct testing.
 *
 * `loop` / `volume` / `playbackRate` come from the shared resolver rather than
 * being left at their defaults. Dropping `loop` is not cosmetic: a deck that
 * loops a short background clip (solution-explorer slide 2 loops a 2-second
 * video) played it once, hit the end and froze on the last frame, which reads
 * exactly like media that never started. Leaving `volume` alone was worse: a
 * deck marked `vol="0"` played at full volume.
 */
export function applyMediaPresentingState(
	el: HTMLMediaElement,
	presenting: boolean,
	playback: MediaPlaybackSource & { trimStartMs?: number },
): void {
	applyMediaPlaybackAttributes(el, playback);
	if (presenting) {
		startMediaAutoplay(el, { trimStartMs: playback.trimStartMs });
	} else if (!el.paused) {
		el.pause();
	}
}

/**
 * Register a `playAcrossSlides` audio element with the shared persistent-audio
 * manager, using the same resolved source, loop, volume and trim start the
 * slide-local element would have used. PowerPoint keeps such background audio
 * playing when the show advances, but this renderer rebuilds the whole stage on
 * every state change, so the slide-local `<audio>` dies with its slide's DOM;
 * the manager's hidden document-level element survives it.
 *
 * Returns true when the persistent element owns playback, in which case the
 * slide-local media node must stay silent or the track doubles. Idempotent per
 * element id (the manager no-ops a re-register), so the per-navigation stage
 * rebuild does not restart the track.
 */
export function registerCrossSlideAudio(
	element: MediaPptxElement,
	src: string | undefined,
): boolean {
	if (element.playAcrossSlides !== true || element.mediaType !== 'audio' || !src) {
		return false;
	}
	const playback = mediaPlaybackAttributes(element);
	registerPersistentAudio(
		element.id,
		src,
		element.mediaMimeType,
		playback.loop,
		playback.volume,
		(element.trimStartMs ?? 0) / 1000,
	);
	return true;
}

export const renderMediaElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'media') {
		return null;
	}
	// A stage that is neither interactive nor presenting is a STILL of a slide:
	// the presenter console's current-slide pane and next-slide preview, the
	// thumbnail rail, an export raster. `!presenting` alone put Chrome's black
	// scrubber across all of them, so the presenter console painted a transport
	// over a slide the speaker cannot play.
	const surface = mediaSurfaceOf({
		interactive: context.interactive === true,
		presenting: context.presenting,
	});
	const showTransport = mediaTransportVisible({ ...surface, canvasTransport: true });
	const doc = context.document;
	const el = createEl(doc, 'div', 'pptxv-element pptxv-media', getContainerStyle(element, zIndex));
	el.dataset.elementId = element.id;

	const mediaSrc =
		element.mediaData ??
		(element.mediaPath ? context.mediaDataUrls.get(element.mediaPath) : undefined);
	const posterSrc = getImageSrc(element, new Map(context.mediaDataUrls));

	if (mediaSrc && element.mediaType === 'video') {
		const video = createEl(doc, 'video', 'pptxv-media-video', {
			width: '100%',
			height: '100%',
			objectFit: 'contain',
			display: 'block',
		});
		video.src = mediaSrc;
		// No transport during a show: PowerPoint paints none, and a full-bleed
		// background video otherwise draws Chrome's own black scrubber across the
		// bottom of the slide, on top of the presentation toolbar.
		video.controls = showTransport;
		video.preload = 'metadata';
		video.playsInline = true;
		if (posterSrc) {
			video.setAttribute('poster', posterSrc);
		}
		el.appendChild(video);
		applyMediaPresentingState(video, context.presenting, element);
		return el;
	}

	if (mediaSrc && element.mediaType === 'audio') {
		const audio = createEl(doc, 'audio', 'pptxv-media-audio', { width: '100%' });
		audio.src = mediaSrc;
		audio.controls = showTransport;
		el.appendChild(audio);
		// "Play across slides" audio: a hidden document-level element (the shared
		// persistent-audio manager) carries the sound so it survives the stage
		// rebuild on advance. The slide-local copy must then stay silent, or the
		// track doubles while its own slide is up.
		if (context.presenting && registerCrossSlideAudio(element, mediaSrc)) {
			audio.muted = true;
			applyMediaPlaybackAttributes(audio, element);
			return el;
		}
		applyMediaPresentingState(audio, context.presenting, element);
		return el;
	}

	// No playable source. A still of a slide - the transition overlay, the
	// presenter console's panes, the thumbnail rail - paints the poster frame and
	// nothing else: the play badge and the typed placeholder box are authoring
	// chrome, and issue #147 is exactly that chrome riding along inside a morph.
	const fallback = mediaFallbackVisual(surface, {
		hasPoster: Boolean(posterSrc),
		missing: element.mediaMissing === true,
	});

	if (fallback.poster && posterSrc) {
		const img = createEl(doc, 'img', 'pptxv-media-poster', {
			width: '100%',
			height: '100%',
			objectFit: 'contain',
			display: 'block',
			opacity: fallback.dimPoster ? '0.5' : '',
		});
		img.src = posterSrc;
		img.alt = '';
		el.appendChild(img);
		if (fallback.badge) {
			el.appendChild(buildPlayBadge(doc));
		}
		return el;
	}

	if (fallback.placeholder) {
		// Unavailable media: reuse the placeholder look for a graceful fallback box.
		el.classList.add('pptxv-placeholder');
		el.setAttribute(MEDIA_CHROME_ATTRIBUTE, 'placeholder');
		const label = createEl(doc, 'div', 'pptxv-placeholder-label');
		label.textContent = context.t('pptx.elementType.media');
		el.appendChild(label);
	}
	return el;
};

/**
 * The centred play triangle painted over a poster frame on the authoring
 * canvas. `MEDIA_CHROME_ATTRIBUTE` is the neutral marker
 * `e2e/media-transition-chrome.spec.ts` asserts the absence of on a transition.
 */
function buildPlayBadge(doc: Document): SVGSVGElement {
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '1.5');
	svg.setAttribute(MEDIA_CHROME_ATTRIBUTE, 'play');
	svg.setAttribute('class', 'pptxv-media-badge');
	const polygon = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
	polygon.setAttribute('points', MEDIA_PLAY_BADGE_POINTS);
	svg.appendChild(polygon);
	return svg;
}
