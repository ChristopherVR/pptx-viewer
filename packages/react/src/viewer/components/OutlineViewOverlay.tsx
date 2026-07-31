/**
 * PowerPoint's Outline view.
 *
 * The deck as an editable indented text document: one row per slide title at
 * the left margin, that slide's body lines stepped in beneath it. Typing edits
 * the slide, Tab and Shift+Tab change a line's outline level, and Enter on a
 * title starts a new slide. See `render/outline-view` in `pptx-viewer-shared`
 * for the model, and `render/outline-view-edit` for what each gesture does and
 * (just as important) what it deliberately does not.
 *
 * Rendered as a full-window overlay rather than by replacing the thumbnail
 * pane, matching SlideSorterOverlay and ReadingViewOverlay. Every binding then
 * needs one overlay, not five different rebuilds of its own sidebar.
 *
 * Each row is a real `<input>`. A contenteditable would have to re-implement
 * caret placement, IME commit and undo per browser, and a list of one-line
 * inputs is exactly what the outline is.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	OUTLINE_LEVEL_ATTR,
	OUTLINE_ROW_ATTR,
	OUTLINE_SLIDE_ATTR,
	OUTLINE_VIEW_ATTR,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import type { CanvasSize } from '../types';
import { useOutlineView } from './outline-view/useOutlineView';

export interface OutlineViewOverlayProps {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	canEdit: boolean;
	setSlides: (slides: PptxSlide[]) => void;
	setActiveSlideIndex: (index: number) => void;
	bumpHistory: () => void;
	onClose: () => void;
}

/** Indent per outline level, in pixels. Level 0 (a title) sits flush left. */
const INDENT_PX = 22;

export function OutlineViewOverlay({
	slides,
	canvasSize,
	canEdit,
	setSlides,
	setActiveSlideIndex,
	bumpHistory,
	onClose,
}: OutlineViewOverlayProps): React.ReactElement {
	const { t } = useTranslation();
	const { rows, containerRef, run, onRowKeyDown } = useOutlineView({
		slides,
		canvasSize,
		canEdit,
		setSlides,
		setActiveSlideIndex,
		bumpHistory,
	});

	return (
		<div
			{...{ [OUTLINE_VIEW_ATTR]: 'true' }}
			role='region'
			aria-label={t('pptx.view.outlineView')}
			className='fixed inset-0 z-[1300] flex flex-col bg-neutral-900 text-neutral-100'
		>
			<div className='flex items-center gap-3 border-b border-white/10 px-4 py-2'>
				<span className='text-sm font-semibold'>{t('pptx.view.outlineView')}</span>
				<span className='flex-1 truncate text-[11px] text-white/50'>{t('pptx.outline.hint')}</span>
				<button
					type='button'
					className='inline-flex h-8 w-8 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white'
					aria-label={t('pptx.statusBar.normalView')}
					title={t('pptx.statusBar.normalView')}
					onClick={onClose}
				>
					<LuX />
				</button>
			</div>
			<div ref={containerRef} className='min-h-0 flex-1 overflow-auto px-4 py-3'>
				{rows.map((row) => (
					<div
						key={row.key}
						className='flex items-center gap-2 py-0.5'
						style={{ paddingLeft: row.level * INDENT_PX }}
					>
						{/*
							The slide number is drawn only on a slide's first row, which is
							always its title row, so the outline reads as a list of slides
							rather than as one undifferentiated wall of lines.
						*/}
						<span className='w-6 shrink-0 text-right text-[10px] tabular-nums text-white/40'>
							{row.kind === 'title' ? row.slideIndex + 1 : ''}
						</span>
						<input
							{...{
								[OUTLINE_ROW_ATTR]: row.key,
								[OUTLINE_SLIDE_ATTR]: String(row.slideIndex + 1),
								[OUTLINE_LEVEL_ATTR]: String(row.level),
							}}
							type='text'
							value={row.text}
							readOnly={!canEdit}
							aria-label={t(
								row.kind === 'title' ? 'pptx.outline.titleLine' : 'pptx.outline.bodyLine',
							)}
							className={
								row.kind === 'title'
									? 'w-full rounded bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:bg-white/10'
									: 'w-full rounded bg-transparent px-1 py-0.5 text-[13px] text-white/80 outline-none focus:bg-white/10'
							}
							onChange={(event) => run({ type: 'setText', key: row.key, text: event.target.value })}
							onKeyDown={(event) => onRowKeyDown(event, row.key)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
