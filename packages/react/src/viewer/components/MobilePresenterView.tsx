import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	formatMobileElapsed,
	isFirstSlide,
	isLastSlide,
	mobileElapsedSince,
	mobileSlideCounter,
} from 'pptx-viewer-shared';
/**
 * MobilePresenterView: single-column phone layout for presenter/speaker view.
 *
 * Shown instead of the desktop split-screen `PresenterView` when the speaker
 * enters presenter mode on a small screen (see `ViewerPresentationLayer`).
 * The desktop layout is left byte-for-byte unchanged; only the layout differs.
 *
 * Layout, top to bottom: the current slide large, a header row (elapsed timer
 * + slide counter + exit), a small "next" thumbnail, the scrollable speaker
 * notes, and prev/next controls; everything is offset by the device safe-area
 * insets. All pure geometry / labels / time formatting come from
 * `pptx-viewer-shared` (`presenter-mobile`).
 *
 * Keyboard navigation is owned by the parent `usePresentationKeyboard` hook;
 * this component registers no key listener (matching `PresenterView`).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';

import type { CanvasSize } from '../types';
import { renderNotesSegments } from './presenter-view-utils';
import { ScaledSlidePreview } from './ScaledSlidePreview';

// ---------------------------------------------------------------------------
// Props (a subset of PresenterViewProps so the two are wiring-compatible)
// ---------------------------------------------------------------------------

export interface MobilePresenterViewProps {
	slides: PptxSlide[];
	currentSlideIndex: number;
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	presentationStartTime: number | null;
	onMovePresentationSlide: (direction: 1 | -1) => void;
	onExit: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobilePresenterView({
	slides,
	currentSlideIndex,
	canvasSize,
	templateElements,
	presentationStartTime,
	onMovePresentationSlide,
	onExit,
}: MobilePresenterViewProps): React.ReactElement {
	const { t } = useTranslation();

	// -- Elapsed timer (1 Hz tick) -------------------------------------------
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, []);
	const elapsed = mobileElapsedSince(presentationStartTime, now);

	// -- Slide data ----------------------------------------------------------
	const currentSlide = slides[currentSlideIndex];
	const nextSlide =
		currentSlideIndex + 1 < slides.length ? slides[currentSlideIndex + 1] : undefined;

	if (!currentSlide) {
		return (
			<div className='absolute inset-0 z-50 flex items-center justify-center bg-card text-muted-foreground'>
				{t('pptx.presenter.noSlides')}
			</div>
		);
	}

	const notesText = currentSlide.notes ?? '';
	const notesSegments = currentSlide.notesSegments;
	const hasRichNotes = notesSegments && notesSegments.length > 0;

	const atFirst = isFirstSlide(currentSlideIndex);
	const atLast = isLastSlide(currentSlideIndex, slides.length);

	const insetStyle: React.CSSProperties = {
		paddingTop: 'env(safe-area-inset-top, 0px)',
		paddingBottom: 'env(safe-area-inset-bottom, 0px)',
		paddingLeft: 'env(safe-area-inset-left, 0px)',
		paddingRight: 'env(safe-area-inset-right, 0px)',
	};

	return (
		<div className='absolute inset-0 z-50 flex flex-col bg-card text-foreground' style={insetStyle}>
			{/* Header: elapsed timer + slide counter + exit */}
			<div className='flex items-center justify-between gap-2 px-4 py-2 border-b border-border/60'>
				<div className='flex flex-col'>
					<span className='text-[10px] text-muted-foreground uppercase tracking-wider'>
						{t('pptx.presenter.elapsed')}
					</span>
					<span className='text-lg font-mono tabular-nums text-primary'>
						{formatMobileElapsed(elapsed)}
					</span>
				</div>
				<span className='text-sm font-mono tabular-nums text-foreground'>
					{mobileSlideCounter(currentSlideIndex, slides.length)}
				</span>
				<button
					type='button'
					onClick={onExit}
					className='flex items-center justify-center w-11 h-11 min-w-11 min-h-11 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors'
					title={t('pptx.presenter.endPresentation')}
					aria-label={t('pptx.presenter.endPresentation')}
				>
					<LuX className='w-5 h-5' />
				</button>
			</div>

			{/* Current slide (large) */}
			<div className='flex items-center justify-center bg-black px-3 py-3'>
				<div className='w-full max-w-[640px]'>
					<ScaledSlidePreview
						slide={currentSlide}
						templateElements={templateElements}
						canvasSize={canvasSize}
					/>
				</div>
			</div>

			{/* Next thumbnail */}
			<div className='flex items-center gap-3 px-4 py-2 border-b border-border/60'>
				<span className='text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap'>
					{t('pptx.presenter.nextSlidePreview')}
				</span>
				<div className='w-[132px] flex-shrink-0'>
					{nextSlide ? (
						<ScaledSlidePreview
							slide={nextSlide}
							templateElements={templateElements}
							canvasSize={canvasSize}
						/>
					) : (
						<div className='flex items-center justify-center h-12 rounded border border-border/30 bg-muted/40 text-[10px] text-muted-foreground italic'>
							{t('pptx.presenter.endOfPresentation')}
						</div>
					)}
				</div>
			</div>

			{/* Speaker notes (scrollable) */}
			<div className='flex-1 flex flex-col min-h-0 px-4 py-2'>
				<div className='text-[10px] text-muted-foreground uppercase tracking-wider mb-1'>
					{t('pptx.presenter.speakerNotes')}
				</div>
				<div className='flex-1 overflow-y-auto rounded border border-border/30 bg-muted/40 px-3 py-2 text-foreground whitespace-pre-wrap leading-relaxed text-[15px]'>
					{hasRichNotes ? (
						renderNotesSegments(notesSegments)
					) : notesText.trim().length > 0 ? (
						notesText
					) : (
						<span className='italic text-muted-foreground'>{t('pptx.presenter.noNotes')}</span>
					)}
				</div>
			</div>

			{/* Prev / Next controls */}
			<div className='flex items-center justify-between gap-3 px-4 py-2 border-t border-border/60'>
				<button
					type='button'
					onClick={() => onMovePresentationSlide(-1)}
					disabled={atFirst}
					className='inline-flex items-center justify-center gap-1.5 flex-1 h-11 rounded bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors'
					title={t('pptx.presenter.previousSlide')}
					aria-label={t('pptx.presenter.previousSlide')}
				>
					<LuChevronLeft className='w-5 h-5' />
					{t('pptx.presenter.prev')}
				</button>
				<button
					type='button'
					onClick={() => onMovePresentationSlide(1)}
					disabled={atLast}
					className='inline-flex items-center justify-center gap-1.5 flex-1 h-11 rounded bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors'
					title={t('pptx.presenter.nextSlide')}
					aria-label={t('pptx.presenter.nextSlide')}
				>
					{t('pptx.presenter.next')}
					<LuChevronRight className='w-5 h-5' />
				</button>
			</div>
		</div>
	);
}
