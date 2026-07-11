export type { ApplyToSelected } from './editor-apply-to-selected';
export { createApplyToSelected } from './editor-apply-to-selected';
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
export type { ClipboardActions, ClipboardActionsDeps } from './editor-clipboard-actions';
export { createClipboardActions } from './editor-clipboard-actions';
export type { EditorController, EditorControllerDeps } from './editor-controller';
export { createEditorController } from './editor-controller';
export type { EditActions, EditActionsDeps, GeometryPatch } from './editor-edit-ops';
export { createEditActions } from './editor-edit-ops';
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
	updateElement,
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
