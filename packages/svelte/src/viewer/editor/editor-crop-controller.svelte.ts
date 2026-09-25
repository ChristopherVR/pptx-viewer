import type { PptxElement } from 'pptx-viewer-core';
import type { CropElementUpdate, CropSession } from 'pptx-viewer-shared';
import {
	canCropElement,
	cancelCropUpdate,
	cropFrameOf,
	cropModeKeyAction,
	cropSessionChanged,
	readCropInsets,
	startCropSession,
} from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/** The attribute the crop overlay's root carries (pointer-down inside it is crop mode's own). */
export const CROP_OVERLAY_ATTR = 'data-pptx-crop-overlay';

/** True when `target` sits inside the crop-mode overlay. */
export function isInsideCropOverlay(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(`[${CROP_OVERLAY_ATTR}]`) !== null;
}

/**
 * On-canvas picture crop mode (Picture Format > Crop), driven by the shared
 * `picture-crop` lifecycle:
 *
 * - {@link enter}: the ribbon Crop button or the picture context menu's Crop.
 * - {@link preview}: handle and pan drags write the picture LIVE, with no
 *   history, so the normal renderer shows the new `a:srcRect` as it changes.
 * - {@link commit}: Enter, a click outside, a selection or slide change, or
 *   Crop again. Rewinds the picture to the entry snapshot, records history
 *   there, then re-applies the result: exactly ONE undo step, whose undo
 *   restores the pre-crop picture (none when nothing changed).
 * - {@link cancel}: Escape writes the snapshot back and leaves no undo step.
 */
export class EditorCropController {
	readonly #editor: EditorState;
	session = $state.raw<CropSession | null>(null);
	#slideIndex = -1;
	#latest: PptxElement | null = null;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	get active(): boolean {
		return this.session !== null;
	}

	/** The picture being cropped, as it is right now. */
	get element(): PptxElement | undefined {
		const id = this.session?.elementId;
		return id ? this.#editor.elementById(id) : undefined;
	}

	/** Editable, exactly one element selected, and it is a croppable picture. */
	get canCrop(): boolean {
		return (
			this.#editor.editable &&
			this.#editor.selection.size === 1 &&
			canCropElement(this.#editor.selectedElement)
		);
	}

	/** Enter crop mode on the selected picture. False when it cannot be cropped. */
	enter(): boolean {
		if (this.session) {
			return true;
		}
		if (!this.canCrop) {
			return false;
		}
		const element = this.#editor.selectedElement;
		const session = startCropSession(element);
		if (!session || !element) {
			return false;
		}
		this.#slideIndex = this.#editor.currentSlideIndex;
		this.#latest = element;
		this.session = session;
		return true;
	}

	/** The ribbon Crop toggle: enter, or commit when already cropping. */
	toggle(): void {
		if (this.session) {
			this.commit();
		} else {
			this.enter();
		}
	}

	/** Apply a live crop update onto the picture without recording history. */
	preview(update: CropElementUpdate): void {
		const session = this.session;
		if (!session) {
			return;
		}
		const next = this.#write(session.elementId, update);
		if (next) {
			this.#latest = next;
		}
	}

	/** End the session, leaving one undo step when the picture changed. */
	commit(): void {
		const session = this.session;
		const latest = this.#latest;
		this.#end();
		if (!session || !latest || !cropSessionChanged(session, latest)) {
			return;
		}
		const result: CropElementUpdate = { ...cropFrameOf(latest), ...readCropInsets(latest) };
		if (!this.#write(session.elementId, cancelCropUpdate(session))) {
			return;
		}
		this.#editor.pushHistory();
		this.#write(session.elementId, result);
		this.#editor.commitChange();
	}

	/** End the session and restore the picture as it was on entry, with no undo step. */
	cancel(): void {
		const session = this.session;
		const latest = this.#latest;
		this.#end();
		if (session && latest && cropSessionChanged(session, latest)) {
			this.#write(session.elementId, cancelCropUpdate(session));
		}
	}

	/**
	 * Enter commits and Escape cancels while cropping; the key is consumed so
	 * the editor's own Enter/Escape action does not also run. True when handled.
	 */
	handleKey(event: KeyboardEvent): boolean {
		if (!this.session) {
			return false;
		}
		const action = cropModeKeyAction(event.key);
		if (!action) {
			return false;
		}
		event.preventDefault();
		event.stopPropagation();
		if (action === 'commit') {
			this.commit();
		} else {
			this.cancel();
		}
		return true;
	}

	/** Commit when the selection moved off the picture or the slide changed. */
	syncContext(selectedIds: readonly string[], slideIndex: number): void {
		const session = this.session;
		if (!session) {
			return;
		}
		const sameSelection = selectedIds.length === 1 && selectedIds[0] === session.elementId;
		if (!sameSelection || slideIndex !== this.#slideIndex) {
			this.commit();
		}
	}

	/**
	 * A one-click crop (aspect ratio, Fill, Fit) on the selected picture. Inside
	 * a session it joins the session's single undo step; otherwise it is one
	 * undoable update of its own.
	 */
	applyOnce(update: CropElementUpdate): void {
		const element = this.#editor.selectedElement;
		if (!this.#editor.editable || !element || !canCropElement(element)) {
			return;
		}
		if (this.session?.elementId === element.id) {
			this.preview(update);
			return;
		}
		this.#editor.applyElementPatch(element.id, update as Partial<PptxElement>);
	}

	#end(): void {
		this.session = null;
		this.#latest = null;
		this.#slideIndex = -1;
	}

	/**
	 * Patch the picture wherever it lives: the active layer, or (after a slide
	 * change) the slide that still holds it. Returns the patched element.
	 */
	#write(id: string, update: CropElementUpdate): PptxElement | null {
		const patch = (element: PptxElement): PptxElement => ({ ...element, ...update }) as PptxElement;
		const active = this.#editor.activeElements;
		const current = active.find((element) => element.id === id);
		if (current) {
			this.#editor.replaceActiveElements(
				active.map((element) => (element.id === id ? patch(element) : element)),
			);
			return patch(current);
		}
		const hit: { element: PptxElement | null } = { element: null };
		const slides = this.#editor.slides.map((slide) => {
			if (hit.element || !slide.elements.some((element) => element.id === id)) {
				return slide;
			}
			return {
				...slide,
				elements: slide.elements.map((element) => {
					if (element.id !== id) {
						return element;
					}
					hit.element = patch(element);
					return hit.element;
				}),
			};
		});
		if (hit.element) {
			this.#editor.slides = slides;
		}
		return hit.element;
	}
}
