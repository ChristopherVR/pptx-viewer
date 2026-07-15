/**
 * ViewerPresentationLayer: Renders presenter-view, rehearsal HUD, and
 * rehearsal summary overlays that sit above the main editor UI.
 */
import type { PptxSlide, PptxElement } from 'pptx-viewer-core';

import { PresenterView, RehearseTimingsHud, RehearseTimingsSummary } from '.';
import type { UsePresentationModeResult } from '../hooks/usePresentationMode';
import type { CanvasSize } from '../types';
import type { ViewerMode } from '../types-core';
import { MobilePresenterView } from './MobilePresenterView';
import { PresentationAudienceEffects } from './PresentationAudienceEffects';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerPresentationLayerProps {
	mode: ViewerMode;
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	templateElements: PptxElement[];
	presentation: UsePresentationModeResult;
	onExitPresentation: () => void;
	/** Use the single-column mobile presenter layout instead of the desktop one. */
	isMobile?: boolean;
	onUpdateNotes?: (notes: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerPresentationLayer(props: ViewerPresentationLayerProps) {
	const {
		mode,
		slides,
		canvasSize,
		templateElements,
		presentation,
		onExitPresentation,
		isMobile,
		onUpdateNotes,
	} = props;

	const presenterActive = mode === 'present' && presentation.presenterMode;

	return (
		<>
			{mode === 'present' && !presentation.presenterMode && (
				<PresentationAudienceEffects snapshot={presentation.presenterSnapshot} />
			)}
			{presenterActive &&
				(isMobile ? (
					<MobilePresenterView
						slides={slides}
						currentSlideIndex={presentation.presentationSlideIndex}
						canvasSize={canvasSize}
						templateElements={templateElements}
						presentationStartTime={presentation.presentationStartTime}
						onMovePresentationSlide={presentation.movePresentationSlide}
						onExit={onExitPresentation}
					/>
				) : (
					<PresenterView
						slides={slides}
						currentSlideIndex={presentation.presentationSlideIndex}
						canvasSize={canvasSize}
						templateElements={templateElements}
						presentationStartTime={presentation.presentationStartTime}
						onMovePresentationSlide={presentation.movePresentationSlide}
						onExit={onExitPresentation}
						onOpenAudienceWindow={presentation.openAudienceWindow}
						onCloseAudienceWindow={presentation.closeAudienceWindow}
						isAudienceWindowOpen={presentation.isAudienceWindowOpen()}
						snapshot={presentation.presenterSnapshot}
						onNavigateToSlide={presentation.navigateToSlide}
						onToggleTimer={presentation.togglePresenterTimer}
						onResetTimer={presentation.resetPresenterTimer}
						onStepZoom={presentation.stepPresenterZoom}
						onResetZoom={presentation.resetPresenterZoom}
						onSetBlackout={presentation.setPresenterBlackout}
						onUpdateSnapshot={presentation.updatePresenterSnapshot}
						onToggleSubtitles={() =>
							presentation.setPresenterSubtitlesVisible(
								!presentation.presenterSnapshot.subtitlesVisible,
							)
						}
						onSwapDisplays={() => void presentation.swapPresenterDisplays()}
						onUpdateNotes={onUpdateNotes}
					/>
				))}

			{mode === 'present' && presentation.rehearsing && (
				<RehearseTimingsHud
					presentationStartTime={presentation.presentationStartTime}
					slideStartTime={presentation.slideStartTime}
					paused={presentation.rehearsalPaused}
					onTogglePause={presentation.toggleRehearsalPause}
				/>
			)}

			{presentation.showRehearsalSummary && (
				<RehearseTimingsSummary
					slides={slides}
					canvasSize={canvasSize}
					recordedTimings={presentation.recordedTimings}
					onSave={presentation.saveRehearsalTimings}
					onDiscard={presentation.dismissRehearsalSummary}
				/>
			)}
		</>
	);
}
