import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange, ShowOrderCustomShow } from 'pptx-viewer-shared';
import {
	nextPresentedSlide,
	PRESENTER_CONSOLE_CLASSES,
	presenterNextDisabled,
	presenterPrevDisabled,
} from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight, LuMinus, LuPlus } from 'react-icons/lu';

import type { CanvasSize } from '../types';
import {
	clampNotesFontSize,
	formatElapsed,
	formatTime,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	renderNotesSegments,
} from './presenter-view-utils';
import { ScaledSlidePreview } from './ScaledSlidePreview';

interface PresenterNotesRailProps {
	slides: PptxSlide[];
	current: number;
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	now: number;
	elapsed: number;
	/**
	 * The custom show currently playing, if any. The "next slide" preview MUST
	 * run the same show order the next forward press will: while "Reverse" is
	 * playing, the slide after 3 is 2, and previewing 4 rehearses a segue the
	 * room never sees.
	 */
	activeCustomShow?: ShowOrderCustomShow | null;
	/** The deck's authored `p:sldRg` range, so the preview never shows a slide outside it. */
	authoredRange?: AuthoredSlideRange | undefined;
	onMove: (direction: 1 | -1) => void;
	onUpdateNotes?: (notes: string) => void;
}

export function PresenterNotesRail({
	slides,
	current,
	canvasSize,
	templateElements,
	now,
	elapsed,
	activeCustomShow,
	authoredRange,
	onMove,
	onUpdateNotes,
}: PresenterNotesRailProps): React.ReactElement {
	const { t } = useTranslation();
	const slide = slides[current];
	const nextSlide = nextPresentedSlide(slides, current, activeCustomShow, authoredRange);
	const notesText = slide?.notes ?? '';
	const notesSegments = slide?.notesSegments;
	const [notesDraft, setNotesDraft] = useState(notesText);
	const [fontSize, setFontSize] = useState(NOTES_FONT_SIZE_DEFAULT);
	// `current` is not read in the callback; it's a re-sync trigger so navigating
	// to a different slide resets the draft to that slide's notes.
	// oxlint-disable-next-line react/exhaustive-effect-dependencies -- see comment above
	useEffect(() => setNotesDraft(notesText), [current, notesText]);
	const notes = useMemo(
		() =>
			notesSegments?.length ? (
				renderNotesSegments(notesSegments)
			) : notesText.trim() ? (
				notesText
			) : (
				<span className='italic text-muted-foreground'>{t('pptx.presenter.noNotes')}</span>
			),
		[notesSegments, notesText, t],
	);

	return (
		<aside className={PRESENTER_CONSOLE_CLASSES.rail}>
			<header className='flex items-center justify-between border-b border-border/60 px-4 py-3'>
				<div>
					<div className={PRESENTER_CONSOLE_CLASSES.railHeading}>
						{t('pptx.presenter.currentTime')}
					</div>
					<div className='font-mono text-lg tabular-nums'>{formatTime(new Date(now))}</div>
				</div>
				<div className='text-right'>
					<div className={PRESENTER_CONSOLE_CLASSES.railHeading}>{t('pptx.presenter.elapsed')}</div>
					<div className='font-mono text-lg tabular-nums text-primary'>
						{formatElapsed(elapsed)}
					</div>
				</div>
			</header>

			<nav className='flex items-center justify-between border-b border-border/60 px-4 py-2'>
				<button
					type='button'
					onClick={() => onMove(-1)}
					disabled={presenterPrevDisabled(current)}
					data-pptx-presenter-control='prev'
					className='inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs disabled:opacity-40'
				>
					<LuChevronLeft /> {t('pptx.presenter.prev')}
				</button>
				<span className='font-mono text-sm tabular-nums'>
					{current + 1} / {slides.length}
				</span>
				{/*
				 * Next stays live on the last slide. PowerPoint's console advances
				 * from there to the end-of-show screen and then out of the show;
				 * disabling it stranded the presenter on the final slide with no way
				 * to finish, so the audience display never closed either. The comment
				 * was not enough to stop three ports disabling it anyway, so the rule
				 * is now shared code (`presenterNextDisabled`).
				 */}
				<button
					type='button'
					onClick={() => onMove(1)}
					disabled={presenterNextDisabled()}
					data-pptx-presenter-control='next'
					className='inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs disabled:opacity-40'
				>
					{t('pptx.presenter.next')} <LuChevronRight />
				</button>
			</nav>

			<section className='border-b border-border/60 px-4 py-3' data-pptx-presenter-next-preview>
				<div className={`mb-2 ${PRESENTER_CONSOLE_CLASSES.railHeading}`}>
					{t('pptx.presenter.nextSlidePreview')}
				</div>
				{nextSlide ? (
					<ScaledSlidePreview
						slide={nextSlide}
						templateElements={templateElements}
						canvasSize={canvasSize}
					/>
				) : (
					<div className='flex h-16 items-center justify-center rounded bg-muted/40 text-xs italic text-muted-foreground'>
						{t('pptx.presenter.endOfPresentation')}
					</div>
				)}
			</section>

			<section className='flex min-h-0 flex-1 flex-col px-4 py-3' data-pptx-presenter-notes>
				<div className='mb-2 flex items-center justify-between'>
					<div className={PRESENTER_CONSOLE_CLASSES.railHeading}>
						{t('pptx.presenter.speakerNotes')}
					</div>
					<div className='flex items-center gap-1'>
						<button
							type='button'
							onClick={() => setFontSize(clampNotesFontSize(fontSize - NOTES_FONT_SIZE_STEP))}
							disabled={fontSize <= NOTES_FONT_SIZE_MIN}
							data-pptx-presenter-control='notes-font-decrease'
							aria-label={t('pptx.presenter.decreaseFontSize')}
						>
							<LuMinus />
						</button>
						<span className='min-w-8 text-center font-mono text-[10px]'>{fontSize}px</span>
						<button
							type='button'
							onClick={() => setFontSize(clampNotesFontSize(fontSize + NOTES_FONT_SIZE_STEP))}
							disabled={fontSize >= NOTES_FONT_SIZE_MAX}
							data-pptx-presenter-control='notes-font-increase'
							aria-label={t('pptx.presenter.increaseFontSize')}
						>
							<LuPlus />
						</button>
					</div>
				</div>
				{onUpdateNotes ? (
					<textarea
						className='min-h-0 flex-1 resize-none rounded border border-border/30 bg-muted/40 px-3 py-2 leading-relaxed'
						style={{ fontSize }}
						value={notesDraft}
						onChange={(event) => setNotesDraft(event.target.value)}
						onBlur={() => onUpdateNotes(notesDraft)}
						aria-label={t('pptx.presenter.speakerNotes')}
					/>
				) : (
					<div
						className='min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-border/30 bg-muted/40 px-3 py-2 leading-relaxed'
						style={{ fontSize }}
					>
						{notes}
					</div>
				)}
			</section>
		</aside>
	);
}
