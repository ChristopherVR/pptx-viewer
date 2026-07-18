/**
 * useExportHandlers: Export to PNG, PDF, Video, GIF, "Package for Sharing",
 * "Copy slide as image", and "Save As" format handlers.
 *
 * Types live in ./export-handler-types.ts;
 * Save-as / packaging logic lives in ./useExportSaveAs.ts.
 */
import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';
import { useState, useRef, useCallback } from 'react';

import { downloadBlob } from '../utils/dom-helpers';
import {
	exportSlideAsPng,
	exportAllSlidesAsPdf,
	exportAllSlidesAsNotesPdf,
	copySlideToClipboard,
	exportAllSlidesAsVideo,
	exportAllSlidesAsGif,
} from '../utils/export';
import type { UseExportHandlersInput, ExportHandlersResult } from './export-handler-types';
import { useExportSaveAs } from './useExportSaveAs';

export type { UseExportHandlersInput, ExportHandlersResult } from './export-handler-types';
export type { ExportModalControls } from './export-handler-types';
export { downloadBlob } from '../utils/dom-helpers';

export function useExportHandlers(input: UseExportHandlersInput): ExportHandlersResult {
	const {
		slides,
		templateElementsBySlideId,
		activeSlide,
		activeSlideIndex,
		filePath,
		canvasStageRef,
		setActiveSlideIndex,
		handlerRef,
		serializeSlides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndexForGuides,
		password,
	} = input;

	const [exportModalOpen, setExportModalOpen] = useState(false);
	const [exportModalTitle, setExportModalTitle] = useState('');
	const [exportProgress, setExportProgress] = useState(0);
	const [exportStatusMessage, setExportStatusMessage] = useState('');
	const exportAbortRef = useRef<AbortController | null>(null);

	const modalControls = {
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
		exportAbortRef,
	};

	const {
		handlePackageForSharing,
		handleSaveAsFormat,
		handleSaveAsPptx,
		handleSaveAsPpsx,
		handleSaveAsPptm,
	} = useExportSaveAs({
		slides,
		templateElementsBySlideId,
		filePath,
		handlerRef,
		serializeSlides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndexForGuides,
		modalControls,
		password,
	});

	const handleExportPng = useCallback(async () => {
		const stageEl = canvasStageRef.current;
		if (!stageEl) {
			return;
		}
		try {
			await exportSlideAsPng(stageEl, activeSlideIndex, {
				backgroundColor: activeSlide?.backgroundColor,
			});
		} catch (err) {
			console.error('[PowerPointViewer] PNG export failed:', err);
		}
	}, [canvasStageRef, activeSlideIndex, activeSlide?.backgroundColor]);

	const handleExportPdf = useCallback(async () => {
		if (!canvasStageRef.current) {
			return;
		}
		const abortCtrl = new AbortController();
		exportAbortRef.current = abortCtrl;
		setExportModalTitle('Export as PDF');
		setExportStatusMessage('Capturing slides...');
		setExportProgress(0);
		setExportModalOpen(true);
		try {
			await exportAllSlidesAsPdf(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				'presentation.pdf',
				{
					scale: 2,
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
				console.error('[PowerPointViewer] PDF export failed:', err);
			}
		} finally {
			exportAbortRef.current = null;
			setExportModalOpen(false);
		}
	}, [canvasStageRef, slides.length, setActiveSlideIndex, activeSlideIndex]);

	const handleExportNotesPdf = useCallback(async () => {
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
					scale: 2,
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
	}, [canvasStageRef, slides, setActiveSlideIndex, activeSlideIndex]);

	const handleCopySlideAsImage = useCallback(async () => {
		const stageEl = canvasStageRef.current;
		if (!stageEl) {
			return;
		}
		try {
			await copySlideToClipboard(stageEl, {
				backgroundColor: activeSlide?.backgroundColor,
			});
		} catch (err) {
			console.error('[PowerPointViewer] Copy slide as image failed:', err);
		}
	}, [canvasStageRef, activeSlide?.backgroundColor]);

	const handleExportVideo = useCallback(async () => {
		if (!canvasStageRef.current) {
			return;
		}
		const abortCtrl = new AbortController();
		exportAbortRef.current = abortCtrl;
		setExportModalTitle('Export as Video');
		setExportStatusMessage('Capturing slides...');
		setExportProgress(0);
		setExportModalOpen(true);
		try {
			const blob = await exportAllSlidesAsVideo(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{
					scale: 1,
					slideDurationMs: 3000,
					onProgress: (current, total) => {
						setExportProgress(slideProgressPercent(current, total, 45));
						setExportStatusMessage(slideStatusLabel('Capturing', current, total));
					},
					onRecordProgress: (current, total) => {
						setExportProgress(recordProgressPercent(current, total));
						setExportStatusMessage(slideStatusLabel('Recording', current, total));
					},
					signal: abortCtrl.signal,
				},
			);
			setExportProgress(EXPORT_ASSEMBLING_PERCENT);
			setExportStatusMessage('Saving file...');
			downloadBlob(blob, 'presentation.webm');
			setExportProgress(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] Video export failed:', err);
			}
		} finally {
			exportAbortRef.current = null;
			setExportModalOpen(false);
		}
	}, [canvasStageRef, slides.length, setActiveSlideIndex, activeSlideIndex]);

	const handleExportGif = useCallback(async () => {
		if (!canvasStageRef.current) {
			return;
		}
		const abortCtrl = new AbortController();
		exportAbortRef.current = abortCtrl;
		setExportModalTitle('Export as GIF');
		setExportStatusMessage('Capturing slides...');
		setExportProgress(0);
		setExportModalOpen(true);
		try {
			const blob = await exportAllSlidesAsGif(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{
					scale: 0.5,
					slideDurationMs: 2000,
					onProgress: (current, total) => {
						setExportProgress(slideProgressPercent(current, total));
						setExportStatusMessage(slideStatusLabel('Encoding', current, total));
					},
					signal: abortCtrl.signal,
				},
			);
			setExportProgress(EXPORT_ASSEMBLING_PERCENT);
			setExportStatusMessage('Saving file...');
			downloadBlob(blob, 'presentation.gif');
			setExportProgress(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] GIF export failed:', err);
			}
		} finally {
			exportAbortRef.current = null;
			setExportModalOpen(false);
		}
	}, [canvasStageRef, slides.length, setActiveSlideIndex, activeSlideIndex]);

	const handleCancelExport = useCallback(() => {
		exportAbortRef.current?.abort();
		exportAbortRef.current = null;
		setExportModalOpen(false);
		setExportProgress(0);
	}, []);

	return {
		handleExportPng,
		handleExportPdf,
		handleExportNotesPdf,
		handleCopySlideAsImage,
		handleExportVideo,
		handleExportGif,
		handlePackageForSharing,
		handleSaveAsFormat,
		handleSaveAsPptx,
		handleSaveAsPpsx,
		handleSaveAsPptm,
		handleCancelExport,
		exportModalOpen,
		exportModalTitle,
		exportProgress,
		exportStatusMessage,
	};
}
