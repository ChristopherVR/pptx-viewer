import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';
import { useCallback } from 'react';

import { exportAllSlidesAsNotesPdf } from '../utils/export';
import type { ExportModalControls, UseExportHandlersInput } from './export-handler-types';

type NotesPdfInput = ExportModalControls &
	Pick<
		UseExportHandlersInput,
		'slides' | 'activeSlideIndex' | 'canvasStageRef' | 'setActiveSlideIndex' | 'imageExportScale'
	>;

/**
 * Isolate the necessary slides capture from the other export callbacks.
 * Otherwise stable siblings can retain this render's entire deck through a
 * shared closure context, even when they only need a count or background.
 */
export function useExportNotesPdf(input: NotesPdfInput): () => Promise<void> {
	const {
		slides,
		activeSlideIndex,
		canvasStageRef,
		setActiveSlideIndex,
		imageExportScale,
		exportAbortRef,
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
	} = input;

	return useCallback(async () => {
		if (!canvasStageRef.current) {
			return;
		}
		const abortCtrl = new AbortController();
		exportAbortRef.current = abortCtrl;
		setExportModalTitle('Export as PDF (Notes)');
		setExportStatusMessage('Capturing slides...');
		setExportProgress(0);
		setExportModalOpen(true);
		try {
			const slideNotes = slides.map((s) => s.notes);
			await exportAllSlidesAsNotesPdf(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				slideNotes,
				'presentation-notes.pdf',
				{
					scale: imageExportScale,
					onProgress: (current, total) => {
						setExportProgress(slideProgressPercent(current, total));
						setExportStatusMessage(slideStatusLabel('Rendering', current, total));
					},
					signal: abortCtrl.signal,
				},
			);
			setExportProgress(EXPORT_ASSEMBLING_PERCENT);
			setExportStatusMessage('Building PDF...');
			await new Promise<void>((r) => {
				setTimeout(r, 100);
			});
			setExportProgress(EXPORT_DONE_PERCENT);
			setExportStatusMessage('Done!');
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] Notes PDF export failed:', err);
			}
		} finally {
			exportAbortRef.current = null;
			setExportModalOpen(false);
		}
	}, [
		canvasStageRef,
		slides,
		setActiveSlideIndex,
		activeSlideIndex,
		imageExportScale,
		exportAbortRef,
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
	]);
}
