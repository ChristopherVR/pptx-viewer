/**
 * useExportMediaHandlers: the GIF and WebM video export handlers, split out
 * of useExportHandlers.ts to keep that file under the project's per-file
 * line budget.
 *
 * Capture scale and (for GIF) the post-capture size cap both come from the
 * shared `resolveExportCaptureDecision` (`pptx-viewer-shared`), so File >
 * Options > Advanced > Default Resolution governs GIF/video export the same
 * way it already governs PNG/PDF export, and the GIF quantisation-cost cap
 * matches every other binding instead of each one picking its own constant.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	resolveExportCaptureDecision,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';
import { useCallback } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import { downloadBlob } from '../utils/dom-helpers';
import { exportAllSlidesAsGif, exportAllSlidesAsVideo } from '../utils/export';
import type { ExportModalControls } from './export-handler-types';

export interface UseExportMediaHandlersInput extends ExportModalControls {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasStageRef: RefObject<HTMLDivElement | null>;
	setActiveSlideIndex: Dispatch<SetStateAction<number>>;
	/**
	 * The raw `resolveImageResolutionScale(viewerOptions)` multiplier fed into
	 * `resolveExportCaptureDecision`. Defaults to 1 (the "High fidelity"
	 * preset) when omitted.
	 */
	imageResolutionScale?: number;
	setExportModalTitle: (title: string) => void;
	setExportProgress: (progress: number) => void;
	setExportStatusMessage: (message: string) => void;
}

export interface ExportMediaHandlersResult {
	handleExportVideo: () => Promise<void>;
	handleExportGif: () => Promise<void>;
}

export function useExportMediaHandlers(
	input: UseExportMediaHandlersInput,
): ExportMediaHandlersResult {
	const {
		slides,
		activeSlideIndex,
		canvasStageRef,
		setActiveSlideIndex,
		imageResolutionScale = 1,
		exportAbortRef,
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
	} = input;

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
			const { scale } = resolveExportCaptureDecision(imageResolutionScale, 'video');
			const blob = await exportAllSlidesAsVideo(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{
					scale,
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
	}, [
		canvasStageRef,
		slides.length,
		setActiveSlideIndex,
		activeSlideIndex,
		imageResolutionScale,
		exportAbortRef,
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
	]);

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
			const { scale, postCaptureMaxSide } = resolveExportCaptureDecision(
				imageResolutionScale,
				'gif',
			);
			const blob = await exportAllSlidesAsGif(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{
					scale,
					maxSide: postCaptureMaxSide,
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
	}, [
		canvasStageRef,
		slides.length,
		setActiveSlideIndex,
		activeSlideIndex,
		imageResolutionScale,
		exportAbortRef,
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
	]);

	return { handleExportVideo, handleExportGif };
}
