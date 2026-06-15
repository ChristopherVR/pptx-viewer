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

import { computeAlign, computeDistribute } from './align-distribute';
import type { AlignMode, DistributeMode } from './align-distribute';
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

	// ── Interactive transform (drag / resize: one history entry per gesture) ──

	/** Record a single history snapshot at the start of a drag/resize gesture. */
	beginTransform(label: string): void {
		this.history.record(this.clone(this.slides()), label);
		this.dirty.set(true);
		this.syncHistory();
	}

	/**
	 * Apply a live transform during a gesture WITHOUT recording history (the
	 * gesture's snapshot was taken in {@link beginTransform}). Accepts any subset
	 * of x/y/width/height.
	 */
	applyTransform(
		slideIndex: number,
		id: string,
		box: { x?: number; y?: number; width?: number; height?: number; rotation?: number },
	): void {
		const slides = this.slides();
		if (!slides[slideIndex]) {
			return;
		}
		this.slides.set(
			slides.map((slide, i) =>
				i === slideIndex
					? {
							...slide,
							elements: updateElementById(slide.elements, id, box as Partial<PptxElement>),
						}
					: slide,
			),
		);
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

	// ── Align / distribute (multi-selection) ─────────────────────────────────

	/** Align the selected elements within their group bounds (one history entry). */
	alignSelected(slideIndex: number, mode: AlignMode): void {
		this.applyPositionMap(slideIndex, `Align ${mode}`, (boxes) => computeAlign(boxes, mode));
	}

	/** Evenly distribute the selected elements along an axis (one history entry). */
	distributeSelected(slideIndex: number, mode: DistributeMode): void {
		this.applyPositionMap(slideIndex, 'Distribute', (boxes) => computeDistribute(boxes, mode));
	}

	private applyPositionMap(
		slideIndex: number,
		label: string,
		compute: (
			boxes: { id: string; x: number; y: number; width: number; height: number }[],
		) => Map<string, { x?: number; y?: number }>,
	): void {
		const ids = new Set(this.selectedIds());
		const slide = this.slides()[slideIndex];
		if (!slide) {
			return;
		}
		const boxes = slide.elements
			.filter((el) => ids.has(el.id))
			.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));
		const map = compute(boxes);
		if (map.size === 0) {
			return;
		}
		this.history.record(this.clone(this.slides()), label);
		this.slides.set(
			this.slides().map((s, i) =>
				i === slideIndex
					? {
							...s,
							elements: s.elements.map((el) => {
								const pos = map.get(el.id);
								return pos ? { ...el, x: pos.x ?? el.x, y: pos.y ?? el.y } : el;
							}),
						}
					: s,
			),
		);
		this.dirty.set(true);
		this.syncHistory();
	}

	// ── Clipboard ──────────────────────────────────────────────────────────────

	private clipboard: PptxElement[] = [];
	/** Whether the clipboard holds copied elements (enables paste). */
	readonly hasClipboard = signal(false);

	/** Copy the selected elements to the in-memory clipboard. */
	copySelected(slideIndex: number): void {
		const ids = new Set(this.selectedIds());
		const slide = this.slides()[slideIndex];
		if (!slide) {
			return;
		}
		const picked = slide.elements.filter((el) => ids.has(el.id));
		if (picked.length === 0) {
			return;
		}
		this.clipboard = this.clone(picked);
		this.hasClipboard.set(true);
	}

	/** Copy then delete the selected elements. */
	cutSelected(slideIndex: number): void {
		this.copySelected(slideIndex);
		this.deleteSelected(slideIndex);
	}

	/** Paste clipboard elements onto a slide (offset + fresh ids) and select them. */
	paste(slideIndex: number): void {
		if (this.clipboard.length === 0) {
			return;
		}
		const slides = this.slides();
		if (!slides[slideIndex]) {
			return;
		}
		this.history.record(this.clone(slides), 'Paste');
		const newIds: string[] = [];
		const additions = this.clipboard.map((el) => {
			const id = this.newId();
			newIds.push(id);
			return { ...this.clone(el), id, x: el.x + 12, y: el.y + 12 };
		});
		this.slides.set(
			slides.map((slide, i) =>
				i === slideIndex ? { ...slide, elements: [...slide.elements, ...additions] } : slide,
			),
		);
		this.selectedIds.set(newIds);
		this.dirty.set(true);
		this.syncHistory();
	}

	// ── Element insertion ────────────────────────────────────────────────────

	/** Append a new element to a slide (records history) and select it. */
	addElement(slideIndex: number, element: PptxElement): void {
		const slides = this.slides();
		if (!slides[slideIndex]) {
			return;
		}
		const withId: PptxElement = { ...element, id: element.id || this.newId() };
		this.history.record(this.clone(slides), 'Insert');
		this.slides.set(
			slides.map((slide, i) =>
				i === slideIndex ? { ...slide, elements: [...slide.elements, withId] } : slide,
			),
		);
		this.selectedIds.set([withId.id]);
		this.dirty.set(true);
		this.syncHistory();
	}

	// ── Slide operations ─────────────────────────────────────────────────────

	/** Insert a blank slide after `afterIndex` (records history). */
	addSlide(afterIndex: number): void {
		const slides = this.slides();
		this.history.record(this.clone(slides), 'Add slide');
		const id = this.newId();
		const blank = { id, rId: id, slideNumber: 0, elements: [] } as PptxSlide;
		const next = [...slides];
		next.splice(Math.min(afterIndex + 1, next.length), 0, blank);
		this.slides.set(this.renumber(next));
		this.selectedIds.set([]);
		this.dirty.set(true);
		this.syncHistory();
	}

	/** Delete a slide (keeps at least one; records history). */
	deleteSlide(index: number): void {
		const slides = this.slides();
		if (slides.length <= 1 || !slides[index]) {
			return;
		}
		this.history.record(this.clone(slides), 'Delete slide');
		this.slides.set(this.renumber(slides.filter((_, i) => i !== index)));
		this.selectedIds.set([]);
		this.dirty.set(true);
		this.syncHistory();
	}

	/** Duplicate a slide, inserting the copy after it (records history). */
	duplicateSlide(index: number): void {
		const slides = this.slides();
		if (!slides[index]) {
			return;
		}
		this.history.record(this.clone(slides), 'Duplicate slide');
		const id = this.newId();
		const copy: PptxSlide = { ...this.clone(slides[index]), id, rId: id };
		const next = [...slides];
		next.splice(index + 1, 0, copy);
		this.slides.set(this.renumber(next));
		this.dirty.set(true);
		this.syncHistory();
	}

	/** Reorder a slide from `from` to `to` (records history). */
	moveSlide(from: number, to: number): void {
		const slides = this.slides();
		if (from === to || !slides[from] || to < 0 || to >= slides.length) {
			return;
		}
		this.history.record(this.clone(slides), 'Move slide');
		const next = [...slides];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		this.slides.set(this.renumber(next));
		this.dirty.set(true);
		this.syncHistory();
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private renumber(slides: readonly PptxSlide[]): PptxSlide[] {
		return slides.map((slide, i) => ({ ...slide, slideNumber: i + 1 }));
	}

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
