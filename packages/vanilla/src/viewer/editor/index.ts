export type { EditorController, EditorControllerDeps } from './editor-controller';
export { createEditorController } from './editor-controller';
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
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	patchElementGeometry,
	removeElement,
	updateElement,
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
