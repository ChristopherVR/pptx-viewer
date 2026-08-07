import type { PptxElement } from 'pptx-viewer-core';
import { mediaPlaybackAttributes } from 'pptx-viewer-shared';
import type { MediaSurface } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { VideoWithMetadata, AudioWithMetadata } from './media-components';
import { PresentationMediaController } from './media-controller';
import { renderMediaFallback } from './media-fallback';
import { buildTrimFragment } from './media-persistent-audio';

// ---------------------------------------------------------------------------
// Public render options
// ---------------------------------------------------------------------------

export interface RenderMediaOptions {
	autoPlay?: boolean;
	fullScreen?: boolean;
	isPresentationMode?: boolean;
	/**
	 * Whether to paint the browser's native transport. Defaults to the show rule
	 * (`!isPresentationMode`); the STILL surfaces (presenter console panes,
	 * thumbnails, previews) pass `false` explicitly, because they are not in
	 * presentation mode and would otherwise get a scrubber over a slide the
	 * viewer cannot play. See the shared `mediaTransportVisible`.
	 */
	showTransport?: boolean;
	/**
	 * True when the slide is painted as a STILL of itself: a slide-transition
	 * overlay, the presenter console's panes, the thumbnail rail, an export
	 * raster. Such a surface paints slide CONTENT only - never the play badge or
	 * the typed placeholder box, which are authoring chrome (issue #147).
	 */
	preview?: boolean;
	/** Callback fired when the media play/pause state changes. */
	onPlayStateChange?: (isPlaying: boolean) => void;
}

// ---------------------------------------------------------------------------
// renderMediaElement: main public entry point
// ---------------------------------------------------------------------------

/**
 * Render video or audio media elements with native HTML5 players.
 * Supports trim, fade in/out, volume, loop, auto-play, hide-when-not-playing,
 * bookmarks, metadata extraction, closed captions, and missing-media placeholders.
 */
export function renderMediaElement(
	element: PptxElement,
	mediaDataUrls: Map<string, string>,
	options?: RenderMediaOptions,
): React.ReactNode {
	if (element.type !== 'media') {
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
				{translationsEn['pptx.media.title']}
			</div>
		);
	}

	// Extract media info from the element (already narrowed by type guard above)
	const mediaType = element.mediaType;
	const mediaPath = element.mediaPath;
	const mediaMimeType = element.mediaMimeType;

	// Try to resolve the media data URL (base64-encoded by PptxHandler)
	const dataUrl = element.mediaData ?? (mediaPath ? mediaDataUrls.get(mediaPath) : undefined);

	// Trim fragment for media source URL
	const trimFragment = buildTrimFragment(element);

	// Poster frame data URL (resolved during parsing)
	const posterUrl = element.posterFrameData ?? undefined;

	// Loop flag, read through the shared mapping so `element.loop` is interpreted
	// identically in every binding (two of them simply dropped it, and a looping
	// two-second clip that plays once looks exactly like a video that never ran).
	const shouldLoop = mediaPlaybackAttributes(element).loop;
	const shouldAutoPlay = options?.autoPlay === true || element.autoPlay === true;
	const isFullScreen = options?.fullScreen === true;
	const isPresentationMode = options?.isPresentationMode === true;
	const showTransport = options?.showTransport ?? !isPresentationMode;
	const surface: MediaSurface = {
		presenting: isPresentationMode,
		preview: options?.preview === true,
	};

	// Play-across-slides audio is registered by the PresentationMediaController
	// auto-play effect, which receives this resolved dataUrl (element bytes or
	// mediaDataUrls lookup) via its `resolvedDataUrl` prop.

	// Explicitly missing media: the poster frame is the only slide content left,
	// and the "not found" mark over it is chrome the shared rule places.
	if (element.mediaMissing) {
		return renderMediaFallback({ element, posterUrl, surface });
	}

	if (mediaType === 'video') {
		if (dataUrl) {
			return (
				<PresentationMediaController
					element={element}
					isPresentationMode={isPresentationMode}
					shouldAutoPlay={shouldAutoPlay}
					resolvedDataUrl={dataUrl}
					isFullScreen={isFullScreen}
					onPlayStateChange={options?.onPlayStateChange}
				>
					{({ mediaRef, onPlay }) => (
						<VideoWithMetadata
							element={element}
							mediaRef={mediaRef}
							onPlay={onPlay}
							dataUrl={dataUrl}
							trimFragment={trimFragment}
							mediaMimeType={mediaMimeType}
							posterUrl={posterUrl}
							shouldLoop={shouldLoop}
							shouldAutoPlay={shouldAutoPlay}
							isFullScreen={isFullScreen}
							isPresentationMode={isPresentationMode}
							showTransport={showTransport}
						/>
					)}
				</PresentationMediaController>
			);
		}
		// No playable source: the poster frame, plus canvas-only chrome.
		return renderMediaFallback({ element, posterUrl, surface });
	}

	if (mediaType === 'audio') {
		if (dataUrl) {
			return (
				<PresentationMediaController
					element={element}
					isPresentationMode={isPresentationMode}
					shouldAutoPlay={shouldAutoPlay}
					resolvedDataUrl={dataUrl}
					isFullScreen={false}
					onPlayStateChange={options?.onPlayStateChange}
				>
					{({ mediaRef, onPlay }) => (
						<AudioWithMetadata
							element={element}
							mediaRef={mediaRef}
							onPlay={onPlay}
							dataUrl={dataUrl}
							trimFragment={trimFragment}
							mediaMimeType={mediaMimeType}
							shouldLoop={shouldLoop}
							shouldAutoPlay={shouldAutoPlay}
							showTransport={showTransport}
						/>
					)}
				</PresentationMediaController>
			);
		}
		return renderMediaFallback({ element, posterUrl, surface });
	}

	// Untyped media: a labelled box is chrome, so a still of the slide (a
	// transition overlay, a thumbnail) and the show itself paint nothing.
	if (surface.presenting || surface.preview) {
		return null;
	}
	return (
		<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
			{translationsEn['pptx.media.title']}
		</div>
	);
}
