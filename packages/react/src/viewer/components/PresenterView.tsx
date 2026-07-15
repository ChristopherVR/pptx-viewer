import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';
/**
 * PresenterView: Split-screen presenter layout with current slide,
 * next slide preview, speaker notes, timer, and navigation controls.
 *
 * Rendered as an absolute overlay when presenterMode is active during
 * presentation mode. Uses ScaledSlidePreview for slide rendering.
 *
 * Supports opening an audience window via `window.open()` for dual-screen
 * presenter workflows. The audience window receives slide changes via
 * `postMessage()` cross-window communication.
 *
 * Keyboard navigation (arrows, space, escape) is handled by the parent
 * `usePresentationKeyboard` hook; this component does NOT register its
 * own keydown listener to avoid double-handling.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../types';
import { PresentationAudienceEffects } from './PresentationAudienceEffects';
import { PresentationSubtitleBar } from './PresentationSubtitleBar';
import { formatElapsed } from './presenter-view-utils';
import { PresenterConsoleToolbar } from './PresenterConsoleToolbar';
import { PresenterNotesRail } from './PresenterNotesRail';
import { PresenterSlideNavigator } from './PresenterSlideNavigator';
import { ScaledSlidePreview } from './ScaledSlidePreview';
import { usePresenterInk } from './usePresenterInk';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresenterViewProps {
	slides: PptxSlide[];
	currentSlideIndex: number;
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	presentationStartTime: number | null;
	onMovePresentationSlide: (direction: 1 | -1) => void;
	onExit: () => void;
	/** Open the audience display in a separate browser window. */
	onOpenAudienceWindow?: () => boolean;
	/** Close the audience display window. */
	onCloseAudienceWindow?: () => void;
	/** Whether the audience window is currently open. */
	isAudienceWindowOpen?: boolean;
	snapshot: PresentationSnapshot;
	onNavigateToSlide: (index: number) => void;
	onToggleTimer: () => void;
	onResetTimer: () => void;
	onStepZoom: (direction: 1 | -1) => void;
	onResetZoom: () => void;
	onSetBlackout: (value: PresentationSnapshot['blackout']) => void;
	onUpdateSnapshot: (patch: Partial<PresentationSnapshot>) => void;
	onToggleSubtitles: () => void;
	onSwapDisplays: () => void;
	onUpdateNotes?: (notes: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenterView({
	slides,
	currentSlideIndex,
	canvasSize,
	templateElements,
	presentationStartTime,
	onMovePresentationSlide,
	onExit,
	onOpenAudienceWindow,
	onCloseAudienceWindow,
	isAudienceWindowOpen,
	snapshot,
	onNavigateToSlide,
	onToggleTimer,
	onResetTimer,
	onStepZoom,
	onResetZoom,
	onSetBlackout,
	onUpdateSnapshot,
	onToggleSubtitles,
	onSwapDisplays,
	onUpdateNotes,
}: PresenterViewProps): React.ReactElement {
	const { t } = useTranslation();

	// -- Clock + elapsed timer -----------------------------------------------
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, []);

	const elapsed = snapshot.elapsedMs ?? (presentationStartTime ? now - presentationStartTime : 0);

	const [showSlides, setShowSlides] = useState(false);
	const ink = usePresenterInk(snapshot, onUpdateSnapshot);
	const handleCaptionChange = useCallback(
		(caption: string) => onUpdateSnapshot({ caption }),
		[onUpdateSnapshot],
	);

	// -- Slide data ----------------------------------------------------------
	const currentSlide = slides[currentSlideIndex];

	if (!currentSlide) {
		return (
			<div className='absolute inset-0 z-50 flex items-center justify-center bg-card text-muted-foreground'>
				{t('pptx.presenter.noSlides')}
			</div>
		);
	}

	// -- Timer progress (5-minute segments) ------------------------------------
	const TIMER_SEGMENT_MS = 5 * 60 * 1000; // 5 minutes per bar fill
	const timerProgress = Math.min(100, ((elapsed % TIMER_SEGMENT_MS) / TIMER_SEGMENT_MS) * 100);
	const timerSegment = Math.floor(elapsed / TIMER_SEGMENT_MS);

	return (
		<div className='absolute inset-0 z-50 flex flex-col bg-slate-950 text-slate-100'>
			<PresenterConsoleToolbar
				snapshot={snapshot}
				audienceOpen={Boolean(isAudienceWindowOpen)}
				onToggleAudience={() =>
					isAudienceWindowOpen ? onCloseAudienceWindow?.() : onOpenAudienceWindow?.()
				}
				onSwapDisplays={onSwapDisplays}
				onToggleTimer={onToggleTimer}
				onResetTimer={onResetTimer}
				onShowSlides={() => setShowSlides(true)}
				onStepZoom={onStepZoom}
				onResetZoom={onResetZoom}
				onBlackout={onSetBlackout}
				onPointerTool={(tool: PresentationPointerTool) =>
					onUpdateSnapshot({
						pointer: { ...(snapshot.pointer ?? { x: 0.5, y: 0.5, color: '#ef4444' }), tool },
					})
				}
				onToggleSubtitles={onToggleSubtitles}
				onExit={onExit}
			/>
			<div className='flex flex-1 min-h-0'>
				{/* Left panel -- current slide (70%) */}
				<div className='flex-[7] flex flex-col items-center justify-center bg-black p-6 min-w-0 overflow-hidden'>
					<div
						className='relative transition-transform duration-200'
						style={{
							transform: `scale(${snapshot.zoom?.scale ?? 1})`,
							transformOrigin: `${(snapshot.zoom?.originX ?? 0.5) * 100}% ${(snapshot.zoom?.originY ?? 0.5) * 100}%`,
							touchAction: 'none',
						}}
						{...ink}
					>
						<ScaledSlidePreview
							slide={currentSlide}
							templateElements={templateElements}
							canvasSize={canvasSize}
						/>
						<PresentationAudienceEffects snapshot={snapshot} />
					</div>
					{/* Slide number badge */}
					<div className='mt-3 text-xs font-mono tabular-nums text-white/50 select-none'>
						{t('pptx.presenter.slideLabel', {
							current: currentSlideIndex + 1,
							total: slides.length,
							defaultValue: `Slide ${currentSlideIndex + 1} of ${slides.length}`,
						})}
					</div>
				</div>

				<PresenterNotesRail
					slides={slides}
					current={currentSlideIndex}
					canvasSize={canvasSize}
					templateElements={templateElements}
					now={now}
					elapsed={elapsed}
					onMove={onMovePresentationSlide}
					onUpdateNotes={onUpdateNotes}
				/>
			</div>
			<PresentationSubtitleBar
				visible={Boolean(snapshot.subtitlesVisible)}
				onCaptionChange={handleCaptionChange}
			/>
			{showSlides && (
				<PresenterSlideNavigator
					slides={slides}
					current={currentSlideIndex}
					canvasSize={canvasSize}
					templateElements={templateElements}
					onSelect={(index) => {
						onNavigateToSlide(index);
						setShowSlides(false);
					}}
					onClose={() => setShowSlides(false)}
				/>
			)}

			{/* Timer progress bar */}
			<div
				className='h-1.5 w-full bg-muted/60 flex-shrink-0'
				role='progressbar'
				aria-valuenow={Math.round(timerProgress)}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={t('pptx.presenter.timerProgress')}
				title={`${formatElapsed(elapsed)} (segment ${timerSegment + 1})`}
			>
				<div
					className='h-full bg-primary transition-[width] duration-1000 ease-linear'
					style={{ width: `${timerProgress}%` }}
				/>
			</div>
		</div>
	);
}
