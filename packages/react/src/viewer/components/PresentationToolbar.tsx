/**
 * PresentationToolbar
 *
 * Floating bottom toolbar shown during presentation mode.
 * Contains: prev/next navigation, slide counter (X/Y), elapsed timer,
 * annotation tool toggles (laser/pen/highlighter/eraser), and an
 * end-presentation button.
 *
 * A thin adapter around the shared `pptx-ui-present-toolbar`: the element renders
 * the shared control inventory, the colour palettes and the elapsed readout; this
 * maps presentation state onto it and routes its intents to the callbacks.
 * Auto-hide behaviour lives in `PresentationToolbarWrapper.tsx`.
 */
import type {
	PptxUiPresentToolbarElement,
	PresentationBlackout,
	PresentToolbarIntent,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PresentationTool } from '../hooks/usePresentationAnnotations';
import { useWebControl } from '../hooks/useWebControl';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationToolbarProps {
	/** Current annotation tool. */
	presentationTool: PresentationTool;
	penColor: string;
	highlighterColor: string;
	hasAnnotations: boolean;
	onSetTool: (tool: PresentationTool) => void;
	onSetPenColor: (color: string) => void;
	onSetHighlighterColor: (color: string) => void;
	onClearAnnotations: () => void;
	/** Current blackout state, for the Blackboard toggle's active reading. */
	blackout: PresentationBlackout;
	/** One click arms (or disarms) the black screen and the pen together. */
	onToggleBlackboard: () => void;

	// --- Navigation props ---
	/** Zero-based index of the current presentation slide. */
	currentSlideIndex: number;
	/** Total number of slides in the presentation. */
	totalSlides: number;
	/** Navigate to next (1) or previous (-1) slide. */
	onMovePresentationSlide: (direction: 1 | -1) => void;
	/** Timestamp (ms) when the presentation started. */
	presentationStartTime: number | null;
	/** End the current presentation. */
	onEndPresentation: () => void;
	/** Toggle presenter view (split-screen with notes). */
	onTogglePresenterView?: () => void;
	/** Whether presenter view is currently active. */
	presenterMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationToolbar(p: PresentationToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useWebControl<PptxUiPresentToolbarElement>(
		{
			current: p.currentSlideIndex,
			total: p.totalSlides,
			tool: p.presentationTool,
			penColor: p.penColor,
			highlighterColor: p.highlighterColor,
			hasAnnotations: p.hasAnnotations,
			blackout: p.blackout,
			presenterViewVisible: Boolean(p.onTogglePresenterView),
			presenterViewActive: p.presenterMode === true,
			startTime: p.presentationStartTime,
			translate: t,
		},
		{
			'present-toolbar-request': (event) => {
				const intent = event.detail as PresentToolbarIntent;
				switch (intent.id) {
					case 'move':
						p.onMovePresentationSlide(intent.direction);
						break;
					case 'tool':
						p.onSetTool(intent.tool);
						break;
					case 'color':
						if (intent.tool === 'pen') {
							p.onSetPenColor(intent.color);
						} else {
							p.onSetHighlighterColor(intent.color);
						}
						if (p.presentationTool !== intent.tool) {
							p.onSetTool(intent.tool);
						}
						break;
					case 'blackboard':
						p.onToggleBlackboard();
						break;
					case 'clear':
						p.onClearAnnotations();
						break;
					case 'presenterView':
						p.onTogglePresenterView?.();
						break;
					case 'end':
						p.onEndPresentation();
				}
			},
		},
	);
	return <pptx-ui-present-toolbar ref={ref} />;
}
