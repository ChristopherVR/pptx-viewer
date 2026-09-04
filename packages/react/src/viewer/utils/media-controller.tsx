import type { MediaPptxElement } from 'pptx-viewer-core';
import {
	mediaPlaybackAttributes,
	registerCrossSlideAudio,
	scheduleMediaTrimAndFade,
} from 'pptx-viewer-shared';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// PresentationMediaController: manages trim, fade, volume at runtime
// ---------------------------------------------------------------------------

interface PresentationMediaControllerProps {
	element: MediaPptxElement;
	isPresentationMode: boolean;
	/**
	 * Effective autoplay decision used to render the underlying element's
	 * `autoPlay` prop (`options.autoPlay || element.autoPlay`), NOT the raw
	 * persisted `element.autoPlay` flag. Present mode makes this true for any
	 * media on the active slide, so the corrective `.play()` effect must gate
	 * on this to actually start playback for media inserted without the flag.
	 */
	shouldAutoPlay: boolean;
	/**
	 * The resolved media source the inline element renders with:
	 * `element.mediaData` or the `mediaDataUrls` lookup by `element.mediaPath`
	 * (see `renderMediaElement`). The play-across-slides branch registers the
	 * persistent audio with this, so audio whose bytes live in the map (not on
	 * the element) still survives slide unmount.
	 */
	resolvedDataUrl?: string;
	/** Whether this media is in full-screen overlay mode. */
	isFullScreen: boolean;
	/** Callback fired when media play/pause state changes. */
	onPlayStateChange?: (isPlaying: boolean) => void;
	children: (props: {
		mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
		onPlay: () => void;
		isMediaPlaying: boolean;
	}) => React.ReactNode;
}

export function PresentationMediaController({
	element,
	isPresentationMode,
	shouldAutoPlay,
	resolvedDataUrl,
	isFullScreen,
	onPlayStateChange,
	children,
}: PresentationMediaControllerProps): React.ReactElement {
	const { t } = useTranslation();
	const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
	const [isMediaPlaying, setIsMediaPlaying] = useState(false);

	const trimStartSec = element.trimStartMs !== undefined ? element.trimStartMs / 1000 : 0;
	const hideWhenNotPlaying = isPresentationMode && element.hideWhenNotPlaying === true;

	// The clamps that turn authored playback settings into DOM values live in
	// shared, so all five bindings agree on what `vol="0"` or a 10x rate means.
	// `loop` is declarative here (the <video>/<audio> `loop` prop, from
	// `element.loop`), so only the two IDL-only properties are applied by hand.
	const { volume: playbackVolume, playbackRate } = mediaPlaybackAttributes({
		loop: element.loop,
		volume: element.volume,
		playbackSpeed: element.playbackSpeed,
	});

	// Apply volume
	useEffect(() => {
		const el = mediaRef.current;
		if (el) {
			el.volume = playbackVolume;
		}
	}, [playbackVolume]);

	// Apply playback speed
	useEffect(() => {
		const el = mediaRef.current;
		if (el) {
			el.playbackRate = playbackRate;
		}
	}, [playbackRate]);

	// Track play/pause state and notify parent
	useEffect(() => {
		const el = mediaRef.current;
		if (!el) {
			return;
		}
		const handlePlay = (): void => {
			setIsMediaPlaying(true);
			onPlayStateChange?.(true);
		};
		const handlePause = (): void => {
			setIsMediaPlaying(false);
			onPlayStateChange?.(false);
		};
		const handleEnded = (): void => {
			setIsMediaPlaying(false);
			onPlayStateChange?.(false);
		};
		el.addEventListener('play', handlePlay);
		el.addEventListener('pause', handlePause);
		el.addEventListener('ended', handleEnded);
		return () => {
			el.removeEventListener('play', handlePlay);
			el.removeEventListener('pause', handlePause);
			el.removeEventListener('ended', handleEnded);
		};
	}, [onPlayStateChange]);

	// Trim-end stop + fade in/out (G20): shared with the other four bindings so
	// a trimmed/faded clip behaves identically everywhere, not just here. Only
	// active in presentation mode, matching the previous React-only behaviour;
	// re-schedules whenever the authored trim/fade/volume settings change.
	useEffect(() => {
		const el = mediaRef.current;
		if (!el || !isPresentationMode) {
			return;
		}
		return scheduleMediaTrimAndFade(el, {
			trimStartMs: element.trimStartMs,
			trimEndMs: element.trimEndMs,
			fadeInDuration: element.fadeInDuration,
			fadeOutDuration: element.fadeOutDuration,
			volume: playbackVolume,
		});
	}, [
		isPresentationMode,
		element.trimStartMs,
		element.trimEndMs,
		element.fadeInDuration,
		element.fadeOutDuration,
		playbackVolume,
	]);

	// Auto-play in presentation mode
	useEffect(() => {
		if (!isPresentationMode || !shouldAutoPlay) {
			return;
		}

		// Play-across-slides: register with persistent manager so audio
		// survives slide unmount. The media element in the slide is hidden;
		// a detached <audio> plays instead. The source is resolved exactly like
		// the inline path's src: element bytes first, then the caller's
		// mediaDataUrls lookup (passed in as `resolvedDataUrl`).
		if (element.playAcrossSlides && element.mediaType === 'audio') {
			const dataUrl = element.mediaData ?? resolvedDataUrl;
			if (registerCrossSlideAudio(element, dataUrl)) {
				// The detached persistent element plays; don't also play inline.
				return;
			}
			// No source resolved: fall through so the inline element at least
			// plays on this slide instead of the audio being silently dropped.
		}

		const el = mediaRef.current;
		if (!el) {
			return;
		}

		// Small delay to let the slide render
		const timer = window.setTimeout(() => {
			if (trimStartSec > 0) {
				el.currentTime = trimStartSec;
			}
			void el.play().catch(() => {
				/* autoplay blocked */
			});
		}, 100);
		return () => window.clearTimeout(timer);
	}, [isPresentationMode, shouldAutoPlay, element, resolvedDataUrl, trimStartSec]);

	const wrapperStyle: React.CSSProperties = hideWhenNotPlaying
		? {
				opacity: isMediaPlaying ? 1 : 0,
				transition: 'opacity 0.3s ease',
				pointerEvents: isMediaPlaying ? 'auto' : 'none',
			}
		: {};

	const handleStopFullScreen = useCallback((): void => {
		const el = mediaRef.current;
		if (el && !el.paused) {
			el.pause();
		}
	}, []);

	// Trim/fade scheduling is now driven entirely by the DOM `play` listener
	// `scheduleMediaTrimAndFade` attaches above, not this render prop; kept in
	// the `children` contract (stable no-op) so callers do not need to change.
	const noopOnPlay = useCallback((): void => {}, []);

	return (
		<div className='w-full h-full' style={wrapperStyle}>
			{children({ mediaRef, onPlay: noopOnPlay, isMediaPlaying })}
			{/* Subtle close/stop button for full-screen media overlay */}
			{isFullScreen && isPresentationMode && isMediaPlaying && (
				<button
					type='button'
					className='absolute bottom-3 right-3 z-30 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-white p-2 transition-colors pointer-events-auto'
					onClick={handleStopFullScreen}
					aria-label={t('pptx.media.stopFullscreenAria')}
				>
					<svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor' stroke='none'>
						<rect x='6' y='6' width='12' height='12' rx='1' />
					</svg>
				</button>
			)}
		</div>
	);
}
