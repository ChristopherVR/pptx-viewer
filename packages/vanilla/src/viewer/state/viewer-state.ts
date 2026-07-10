import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from 'pptx-viewer-shared';

/** `zoom` is either an explicit scale factor (1 = 100%) or fit-to-viewport. */
export type ZoomLevel = number | 'fit';

/**
 * The vanilla viewer's reactive view state. Kept intentionally flat and small;
 * everything here is what the DOM render layer consumes.
 */
export interface ViewerState {
	/** Parsed slides (image/media URLs already patched in by the load pipeline). */
	slides: PptxSlide[];
	/** Slide canvas size in CSS pixels. */
	canvasSize: CanvasSize;
	/** Archive-path to displayable URL map for media + poster frames. */
	mediaDataUrls: Map<string, string>;
	/** Zero-based index of the visible slide. */
	currentSlide: number;
	/** Requested zoom (explicit factor or fit-to-viewport). */
	zoom: ZoomLevel;
	/** True while a load is in flight. */
	loading: boolean;
	/** Error message from the last failed load, or null. */
	error: string | null;
	/** True while presentation (fullscreen) mode is active. */
	presenting: boolean;
	/** True when editing interactions (select/move/resize/...) are enabled. */
	editable: boolean;
	/** Id of the selected element on the current slide, or null. */
	selectedElementId: string | null;
	/** True when the document has unsaved edits (cleared by a save). */
	dirty: boolean;
	/**
	 * True while a pointer gesture (drag/resize/rotate) is in flight. Thumbnail
	 * re-renders are deferred until the gesture ends.
	 */
	interactionActive: boolean;
	/**
	 * True when the speaker-notes panel body is expanded. Persists across slide
	 * navigation for the life of the viewer instance (in-memory only).
	 */
	notesExpanded: boolean;
}

export function createInitialViewerState(): ViewerState {
	return {
		slides: [],
		canvasSize: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
		mediaDataUrls: new Map(),
		currentSlide: 0,
		zoom: 'fit',
		loading: false,
		error: null,
		presenting: false,
		editable: false,
		selectedElementId: null,
		dirty: false,
		interactionActive: false,
		notesExpanded: false,
	};
}

/** Clamp a slide index into the valid range for the given slide count. */
export function clampSlideIndex(index: number, slideCount: number): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}
