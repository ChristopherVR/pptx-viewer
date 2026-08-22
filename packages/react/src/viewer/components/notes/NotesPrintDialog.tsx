import type { PptxSlide, PptxTextStyleLevels } from 'pptx-viewer-core';
import { buildNotesPrintHtml, resolveNotesSegments } from 'pptx-viewer-shared';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { renderRichNotesSegments } from './notes-html';
import { segmentsToPlainText } from './notes-utils';

/* ------------------------------------------------------------------ */
/*  Print Notes Dialog                                                 */
/* ------------------------------------------------------------------ */

export function NotesPrintDialog({
	slides,
	onClose,
	notesStyle,
}: {
	slides: PptxSlide[];
	onClose: () => void;
	/**
	 * The deck's notes master `<p:notesStyle>` (`PptxData.notesMaster.
	 * notesStyle`), when loaded. Drives the printed page's notes-text font
	 * size/family/colour instead of a hardcoded 12px look; see
	 * `buildNotesPrintHtml` (`pptx-viewer-shared`).
	 */
	notesStyle?: PptxTextStyleLevels;
}): React.ReactElement {
	const { t } = useTranslation();
	const printFrameRef = useRef<HTMLIFrameElement>(null);

	const handlePrint = useCallback(() => {
		const iframe = printFrameRef.current;
		if (!iframe?.contentWindow) {
			return;
		}

		const doc = iframe.contentWindow.document;
		doc.open();
		doc.write(buildNotesPrintHtml(slides, (n) => t('pptx.notes.slideN', { n }), notesStyle));
		doc.close();

		setTimeout(() => {
			iframe.contentWindow?.print();
		}, 200);
	}, [slides, t, notesStyle]);

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
			<div className='bg-background border border-border rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'>
				<div className='flex items-center justify-between px-4 py-3 border-b border-border'>
					<span className='text-sm font-medium text-foreground'>{t('pptx.notes.printNotes')}</span>
					<button
						type='button'
						onClick={onClose}
						className='text-muted-foreground hover:text-foreground text-sm'
					>
						{t('pptx.common.close')}
					</button>
				</div>
				<div className='flex-1 overflow-y-auto p-4 space-y-4'>
					{slides.map((slide) => {
						const segs = resolveNotesSegments(slide, notesStyle);
						const hasText = segmentsToPlainText(segs).trim().length > 0;

						return (
							<div key={slide.id} className='border border-border/50 rounded p-3'>
								<div className='text-xs font-medium text-muted-foreground mb-2'>
									{t('pptx.notes.slideN', { n: slide.slideNumber })}
								</div>
								<div className='w-full aspect-video bg-muted rounded mb-2 flex items-center justify-center text-muted-foreground text-sm'>
									{t('pptx.notes.slideN', { n: slide.slideNumber })}
								</div>
								<div className='text-xs text-foreground whitespace-pre-wrap'>
									{hasText ? (
										renderRichNotesSegments(segs)
									) : (
										<span className='italic text-muted-foreground'>{t('pptx.notes.noNotes')}</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
				<div className='flex justify-end px-4 py-3 border-t border-border'>
					<button
						type='button'
						onClick={handlePrint}
						className='px-3 py-1.5 text-xs bg-primary hover:bg-primary/80 text-white rounded'
					>
						{t('pptx.notes.print')}
					</button>
				</div>
				<iframe
					ref={printFrameRef}
					title='print-notes'
					className='hidden'
					sandbox='allow-same-origin'
				/>
			</div>
		</div>
	);
}
