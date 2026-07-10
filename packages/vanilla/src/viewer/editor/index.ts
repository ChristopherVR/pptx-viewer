export type { EditorController, EditorControllerDeps } from './editor-controller';
export { createEditorController } from './editor-controller';
export type { EditActions, EditActionsDeps, GeometryPatch } from './editor-edit-ops';
export { createEditActions } from './editor-edit-ops';
export type { TextFormatState, TextToggleKey } from './editor-format-mutations';
export {
	adjustFontSize,
	canFormatShape,
	canFormatText,
	patchShapeStyle,
	readTextFormatState,
	setFontSize,
	setHighlightColor,
	setTextColor,
	toggleTextProp,
} from './editor-format-mutations';
export type { InsertKind } from './editor-insert';
export { buildInsertElement, centerOnCanvas, pickImageElement } from './editor-insert';
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
