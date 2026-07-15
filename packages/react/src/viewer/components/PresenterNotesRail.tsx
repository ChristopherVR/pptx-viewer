import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
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
	onMove,
	onUpdateNotes,
}: PresenterNotesRailProps): React.ReactElement {
	const { t } = useTranslation();
	const slide = slides[current];
	const nextSlide = slides.slice(current + 1).find((candidate) => !candidate.hidden);
	const notesText = slide?.notes ?? '';
	const notesSegments = slide?.notesSegments;
	const [notesDraft, setNotesDraft] = useState(notesText);
	const [fontSize, setFontSize] = useState(NOTES_FONT_SIZE_DEFAULT);
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
		<aside className='flex flex-[3] min-w-[260px] max-w-[440px] flex-col border-l border-border bg-background'>
			<header className='flex items-center justify-between border-b border-border/60 px-4 py-3'>
				<div>
					<div className='text-[10px] uppercase tracking-wider text-muted-foreground'>
						{t('pptx.presenter.currentTime')}
					</div>
					<div className='font-mono text-lg tabular-nums'>{formatTime(new Date(now))}</div>
				</div>
				<div className='text-right'>
					<div className='text-[10px] uppercase tracking-wider text-muted-foreground'>
						{t('pptx.presenter.elapsed')}
					</div>
					<div className='font-mono text-lg tabular-nums text-primary'>
						{formatElapsed(elapsed)}
					</div>
				</div>
			</header>

			<nav className='flex items-center justify-between border-b border-border/60 px-4 py-2'>
				<button
					type='button'
					onClick={() => onMove(-1)}
					disabled={current === 0}
					className='inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs disabled:opacity-40'
				>
					<LuChevronLeft /> {t('pptx.presenter.prev')}
				</button>
				<span className='font-mono text-sm tabular-nums'>
					{current + 1} / {slides.length}
				</span>
				<button
					type='button'
					onClick={() => onMove(1)}
					disabled={current >= slides.length - 1}
					className='inline-flex items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs disabled:opacity-40'
				>
					{t('pptx.presenter.next')} <LuChevronRight />
				</button>
			</nav>

			<section className='border-b border-border/60 px-4 py-3'>
				<div className='mb-2 text-[10px] uppercase tracking-wider text-muted-foreground'>
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

			<section className='flex min-h-0 flex-1 flex-col px-4 py-3'>
				<div className='mb-2 flex items-center justify-between'>
					<div className='text-[10px] uppercase tracking-wider text-muted-foreground'>
						{t('pptx.presenter.speakerNotes')}
					</div>
					<div className='flex items-center gap-1'>
						<button
							type='button'
							onClick={() => setFontSize(clampNotesFontSize(fontSize - NOTES_FONT_SIZE_STEP))}
							disabled={fontSize <= NOTES_FONT_SIZE_MIN}
							aria-label={t('pptx.presenter.decreaseFontSize')}
						>
							<LuMinus />
						</button>
						<span className='min-w-8 text-center font-mono text-[10px]'>{fontSize}px</span>
						<button
							type='button'
							onClick={() => setFontSize(clampNotesFontSize(fontSize + NOTES_FONT_SIZE_STEP))}
							disabled={fontSize >= NOTES_FONT_SIZE_MAX}
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
