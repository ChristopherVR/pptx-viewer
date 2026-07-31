/**
 * EditorStateService: signal-based editing state for the Angular viewer.
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

import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { cloneElement, cloneSlide, cloneTemplateElementsBySlideId } from 'pptx-viewer-core';
import type { PptxElement, PptxHeaderFooter, PptxSection, PptxSlide } from 'pptx-viewer-core';

import { groupSlidesBySection, isTemplateElement, isTemplateElementId } from '../internal/shared';
import { translationsEn } from '../internal/shared-src/i18n';
import { computeAlign, computeDistribute } from './align-distribute';
import type { AlignMode, DistributeMode } from './align-distribute';
import { EditorHistory } from './editor-history';
import { createEditorSectionOperations } from './editor-section-operations';
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
import { groupElements, ungroupElements } from './group-ops';
import { LoadContentService } from './load-content.service';
import { partitionSlides } from './template-mode';
import type { TemplateElementsBySlideId } from './template-mode';

/** Default nudge distance (px) for arrow-key moves. */
const NUDGE_STEP = 1;
/** Offset (px) applied to a duplicated element so it is visible. */
const DUPLICATE_OFFSET = 12;

/**
 * A complete editor snapshot recorded on the undo/redo stack: the editable
 * (template-free) deck plus the separated template store, so undoing a template
 * edit restores the template store alongside the slides.
 */
interface EditorSnapshot {
	slides: readonly PptxSlide[];
	templateElementsBySlideId: TemplateElementsBySlideId;
	sections: readonly PptxSection[];
	headerFooter: PptxHeaderFooter;
}

@Injectable()
export class EditorStateService {
	private readonly loader: LoadContentService | null = (() => {
		try {
			return inject(LoadContentService);
		} catch {
			return null;
		}
	})();
	/**
	 * Optional: `inject()` requires an active Angular injection context, which
	 * plain `new EditorStateService()` calls (used throughout this service's
	 * unit tests, deliberately bypassing TestBed for speed) do not provide.
	 * Falls back to raw dictionary keys via {@link t} when constructed outside
	 * DI, which is fine since only undo/redo action labels use it.
	 */
	private readonly translate: TranslateService | null = (() => {
		try {
			return inject(TranslateService);
		} catch {
			return null;
		}
	})();
	private readonly history = new EditorHistory<EditorSnapshot>();

	/**
	 * Resolve a translation. Outside an injection context (see {@link translate})
	 * falls back to the canonical English dictionary text, then the raw key.
	 */
	private t(key: string, params?: Record<string, unknown>): string {
		if (this.translate) {
			return this.translate.instant(key, params);
		}
		const fallback = translationsEn[key];
		if (fallback === undefined) {
			return key;
		}
		return params
			? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(params[name] ?? ''))
			: fallback;
	}

	/** The editable slide deck (a clone of the loaded presentation). */
	readonly slides = signal<readonly PptxSlide[]>([]);
	readonly sections = signal<readonly PptxSection[]>([]);
	readonly headerFooter = signal<PptxHeaderFooter>({});
	readonly sectionGroups = computed(() => groupSlidesBySection(this.sections(), this.slides()));
	readonly sectionOps = createEditorSectionOperations({
		sections: () => this.sections(),
		slides: () => this.slides(),
		commit: (sections, slides) => this.commitSections(sections, slides),
	});
	/** Ids of the currently selected elements (on the active slide). */
	readonly selectedIds = signal<readonly string[]>([]);
	/** Whether the deck has unsaved edits. */
	readonly dirty = signal(false);
	/**
	 * When true, inherited master/layout (template) elements become interactive:
	 * selectable, draggable, deletable, and editable. When false (default) they
	 * render but are inert, so normal slide editing never disturbs the template.
	 *
	 * Note: a template element is shared by every slide inheriting the same
	 * layout/master, so editing one updates the shared part for all of them.
	 */
	readonly editTemplateMode = signal(false);
	/**
	 * Inherited master/layout (template) elements, separated out of every slide's
	 * own elements at load time and keyed by slide id. They render as a dedicated
	 * layer BEHIND the slide and are only mutated while {@link editTemplateMode} is
	 * on; {@link buildSaveSlides} re-merges them for serialization.
	 */
	readonly templateElementsBySlideId = signal<TemplateElementsBySlideId>({});

	readonly canUndo = signal(false);
	readonly canRedo = signal(false);
	readonly undoLabel = signal<string | undefined>(undefined);
	readonly redoLabel = signal<string | undefined>(undefined);

	readonly hasSelection = computed(() => this.selectedIds().length > 0);

	/**
	 * Replace the editable deck (clones the source); resets selection + history.
	 *
	 * Inherited template (master/layout) elements are PARTITIONED out of each
	 * slide here: the editable deck keeps only its own elements while the template
	 * elements move into {@link templateElementsBySlideId}, rendered as a separate
	 * layer and re-merged on save.
	 */
	setSlides(
		slides: readonly PptxSlide[],
		sections: readonly PptxSection[] = [],
		headerFooter: PptxHeaderFooter = this.loader?.headerFooter() ?? {},
	): void {
		const partitioned = partitionSlides(slides.map(cloneSlide));
		this.slides.set(partitioned.slides);
		this.templateElementsBySlideId.set(partitioned.templateElementsBySlideId);
		this.sections.set(structuredClone(sections));
		this.headerFooter.set(structuredClone(headerFooter));
		this.selectedIds.set([]);
		this.history.clear();
		this.dirty.set(false);
		this.syncHistory();
	}

	/** Current editable (template-free) slides as a fresh (cloned) array. */
	snapshot(): readonly PptxSlide[] {
		return this.slides().map(cloneSlide);
	}

	/**
	 * Replace the whole deck with pre-computed slides (e.g. a find/replace
	 * result) as a single undoable history entry. Unlike {@link setSlides} this
	 * preserves history and selection.
	 */
	applyReplacement(
		newSlides: readonly PptxSlide[],
		label = this.t('pptx.undoAction.replace'),
	): void {
		this.history.record(this.captureSnapshot(), label);
		this.slides.set(newSlides.map(cloneSlide));
		this.dirty.set(true);
		this.syncHistory();
	}

	/**
	 * Apply a remote collaborator's slide set (already template-free, as broadcast
	 * over the CRDT) to the editable deck. Selection, history, and this peer's own
	 * separated template store are left untouched; remote edits are not local undo
	 * steps.
	 */
	applyRemoteSlides(slides: readonly PptxSlide[]): void {
		this.slides.set(slides.map(cloneSlide));
		this.dirty.set(true);
	}

	// ── Snapshot (deck + template store) ─────────────────────────────────────

	/** Capture the current deck + template store as one undo/redo snapshot. */
	private captureSnapshot(): EditorSnapshot {
		return {
			slides: this.slides().map(cloneSlide),
			templateElementsBySlideId: cloneTemplateElementsBySlideId(this.templateElementsBySlideId()),
			sections: structuredClone(this.sections()),
			headerFooter: structuredClone(this.headerFooter()),
		};
	}

	/** Restore both the deck and the template store from a snapshot. */
	private restoreSnapshot(snapshot: EditorSnapshot): void {
		this.slides.set(snapshot.slides);
		this.templateElementsBySlideId.set(snapshot.templateElementsBySlideId);
		this.sections.set(snapshot.sections);
		this.headerFooter.set(snapshot.headerFooter);
		this.loader?.headerFooter.set(structuredClone(snapshot.headerFooter));
	}

	/** Replace presentation-level header/footer settings as one undoable edit. */
	updateHeaderFooter(next: PptxHeaderFooter): void {
		this.history.record(this.captureSnapshot(), this.t('pptx.headerFooter.title'));
		const value = structuredClone(next);
		this.headerFooter.set(value);
		this.loader?.headerFooter.set(structuredClone(value));
		this.dirty.set(true);
		this.syncHistory();
	}

	/** The template (master/layout) elements separated out of a slide, by id. */
	private templatesForSlide(slideId: string): readonly PptxElement[] {
		return this.templateElementsBySlideId()[slideId] ?? [];
	}

	/** Replace a slide's template-element list (drops the entry when empty). */
	private writeTemplatesForSlide(slideId: string, elements: readonly PptxElement[]): void {
		const next: TemplateElementsBySlideId = { ...this.templateElementsBySlideId() };
		if (elements.length > 0) {
			next[slideId] = [...elements];
		} else {
			delete next[slideId];
		}
		this.templateElementsBySlideId.set(next);
	}

	/** Toggle whether inherited template (master/layout) elements are editable. */
	setEditTemplateMode(mode: boolean): void {
		this.editTemplateMode.set(mode);
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

	/** Select every element on a slide. */
	selectAll(slideIndex: number): void {
		const slide = this.slides()[slideIndex];
		if (slide) {
			this.selectedIds.set(slide.elements.map((el) => el.id));
		}
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
		this.commit(this.t('pptx.undoAction.move'), slideIndex, (els) =>
			ids.reduce<PptxElement[]>((acc, id) => moveElementBy(acc, id, dx, dy), [...els]),
		);
	}

	nudgeSelected(slideIndex: number, dirX: number, dirY: number): void {
		this.moveSelectedBy(slideIndex, dirX * NUDGE_STEP, dirY * NUDGE_STEP);
	}

	setPosition(slideIndex: number, id: string, x: number, y: number): void {
		this.commit(this.t('pptx.undoAction.move'), slideIndex, (els) =>
			setElementPosition(els, id, x, y),
		);
	}

	resize(slideIndex: number, id: string, width: number, height: number): void {
		this.commit(this.t('pptx.undoAction.resize'), slideIndex, (els) =>
			resizeElement(els, id, width, height),
		);
	}

	updateElement(slideIndex: number, id: string, patch: Partial<PptxElement>): void {
		this.commit(this.t('pptx.undoAction.edit'), slideIndex, (els) =>
			updateElementById(els, id, patch),
		);
	}

	deleteSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		this.commit(this.t('pptx.undoAction.delete'), slideIndex, (els) =>
			deleteElementsByIds(els, ids),
		);
		this.selectedIds.set([]);
	}

	duplicateSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length === 0) {
			return;
		}
		const newIds: string[] = [];
		this.commit(this.t('pptx.undoAction.duplicate'), slideIndex, (els) =>
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
		this.zOrder(slideIndex, this.t('pptx.undoAction.bringToFront'), bringToFront);
	}
	sendSelectedToBack(slideIndex: number): void {
		this.zOrder(slideIndex, this.t('pptx.undoAction.sendToBack'), sendToBack);
	}
	bringSelectedForward(slideIndex: number): void {
		this.zOrder(slideIndex, this.t('pptx.undoAction.bringForward'), bringForward);
	}
	sendSelectedBackward(slideIndex: number): void {
		this.zOrder(slideIndex, this.t('pptx.undoAction.sendBackward'), sendBackward);
	}

	// ── Interactive transform (drag / resize: one history entry per gesture) ──

	/** Record a single history snapshot at the start of a drag/resize gesture. */
	beginTransform(label: string): void {
		this.history.record(this.captureSnapshot(), label);
		this.dirty.set(true);
		this.syncHistory();
	}

	/**
	 * Apply a live transform during a gesture WITHOUT recording history (the
	 * gesture's snapshot was taken in {@link beginTransform}). Accepts any subset
	 * of x/y/width/height. Routes by id: template (master/layout) elements mutate
	 * the template store, normal elements mutate the slide.
	 */
	applyTransform(
		slideIndex: number,
		id: string,
		box: { x?: number; y?: number; width?: number; height?: number; rotation?: number },
	): void {
		const slides = this.slides();
		const target = slides[slideIndex];
		if (!target) {
			return;
		}
		if (isTemplateElementId(id)) {
			this.writeTemplatesForSlide(
				target.id,
				updateElementById(this.templatesForSlide(target.id), id, box as Partial<PptxElement>),
			);
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
		const result = this.history.undo(this.captureSnapshot());
		if (result) {
			this.restoreSnapshot(result.snapshot);
			this.dirty.set(true);
			this.selectedIds.set([]);
			this.syncHistory();
		}
	}

	redo(): void {
		const result = this.history.redo(this.captureSnapshot());
		if (result) {
			this.restoreSnapshot(result.snapshot);
			this.dirty.set(true);
			this.selectedIds.set([]);
			this.syncHistory();
		}
	}

	// ── Align / distribute (multi-selection) ─────────────────────────────────

	/** Align the selected elements within their group bounds (one history entry). */
	alignSelected(slideIndex: number, mode: AlignMode): void {
		this.applyPositionMap(slideIndex, this.t('pptx.undoAction.align', { mode }), (boxes) =>
			computeAlign(boxes, mode),
		);
	}

	/** Evenly distribute the selected elements along an axis (one history entry). */
	distributeSelected(slideIndex: number, mode: DistributeMode): void {
		this.applyPositionMap(slideIndex, this.t('pptx.undoAction.distribute'), (boxes) =>
			computeDistribute(boxes, mode),
		);
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
		this.history.record(this.captureSnapshot(), label);
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

	// ── Group / ungroup ──────────────────────────────────────────────────────

	/** Group the selected elements into a single group element. */
	groupSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length < 2) {
			return;
		}
		const slides = this.slides();
		const slide = slides[slideIndex];
		if (!slide) {
			return;
		}
		const { elements, groupId } = groupElements(slide.elements, ids, this.newId());
		if (!groupId) {
			return;
		}
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.group'));
		this.slides.set(slides.map((s, i) => (i === slideIndex ? { ...s, elements } : s)));
		this.selectedIds.set([groupId]);
		this.dirty.set(true);
		this.syncHistory();
	}

	/** Ungroup the single selected group back into its children. */
	ungroupSelected(slideIndex: number): void {
		const ids = this.selectedIds();
		if (ids.length !== 1) {
			return;
		}
		const slides = this.slides();
		const slide = slides[slideIndex];
		if (!slide) {
			return;
		}
		const group = slide.elements.find((el) => el.id === ids[0]);
		if (!group || group.type !== 'group') {
			return;
		}
		const childIds = (group.children ?? []).map(() => this.newId());
		const { elements, childIds: used } = ungroupElements(slide.elements, ids[0], childIds);
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.ungroup'));
		this.slides.set(slides.map((s, i) => (i === slideIndex ? { ...s, elements } : s)));
		this.selectedIds.set(used);
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
		this.clipboard = picked.map(cloneElement);
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
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.paste'));
		const newIds: string[] = [];
		const additions = this.clipboard.map((el) => {
			const id = this.newId();
			newIds.push(id);
			return { ...cloneElement(el), id, x: el.x + 12, y: el.y + 12 };
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
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.insert'));
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

	/** Patch slide-level properties (background, notes, …); one history entry. */
	updateSlide(slideIndex: number, patch: Partial<PptxSlide>): void {
		const slides = this.slides();
		if (!slides[slideIndex]) {
			return;
		}
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.slideProperties'));
		this.slides.set(slides.map((s, i) => (i === slideIndex ? { ...s, ...patch } : s)));
		this.dirty.set(true);
		this.syncHistory();
	}

	/**
	 * Insert a blank slide after `afterIndex` (records history).
	 *
	 * @param layoutPath - Package path of the slide layout the new slide should
	 *   inherit from, as offered by the Home tab's "New Slide" split button.
	 *   Omitted for a plain blank slide, which is what the button itself does.
	 */
	addSlide(afterIndex: number, layoutPath?: string): void {
		const slides = this.slides();
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.addSlide'));
		const id = this.newId();
		const blank = {
			id,
			rId: id,
			slideNumber: 0,
			elements: [],
			...(layoutPath ? { layoutPath } : {}),
		} as PptxSlide;
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
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.deleteSlide'));
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
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.duplicateSlide'));
		const id = this.newId();
		const copy: PptxSlide = { ...cloneSlide(slides[index]), id, rId: id };
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
		this.history.record(this.captureSnapshot(), this.t('pptx.undoAction.moveSlide'));
		const next = [...slides];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		this.slides.set(this.renumber(next));
		this.dirty.set(true);
		this.syncHistory();
	}

	addSection(afterSlideIndex: number): void {
		this.sectionOps.add(afterSlideIndex, this.t('pptx.sections.defaultName'));
	}

	private commitSections(sections: readonly PptxSection[], slides: readonly PptxSlide[]): void {
		this.history.record(this.captureSnapshot(), this.t('pptx.sections.sectionButtonLabel'));
		this.sections.set(sections);
		this.slides.set(slides);
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
		// Record the pre-mutation snapshot, then apply. The mutation runs over the
		// COMBINED list (template elements ahead of the slide's own), then the
		// result is re-partitioned by id prefix back into the two stores. This
		// routes every element-update operation (move/resize/edit/delete/duplicate/
		// z-order) to the correct store, even for a mixed selection, without each
		// caller having to branch on template vs. normal ids.
		this.history.record(this.captureSnapshot(), label);
		const combined = mutate([...this.templatesForSlide(target.id), ...target.elements]);
		const nextTemplates = combined.filter((el) => isTemplateElement(el));
		const nextNormal = combined.filter((el) => !isTemplateElement(el));
		this.slides.set(
			slides.map((slide, i) => (i === slideIndex ? { ...slide, elements: nextNormal } : slide)),
		);
		this.writeTemplatesForSlide(target.id, nextTemplates);
		this.dirty.set(true);
		this.syncHistory();
	}

	private syncHistory(): void {
		this.canUndo.set(this.history.canUndo);
		this.canRedo.set(this.history.canRedo);
		this.undoLabel.set(this.history.undoLabel);
		this.redoLabel.set(this.history.redoLabel);
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
