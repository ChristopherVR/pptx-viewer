export { useEditorHistory } from "./useEditorHistory";
export type {
  EditorHistoryInput,
  EditorHistoryResult,
} from "./useEditorHistory";

export { useZoomViewport } from "./useZoomViewport";

export { usePresentationMode } from "./usePresentationMode";

export { usePresentationAnnotations } from "./usePresentationAnnotations";
export type {
  PresentationTool,
  AnnotationStroke,
  UsePresentationAnnotationsResult,
} from "./usePresentationAnnotations";

export { useFindReplace } from "./useFindReplace";

export { useComments } from "./useComments";

export { useViewerState } from "./useViewerState";
export type { ViewerState, UseViewerStateInput } from "./useViewerState";

export { useViewerCoreState } from "./useViewerCoreState";
export type {
  ViewerCoreState,
  UseViewerCoreStateInput,
} from "./useViewerCoreState";

export { useViewerUIState } from "./useViewerUIState";
export type { ViewerUIState } from "./useViewerUIState";

export { useLoadContent } from "./useLoadContent";
export type {
  UseLoadContentInput,
  UseLoadContentResult,
} from "./useLoadContent";

export { useAutosave } from "./useAutosave";
export type {
  AutosaveStatus,
  UseAutosaveInput,
  UseAutosaveResult,
} from "./useAutosave";

export { useElementOperations } from "./useElementOperations";
export type {
  ElementOperations,
  UseElementOperationsInput,
} from "./useElementOperations";

export { useSectionOperations } from "./useSectionOperations";
export type {
  SectionOperations,
  UseSectionOperationsInput,
} from "./useSectionOperations";

export { usePointerHandlers } from "./usePointerHandlers";
export type { UsePointerHandlersInput } from "./usePointerHandlers";

export { useCanvasInteractions } from "./useCanvasInteractions";
export type {
  UseCanvasInteractionsInput,
  CanvasInteractionHandlers,
} from "./useCanvasInteractions";

export { useInsertElements } from "./useInsertElements";
export type {
  UseInsertElementsInput,
  InsertElementHandlers,
} from "./useInsertElements";

export { useElementManipulation } from "./useElementManipulation";
export type {
  UseElementManipulationInput,
  ElementManipulationHandlers,
} from "./useElementManipulation";

export { useSlideManagement } from "./useSlideManagement";
export type {
  UseSlideManagementInput,
  SlideManagementHandlers,
} from "./useSlideManagement";

export { useTableOperations } from "./useTableOperations";
export type {
  UseTableOperationsInput,
  TableOperationHandlers,
} from "./useTableOperations";

export { useExportHandlers } from "./useExportHandlers";
export type {
  UseExportHandlersInput,
  ExportHandlersResult,
} from "./useExportHandlers";

export { usePrintHandlers } from "./usePrintHandlers";
export type {
  UsePrintHandlersInput,
  PrintHandlersResult,
} from "./usePrintHandlers";

export { useThemeHandlers } from "./useThemeHandlers";
export type {
  UseThemeHandlersInput,
  ThemeHandlersResult,
} from "./useThemeHandlers";

export { useThemeSwitching } from "./useThemeSwitching";
export type {
  UseThemeSwitchingInput,
  ThemeSwitchingResult,
} from "./useThemeSwitching";

export { usePropertyHandlers } from "./usePropertyHandlers";
export type {
  UsePropertyHandlersInput,
  PropertyHandlersResult,
} from "./usePropertyHandlers";

export { useViewerDialogs } from "./useViewerDialogs";
export type {
  UseViewerDialogsInput,
  ViewerDialogsResult,
} from "./useViewerDialogs";

export { useDerivedSlideState } from "./useDerivedSlideState";
export type {
  UseDerivedSlideStateInput,
  DerivedSlideState,
} from "./useDerivedSlideState";

export { useAnnotationHandlers } from "./useAnnotationHandlers";
export type {
  UseAnnotationHandlersInput,
  AnnotationHandlersResult,
} from "./useAnnotationHandlers";

export { useSerialize } from "./useSerialize";
export type { UseSerializeInput } from "./useSerialize";

export { useRecoveryDetection } from "./useRecoveryDetection";
export type { UseRecoveryDetectionInput } from "./useRecoveryDetection";

export { usePresentationSetup } from "./usePresentationSetup";
export type {
  UsePresentationSetupInput,
  PresentationSetupResult,
} from "./usePresentationSetup";

export { useEditorOperations } from "./useEditorOperations";
export type {
  UseEditorOperationsInput,
  EditorOperationsResult,
} from "./useEditorOperations";

export { useIOHandlers } from "./useIOHandlers";
export type { UseIOHandlersInput, IOHandlersResult } from "./useIOHandlers";

export { useContentLifecycle } from "./useContentLifecycle";
export type {
  UseContentLifecycleInput,
  ContentLifecycleResult,
} from "./useContentLifecycle";

export { useKeyboardShortcutWiring } from "./useKeyboardShortcutWiring";
export type { UseKeyboardShortcutWiringInput } from "./useKeyboardShortcutWiring";

export { useViewerIntegration } from "./useViewerIntegration";
export type {
  UseViewerIntegrationInput,
  ViewerIntegrationResult,
} from "./useViewerIntegration";

export { useReducedMotion } from "./useReducedMotion";
export type { UseReducedMotionResult } from "./useReducedMotion";

// Collaboration
export type {
  CollaborationConfig,
  ConnectionStatus,
  UserPresence,
  CollaborationContextValue,
} from "./collaboration";
export { useCollaborativeState } from "./collaboration";
export type { UseCollaborativeStateInput } from "./collaboration";
export { usePresenceTracking } from "./collaboration";
export type {
  UsePresenceTrackingInput,
  UsePresenceTrackingResult,
} from "./collaboration";
export { useCollaborativeHistory } from "./collaboration";
export type {
  UseCollaborativeHistoryInput,
  UseCollaborativeHistoryResult,
} from "./collaboration";

export { useLayoutSwitching } from "./useLayoutSwitching";
export type {
  UseLayoutSwitchingInput,
  LayoutSwitchingResult,
} from "./useLayoutSwitching";

export {
  useVirtualizedSlides,
  computeVirtualRange,
} from "./useVirtualizedSlides";
export type {
  VirtualizedSlidesOptions,
  VirtualizedSlidesResult,
  VirtualizedRange,
} from "./useVirtualizedSlides";
