import type {
	PptxElement,
	PptxLayoutOption,
	PptxSlide,
	PptxSlideTransition,
	PptxElementAnimation,
	PptxAnimationPreset,
} from 'pptx-viewer-core';
import { createBackstagePresentation, DEFAULT_INSERT_CHART_TYPE } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';
/**
 * ViewerToolbarSection: Renders the top toolbar, signature badge,
 * and hidden file-input elements.
 */
import React, { useCallback } from 'react';

import { Toolbar, SignatureStatusBadge } from '.';
import type { AutosaveStatus } from '../hooks/useAutosave';
import type { EditorHistoryResult } from '../hooks/useEditorHistory';
import type { ElementManipulationHandlers } from '../hooks/useElementManipulation';
import type { ElementOperations } from '../hooks/useElementOperations';
import type { ExportHandlersResult } from '../hooks/useExportHandlers';
import type { InsertElementHandlers } from '../hooks/useInsertElements';
import type { PrintHandlersResult } from '../hooks/usePrintHandlers';
import type { PropertyHandlersResult } from '../hooks/usePropertyHandlers';
import { scopeLayoutOptionsToActiveSlide } from '../hooks/useScopedLayoutOptions';
import type { SlideManagementHandlers } from '../hooks/useSlideManagement';
import type { ViewerDialogsResult } from '../hooks/useViewerDialogs';
import type { SupportedShapeType, ViewerMode } from '../types';
import type { ElementClipboardPayload } from '../types-core';
import type { DrawingTool, TableCellEditorState, ToolbarSection } from '../types-ui';
import { hasCopyableFormat } from '../utils/format-painter';
import { TitleBar } from './toolbar/TitleBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerToolbarSectionProps {
	mode: ViewerMode;
	canEdit: boolean;
	state: {
		isDirty: boolean;
		isSlidesPaneOpen: boolean;
		setIsSlidesPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
		isInspectorPaneOpen: boolean;
		setIsInspectorPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
		isCompactToolbarOpen: boolean;
		setIsCompactToolbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
		toolbarSection: ToolbarSection;
		setToolbarSection: React.Dispatch<React.SetStateAction<ToolbarSection>>;
		setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
		setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
		setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
		setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
		setTemplateElementsBySlideId: React.Dispatch<
			React.SetStateAction<Record<string, PptxElement[]>>
		>;
		setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
		newShapeType: SupportedShapeType;
		setNewShapeType: React.Dispatch<React.SetStateAction<SupportedShapeType>>;
		activeTool: DrawingTool;
		setActiveTool: React.Dispatch<React.SetStateAction<DrawingTool>>;
		drawingColor: string;
		setDrawingColor: React.Dispatch<React.SetStateAction<string>>;
		drawingWidth: number;
		setDrawingWidth: React.Dispatch<React.SetStateAction<number>>;
		clipboardPayload: ElementClipboardPayload | null;
		tableEditorState: TableCellEditorState | null;
		editTemplateMode: boolean;
		setEditTemplateMode: React.Dispatch<React.SetStateAction<boolean>>;
		spellCheckEnabled: boolean;
		setSpellCheckEnabled: React.Dispatch<React.SetStateAction<boolean>>;
		showGrid: boolean;
		setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
		showRulers: boolean;
		setShowRulers: React.Dispatch<React.SetStateAction<boolean>>;
		snapToGrid: boolean;
		setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
		snapToShape: boolean;
		setSnapToShape: React.Dispatch<React.SetStateAction<boolean>>;
		isOverflowMenuOpen: boolean;
		setIsOverflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
		layoutOptions: PptxLayoutOption[];
		hasMacros: boolean;
		isThemeEditorOpen: boolean;
		setIsThemeEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
		isThemeGalleryOpen: boolean;
		setIsThemeGalleryOpen: React.Dispatch<React.SetStateAction<boolean>>;
		isSelectionPaneOpen: boolean;
		setIsSelectionPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
		formatPainterActive: boolean;
		setFormatPainterActive: React.Dispatch<React.SetStateAction<boolean>>;
		eyedropperActive: boolean;
		setEyedropperActive: React.Dispatch<React.SetStateAction<boolean>>;
		customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
		activeCustomShowId: string | null;
		setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
		setIsShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
		setShowSlideSorter: React.Dispatch<React.SetStateAction<boolean>>;
		presentationProperties: { showSubtitles?: boolean };
		hasDigitalSignatures: boolean;
		digitalSignatureCount: number;
		imageInputRef: React.RefObject<HTMLInputElement | null>;
		mediaInputRef: React.RefObject<HTMLInputElement | null>;
		sidebarPanelMode: string;
		setSidebarPanelMode: React.Dispatch<React.SetStateAction<string>>;
	};
	selectedElement: PptxElement | null;
	activeSlide: PptxSlide | undefined;
	zoom: {
		scale: number;
		handleZoomIn: () => void;
		handleZoomOut: () => void;
		handleZoomToFit: () => void;
	};
	history: EditorHistoryResult;
	findReplace: {
		findReplaceOpen: boolean;
		setFindReplaceOpen: (open: boolean) => void;
	};
	manipulation: ElementManipulationHandlers;
	insertHandlers: InsertElementHandlers;
	exportHandlers: ExportHandlersResult;
	printHandlers: PrintHandlersResult;
	propertyHandlers: PropertyHandlersResult;
	dialogs: ViewerDialogsResult;
	slideOps: SlideManagementHandlers;
	ops: ElementOperations;
	onSetMode: (mode: ViewerMode) => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSettings?: () => void;
	onOpenHeaderFooter?: () => void;
	onOpenShareDialog?: () => void;
	onOpenFile?: () => void;
	onOpenRecentFile?: (key: string) => void;
	onToggleFormatPainter?: () => void;
	/** Title-bar wiring (PowerPoint-style top chrome row). */
	fileName?: string;
	autosaveStatus?: AutosaveStatus;
	autosaveEnabled?: boolean;
	onToggleAutosave?: () => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: ToolbarActionId[];
	/** Whether the AI assistant is available (the host passed the `ai` prop). */
	aiEnabled?: boolean;
	/** Whether the AI assistant panel is currently open. */
	isAiPanelOpen?: boolean;
	/** Toggle the AI assistant panel. */
	onToggleAiPanel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerToolbarSection(props: ViewerToolbarSectionProps) {
	const {
		mode,
		canEdit,
		state: s,
		selectedElement,
		activeSlide,
		zoom,
		history,
		findReplace,
		manipulation,
		insertHandlers,
		exportHandlers,
		printHandlers,
		propertyHandlers,
		dialogs,
		slideOps,
		ops,
		onSetMode,
		onEnterPresenterView,
		onEnterRehearsalMode,
		onOpenSettings,
		onOpenHeaderFooter,
		onOpenShareDialog,
		onOpenFile,
		onOpenRecentFile,
		onToggleFormatPainter: onToggleFormatPainterProp,
		fileName,
		autosaveStatus,
		autosaveEnabled = true,
		onToggleAutosave,
		hiddenActions,
		aiEnabled,
		isAiPanelOpen,
		onToggleAiPanel,
	} = props;

	const handleAddAnimation = useCallback(
		(preset: string, group: 'entrance' | 'emphasis' | 'exit') => {
			if (!selectedElement || !activeSlide) {
				return;
			}
			const current = activeSlide.animations ?? [];
			const existing = current.find((a) => a.elementId === selectedElement.id);
			const presetValue = preset as PptxAnimationPreset;
			if (existing) {
				const updated = current.map((a) =>
					a.elementId === selectedElement.id ? { ...a, [group]: presetValue } : a,
				);
				propertyHandlers.handleUpdateSlide({ animations: updated });
			} else {
				const newAnim: PptxElementAnimation = {
					elementId: selectedElement.id,
					[group]: presetValue,
					durationMs: 500,
					order: current.length,
					trigger: 'onClick',
				};
				propertyHandlers.handleUpdateSlide({ animations: [...current, newAnim] });
			}
		},
		[selectedElement, activeSlide, propertyHandlers],
	);

	const handleRemoveAnimation = useCallback(() => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const current = activeSlide.animations ?? [];
		const filtered = current.filter((a) => a.elementId !== selectedElement.id);
		propertyHandlers.handleUpdateSlide({ animations: filtered });
	}, [selectedElement, activeSlide, propertyHandlers]);

	const handleTransitionChange = useCallback(
		(updates: Partial<PptxSlideTransition>) => {
			if (!activeSlide) {
				return;
			}
			const current = activeSlide.transition ?? { type: 'none' as const };
			propertyHandlers.handleUpdateSlide({ transition: { ...current, ...updates } });
		},
		[activeSlide, propertyHandlers],
	);

	const scopedLayoutOptions = React.useMemo(
		() => scopeLayoutOptionsToActiveSlide(s.layoutOptions, activeSlide),
		[s.layoutOptions, activeSlide],
	);

	const handleApplyTransitionToAll = useCallback(() => {
		const transition = activeSlide?.transition;
		if (!transition) {
			return;
		}
		ops.updateSlides((prev) => prev.map((sl) => ({ ...sl, transition })));
		history.markDirty();
	}, [activeSlide, ops, history]);

	const handleCommandSearch = useCallback(
		(command: string) => {
			const [category, action] = command.split('.');
			switch (category) {
				case 'format':
					switch (action) {
						case 'bold':
							ops.updateSelectedTextStyle({ bold: true });
							break;
						case 'italic':
							ops.updateSelectedTextStyle({ italic: true });
							break;
						case 'underline':
							ops.updateSelectedTextStyle({ underline: true });
							break;
						case 'alignLeft':
							ops.updateSelectedTextStyle({ align: 'left' });
							break;
						case 'alignCenter':
							ops.updateSelectedTextStyle({ align: 'center' });
							break;
						case 'alignRight':
							ops.updateSelectedTextStyle({ align: 'right' });
							break;
						case 'clear':
							ops.updateSelectedTextStyle({
								bold: false,
								italic: false,
								underline: false,
								strikethrough: false,
							});
							break;
					}
					break;
				case 'insert':
					switch (action) {
						case 'textBox':
							insertHandlers.handleAddTextBox();
							break;
						case 'shape':
							insertHandlers.handleAddShape();
							break;
						case 'image':
							s.imageInputRef.current?.click();
							break;
						case 'media':
							s.mediaInputRef.current?.click();
							break;
						case 'table':
							insertHandlers.handleAddTable();
							break;
						case 'chart':
							insertHandlers.handleAddChart(DEFAULT_INSERT_CHART_TYPE);
							break;
						case 'smartArt':
							dialogs.setIsSmartArtDialogOpen(true);
							break;
						case 'equation':
							dialogs.setIsEquationDialogOpen(true);
							break;
						case 'link':
							dialogs.setIsHyperlinkDialogOpen(true);
							break;
					}
					break;
				case 'view':
					switch (action) {
						case 'toggleGrid':
							s.setShowGrid((p) => !p);
							break;
						case 'toggleRulers':
							s.setShowRulers((p) => !p);
							break;
						case 'slideSorter':
							s.setShowSlideSorter((p) => !p);
							break;
						case 'zoomToFit':
							zoom.handleZoomToFit();
							break;
					}
					break;
				case 'slideShow':
					switch (action) {
						case 'fromBeginning':
							onSetMode('present');
							break;
						case 'presenterView':
							onEnterPresenterView();
							break;
					}
					break;
				case 'design':
					switch (action) {
						case 'browseThemes':
							s.setIsThemeGalleryOpen((p) => !p);
							break;
						case 'slideSize':
							dialogs.setIsSetUpSlideShowOpen(true);
							break;
					}
					break;
				case 'arrange':
					switch (action) {
						case 'bringToFront':
							manipulation.handleMoveLayerToEdge('front');
							break;
						case 'sendToBack':
							manipulation.handleMoveLayerToEdge('back');
							break;
						case 'duplicate':
							manipulation.handleDuplicate();
							break;
					}
					break;
				case 'review':
					switch (action) {
						case 'spelling':
							s.setSpellCheckEnabled((p) => !p);
							break;
						case 'accessibility':
							dialogs.handleRunAccessibilityCheck();
							break;
					}
					break;
			}
		},
		[ops, insertHandlers, s, dialogs, zoom, onSetMode, onEnterPresenterView, manipulation],
	);

	return (
		<>
			{!dialogs.isNarrowViewport && (
				<TitleBar
					mode={mode}
					canEdit={canEdit}
					fileName={fileName}
					isDirty={s.isDirty}
					autosaveStatus={autosaveStatus}
					autosaveEnabled={autosaveEnabled}
					onToggleAutosave={onToggleAutosave ?? (() => {})}
					canUndo={history.canUndo}
					canRedo={history.canRedo}
					undoLabel={history.undoLabel}
					redoLabel={history.redoLabel}
					onUndo={history.handleUndo}
					onRedo={history.handleRedo}
					onSave={exportHandlers.handleSaveAsPptx}
					findReplaceOpen={findReplace.findReplaceOpen}
					onToggleFindReplace={() => findReplace.setFindReplaceOpen(!findReplace.findReplaceOpen)}
					onCommandSearch={handleCommandSearch}
					hiddenActions={hiddenActions}
				/>
			)}
			<Toolbar
				fileName={fileName}
				mode={mode}
				canEdit={canEdit}
				hiddenActions={hiddenActions}
				isNarrowViewport={dialogs.isNarrowViewport}
				isSidebarCollapsed={!s.isSlidesPaneOpen}
				isInspectorPaneOpen={s.isInspectorPaneOpen}
				isCompactToolbarOpen={s.isCompactToolbarOpen}
				toolbarSection={s.toolbarSection}
				scale={zoom.scale}
				canUndo={history.canUndo}
				canRedo={history.canRedo}
				undoLabel={history.undoLabel}
				redoLabel={history.redoLabel}
				findReplaceOpen={findReplace.findReplaceOpen}
				selectedElement={selectedElement}
				tableEditorState={s.tableEditorState}
				editTemplateMode={s.editTemplateMode}
				newShapeType={s.newShapeType}
				activeTool={s.activeTool}
				drawingColor={s.drawingColor}
				drawingWidth={s.drawingWidth}
				clipboardPayload={s.clipboardPayload}
				onSetMode={onSetMode}
				onToggleSidebar={() => s.setIsSlidesPaneOpen((p) => !p)}
				onToggleInspector={() => s.setIsInspectorPaneOpen((p) => !p)}
				onOpenAnimationPanel={() => {
					s.setIsInspectorPaneOpen(true);
					s.setSidebarPanelMode('properties');
				}}
				onAddAnimation={handleAddAnimation}
				onRemoveAnimation={handleRemoveAnimation}
				onToggleCompactToolbar={() => s.setIsCompactToolbarOpen((p) => !p)}
				onSetToolbarSection={s.setToolbarSection}
				onZoomIn={zoom.handleZoomIn}
				onZoomOut={zoom.handleZoomOut}
				onZoomToFit={zoom.handleZoomToFit}
				onUndo={history.handleUndo}
				onRedo={history.handleRedo}
				onToggleFindReplace={() => findReplace.setFindReplaceOpen(!findReplace.findReplaceOpen)}
				onSetNewShapeType={s.setNewShapeType}
				onAddTextBox={insertHandlers.handleAddTextBox}
				onAddShape={insertHandlers.handleAddShape}
				onAddTable={insertHandlers.handleAddTable}
				onAddChart={insertHandlers.handleAddChart}
				onAddSmartArt={() => dialogs.setIsSmartArtDialogOpen(true)}
				onAddEquation={() => {
					dialogs.setEditingEquationOmml(null);
					dialogs.setIsEquationDialogOpen(true);
				}}
				onAddActionButton={insertHandlers.handleAddActionButton}
				onInsertField={insertHandlers.handleInsertField}
				onOpenHeaderFooter={onOpenHeaderFooter}
				onOpenImagePicker={() => s.imageInputRef.current?.click()}
				onOpenMediaPicker={() => s.mediaInputRef.current?.click()}
				onSetActiveTool={s.setActiveTool}
				onSetDrawingColor={s.setDrawingColor}
				onSetDrawingWidth={s.setDrawingWidth}
				onSetEditTemplateMode={s.setEditTemplateMode}
				spellCheckEnabled={s.spellCheckEnabled}
				showGrid={s.showGrid}
				showRulers={s.showRulers}
				snapToGrid={s.snapToGrid}
				snapToShape={s.snapToShape}
				onSetSpellCheckEnabled={s.setSpellCheckEnabled}
				onSetShowGrid={s.setShowGrid}
				onSetShowRulers={s.setShowRulers}
				onSetSnapToGrid={s.setSnapToGrid}
				onSetSnapToShape={s.setSnapToShape}
				onAddGuide={dialogs.handleAddGuide}
				onAlignElements={manipulation.handleAlignElements}
				onDistributeElements={manipulation.handleDistributeElements}
				canDistribute={manipulation.canDistribute}
				onCopy={manipulation.handleCopy}
				onCut={manipulation.handleCut}
				onPaste={manipulation.handlePaste}
				onFlip={manipulation.handleFlip}
				onMoveLayer={manipulation.handleMoveLayer}
				onMoveLayerToEdge={manipulation.handleMoveLayerToEdge}
				onDuplicate={manipulation.handleDuplicate}
				onDelete={manipulation.handleDelete}
				onExportPng={exportHandlers.handleExportPng}
				onExportPdf={exportHandlers.handleExportPdf}
				onExportVideo={exportHandlers.handleExportVideo}
				onExportGif={exportHandlers.handleExportGif}
				onPackageForSharing={exportHandlers.handlePackageForSharing}
				onOpenFile={onOpenFile}
				onOpenRecentFile={onOpenRecentFile}
				onCreatePresentation={(templateId) => {
					s.setSlides(createBackstagePresentation(templateId));
					s.setActiveSlideIndex(0);
					s.setSelectedElementId(null);
					s.setSelectedElementIds([]);
					s.setTemplateElementsBySlideId({});
					s.setIsDirty(true);
				}}
				onOpenShareDialog={onOpenShareDialog}
				onSaveAsPptx={exportHandlers.handleSaveAsPptx}
				onSaveAsPpsx={exportHandlers.handleSaveAsPpsx}
				onSaveAsPptm={exportHandlers.handleSaveAsPptm}
				hasMacros={s.hasMacros}
				onCopySlideAsImage={exportHandlers.handleCopySlideAsImage}
				onPrint={printHandlers.handlePrint}
				onToggleShortcuts={() => s.setIsShortcutHelpOpen((p) => !p)}
				onOpenSettings={onOpenSettings}
				onRunAccessibilityCheck={dialogs.handleRunAccessibilityCheck}
				onToggleSlideSorter={() => s.setShowSlideSorter((p) => !p)}
				onUpdateTextStyle={ops.updateSelectedTextStyle}
				onTransformTextCase={ops.updateSelectedTextCase}
				isOverflowMenuOpen={s.isOverflowMenuOpen}
				onSetOverflowMenuOpen={s.setIsOverflowMenuOpen}
				layoutOptions={scopedLayoutOptions}
				onInsertSlideFromLayout={slideOps.handleInsertSlideFromLayout}
				customShows={s.customShows}
				activeCustomShowId={s.activeCustomShowId}
				onSetActiveCustomShowId={s.setActiveCustomShowId}
				onCreateCustomShow={dialogs.handleCreateCustomShow}
				onRenameActiveCustomShow={dialogs.handleRenameActiveCustomShow}
				onDeleteActiveCustomShow={dialogs.handleDeleteActiveCustomShow}
				onToggleCurrentSlideInActiveShow={dialogs.handleToggleCurrentSlideInActiveShow}
				isCurrentSlideInActiveShow={dialogs.isCurrentSlideInActiveShow}
				onEnterMasterView={dialogs.handleEnterMasterView}
				onCloseMasterView={dialogs.handleCloseMasterView}
				onToggleVersionHistory={() => propertyHandlers.setIsVersionHistoryOpen((p) => !p)}
				onOpenPasswordProtection={() => dialogs.setIsPasswordDialogOpen(true)}
				onOpenDocumentProperties={() => dialogs.setIsDocPropsDialogOpen(true)}
				onOpenFontEmbedding={() => dialogs.setIsFontEmbeddingOpen(true)}
				onOpenDigitalSignatures={() => dialogs.setIsDigitalSigDialogOpen(true)}
				onEnterPresenterView={onEnterPresenterView}
				onEnterRehearsalMode={onEnterRehearsalMode}
				onToggleThemeEditor={() => s.setIsThemeEditorOpen((p) => !p)}
				isThemeEditorOpen={s.isThemeEditorOpen}
				onToggleThemeGallery={() => s.setIsThemeGalleryOpen((p) => !p)}
				isThemeGalleryOpen={s.isThemeGalleryOpen}
				onCompare={propertyHandlers.handleCompare}
				onToggleComments={() => {
					s.setSidebarPanelMode('comments');
					if (!s.isInspectorPaneOpen) {
						s.setIsInspectorPaneOpen(true);
					}
				}}
				isCommentsPanelOpen={s.isInspectorPaneOpen}
				slideCommentCount={activeSlide?.comments?.length ?? 0}
				formatPainterActive={s.formatPainterActive}
				canActivateFormatPainter={hasCopyableFormat(selectedElement)}
				onToggleFormatPainter={
					onToggleFormatPainterProp ?? (() => s.setFormatPainterActive((p) => !p))
				}
				isSelectionPaneOpen={s.isSelectionPaneOpen}
				onToggleSelectionPane={() => s.setIsSelectionPaneOpen((p) => !p)}
				eyedropperActive={s.eyedropperActive}
				onToggleEyedropper={() => s.setEyedropperActive((p) => !p)}
				onOpenSetUpSlideShow={() => dialogs.setIsSetUpSlideShowOpen(true)}
				onOpenBroadcastDialog={() => dialogs.setIsBroadcastDialogOpen(true)}
				onToggleSubtitles={dialogs.handleToggleSubtitles}
				showSubtitles={Boolean(s.presentationProperties.showSubtitles)}
				activeSlide={activeSlide}
				onTransitionChange={handleTransitionChange}
				onApplyTransitionToAll={handleApplyTransitionToAll}
				aiEnabled={aiEnabled}
				isAiPanelOpen={isAiPanelOpen}
				onToggleAiPanel={onToggleAiPanel}
			/>

			{/* Signature status badge */}
			{s.hasDigitalSignatures && (
				<div className='flex items-center px-3 py-1 z-10'>
					<SignatureStatusBadge
						hasSignatures={s.hasDigitalSignatures}
						signatureCount={s.digitalSignatureCount}
						onClick={() => dialogs.setIsDigitalSigDialogOpen(true)}
					/>
				</div>
			)}

			{/* Hidden file inputs */}
			<input
				ref={s.imageInputRef}
				type='file'
				name='image-upload'
				accept='image/*'
				className='hidden'
				onChange={insertHandlers.handleImageFileChange}
			/>
			<input
				ref={s.mediaInputRef}
				type='file'
				name='media-upload'
				accept='video/*,audio/*'
				className='hidden'
				onChange={insertHandlers.handleMediaFileChange}
			/>
		</>
	);
}
