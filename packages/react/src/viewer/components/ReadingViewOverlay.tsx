/**
 * PowerPoint's Reading View.
 *
 * The deck at full window size with the editor chrome reduced to a nav bar.
 * This is NOT the slide show: no Fullscreen API, no pointer tools, no
 * presenter console, no blackout. The reader gets the slide, a counter and
 * three controls, and Escape puts them back in the editor on the slide they
 * stopped at. See `render/reading-view` in `pptx-viewer-shared` for why the two
 * views are kept apart.
 *
 * `fixed inset-0` fills the browser window without requesting fullscreen,
 * matching both PowerPoint's behaviour and the existing SlideSorterOverlay.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	canGoNext,
	canGoPrevious,
	formatSlideCounter,
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';

import type { CanvasSize } from '../types';
import { ReadingViewStage } from './reading-view/ReadingViewStage';
import { useReadingView } from './reading-view/useReadingView';

export interface ReadingViewOverlayProps {
	slides: PptxSlide[];
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	/** Receives the slide the reader ended on. */
	onExit: (slideIndex: number) => void;
}

export function ReadingViewOverlay({
	slides,
	templateElements,
	canvasSize,
	activeSlideIndex,
	onExit,
}: ReadingViewOverlayProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { state, viewportRef, scale, run } = useReadingView({
		slideCount: slides.length,
		canvasSize,
		initialSlideIndex: activeSlideIndex,
		onExit,
	});

	const slide = slides[state.slideIndex];
	if (!state.open || !slide) {
		return null;
	}

	const control =
		'inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent';

	return (
		<div
			{...{ [READING_VIEW_ATTR]: 'true' }}
			role='region'
			aria-label={t('pptx.view.readingView')}
			className='fixed inset-0 z-[1300] flex flex-col bg-neutral-900'
		>
			<div ref={viewportRef} className='flex min-h-0 flex-1 items-center justify-center'>
				<ReadingViewStage
					slide={slide}
					templateElements={templateElements}
					canvasSize={canvasSize}
					scale={scale}
				/>
			</div>
			<div className='flex items-center justify-center gap-3 border-t border-white/10 px-4 py-2'>
				<button
					type='button'
					className={control}
					aria-label={t('pptx.common.previous')}
					title={t('pptx.common.previous')}
					disabled={!canGoPrevious(state)}
					onClick={() => run({ command: 'previous' })}
				>
					<LuChevronLeft />
				</button>
				<span
					{...{ [READING_VIEW_COUNTER_ATTR]: 'true' }}
					className='min-w-16 text-center text-xs tabular-nums text-white/70'
				>
					{formatSlideCounter(state.slideIndex, slides.length)}
				</span>
				<button
					type='button'
					className={control}
					aria-label={t('pptx.common.next')}
					title={t('pptx.common.next')}
					disabled={!canGoNext(state, slides.length)}
					onClick={() => run({ command: 'next' })}
				>
					<LuChevronRight />
				</button>
				<button
					type='button'
					className={control}
					aria-label={t('pptx.statusBar.normalView')}
					title={t('pptx.statusBar.normalView')}
					onClick={() => run({ command: 'exit' })}
				>
					<LuX />
				</button>
			</div>
		</div>
	);
}
