import { getContainerStyle, getImageSrc, startMediaAutoplay } from 'pptx-viewer-shared';

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
 *   mounted-watcher via the shared `startMediaAutoplay`); the edit-canvas
 *   controls suppression Vue does is not applicable here, the vanilla binding
 *   is a plain viewer, so controls are always enabled.
 */

/**
 * Apply the presentation-mode play/pause state to a mounted `<video>`/`<audio>`
 * element. Since the vanilla renderer rebuilds the whole stage on every state
 * change (no persistent element to `watch`), this runs once right after the
 * element is appended: start autoplay when presenting, otherwise make sure a
 * (rare, already-playing) element is paused. Exported for direct testing.
 */
export function applyMediaPresentingState(
	el: HTMLMediaElement,
	presenting: boolean,
	trimStartMs: number | undefined,
): void {
	if (presenting) {
		startMediaAutoplay(el, { trimStartMs });
	} else if (!el.paused) {
		el.pause();
	}
}

export const renderMediaElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'media') {
		return null;
	}
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
		video.controls = true;
		video.preload = 'metadata';
		video.playsInline = true;
		if (posterSrc) {
			video.setAttribute('poster', posterSrc);
		}
		el.appendChild(video);
		applyMediaPresentingState(video, context.presenting, element.trimStartMs);
		return el;
	}

	if (mediaSrc && element.mediaType === 'audio') {
		const audio = createEl(doc, 'audio', 'pptxv-media-audio', { width: '100%' });
		audio.src = mediaSrc;
		audio.controls = true;
		el.appendChild(audio);
		applyMediaPresentingState(audio, context.presenting, element.trimStartMs);
		return el;
	}

	if (posterSrc) {
		const img = createEl(doc, 'img', 'pptxv-media-poster', {
			width: '100%',
			height: '100%',
			objectFit: 'contain',
			display: 'block',
		});
		img.src = posterSrc;
		img.alt = '';
		el.appendChild(img);
		return el;
	}

	// Unavailable media: reuse the placeholder look for a graceful fallback box.
	el.classList.add('pptxv-placeholder');
	const label = createEl(doc, 'div', 'pptxv-placeholder-label');
	label.textContent = context.t('pptx.elementType.media');
	el.appendChild(label);
	return el;
};
