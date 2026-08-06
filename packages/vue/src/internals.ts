// ── Internal building blocks. Not covered by semver; prefer the stable root exports. ──
//
// These are the same composables `PowerPointViewer.vue` composes internally (directly, or via a
// wiring composable used by a child component). They are exposed here for advanced integrations
// that need finer-grained control than the component or the curated `pptx-vue-viewer/viewer` entry
// provide.
//
// Only files that export an actual `use*()` composable function are included (plus the
// input/result types declared alongside it). Purely internal helper modules that back a composable
// (pure functions, provide/inject keys, constant tables) are not part of this surface - they are
// implementation detail, not composables.

export * from './viewer/composables/smart-art-3d';
export * from './viewer/composables/smartart-inline-edit';
export * from './viewer/composables/table-selection';
export * from './viewer/composables/useAccessibility';
export * from './viewer/composables/useAlignGroup';
export * from './viewer/composables/useAnimationPlayback';
export * from './viewer/composables/useAutosave';
export * from './viewer/composables/useChartEditing';
export * from './viewer/composables/useCollaboration';
export * from './viewer/composables/useCollaborationWiring';
export * from './viewer/composables/use-color-change-image';
export * from './viewer/composables/useComments';
export * from './viewer/composables/useCommentsWiring';
export * from './viewer/composables/useContextMenu';
export * from './viewer/composables/useCustomShows';
export * from './viewer/composables/useCustomShowsWiring';
export * from './viewer/composables/useDebouncedCallback';
export * from './viewer/composables/useDocumentPropertiesDialog';
export * from './viewer/composables/useDocumentStatistics';
export * from './viewer/composables/useEditorHistory';
export * from './viewer/composables/useEditorKeyboard';
export * from './viewer/composables/useEditorOperations';
export * from './viewer/composables/useElementDrag';
export * from './viewer/composables/useElementInsertion';
export * from './viewer/composables/useEmbeddedFonts';
export * from './viewer/composables/useExport';
export * from './viewer/composables/useExportProgress';
export * from './viewer/composables/useExportWiring';
export * from './viewer/composables/useFindReplace';
export * from './viewer/composables/useFontEmbedding';
export * from './viewer/composables/useFormatPainter';
export * from './viewer/composables/useHeaderFooterDialog';
export * from './viewer/composables/useInkDrawing';
export * from './viewer/composables/useInlineEditing';
export * from './viewer/composables/useInsertElementDialogs';
export * from './viewer/composables/useIsMobile';
export * from './viewer/composables/useKeyboardInsets';
export * from './viewer/composables/useKeyboardShortcuts';
export * from './viewer/composables/useLoadContent';
export * from './viewer/composables/useMasterViewState';
// `RasterizeSlide` is identical across useExport/useMediaExport/usePrint; the
// canonical re-export comes from useExport, so it is omitted here to avoid an
// ambiguous re-export.
export type {
	EncodeGif,
	MediaRecorderFactory,
	MediaExportProgress,
	UseMediaExportOptions,
	MediaExportOptions,
	WebmExportOptions,
	UseMediaExportResult,
} from './viewer/composables/useMediaExport';
export { useMediaExport } from './viewer/composables/useMediaExport';
export * from './viewer/composables/useMobileChrome';
export * from './viewer/composables/useModel3dScene';
export * from './viewer/composables/useMultiSelectOps';
export * from './viewer/composables/usePasswordProtection';
export * from './viewer/composables/usePresentationAnnotations';
export * from './viewer/composables/usePresentationModeWiring';
// See the useMediaExport note above: `RasterizeSlide` is omitted here too.
export type {
	OpenPrintWindow,
	UsePrintOptions,
	UsePrintResult,
} from './viewer/composables/usePrint';
export { usePrint } from './viewer/composables/usePrint';
export * from './viewer/composables/useRehearseTimings';
export * from './viewer/composables/useRibbonActions';
export * from './viewer/composables/useRibbonProps';
export * from './viewer/composables/useRibbonUiState';
export * from './viewer/composables/useSectionOperations';
export * from './viewer/composables/useSelectionPaneWiring';
export * from './viewer/composables/useSheetDismissDrag';
export * from './viewer/composables/useSignatures';
export * from './viewer/composables/useSignatureWorkflow';
export * from './viewer/composables/useSlideMutations';
export * from './viewer/composables/useSlideOperations';
export * from './viewer/composables/useSlideShowSettings';
export * from './viewer/composables/useSlideTemplateInsertion';
export * from './viewer/composables/useSmartArtEditing';
export * from './viewer/composables/useSmartArtFocus';
export * from './viewer/composables/useSmartArtHoverRect';
export * from './viewer/composables/useSmartArtNodeEditContext';
export * from './viewer/composables/useTableCellEditingContext';
export * from './viewer/composables/useThemeEditing';
export * from './viewer/composables/useToolbarAutoHide';
// Moved out of the curated `pptx-vue-viewer/viewer` surface: internal wiring.
export { useToolbarVisibility } from './viewer/composables/useToolbarVisibility';
export type { UseToolbarVisibilityResult } from './viewer/composables/useToolbarVisibility';
export * from './viewer/composables/useTouchGestures';
export * from './viewer/composables/useVersionHistory';
export * from './viewer/composables/useVersionHistoryWiring';
export * from './viewer/composables/useViewerSettingsDialog';
