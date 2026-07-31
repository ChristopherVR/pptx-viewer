/**
 * ViewerOverlays: Shortcut, Accessibility, and Slide Sorter overlay panels.
 *
 * Consolidates the three overlay panels that render on top of the viewer
 * so the main orchestrator component stays lean.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { AccessibilityIssue, CanvasSize, SlideSectionGroup } from '../types';
import { AccessibilityPanel } from './AccessibilityPanel';
import { ReadingViewOverlay } from './ReadingViewOverlay';
import { ShortcutPanel } from './ShortcutPanel';
import { SlideSorterOverlay } from './SlideSorterOverlay';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ViewerOverlaysProps {
	isShortcutHelpOpen: boolean;
	isAccessibilityPanelOpen: boolean;
	showSlideSorter: boolean;
	/** PowerPoint's Reading View: the deck full-window, editor chrome minimised. */
	showReadingView: boolean;
	/** Master/layout elements drawn beneath the slide's own, in Reading View. */
	templateElements: PptxElement[];
	accessibilityIssues: AccessibilityIssue[];
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	canEdit: boolean;
	sectionGroups: SlideSectionGroup[];
	onCloseShortcuts: () => void;
	onCloseAccessibility: () => void;
	onSelectSlide: (i: number) => void;
	onMoveSlide: (fromIndex: number, toIndex: number) => void;
	onDeleteSlides: (indexes: number[]) => void;
	onDuplicateSlides: (indexes: number[]) => void;
	onToggleHideSlides: (indexes: number[]) => void;
	onCloseSorter: () => void;
	/** Receives the slide the reader ended Reading View on. */
	onCloseReadingView: (slideIndex: number) => void;
	/** Whether reduced motion mode is active. */
	reducedMotion?: boolean;
	/** Toggle reduced motion mode on/off. */
	onToggleReducedMotion?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ViewerOverlays({
	isShortcutHelpOpen,
	isAccessibilityPanelOpen,
	showSlideSorter,
	showReadingView,
	templateElements,
	accessibilityIssues,
	slides,
	activeSlideIndex,
	canvasSize,
	canEdit,
	sectionGroups,
	onCloseShortcuts,
	onCloseAccessibility,
	onSelectSlide,
	onMoveSlide,
	onDeleteSlides,
	onDuplicateSlides,
	onToggleHideSlides,
	onCloseSorter,
	onCloseReadingView,
	reducedMotion,
	onToggleReducedMotion,
}: ViewerOverlaysProps): React.ReactElement | null {
	const hasOverlay =
		isShortcutHelpOpen || isAccessibilityPanelOpen || showSlideSorter || showReadingView;
	if (!hasOverlay) {
		return null;
	}

	return (
		<>
			{isShortcutHelpOpen && (
				<ShortcutPanel isOpen={isShortcutHelpOpen} onClose={onCloseShortcuts} />
			)}
			{isAccessibilityPanelOpen && (
				<AccessibilityPanel
					isOpen={isAccessibilityPanelOpen}
					issues={accessibilityIssues}
					onClose={onCloseAccessibility}
					reducedMotion={reducedMotion}
					onToggleReducedMotion={onToggleReducedMotion}
				/>
			)}
			{showSlideSorter && (
				<SlideSorterOverlay
					slides={slides}
					activeSlideIndex={activeSlideIndex}
					canvasSize={canvasSize}
					canEdit={canEdit}
					sectionGroups={sectionGroups}
					onSelectSlide={onSelectSlide}
					onMoveSlide={onMoveSlide}
					onDeleteSlides={onDeleteSlides}
					onDuplicateSlides={onDuplicateSlides}
					onToggleHideSlides={onToggleHideSlides}
					onClose={onCloseSorter}
				/>
			)}
			{showReadingView && (
				<ReadingViewOverlay
					slides={slides}
					templateElements={templateElements}
					canvasSize={canvasSize}
					activeSlideIndex={activeSlideIndex}
					onExit={onCloseReadingView}
				/>
			)}
		</>
	);
}
