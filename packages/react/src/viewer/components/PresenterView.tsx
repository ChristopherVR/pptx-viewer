import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	ShowOrderCustomShow,
} from 'pptx-viewer-shared';
import { PRESENTER_CONSOLE_CLASSES, presenterTimerProgress } from 'pptx-viewer-shared';
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

import type { SlideAdvanceTrigger } from '../hooks/presentation-mode/types';
import type { CanvasSize } from '../types';
import { PresenterSlideFrame } from './presentation/PresenterSlideFrame';
import { PresentationAudienceEffects } from './PresentationAudienceEffects';
import { PresentationEndOverlay } from './PresentationEndOverlay';
import { PresentationSubtitleBar } from './PresentationSubtitleBar';
import { formatElapsed, presenterPaneAdvancesOnClick } from './presenter-view-utils';
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
	/** The running custom show, so the next-slide preview follows its order. */
	activeCustomShow?: ShowOrderCustomShow | null;
	/**
	 * `trigger` mirrors the show stage: `'click'` steps through pending element
	 * builds first and honours the slide's `advanceOnClick` transition flag,
	 * `'explicit'` (the default) is unconditional navigation.
	 */
	onMovePresentationSlide: (direction: 1 | -1, trigger?: SlideAdvanceTrigger) => void;
	onExit: () => void;
	/** Open the audience display in a separate browser window. */
	onOpenAudienceWindow?: () => boolean;
	/** Close the audience display window. */
	onCloseAudienceWindow?: () => void;
	/** Whether the audience window is currently open. */
	isAudienceWindowOpen?: boolean;
	/**
	 * True once the show has run past its last slide and the black "End of slide
	 * show" screen is up. The console MUST surface it: while it is up the next
	 * input is swallowed (backward) or ends the show (forward), so a console that
	 * kept painting the last slide looked stuck and then dumped the presenter
	 * into the editor with no warning.
	 */
	endOfShowVisible?: boolean;
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
	activeCustomShow,
	onMovePresentationSlide,
	onExit,
	onOpenAudienceWindow,
	onCloseAudienceWindow,
	isAudienceWindowOpen,
	endOfShowVisible,
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

	// Click the current-slide pane to advance, the way PowerPoint's presenter
	// console does - it is how presenters actually drive a show, and without it
	// the console could only be advanced from the keyboard or the Next button.
	// The end-of-show screen owns the pane's click (it exits the show), so the
	// advance handler stands down while it is up.
	const paneAdvancesOnClick =
		presenterPaneAdvancesOnClick(snapshot.pointer?.tool) && !endOfShowVisible;
	const handleSlidePaneClick = useCallback(() => {
		if (!paneAdvancesOnClick) {
			return;
		}
		onMovePresentationSlide(1, 'click');
	}, [paneAdvancesOnClick, onMovePresentationSlide]);
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

	// -- Timer progress --------------------------------------------------------
	// Segment length and the clamp live in shared: the bar was inlined here,
	// re-derived in Vue, helper-wrapped in Angular and absent from the other two.
	const timerProgress = presenterTimerProgress(elapsed);

	return (
		<div className={PRESENTER_CONSOLE_CLASSES.root}>
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
			<div className={PRESENTER_CONSOLE_CLASSES.body}>
				{/* Left panel -- current slide (70%). Clicking it advances the show. */}
				<div
					role='presentation'
					data-pptx-presenter-slide
					onClick={handleSlidePaneClick}
					className={`${PRESENTER_CONSOLE_CLASSES.main} ${
						paneAdvancesOnClick ? 'cursor-pointer' : ''
					}`}
				>
					{/* The show has run past its last slide. The console has to say so:
					    while this is up the next input either goes nowhere (backward) or
					    ends the show (forward), and a console still painting the last
					    slide made that look like the deck was stuck, then dumped the
					    presenter into the editor with no warning. */}
					{endOfShowVisible && <PresentationEndOverlay onExit={() => onMovePresentationSlide(1)} />}
					<PresenterSlideFrame
						canvasSize={canvasSize}
						zoomScale={snapshot.zoom?.scale ?? 1}
						zoomOriginX={snapshot.zoom?.originX ?? 0.5}
						zoomOriginY={snapshot.zoom?.originY ?? 0.5}
						inkProps={ink}
					>
						<ScaledSlidePreview
							slide={currentSlide}
							templateElements={templateElements}
							canvasSize={canvasSize}
						/>
						<PresentationAudienceEffects snapshot={snapshot} />
					</PresenterSlideFrame>
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
					activeCustomShow={activeCustomShow}
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
				className={PRESENTER_CONSOLE_CLASSES.progressTrack}
				role='progressbar'
				aria-valuenow={Math.round(timerProgress.percent)}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={t('pptx.presenter.timerProgress')}
				title={t('pptx.presenter.timerTitle', {
					elapsed: formatElapsed(elapsed),
					segment: timerProgress.segment + 1,
				})}
			>
				<div
					className={PRESENTER_CONSOLE_CLASSES.progressFill}
					style={{ width: `${timerProgress.percent}%` }}
				/>
			</div>
		</div>
	);
}
