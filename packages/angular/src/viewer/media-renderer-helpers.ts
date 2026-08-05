import type { MediaCaptionTrack, MediaPptxElement, PptxElement } from 'pptx-viewer-core';

import { mediaPlaybackAttributes, registerPersistentAudio } from '../internal/shared';

/**
 * Pure helpers for {@link MediaRendererComponent}, mirroring React's
 * `media-render.tsx` / `media-persistent-audio.tsx`. Kept TestBed-free so the
 * source resolution + media-fragment maths can be unit-tested directly.
 */

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
 * Register a `playAcrossSlides` audio element with the shared persistent-audio
 * manager, using the same resolved source, loop, volume and trim start the
 * slide-local element would have used. PowerPoint keeps such background audio
 * playing when the show advances, but the slide-local `<audio>` dies with its
 * slide's DOM; the manager's hidden document-level element survives it.
 *
 * Returns true when the persistent element owns playback, in which case the
 * slide-local media node must stay silent or the track doubles. Idempotent per
 * element id (the manager no-ops a re-register), so re-entering the owning
 * slide does not restart the track.
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
