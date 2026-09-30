import type { PptxElement, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import type { ReactNode } from 'react';

import type { AiPanelController } from '../hooks/ai/useAiPanelController';
import type { UseCommentsResult } from '../hooks/useComments-helpers';
import type { EditorHistoryResult } from '../hooks/useEditorHistory';
import type { EditorOperationsResult } from '../hooks/useEditorOperations';
import type { UseMasterViewCrudResult } from '../hooks/useMasterViewCrud';
import type { UsePresentationAnnotationsResult } from '../hooks/usePresentationAnnotations';
import type { UsePresentationModeResult } from '../hooks/usePresentationMode';
import type { PropertyHandlersResult } from '../hooks/usePropertyHandlers';
import type { ThemeHandlersResult } from '../hooks/useThemeHandlers';
import type { ViewerDialogsResult } from '../hooks/useViewerDialogs';
import type { ViewerState } from '../hooks/useViewerState';
import type { UseZoomViewportResult } from '../hooks/useZoomViewport';
import type { CanvasSize, SlideSectionGroup } from '../types';
import type { ViewerMode } from '../types-core';

export interface ViewerMainContentProps {
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	masterPseudoSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	gridSpacingPx: number;
	slideSectionGroups: SlideSectionGroup[];
	showSlidesPane: boolean;
	showMasterPane: boolean;
	selectedElement: PptxElement | null;
	state: ViewerState;
	editorOps: EditorOperationsResult;
	dialogs: ViewerDialogsResult;
	presentation: UsePresentationModeResult;
	/** Show chrome mounted inside the fullscreen stage; see `ViewerCanvasArea`. */
	presentationOverlay?: ReactNode;
	annotations: UsePresentationAnnotationsResult;
	propertyHandlers: PropertyHandlersResult;
	themeHandlers: ThemeHandlersResult;
	history: EditorHistoryResult;
	comments: UseCommentsResult;
	/** Slide Master view sidebar CRUD (Insert/Duplicate/Delete/Rename). */
	masterViewCrud: UseMasterViewCrudResult;
	zoom: UseZoomViewportResult;
	/** Whether the viewport is mobile-sized (<768px). */
	isMobile?: boolean;
	/** Whether the device supports touch input. */
	isTouchDevice?: boolean;
	/** Called when the user clicks "end presentation" in the slide show toolbar. */
	onEndPresentation?: () => void;
	/** Width of the left slides pane in pixels. */
	leftPanelWidth?: number;
	/** Callback to resize the left panel. */
	onResizeLeft?: (delta: number) => void;
	/** Width of the right inspector panel in pixels. */
	rightPanelWidth?: number;
	/** Callback to resize the right panel. */
	onResizeRight?: (delta: number) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/** AI assistant config (present only when the host passes the `ai` prop). */
	aiConfig?: PptxAiConfig;
	/** Bridge exposing the live deck to the AI core. */
	aiBridge?: PptxAiBridge;
	/** AI panel open state + focus/prefill controller (present when `ai` is set). */
	aiPanel?: AiPanelController;
	/** Applies a layout to the active slide; used by the canvas context menu's Layout entry. */
	onApplyLayout?: (path: string) => void;
	/** Fetches layout artwork for the canvas context menu's Layout gallery. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
}
