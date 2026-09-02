import type { MediaCaptionTrack, MediaPptxElement, PptxElement } from 'pptx-viewer-core';

import { mediaFallbackVisual, mediaSurfaceOf, registerCrossSlideAudio } from '../internal/shared';
import type { MediaFallbackVisual, MediaSurface } from '../internal/shared';

export { registerCrossSlideAudio };

/**
 * Pure helpers for {@link MediaRendererComponent}, mirroring React's
 * `media-render.tsx` / `media-persistent-audio.tsx`. Kept TestBed-free so the
 * source resolution + media-fragment maths can be unit-tested directly.
 */

/** Which surface {@link MediaRendererComponent} is painting on. */
export function mediaSurfaceFor(interactive: boolean, presenting: boolean): MediaSurface {
	return mediaSurfaceOf({ interactive, presenting });
}

/**
 * What the template paints when no `<video>`/`<audio>` can be mounted.
 *
 * A still of a slide - the slide-transition overlay, the presenter console's
 * panes, the thumbnail rail - gets the poster frame and nothing else: the play
 * badge and the typed placeholder box are authoring chrome, and issue #147 is
 * exactly that chrome riding along inside a morph. Factored out of the template
 * so its `@if`s can be asserted without a TestBed, as this package does
 * elsewhere (see `action-settings-panel.component.test.ts`).
 */
export function mediaFallbackFor(
	el: PptxElement,
	hasPoster: boolean,
	surface: MediaSurface,
): MediaFallbackVisual {
	return mediaFallbackVisual(surface, {
		hasPoster,
		missing: asMediaElement(el)?.mediaMissing === true,
	});
}

/** Narrow a generic element to `MediaPptxElement`, or `undefined`. */
export function asMediaElement(el: PptxElement): MediaPptxElement | undefined {
	return el.type === 'media' ? el : undefined;
}

/**
 * Resolve the playable source for a media element: the inline base64 data URL
 * when present, otherwise the archive path resolved through the media map.
 * Mirrors React's `element.mediaData ?? mediaDataUrls.get(mediaPath)`.
 */
export function resolveMediaSrc(
	el: MediaPptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	return el.mediaData ?? (el.mediaPath ? mediaDataUrls.get(el.mediaPath) : undefined);
}

/**
 * Build a media-fragment URI component (`#t=start,end`) for trimmed media.
 * Times are stored in milliseconds; the fragment uses seconds. Mirrors React's
 * `buildTrimFragment`.
 */
export function buildTrimFragment(el: MediaPptxElement): string {
	const start = el.trimStartMs;
	const end = el.trimEndMs;
	if (start === undefined && end === undefined) {
		return '';
	}
	const parts: string[] = [];
	if (start !== undefined && start > 0) {
		parts.push((start / 1000).toFixed(3));
	} else {
		parts.push('');
	}
	if (end !== undefined && end > 0) {
		parts.push((end / 1000).toFixed(3));
	}
	return parts.length > 0 ? `#t=${parts.join(',')}` : '';
}

/** A caption track resolved to a `<track>`-ready `src`. */
export interface ResolvedCaptionTrack {
	id: string;
	src: string;
	kind: MediaCaptionTrack['kind'];
	label: string;
	language: string;
	isDefault: boolean;
}

/**
 * Resolve caption tracks to `<track>` descriptors, dropping any without a
 * usable source. Inline VTT content is wrapped in a `data:` URL, mirroring
 * React's `CaptionTrackRenderer`.
 */
export function resolveCaptionTracks(
	tracks: readonly MediaCaptionTrack[] | undefined,
): ResolvedCaptionTrack[] {
	if (!tracks || tracks.length === 0) {
		return [];
	}
	const out: ResolvedCaptionTrack[] = [];
	for (const track of tracks) {
		const src =
			track.src ??
			(track.content
				? `data:text/vtt;charset=utf-8,${encodeURIComponent(track.content)}`
				: undefined);
		if (!src) {
			continue;
		}
		out.push({
			id: track.id,
			src,
			kind: track.kind,
			label: track.label,
			language: track.language,
			isDefault: track.isDefault === true,
		});
	}
	return out;
}
