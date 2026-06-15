/**
 * EditorStateService — signal-based editing state for the Angular viewer.
 *
 * The Angular counterpart of React's `useEditorOperations` / `useViewerState`
 * editing layer: it holds an editable copy of the slides, the current
 * selection, and an undo/redo history, and exposes element operations that
 * record a history snapshot before each mutation.
 *
 * Pure logic is delegated to `element-operations.ts` (immutable array
 * transforms) and `editor-history.ts` (generic snapshot stack); this service
 * only wires them to Angular signals. Provide it at the component level:
 * `@Component({ providers: [EditorStateService] })`.
 */

import { computed, Injectable, signal } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { EditorHistory } from './editor-history';
import {
	bringForward,
	bringToFront,
	deleteElementsByIds,
	duplicateElementById,
	moveElementBy,
	resizeElement,
	sendBackward,
	sendToBack,
	setElementPosition,
	updateElementById,
} from './element-operations';

/** Default nudge distance (px) for arrow-key moves. */
const NUDGE_STEP = 1;
/** Offset (px) applied to a duplicated element so it is visible. */
const DUPLICATE_OFFSET = 12;

@Injectable()
export class EditorStateService {
	private readonly history = new EditorHistory<readonly PptxSlide[]>();

	/** The editable slide deck (a clone of the loaded presentation). */
	readonly slides = signal<readonly PptxSlide[]>([]);
	/** Ids of the currently selected elements (on the active slide). */
	readonly selectedIds = signal<readonly string[]>([]);
	/** Whether the deck has unsaved edits. */
	readonly dirty = signal(false);

	readonly canUndo = signal(false);
	readonly canRedo = signal(false);
	readonly undoLabel = signal<string | undefined>(undefined);
	readonly redoLabel = signal<string | undefined>(undefined);

	readonly hasSelection = computed(() => this.selectedIds().length > 0);

	/** Replace the editable deck (clones the source); resets selection + history. */
	setSlides(slides: readonly PptxSlide[]): void {
		this.slides.set(this.clone(slides));
		this.selectedIds.set([]);
		this.history.clear();
		this.dirty.set(false);
		this.syncHistory();
	}

	/** Current editable slides as a fresh (cloned) array. */
	snapshot(): readonly PptxSlide[] {
		return this.clone(this.slides());
	}

	// ── Selection ───────────────────────────────────────────────────────────

	select(ids: readonly string[]): void {
		this.selectedIds.set([...ids]);
	}

	toggleSelect(id: string, additive: boolean): void {
		const current = this.selectedIds();
		if (!additive) {
			this.selectedIds.set(current.includes(id) && current.length === 1 ? [] : [id]);
			return;
		}
		this.selectedIds.set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
	}

	clearSelection(): void {
		this.selectedIds.set([]);
	}

	isSelected(id: string): boolean {
		return this.selectedIds().includes(id);
	}

	// ── Element operations (each records a history snapshot) ─────────────────

	moveSelectedBy(slideIndex: number, dx: number, dy: number): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		this.commit('Move', slideIndex, (els) =>
			ids.reduce<PptxElement[]>((acc, id) => moveElementBy(acc, id, dx, dy), [...els]),
		);
	}

	nudgeSelected(slideIndex: number, dirX: number, dirY: number): void {
		this.moveSelectedBy(slideIndex, dirX * NUDGE_STEP, dirY * NUDGE_STEP);
	}

	setPosition(slideIndex: number, id: string, x: number, y: number): void {
		this.commit('Move', slideIndex, (els) => setElementPosition(els, id, x, y));
	}

	resize(slideIndex: number, id: string, width: number, height: number): void {
		this.commit('Resize', slideIndex, (els) => resizeElement(els, id, width, height));
	}

	updateElement(slideIndex: number, id: string, patch: Partial<PptxElement>): void {
		this.commit('Edit', slideIndex, (els) => updateElementById(els, id, patch));
	}

	deleteSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		this.commit('Delete', slideIndex, (els) => deleteElementsByIds(els, ids));
		this.selectedIds.set([]);
	}

	duplicateSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		const newIds: string[] = [];
		this.commit('Duplicate', slideIndex, (els) =>
			ids.reduce<PptxElement[]>(
				(acc, id) => {
					const newId = this.newId();
					newIds.push(newId);
					return duplicateElementById(acc, id, newId, DUPLICATE_OFFSET);
				},
				[...els],
			),
		);
		this.selectedIds.set(newIds);
	}

	bringSelectedToFront(slideIndex: number): void {
		this.zOrder(slideIndex, 'Bring to front', bringToFront);
	}
	sendSelectedToBack(slideIndex: number): void {
		this.zOrder(slideIndex, 'Send to back', sendToBack);
	}
	bringSelectedForward(slideIndex: number): void {
		this.zOrder(slideIndex, 'Bring forward', bringForward);
	}
	sendSelectedBackward(slideIndex: number): void {
		this.zOrder(slideIndex, 'Send backward', sendBackward);
	}

	// ── Undo / redo ──────────────────────────────────────────────────────────

	undo(): void {
		const result = this.history.undo(this.clone(this.slides()));
		if (result) {
			this.slides.set(result.snapshot);
			this.dirty.set(true);
			this.selectedIds.set([]);
			this.syncHistory();
		}
	}

	redo(): void {
		const result = this.history.redo(this.clone(this.slides()));
		if (result) {
			this.slides.set(result.snapshot);
			this.dirty.set(true);
			this.selectedIds.set([]);
			this.syncHistory();
		}
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private zOrder(
		slideIndex: number,
		label: string,
		op: (els: readonly PptxElement[], id: string) => PptxElement[],
	): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		this.commit(label, slideIndex, (els) =>
			ids.reduce<PptxElement[]>((acc, id) => op(acc, id), [...els]),
		);
	}

	private commit(
		label: string,
		slideIndex: number,
		mutate: (elements: readonly PptxElement[]) => PptxElement[],
	): void {
		const slides = this.slides();
		const target = slides[slideIndex];
		if (!target) {
			return;
		}
		// Record the pre-mutation snapshot, then apply.
		this.history.record(this.clone(slides), label);
		this.slides.set(
			slides.map((slide, i) =>
				i === slideIndex ? { ...slide, elements: mutate(slide.elements) } : slide,
			),
		);
		this.dirty.set(true);
		this.syncHistory();
	}

	private syncHistory(): void {
		this.canUndo.set(this.history.canUndo);
		this.canRedo.set(this.history.canRedo);
		this.undoLabel.set(this.history.undoLabel);
		this.redoLabel.set(this.history.redoLabel);
	}

	private clone<T>(value: T): T {
		return structuredClone(value);
	}

	private newId(): string {
		const c = globalThis.crypto;
		if (c && typeof c.randomUUID === 'function') {
			return `el-${c.randomUUID()}`;
		}
		// Fallback id (no crypto): index-free uniqueness via a monotonic counter.
		this.idCounter += 1;
		return `el-${this.idCounter}`;
	}

	private idCounter = 0;
}
