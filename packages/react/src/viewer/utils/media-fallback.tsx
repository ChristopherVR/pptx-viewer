import type { MediaPptxElement } from 'pptx-viewer-core';
import {
	MEDIA_CHROME_ATTRIBUTE,
	getImageFitStyle,
	mediaFallbackIcon,
	mediaFallbackLabelKey,
	mediaFallbackVisual,
} from 'pptx-viewer-shared';
import type { MediaFallbackVisual, MediaSurface } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

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

/** Translate a shared label key. This is a plain function, so no hook here. */
function label(key: string | undefined): string | undefined {
	return key === undefined
		? undefined
		: (translationsEn[key as keyof typeof translationsEn] as string | undefined);
}

/**
 * The shared icon for a resolved fallback, drawn as stroked paths so the five
 * bindings render the same geometry from the same array.
 */
function FallbackIcon({
	paths,
	size,
	className,
}: {
	paths: readonly string[];
	size: number;
	className: string;
}): React.ReactElement | null {
	if (paths.length === 0) {
		return null;
	}
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='1.5'
			className={className}
		>
			{paths.map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

/** The centred affordance drawn over a poster frame on the authoring canvas. */
function Badge({
	visual,
	element,
}: {
	visual: MediaFallbackVisual;
	element: MediaPptxElement;
}): React.ReactElement | null {
	if (visual.badge === 'none') {
		return null;
	}
	const isMissing = visual.badge === 'missing';
	return (
		<div
			className={`absolute inset-0 flex flex-col items-center justify-center ${
				isMissing ? 'gap-1' : ''
			}`}
			{...{ [MEDIA_CHROME_ATTRIBUTE]: visual.badge }}
		>
			<FallbackIcon
				paths={mediaFallbackIcon(visual, element.mediaType)}
				size={isMissing ? 32 : 48}
				className={isMissing ? 'text-white/60' : 'text-white/80 drop-shadow-md'}
			/>
			{isMissing && (
				<span className='text-[10px] text-white/60'>
					{label(mediaFallbackLabelKey(visual, element.mediaType))}
				</span>
			)}
		</div>
	);
}

/** The box drawn when there is not even a poster frame to paint. */
function Placeholder({
	visual,
	element,
}: {
	visual: MediaFallbackVisual;
	element: MediaPptxElement;
}): React.ReactElement | null {
	if (visual.placeholder === 'none') {
		return null;
	}
	const isMissing = visual.placeholder === 'missing';
	return (
		<div
			className={`w-full h-full flex flex-col items-center justify-center gap-1 pointer-events-none rounded ${
				isMissing
					? 'bg-black/30 border border-dashed border-white/20'
					: element.mediaType === 'audio'
						? 'bg-black/10'
						: 'bg-black/20'
			}`}
			{...{ [MEDIA_CHROME_ATTRIBUTE]: visual.placeholder }}
		>
			<FallbackIcon
				paths={mediaFallbackIcon(visual, element.mediaType)}
				size={isMissing ? 36 : element.mediaType === 'audio' ? 24 : 32}
				className={isMissing ? 'text-white/50' : 'text-white/70'}
			/>
			<span className={`text-[10px] ${isMissing ? 'text-white/50' : 'text-white/70'}`}>
				{label(mediaFallbackLabelKey(visual, element.mediaType))}
			</span>
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
	const visual = mediaFallbackVisual(surface, {
		hasPoster: Boolean(posterUrl),
		missing: element.mediaMissing === true,
	});

	if (visual.poster && posterUrl) {
		return (
			<div className='w-full h-full relative pointer-events-none'>
				<img
					src={posterUrl}
					alt={
						visual.dimPoster
							? translationsEn['pptx.media.posterAlt']
							: translationsEn['pptx.media.videoPosterAlt']
					}
					className={`w-full h-full${visual.dimPoster ? ' opacity-50' : ''}`}
					style={getImageFitStyle(element)}
				/>
				<Badge visual={visual} element={element} />
			</div>
		);
	}

	return <Placeholder visual={visual} element={element} />;
}
