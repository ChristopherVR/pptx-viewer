export type { ApplyToSelected } from './editor-apply-to-selected';
export { createApplyToSelected } from './editor-apply-to-selected';
export type { AnimationActions, AnimationActionsDeps } from './editor-animation-actions';
export { createAnimationActions } from './editor-animation-actions';
export type { ArrangeActions, ArrangeActionsDeps } from './editor-arrange-actions';
export { createArrangeActions } from './editor-arrange-actions';
export {
	alignSelection,
	alignToCanvas,
	distributeSelection,
	flipElement,
	groupSelection,
	ungroupSelection,
} from './editor-arrange-mutations';
export type {
	SlideBackgroundActions,
	SlideBackgroundActionsDeps,
} from './editor-background-actions';
export { createSlideBackgroundActions } from './editor-background-actions';
export type { ClipboardActions, ClipboardActionsDeps } from './editor-clipboard-actions';
export { createClipboardActions } from './editor-clipboard-actions';
export type { DeckActions, DeckActionsDeps } from './editor-deck-actions';
export { createDeckActions } from './editor-deck-actions';
export type { EditorController, EditorControllerDeps } from './editor-controller';
export { createEditorController } from './editor-controller';
export type { DrawGestures, DrawGesturesDeps } from './editor-draw-gestures';
export { clientPointToStagePoint, createDrawGestures } from './editor-draw-gestures';
export type {
	DrawModeController,
	DrawModeDeps,
	DrawModeStageInteractions,
} from './editor-draw-mode';
export { createDrawModeController } from './editor-draw-mode';
export type { EditActions, EditActionsDeps, GeometryPatch } from './editor-edit-ops';
export { createEditActions } from './editor-edit-ops';
export type { SectionActions } from './editor-section-actions';
export { createSectionActions } from './editor-section-actions';
export type { InkActions, InkActionsDeps } from './editor-ink-actions';
export { createInkActions } from './editor-ink-actions';
export type { FindReplaceActions, FindReplaceActionsDeps } from './editor-find-replace-actions';
export { createFindReplaceActions } from './editor-find-replace-actions';
export type { TextFormatState, TextToggleKey } from './editor-format-mutations';
export {
	adjustFontSize,
	canFormatShape,
	canFormatText,
	changeTextCase,
	clearFormatting,
	patchShapeStyle,
	readTextFormatState,
	setCharacterSpacing,
	setFontFamily,
	setFontSize,
	setHighlightColor,
	setTextColor,
	toggleTextProp,
	toggleTextShadow,
} from './editor-format-mutations';
export type { InsertKind } from './editor-insert';
export { buildInsertElement, centerOnCanvas, pickImageElement } from './editor-insert';
export { pickMediaElement } from './editor-insert-media';
export type { InspectorActions } from './editor-inspector-actions';
export { createInspectorActions } from './editor-inspector-actions';
export type { FieldInsertContext } from './editor-insert-structured';
export {
	buildActionButtonInsertElement,
	buildChartInsertElement,
	buildEquationInsertElement,
	buildFieldInsertElement,
	buildSmartArtInsertElement,
	resolveFieldDisplayText,
} from './editor-insert-structured';
export { createLazyActions } from './editor-lazy-actions';
export {
	adjustIndent,
	setLineSpacing,
	setTextAlign,
	toggleListType,
} from './editor-paragraph-mutations';
export type { SlideActions, SlideActionsDeps } from './editor-slide-actions';
export { createSlideActions } from './editor-slide-actions';
export type { TextActions } from './editor-text-actions';
export { createTextActions } from './editor-text-actions';
export type { TransitionActions, TransitionActionsDeps } from './editor-transition-actions';
export { createTransitionActions } from './editor-transition-actions';
export type {
	GestureController,
	GestureDeps,
	GestureKind,
	GestureTransform,
} from './editor-gestures';
export { createGestureController } from './editor-gestures';
export {
	isCornerHandle,
	lockResizeAspect,
	NUDGE_STEP,
	NUDGE_STEP_LARGE,
	nudgeDelta,
} from './editor-geometry';
export type { EditorKeyboardDeps } from './editor-keyboard';
export { createEditorKeydownHandler } from './editor-keyboard';
export type { ElementBoxPatch } from './editor-mutations';
export {
	appendElementOnSlide,
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	patchElementGeometry,
	removeElement,
	reorderElementOnSlide,
	updateAllSlides,
	updateElement,
	updateSlide,
	updateSlideNotes,
} from './editor-mutations';
export type { EditorOps, EditorOpsDeps } from './editor-operations';
export { createEditorOps } from './editor-operations';
export { resolveTopLevelElementId } from './element-hit';
export type { InlineEditorSession, OpenInlineEditorOptions } from './inline-text-editor';
export {
	canInlineEditElement,
	openInlineEditor,
	readEditableText,
	remapInlineText,
} from './inline-text-editor';
export type { OverlayBox, SelectionOverlay, SelectionOverlayHooks } from './selection-overlay';
export { createSelectionOverlay } from './selection-overlay';
export { buildInspectorState } from './inspector-state-builder';
