export type { EditorControllerDeps } from './editor-controller.svelte';
export { EditorController } from './editor-controller.svelte';
export type { EditorStateDeps } from './editor-state.svelte';
export { EditorState } from './editor-state.svelte';
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
export {
	appendElement,
	newElementId,
	newImageElement,
	newShapeElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
export type { TextFlag } from './editor-format-mutations';
export {
	adjustFontSizePatch,
	highlightColorOf,
	setFillColorPatch,
	setFontSizePatch,
	setHighlightColorPatch,
	setStrokeColorPatch,
	setStrokeWidthPatch,
	setTextColorPatch,
	strokeWidthOf,
	toggleTextFlagPatch,
} from './editor-format-mutations';
export type { ElementBoxPatch } from './editor-mutations';
export {
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	mapSlideElements,
	patchElementGeometry,
	removeElement,
	updateElement,
	updateSlideNotes,
} from './editor-mutations';
export type { ZOrderDirection } from './editor-zorder';
export { reorderElement } from './editor-zorder';
export { resolveTopLevelElementId } from './element-hit';
export type { InlineTextSurface } from './inline-text';
export {
	canInlineEditElement,
	readEditableText,
	remapInlineText,
	resolveInlineSurface,
} from './inline-text';
export type { OverlayBox } from './types';
