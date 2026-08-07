import type { MediaPptxElement } from 'pptx-viewer-core';
import {
	MEDIA_CHROME_ATTRIBUTE,
	MEDIA_PLAY_BADGE_POINTS,
	mediaFallbackVisual,
} from 'pptx-viewer-shared';
import type { MediaSurface } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { MediaNotFoundPlaceholder } from './media-components';

/**
 * What a media element paints when no `<video>`/`<audio>` can be mounted: the
 * poster frame it resolved, plus - on the authoring canvas only - the chrome
 * that says "this picture is a video".
 *
 * The surface rules live in the shared `mediaFallbackVisual` so the five
 * bindings cannot drift. Issue #147: this renderer is what a slide-transition
 * overlay uses (it deliberately passes no media map, so a ghost never mounts a
 * second decoder for a video that is already playing underneath), and the play
 * badge therefore rode along on every morph out of a slide with a full-bleed
 * background video.
 */
export interface MediaFallbackProps {
	element: MediaPptxElement;
	/** Resolved poster / preview frame, when the element has one. */
	posterUrl?: string;
	/** Which surface the slide is being painted on. */
	surface: MediaSurface;
}

/** The centred play triangle, drawn over a poster frame on the canvas. */
function PlayBadge(): React.ReactElement {
	return (
		<div
			className='absolute inset-0 flex items-center justify-center'
			{...{ [MEDIA_CHROME_ATTRIBUTE]: 'play' }}
		>
			<svg
				width='48'
				height='48'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				className='text-white/80 drop-shadow-md'
			>
				<polygon points={MEDIA_PLAY_BADGE_POINTS} />
			</svg>
		</div>
	);
}

/** The crossed circle + label shown over a poster standing in for missing media. */
function MissingBadge(): React.ReactElement {
	return (
		<div
			className='absolute inset-0 flex flex-col items-center justify-center gap-1'
			{...{ [MEDIA_CHROME_ATTRIBUTE]: 'missing' }}
		>
			<svg
				width='32'
				height='32'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				className='text-white/60'
			>
				<circle cx='12' cy='12' r='10' />
				<line x1='4' y1='4' x2='20' y2='20' />
			</svg>
			<span className='text-[10px] text-white/60'>{translationsEn['pptx.media.notFound']}</span>
		</div>
	);
}

/** The typed box shown when there is not even a poster to paint. */
function TypedPlaceholder({ isAudio }: { isAudio: boolean }): React.ReactElement {
	return (
		<div
			className={`w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none rounded ${
				isAudio ? 'bg-black/10' : 'bg-black/20'
			}`}
			{...{ [MEDIA_CHROME_ATTRIBUTE]: 'placeholder' }}
		>
			<svg
				width={isAudio ? '24' : '32'}
				height={isAudio ? '24' : '32'}
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				className='text-white/70'
			>
				{isAudio ? (
					<>
						<path d='M9 18V5l12-2v13' />
						<circle cx='6' cy='18' r='3' />
						<circle cx='18' cy='16' r='3' />
					</>
				) : (
					<polygon points={MEDIA_PLAY_BADGE_POINTS} />
				)}
			</svg>
			<span className='text-[10px] text-white/70'>{isAudio ? 'Audio' : 'Video'}</span>
		</div>
	);
}

/**
 * Render the unplayable-media fallback for `element`, or `null` when the
 * surface asks for slide content only and there is none to paint.
 */
export function renderMediaFallback({
	element,
	posterUrl,
	surface,
}: MediaFallbackProps): React.ReactNode {
	const missing = element.mediaMissing === true;
	const visual = mediaFallbackVisual(surface, { hasPoster: Boolean(posterUrl), missing });

	if (visual.poster && posterUrl) {
		return (
			<div className='w-full h-full relative pointer-events-none'>
				<img
					src={posterUrl}
					alt={
						missing
							? translationsEn['pptx.media.posterAlt']
							: translationsEn['pptx.media.videoPosterAlt']
					}
					className={`w-full h-full object-contain${visual.dimPoster ? ' opacity-50' : ''}`}
				/>
				{visual.badge && (missing ? <MissingBadge /> : <PlayBadge />)}
			</div>
		);
	}

	if (!visual.placeholder) {
		return null;
	}
	if (missing) {
		return <MediaNotFoundPlaceholder mediaType={element.mediaType ?? 'video'} />;
	}
	return <TypedPlaceholder isAudio={element.mediaType === 'audio'} />;
}
