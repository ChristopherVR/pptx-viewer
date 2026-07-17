/**
 * PresentationTouchControls: Always-visible, touch-friendly controls for
 * presentation (slide-show) mode.
 *
 * The existing `PresentationToolbar` only reveals itself on mouse movement, so
 * on a touch device there is no way to exit the slideshow or step between
 * slides (mobile has no Escape key). This overlay fills that gap: a persistent
 * close (✕) button plus large ‹ / › navigation buttons, all ≥44px and offset by
 * the device safe-area insets so they clear notches and rounded corners.
 *
 * Rendered only on touch-capable devices so it never clutters the desktop UI
 * (which keeps the auto-hiding mouse toolbar). Every control stops event
 * propagation so a tap on it never falls through to the slide tap-advance.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';

import { useIsMobile } from '../hooks/useIsMobile';

export interface PresentationTouchControlsProps {
	/** Zero-based index of the current presentation slide. */
	currentSlideIndex: number;
	/** Total number of slides. */
	totalSlides: number;
	/** Navigate next (1) / previous (-1). */
	onMovePresentationSlide: (direction: 1 | -1) => void;
	/** Exit the slideshow. */
	onEndPresentation: () => void;
	/** Hides the previous/next chevrons (the close button always stays). Maps to `hiddenActions: ['navigation']`. */
	hideNavigation?: boolean;
}

export function PresentationTouchControls({
	currentSlideIndex,
	totalSlides,
	onMovePresentationSlide,
	onEndPresentation,
	hideNavigation = false,
}: PresentationTouchControlsProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { isTouchDevice } = useIsMobile();

	// Mouse users keep the auto-hiding toolbar; this overlay is touch-only.
	if (!isTouchDevice) {
		return null;
	}

	// Shared geometry: 44px minimum hit target per WCAG, circular, translucent.
	const btnClass =
		'pointer-events-auto flex items-center justify-center w-11 h-11 min-w-11 min-h-11 rounded-full bg-black/55 text-white shadow-lg active:bg-black/75';

	const stop = (e: React.SyntheticEvent) => {
		e.stopPropagation();
	};

	return (
		<>
			{/* Close (top-right, safe-area aware) */}
			<button
				type='button'
				className={`fixed z-[90] ${btnClass}`}
				style={{
					top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
					right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
					touchAction: 'manipulation',
				}}
				onClick={(e) => {
					stop(e);
					onEndPresentation();
				}}
				aria-label={t('pptx.presenter.endPresentation')}
			>
				<LuX size={22} />
			</button>

			{/* Previous / Next (left / right edges) */}
			{!hideNavigation && (
				<>
					<button
						type='button'
						className={`fixed z-[90] top-1/2 -translate-y-1/2 ${btnClass} disabled:opacity-30`}
						style={{
							left: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)',
							touchAction: 'manipulation',
						}}
						disabled={currentSlideIndex <= 0}
						onClick={(e) => {
							stop(e);
							onMovePresentationSlide(-1);
						}}
						aria-label={t('pptx.presenter.previousSlide')}
					>
						<LuChevronLeft size={26} />
					</button>

					<button
						type='button'
						className={`fixed z-[90] top-1/2 -translate-y-1/2 ${btnClass} disabled:opacity-30`}
						style={{
							right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
							touchAction: 'manipulation',
						}}
						disabled={currentSlideIndex >= totalSlides - 1}
						onClick={(e) => {
							stop(e);
							onMovePresentationSlide(1);
						}}
						aria-label={t('pptx.presenter.nextSlide')}
					>
						<LuChevronRight size={26} />
					</button>
				</>
			)}

			{/* Slide counter (bottom-centre, safe-area aware) */}
			<span
				className='fixed z-[90] left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/55 text-white text-xs font-mono tabular-nums pointer-events-none'
				style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
			>
				{totalSlides === 0 ? '0 / 0' : `${currentSlideIndex + 1} / ${totalSlides}`}
			</span>
		</>
	);
}
