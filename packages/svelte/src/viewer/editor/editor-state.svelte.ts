import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { EditorHistory } from 'pptx-viewer-shared';

import type { ElementBoxPatch } from './editor-mutations';
import {
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	patchElementGeometry,
	removeElement,
	updateElement,
	updateSlideNotes,
} from './editor-mutations';
import { remapInlineText } from './inline-text';

/**
 * History-tracked editing state for the Svelte viewer (runes class): the
 * reactive counterpart of the vanilla binding's `editor-operations` + store,
 * built on the shared `EditorHistory` stack and the pure `editor-mutations`
 * helpers.
 *
 * `slides` is the single editable source of truth (seeded from the loaded
 * presentation via {@link setSlides}); the viewer renders it, so every commit
 * flows straight to the stage, thumbnails, and notes panel. Every operation
 * follows the push-before-mutate pattern: snapshot the current (cloned)
 * slides, apply the immutable mutation, mark dirty, and fire `onChange`.
 */

const MAX_HISTORY_ENTRIES = 100;
/** Consecutive arrow-key nudges within this window share one history entry. */
const NUDGE_COALESCE_MS = 800;

export interface EditorStateDeps {
	/** Active slide index (0-based); read live so it always reflects the viewer. */
	getCurrent(): number;
	/** The live `PptxHandler` for the loaded file, for `save()`. */
	getHandler(): PptxHandler | null;
	/** Host `onchange` callback: fired after every committed mutation. */
	onChange?: () => void;
}

export class EditorState {
	/** The editable slide array (single source of truth for the stage). */
	slides = $state.raw<PptxSlide[]>([]);
	/** Currently-selected top-level element id, or null. */
	selectedElementId = $state<string | null>(null);
	/** Whether editing is enabled (host `editable` prop). */
	editable = $state(false);
	/** True once any mutation has been committed since the last load/save. */
	dirty = $state(false);
	/** True while a pointer gesture (drag/resize/rotate) is in progress. */
	interactionActive = $state(false);

	#history = new EditorHistory<PptxSlide[]>({ maxDepth: MAX_HISTORY_ENTRIES });
	#canUndo = $state(false);
	#canRedo = $state(false);
	#lastNudgeAt = 0;
	readonly #deps: EditorStateDeps;

	constructor(deps: EditorStateDeps) {
		this.#deps = deps;
	}

	/** Whether at least one undo step is available (reactive). */
	get canUndo(): boolean {
		return this.#canUndo;
	}

	/** Whether at least one redo step is available (reactive). */
	get canRedo(): boolean {
		return this.#canRedo;
	}

	/** The selected element resolved against the current slide (or undefined). */
	get selectedElement(): PptxElement | undefined {
		return this.selectedElementId
			? findSlideElement(this.slides, this.#deps.getCurrent(), this.selectedElementId)
			: undefined;
	}

	#syncHistoryFlags(): void {
		this.#canUndo = this.#history.canUndo;
		this.#canRedo = this.#history.canRedo;
	}

	/** Seed the editable slides from a freshly-loaded presentation. */
	setSlides(slides: PptxSlide[]): void {
		this.slides = slides;
		this.selectedElementId = null;
		this.dirty = false;
		this.interactionActive = false;
		this.#history.clear();
		this.#lastNudgeAt = 0;
		this.#syncHistoryFlags();
	}

	/** Drop selection/dirty/interaction + history (new content or teardown). */
	reset(): void {
		this.selectedElementId = null;
		this.dirty = false;
		this.interactionActive = false;
		this.#history.clear();
		this.#lastNudgeAt = 0;
		this.#syncHistoryFlags();
	}

	select(id: string | null): void {
		this.selectedElementId = id;
	}

	/** Snapshot the current slides onto the undo stack (before a mutation). */
	pushHistory(): void {
		this.#history.record(cloneSlides(this.slides), '');
		this.#lastNudgeAt = 0;
		this.#syncHistoryFlags();
	}

	/** Mark dirty + notify host after a committed mutation. */
	commitChange(): void {
		this.dirty = true;
		this.#syncHistoryFlags();
		this.#deps.onChange?.();
	}

	/** Patch geometry WITHOUT history (live gesture preview frames). */
	patchGeometry(id: string, box: ElementBoxPatch): void {
		this.slides = patchElementGeometry(this.slides, this.#deps.getCurrent(), id, box);
	}

	#restore(snapshot: PptxSlide[] | undefined): void {
		if (!snapshot) {
			return;
		}
		this.slides = cloneSlides(snapshot);
		this.interactionActive = false;
		this.commitChange();
	}

	deleteSelected(): void {
		const id = this.selectedElementId;
		if (!this.editable || !id || !this.selectedElement) {
			return;
		}
		this.pushHistory();
		this.slides = removeElement(this.slides, this.#deps.getCurrent(), id);
		this.selectedElementId = null;
		this.commitChange();
	}

	duplicateSelected(): string | null {
		const id = this.selectedElementId;
		if (!this.editable || !id) {
			return null;
		}
		const result = duplicateElementOnSlide(this.slides, this.#deps.getCurrent(), id);
		if (!result) {
			return null;
		}
		this.pushHistory();
		this.slides = result.slides;
		this.selectedElementId = result.newId;
		this.commitChange();
		return result.newId;
	}

	nudgeSelected(dx: number, dy: number): void {
		const el = this.selectedElement;
		const id = this.selectedElementId;
		if (!el || !id) {
			return;
		}
		const now = Date.now();
		if (now - this.#lastNudgeAt > NUDGE_COALESCE_MS) {
			this.pushHistory();
		}
		this.#lastNudgeAt = now;
		this.slides = patchElementGeometry(this.slides, this.#deps.getCurrent(), id, {
			x: el.x + dx,
			y: el.y + dy,
			width: el.width,
			height: el.height,
			rotation: el.rotation ?? 0,
		});
		this.commitChange();
	}

	commitInlineText(id: string, text: string): void {
		const current = this.#deps.getCurrent();
		const target = findSlideElement(this.slides, current, id);
		if (!target) {
			return;
		}
		this.pushHistory();
		this.slides = updateElement(this.slides, current, id, remapInlineText(target, text));
		this.commitChange();
	}

	commitNotes(notes: string): void {
		const current = this.#deps.getCurrent();
		const slide = this.slides[current];
		if (!this.editable || !slide || slide.notes === notes) {
			return;
		}
		this.pushHistory();
		this.slides = updateSlideNotes(this.slides, current, notes);
		this.commitChange();
	}

	undo(): void {
		this.#restore(this.#history.undo(cloneSlides(this.slides))?.snapshot);
	}

	redo(): void {
		this.#restore(this.#history.redo(cloneSlides(this.slides))?.snapshot);
	}

	async save(): Promise<Uint8Array> {
		const handler = this.#deps.getHandler();
		if (!handler) {
			throw new Error('No presentation is loaded.');
		}
		const bytes = await handler.save(this.slides);
		this.dirty = false;
		return bytes;
	}
}
