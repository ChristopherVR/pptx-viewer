export type { EditorControllerDeps } from './editor-controller.svelte';
export { EditorController } from './editor-controller.svelte';
export type { EditorStateDeps } from './editor-state.svelte';
export { EditorState } from './editor-state.svelte';
export { EditorAnimationController } from './editor-animation-controller';
export { EditorArrangeController } from './editor-arrange-controller';
export {
	alignSelectedOnSlide,
	distributeSelectedOnSlide,
	flipSelectedOnSlide,
	groupSelectedOnSlide,
	ungroupOnSlide,
} from './editor-arrange-ops';
export { EditorBackgroundController } from './editor-background-controller';
export { copyElementToClipboard, pasteClipboardElement } from './editor-clipboard';
export { EditorClipboardController } from './editor-clipboard-controller';
export { EditorSlidesController } from './editor-slides-controller';
export { EditorTransitionController } from './editor-transition-controller';
export { deleteSlideAt, duplicateSlideAt, insertBlankSlideAfter } from './editor-slide-ops';
export type { FindReplaceDeps } from './editor-find-replace.svelte';
export { FindReplaceState } from './editor-find-replace.svelte';
export {
	adjustIndentPatch,
	setAlignPatch,
	setLineSpacingPatch,
	toggleListTypePatch,
} from './editor-paragraph-mutations';
export {
	changeCasePatch,
	clearFormattingPatch,
	setCharacterSpacingPatch,
	setFontFamilyPatch,
	toggleStrikethroughPatch,
} from './editor-text-extra-mutations';
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
	centerOnCanvas,
	newElementId,
	newImageElement,
	newPresetShapeElement,
	newShapeElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
export { buildChartInsertElement } from './editor-insert-chart';
export { buildEquationInsertElement } from './editor-insert-equation';
export { buildActionButtonInsertElement } from './editor-insert-action-button';
export type { FieldInsertContext } from './editor-insert-field';
export { buildFieldInsertElement, resolveFieldDisplayText } from './editor-insert-field';
export { buildMediaInsertElement, mediaTypeOfFile } from './editor-insert-media';
export { buildSmartArtInsertElement } from './editor-insert-smart-art';
export type { TextFlag } from './editor-format-mutations';
export {
	adjustFontSizePatch,
	fillOpacityOf,
	highlightColorOf,
	setFillColorPatch,
	setFillOpacityPatch,
	setFontSizePatch,
	setHighlightColorPatch,
	setSolidFillPatch,
	setStrokeColorPatch,
	setStrokeOpacityPatch,
	setStrokeWidthPatch,
	setTextColorPatch,
	strokeOpacityOf,
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
	updateAllSlides,
	updateElement,
	updateSlide,
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
