/**
 * ViewerSidePanels: Inspector pane, selection pane, theme editor panel,
 * and theme gallery that appear alongside the slide canvas.
 */
import { themeColorSchemesEqual } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';

import { ViewerInspector, SelectionPane } from '.';
import type { AiPanelController } from '../hooks/ai/useAiPanelController';
import type { UseCommentsResult } from '../hooks/useComments-helpers';
import type { EditorHistoryResult } from '../hooks/useEditorHistory';
import type { ElementManipulationHandlers } from '../hooks/useElementManipulation';
import type { ElementOperations } from '../hooks/useElementOperations';
import type { PropertyHandlersResult } from '../hooks/usePropertyHandlers';
import type { ThemeHandlersResult } from '../hooks/useThemeHandlers';
import type { ViewerState } from '../hooks/useViewerState';
import type { CanvasSize } from '../types';
import type { ViewerMode } from '../types-core';
import { AiChatPanelLazy } from './ai';
import { ThemeEditorPanel } from './inspector/ThemeEditorPanel';
import { MobileDismissSheet } from './mobile/MobileDismissSheet';
import { ResizeHandle } from './ResizeHandle';
import type { ThemeDefinition } from './toolbar/ThemeGallery';
import { BUILT_IN_THEMES, ThemeGallery } from './toolbar/ThemeGallery';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerSidePanelsProps {
	mode: ViewerMode;
	canEdit: boolean;
	activeSlide: PptxSlide | undefined;
	masterPseudoSlide: PptxSlide | undefined;
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	state: ViewerState;
	comments: UseCommentsResult;
	ops: ElementOperations;
	manipulation: ElementManipulationHandlers;
	propertyHandlers: PropertyHandlersResult;
	themeHandlers: ThemeHandlersResult;
	history: EditorHistoryResult;
	/** Width of the right inspector panel in pixels. */
	panelWidth?: number;
	/** Callback to resize the right panel. */
	onResizeRight?: (delta: number) => void;
	/** AI assistant config (present only when the host passes the `ai` prop). */
	aiConfig?: PptxAiConfig;
	/** Bridge exposing the live deck to the AI core. */
	aiBridge?: PptxAiBridge;
	/** AI panel open state + focus/prefill controller (present when `ai` is set). */
	aiPanel?: AiPanelController;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerSidePanels(props: ViewerSidePanelsProps) {
	const {
		mode,
		canEdit,
		activeSlide,
		masterPseudoSlide,
		slides,
		canvasSize,
		activeSlideIndex,
		selectedElement,
		state: s,
		comments,
		ops,
		manipulation,
		propertyHandlers,
		themeHandlers,
		history,
		panelWidth,
		onResizeRight,
		aiConfig,
		aiBridge,
		aiPanel,
	} = props;

	const effectiveSlide = mode === 'master' ? masterPseudoSlide : activeSlide;
	const currentBuiltInTheme =
		BUILT_IN_THEMES.find((candidate) =>
			themeColorSchemesEqual(s.theme?.colorScheme, candidate.colorScheme),
		) ?? null;

	return (
		<>
			{(mode === 'edit' || mode === 'master') && s.isInspectorPaneOpen && onResizeRight && (
				<ResizeHandle direction='horizontal' onResize={onResizeRight} />
			)}
			<ViewerInspector
				isOpen={(mode === 'edit' || mode === 'master') && s.isInspectorPaneOpen}
				canEdit={canEdit}
				mode={mode}
				activeSlide={effectiveSlide}
				slides={slides}
				canvasSize={canvasSize}
				selectedElement={selectedElement}
				effectiveSelectedIds={s.effectiveSelectedIds}
				tableEditorState={s.tableEditorState}
				sidebarPanelMode={s.sidebarPanelMode}
				activeSlideIndex={activeSlideIndex}
				comments={comments}
				onSetSidebarPanelMode={s.setSidebarPanelMode}
				onClose={() => s.setIsInspectorPaneOpen(false)}
				onUpdateElementStyle={ops.updateSelectedShapeStyle}
				onUpdateTextStyle={ops.updateSelectedTextStyle}
				onUpdateElement={ops.updateSelectedElement}
				onApplySelection={ops.applySelection}
				onSetCanvasSize={s.setCanvasSize}
				onMoveLayer={manipulation.handleMoveLayer}
				onMoveLayerToEdge={manipulation.handleMoveLayerToEdge}
				onDeleteElement={manipulation.handleDelete}
				onUpdateSlide={propertyHandlers.handleUpdateSlide}
				presentationProperties={s.presentationProperties}
				onUpdatePresentationProperties={propertyHandlers.handleUpdatePresentationProperties}
				editTemplateMode={s.editTemplateMode}
				slideMasters={s.slideMasters}
				themeOptions={s.themeOptions}
				notesMaster={s.notesMaster}
				handoutMaster={s.handoutMaster}
				notesCanvasSize={s.notesCanvasSize}
				coreProperties={s.coreProperties}
				appProperties={s.appProperties}
				customProperties={s.customProperties}
				tagCollections={s.tagCollections}
				onUpdateTagCollections={s.setTagCollections}
				onUpdateCoreProperties={propertyHandlers.handleUpdateCoreProperties}
				onUpdateAppProperties={propertyHandlers.handleUpdateAppProperties}
				onUpdateCustomProperties={propertyHandlers.handleUpdateCustomProperties}
				onApplyTheme={themeHandlers.handleApplyTheme}
				onSetTemplateBackground={themeHandlers.handleSetTemplateBackground}
				onGetTemplateBackgroundColor={themeHandlers.handleGetTemplateBackgroundColor}
				mediaDataUrls={s.mediaDataUrls}
				theme={s.theme}
				panelWidth={panelWidth}
			/>

			{s.isSelectionPaneOpen && (mode === 'edit' || mode === 'master') && (
				<MobileDismissSheet
					onClose={() => s.setIsSelectionPaneOpen(false)}
					className='absolute right-0 top-0 z-30 h-full max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-auto max-md:max-h-[50vh] max-md:rounded-t-xl max-md:border-t max-md:border-border max-md:shadow-2xl max-md:bg-background'
				>
					<SelectionPane
						slides={slides}
						activeSlideIndex={activeSlideIndex}
						selectedElementId={s.selectedElementId}
						selectedElementIds={s.selectedElementIds}
						canEdit={canEdit}
						setSelectedElementId={s.setSelectedElementId}
						setSelectedElementIds={s.setSelectedElementIds}
						setSlides={s.setSlides}
						markDirty={history.markDirty}
						onClose={() => s.setIsSelectionPaneOpen(false)}
					/>
				</MobileDismissSheet>
			)}

			{s.isThemeEditorOpen && mode === 'edit' && (
				<MobileDismissSheet
					onClose={() => s.setIsThemeEditorOpen(false)}
					className='absolute right-0 top-0 z-30 h-full w-72 overflow-y-auto border-l border-border bg-card p-2.5 shadow-xl max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:h-auto max-md:max-h-[60vh] max-md:rounded-t-xl max-md:border-t max-md:border-l-0'
				>
					<ThemeEditorPanel
						theme={s.theme}
						canEdit={canEdit}
						onUpdateColorScheme={themeHandlers.handleUpdateThemeColorScheme}
						onUpdateFontScheme={themeHandlers.handleUpdateThemeFontScheme}
						onUpdateThemeName={themeHandlers.handleUpdateThemeName}
						onApplyToPresentation={themeHandlers.handleApplyThemeToPresentation}
						onClose={() => s.setIsThemeEditorOpen(false)}
					/>
				</MobileDismissSheet>
			)}

			{aiPanel?.isOpen && aiConfig && aiBridge && (mode === 'edit' || mode === 'master') && (
				<AiChatPanelLazy
					bridge={aiBridge}
					config={aiConfig}
					aiPanel={aiPanel}
					onClose={aiPanel.close}
					panelWidth={panelWidth}
				/>
			)}

			<ThemeGallery
				open={s.isThemeGalleryOpen}
				currentTheme={currentBuiltInTheme}
				canEdit={canEdit}
				onClose={() => s.setIsThemeGalleryOpen(false)}
				onApplyTheme={(theme: ThemeDefinition) => {
					themeHandlers.handleApplyThemeData(
						theme.colorScheme,
						{
							majorFont: {
								latin: theme.fontScheme.majorFont,
								eastAsia: theme.fontScheme.majorFont,
								complexScript: theme.fontScheme.majorFont,
							},
							minorFont: {
								latin: theme.fontScheme.minorFont,
								eastAsia: theme.fontScheme.minorFont,
								complexScript: theme.fontScheme.minorFont,
							},
						},
						theme.name,
					);
				}}
			/>
		</>
	);
}
