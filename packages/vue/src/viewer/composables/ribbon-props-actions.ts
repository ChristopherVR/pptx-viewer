import type { DistributeAxis } from 'pptx-viewer-shared';

import type { UseRibbonPropsInput } from './ribbon-props-types';
import { RIBBON_ALIGN, toShapePreset } from './useRibbonActions';

/**
 * buildRibbonPropsActions: the callback (action) fields of `RibbonProps`,
 * dispatching into the editor's handlers and toggling its state refs.
 * Extracted from `useRibbonProps.ts` to keep that file under the repo's
 * ~300 LOC convention; see `ribbon-props-state.ts` for the state half.
 */
export function buildRibbonPropsActions(input: UseRibbonPropsInput) {
	return {
		onSetMode: (m: 'preview' | 'edit' | 'present' | 'master') => {
			if (m === 'present') {
				input.startPresenting();
			} else {
				input.presenting.value = false;
			}
		},
		onToggleSidebar: () => {
			input.sidebarCollapsed.value = !input.sidebarCollapsed.value;
		},
		onToggleInspector: () => {
			input.inspectorOpen.value = !input.inspectorOpen.value;
		},
		onOpenAnimationPanel: () => {
			input.toolbarSection.value = 'animations';
		},
		onAddAnimation: input.onAddAnimation,
		onRemoveAnimation: input.onRemoveAnimation,
		onToggleCompactToolbar: () => {
			input.ribbonExpanded.value = !input.ribbonExpanded.value;
		},
		onSetToolbarSection: (sec: typeof input.toolbarSection.value) => {
			input.toolbarSection.value = sec;
		},
		onZoomIn: input.zoomIn,
		onZoomOut: input.zoomOut,
		onZoomToFit: input.zoomReset,
		onUndo: input.undo,
		onRedo: input.redo,
		onToggleFindReplace: () => {
			input.findOpen.value = !input.findOpen.value;
		},
		onSetNewShapeType: (t: typeof input.newShapeType.value) => {
			input.newShapeType.value = t;
		},
		onAddTextBox: input.addText,
		onAddShape: () => input.addShape(toShapePreset(input.newShapeType.value)),
		onAddTable: input.addTable,
		onAddChart: input.addChart,
		onAddSmartArt: () => {
			input.showInsertSmartArt.value = true;
		},
		onAddEquation: () => {
			input.showEquationEditor.value = true;
		},
		onAddActionButton: input.addActionButton,
		onInsertField: input.addField,
		onOpenHeaderFooter: () => {
			input.showHeaderFooter.value = true;
		},
		onOpenImagePicker: input.openImagePicker,
		onOpenMediaPicker: input.openMediaPicker,
		onSetActiveTool: (t: typeof input.activeTool.value) => {
			input.activeTool.value = t;
		},
		onSetDrawingColor: (c: string) => {
			input.drawingColor.value = c;
		},
		onSetDrawingWidth: (w: number) => {
			input.drawingWidth.value = w;
		},
		onSetEditTemplateMode: (mode: boolean) => {
			input.editTemplateMode.value = mode;
		},
		onSetSpellCheckEnabled: (enabled: boolean) => {
			input.spellCheckEnabled.value = enabled;
		},
		onSetShowGrid: (enabled: boolean) => {
			input.showGrid.value = enabled;
		},
		onSetShowRulers: (enabled: boolean) => {
			input.showRulers.value = enabled;
		},
		onSetSnapToGrid: (enabled: boolean) => {
			input.snapToGrid.value = enabled;
		},
		onSetSnapToShape: (enabled: boolean) => {
			input.snapToShape.value = enabled;
		},
		onAddGuide: input.addGuide,
		onAlignElements: (edge: string) => {
			const e = RIBBON_ALIGN[edge];
			if (e) {
				input.onAlign(e);
			}
		},
		onDistributeElements: (axis: string) => {
			if (axis === 'horizontal' || axis === 'vertical') {
				input.onDistribute(axis as DistributeAxis);
			}
		},
		canDistribute: input.canDistribute.value,
		onCopy: input.copySelected,
		onCut: input.cutSelected,
		onPaste: input.pasteElement,
		onFlip: input.ribbonFlip,
		onMoveLayer: (dir: string) => {
			if (dir === 'forward' || dir === 'up' || dir === 'front') {
				input.bringForward();
			} else {
				input.sendBackward();
			}
		},
		onMoveLayerToEdge: input.ribbonMoveToEdge,
		onDuplicate: input.duplicateSelected,
		onDelete: input.deleteSelected,
		onOpenFile: input.handleOpenFile,
		onExportPng: input.onExportPng,
		onExportPdf: input.onExportPdf,
		onExportVideo: input.onExportWebm,
		onExportGif: input.onExportGif,
		onPackageForSharing: () => void input.packageForSharing(),
		onOpenShareDialog: () => {
			input.shareOpen.value = true;
		},
		onSaveAsPptx: () => void input.downloadAs('pptx'),
		onSaveAsPpsx: () => void input.downloadAs('ppsx'),
		onSaveAsPptm: () => void input.downloadAs('pptm'),
		onCopySlideAsImage: () => void input.onCopySlideAsImage(),
		onPrint: input.openPrintDialog,
		onToggleShortcuts: () => {
			input.showShortcuts.value = !input.showShortcuts.value;
		},
		onOpenSettings: () => {
			input.showSettings.value = true;
		},
		onRunAccessibilityCheck: () => {
			input.showA11y.value = true;
		},
		onToggleSlideSorter: () => {
			input.showSorter.value = true;
		},
		onUpdateTextStyle: input.ribbonUpdateTextStyle,
		onTransformTextCase: input.ribbonUpdateTextCase,
		onSetOverflowMenuOpen: (o: boolean) => {
			input.overflowOpen.value = o;
		},
		onInsertSlideFromLayout: (path: string, name?: string) =>
			void input.insertSlideFromLayout(path, name),
		onSetActiveCustomShowId: (id: string | null) => {
			input.activeCustomShowId.value = id;
		},
		onCreateCustomShow: () => {
			input.showCustomShows.value = true;
		},
		onRenameActiveCustomShow: input.onRenameActiveCustomShow,
		onDeleteActiveCustomShow: input.onDeleteActiveCustomShow,
		onToggleCurrentSlideInActiveShow: input.onToggleCurrentSlideInActiveShow,
		onToggleVersionHistory: () => {
			input.showVersionHistory.value = true;
		},
		onOpenPasswordProtection: () => {
			input.showPasswordDialog.value = true;
		},
		onOpenDocumentProperties: () => {
			input.propertiesOpen.value = true;
		},
		onOpenFontEmbedding: () => {
			input.showFontEmbedding.value = true;
		},
		onOpenDigitalSignatures: () => {
			input.showSignatures.value = true;
		},
		onEnterMasterView: () => {
			input.showMasterView.value = true;
		},
		onCloseMasterView: () => {
			input.showMasterView.value = false;
		},
		onEnterPresenterView: input.startPresenterView,
		onEnterRehearsalMode: input.startRehearsal,
		onToggleThemeEditor: () => {
			input.themeEditorOpen.value = !input.themeEditorOpen.value;
		},
		onToggleThemeGallery: () => {
			input.themeGalleryOpen.value = !input.themeGalleryOpen.value;
		},
		onCompare: () => void input.compareWithPresentation(),
		onToggleComments: () => {
			input.showComments.value = !input.showComments.value;
		},
		onToggleFormatPainter: input.toggleFormatPainter,
		onToggleSelectionPane: () => {
			input.showSelectionPane.value = !input.showSelectionPane.value;
		},
		onToggleEyedropper: () => {
			input.eyedropperActive.value = !input.eyedropperActive.value;
		},
		onOpenSetUpSlideShow: () => {
			input.showSetUpSlideShow.value = true;
		},
		onOpenBroadcastDialog: () => {
			input.broadcastOpen.value = true;
		},
		onToggleSubtitles: input.onToggleSubtitles,
		onTransitionChange: input.onTransitionChange,
		onApplyTransitionToAll: input.onApplyTransitionToAll,
	};
}
