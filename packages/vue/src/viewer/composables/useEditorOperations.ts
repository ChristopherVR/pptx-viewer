import {
	cloneElement,
	cloneSlide,
	duplicateElement,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	bringForward as sharedBringForward,
	bringToFront as sharedBringToFront,
	isTemplateElementId,
	sendBackward as sharedSendBackward,
	sendToBack as sharedSendToBack,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { TemplateElementMap } from './template-editing';
import { setTemplateElements } from './template-editing';

/**
 * useEditorOperations: element CRUD + transform operations over the active
 * slide of a reactive `PptxSlide[]`.
 *
 * This is the Vue port of the editing foundation that lives across the React
 * `useElementOperations` / `useClipboardHandlers` / `useGroupAlignLayerHandlers`
 * hooks. It is deliberately PURE of DOM and component concerns: it operates only
 * on the reactive slide model plus a current-slide-index ref, and threads every
 * mutation through a `pushHistory` callback (typically `useEditorHistory`'s
 * `pushHistory`) so the change is undoable.
 *
 * Mutation strategy (immutable, snapshot-first):
 *  1. call `pushHistory()` to snapshot the pre-mutation state,
 *  2. build a brand-new `PptxSlide[]` (active slide rebuilt with new elements),
 *  3. assign it to `slides.value`.
 *
 * Element cloning / creation always defers to the core helpers (`cloneSlide`,
 * `cloneElement`, `duplicateElement`, `updateSmartArtNodeText`) rather than
 * re-implementing them.
 */

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

/** Geometry/transform fields that {@link EditorOperations.transformElement} can patch. */
export interface ElementTransform {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
}

export interface UseEditorOperationsInput {
	/** Live slide array. A `shallowRef` is recommended for large decks. */
	slides: Ref<PptxSlide[]>;
	/** Index of the slide CRUD/transform operations act upon. */
	activeSlideIndex: Ref<number>;
	/**
	 * Snapshot-before-mutate hook. Called immediately before each committed
	 * change. Pass `useEditorHistory(slides).pushHistory`.
	 */
	pushHistory: () => void;
	/**
	 * Optional selection state (element ids). When provided, operations keep it
	 * in sync: newly added/duplicated elements become selected, removed ones are
	 * deselected. When omitted, an internally-owned selection ref is used.
	 */
	selectedElementIds?: Ref<string[]>;
	/**
	 * Optional separate store of the per-slide master/layout (template) elements.
	 * When provided, id-routed operations (update / remove / transform / text /
	 * z-order) targeting a template id (`master-` / `layout-` prefix) mutate this
	 * store for the active slide instead of `slides`.
	 */
	templateElementsBySlideId?: Ref<TemplateElementMap>;
}

export interface EditorOperations {
	/** Resolved active slide (or `undefined` when the index is out of range). */
	activeSlide: ComputedRef<PptxSlide | undefined>;
	/** Currently-selected element ids (owned internally if not supplied as input). */
	selectedElementIds: Ref<string[]>;

	/** Append an element to the active slide and select it. */
	addElement: (element: PptxElement) => void;
	/** Shallow-merge `updates` into the element with `elementId` on the active slide. */
	updateElement: (elementId: string, updates: Partial<PptxElement>) => void;
	/** Remove an element from the active slide and drop it from the selection. */
	removeElement: (elementId: string) => void;
	/** Patch an element's geometry (x/y/width/height/rotation). */
	transformElement: (elementId: string, transform: ElementTransform) => void;
	/** Alias of {@link transformElement}: mirrors the React "move" semantics. */
	moveElement: (elementId: string, transform: ElementTransform) => void;
	/**
	 * Deep-clone an element (new ids via core `duplicateElement`), offset it
	 * slightly, append it, and select the copy. Returns the new element's id.
	 */
	duplicateElement: (elementId: string) => string | undefined;
	/** Swap an element one step later in z-order (towards the front). */
	bringForward: (elementId: string) => void;
	/** Swap an element one step earlier in z-order (towards the back). */
	sendBackward: (elementId: string) => void;
	/** Move an element in front of every sibling on its layer. */
	bringToFront: (elementId: string) => void;
	/** Move an element behind every sibling on its layer. */
	sendToBack: (elementId: string) => void;
	/** Move an element to an explicit index within the active slide's z-order. */
	reorder: (elementId: string, toIndex: number) => void;
	/**
	 * Update an element's text. For `smartArt` elements a `nodeId` targets a
	 * specific node via core `updateSmartArtNodeText`; for text/shape elements the
	 * `text` field (and every text segment's text) is replaced.
	 */
	updateElementText: (elementId: string, text: string, nodeId?: string) => void;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useEditorOperations(input: UseEditorOperationsInput): EditorOperations {
	const { slides, activeSlideIndex, pushHistory } = input;

	const selectedElementIds: Ref<string[]> = input.selectedElementIds ?? ref<string[]>([]);

	const activeSlide = computed<PptxSlide | undefined>(() => slides.value[activeSlideIndex.value]);

	// -- Internal commit helpers ------------------------------------------

	/**
	 * Rebuild the active slide's `elements` via `mapElements` and commit a new
	 * `slides.value`, snapshotting history first. No-op when the active index is
	 * out of range.
	 */
	const commitElements = (mapElements: (elements: PptxElement[]) => PptxElement[]): void => {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		pushHistory();
		slides.value = slides.value.map((s, i) =>
			i === index ? { ...cloneSlide(s), elements: mapElements(s.elements) } : s,
		);
	};

	const templateMap = input.templateElementsBySlideId;

	/** Rebuild the active slide's template store via `mapElements` (history-tracked). */
	const commitTemplateElements = (
		mapElements: (elements: PptxElement[]) => PptxElement[],
	): void => {
		const slide = slides.value[activeSlideIndex.value];
		if (!templateMap || !slide) {
			return;
		}
		const current = templateMap.value[slide.id];
		if (!current) {
			return;
		}
		pushHistory();
		templateMap.value = setTemplateElements(templateMap.value, slide.id, mapElements(current));
	};

	/**
	 * Route an id-keyed element mutation to the correct store: template ids
	 * (`master-` / `layout-` prefix) mutate the separate template store for the
	 * active slide; everything else mutates the slide's `elements`.
	 */
	const commitForId = (
		elementId: string,
		mapElements: (elements: PptxElement[]) => PptxElement[],
	): void => {
		if (templateMap && isTemplateElementId(elementId)) {
			commitTemplateElements(mapElements);
			return;
		}
		commitElements(mapElements);
	};

	/**
	 * Like {@link commitForId}, but skips the commit (and its `pushHistory`
	 * snapshot) entirely when `mapElements` is a no-op. The shared z-order family
	 * (`bringForward`/`sendBackward`/`bringToFront`/`sendToBack`) returns the
	 * SAME array reference when the element is missing or already at that edge,
	 * so a reference check is enough to detect "nothing changed" without a
	 * second pass over the array.
	 */
	const commitForIdIfChanged = (
		elementId: string,
		mapElements: (elements: PptxElement[]) => PptxElement[],
	): void => {
		const current = elementsForId(elementId);
		if (mapElements(current) === current) {
			return;
		}
		commitForId(elementId, mapElements);
	};

	/** The element array (slide or template store) that an id currently lives in. */
	const elementsForId = (elementId: string): PptxElement[] => {
		const slide = slides.value[activeSlideIndex.value];
		if (!slide) {
			return [];
		}
		if (templateMap && isTemplateElementId(elementId)) {
			return templateMap.value[slide.id] ?? [];
		}
		return slide.elements;
	};

	// -- CRUD --------------------------------------------------------------

	const addElement = (element: PptxElement): void => {
		const cloned = cloneElement(element);
		commitElements((elements) => [...elements, cloned]);
		selectedElementIds.value = [cloned.id];
	};

	const updateElement = (elementId: string, updates: Partial<PptxElement>): void => {
		commitForId(elementId, (elements) =>
			elements.map((el) =>
				el.id === elementId ? ({ ...cloneElement(el), ...updates } as PptxElement) : el,
			),
		);
	};

	const removeElement = (elementId: string): void => {
		commitForId(elementId, (elements) => elements.filter((el) => el.id !== elementId));
		if (selectedElementIds.value.includes(elementId)) {
			selectedElementIds.value = selectedElementIds.value.filter((id) => id !== elementId);
		}
	};

	// -- Transform ---------------------------------------------------------

	const transformElement = (elementId: string, transform: ElementTransform): void => {
		const patch: Partial<PptxElement> = {};
		if (transform.x !== undefined) {
			patch.x = transform.x;
		}
		if (transform.y !== undefined) {
			patch.y = transform.y;
		}
		if (transform.width !== undefined) {
			patch.width = transform.width;
		}
		if (transform.height !== undefined) {
			patch.height = transform.height;
		}
		if (transform.rotation !== undefined) {
			patch.rotation = transform.rotation;
		}
		updateElement(elementId, patch);
	};

	// -- Duplicate ---------------------------------------------------------

	const duplicateElementById = (elementId: string): string | undefined => {
		const source = elementsForId(elementId).find((el) => el.id === elementId);
		if (!source) {
			return undefined;
		}
		// Core `duplicateElement` deep-clones and re-assigns ids (incl. group
		// children). Offset by 20px so the copy is visibly distinct. The copy gets a
		// fresh (non-template) id, so it always lands on the slide as real content.
		const copy = duplicateElement(source);
		copy.x += 20;
		copy.y += 20;
		commitElements((elements) => [...elements, copy]);
		selectedElementIds.value = [copy.id];
		return copy.id;
	};

	// -- Z-order -----------------------------------------------------------
	// Every transform below defers to shared `element-operations` (the same
	// `(elements, id) => PptxElement[]` z-order family every binding uses), routed
	// through `commitForId` / `reorderElementOnSlide`'s pure `(elements) =>
	// PptxElement[]` shape so template-id routing keeps working. A private
	// reorder implementation used to live here and could drift from the other
	// bindings; it no longer does.

	const bringForward = (elementId: string): void => {
		commitForIdIfChanged(elementId, (elements) => sharedBringForward(elements, elementId));
	};
	const sendBackward = (elementId: string): void => {
		commitForIdIfChanged(elementId, (elements) => sharedSendBackward(elements, elementId));
	};
	const bringToFront = (elementId: string): void => {
		commitForIdIfChanged(elementId, (elements) => sharedBringToFront(elements, elementId));
	};
	const sendToBack = (elementId: string): void => {
		commitForIdIfChanged(elementId, (elements) => sharedSendToBack(elements, elementId));
	};

	const reorder = (elementId: string, toIndex: number): void => {
		const layer = elementsForId(elementId);
		const from = layer.findIndex((el) => el.id === elementId);
		if (from === -1) {
			return;
		}
		const clamped = Math.max(0, Math.min(toIndex, layer.length - 1));
		if (clamped === from) {
			return;
		}
		commitForId(elementId, (elements) => {
			const next = [...elements];
			const [moved] = next.splice(from, 1);
			next.splice(clamped, 0, moved);
			return next;
		});
	};

	// -- Text --------------------------------------------------------------

	const updateElementText = (elementId: string, text: string, nodeId?: string): void => {
		commitForId(elementId, (elements) =>
			elements.map((el) => {
				if (el.id !== elementId) {
					return el;
				}
				if (el.type === 'smartArt') {
					if (!nodeId || !el.smartArtData) {
						return el;
					}
					return {
						...cloneElement(el),
						smartArtData: updateSmartArtNodeText(el.smartArtData, nodeId, text),
					} as PptxElement;
				}
				if (el.type === 'text' || el.type === 'shape') {
					const cloned = cloneElement(el) as Extract<PptxElement, { type: 'text' | 'shape' }>;
					cloned.text = text;
					if (cloned.textSegments && cloned.textSegments.length > 0) {
						// Collapse to a single segment carrying the new text, preserving
						// the first segment's style so formatting is not lost.
						const baseStyle = cloned.textSegments[0].style;
						cloned.textSegments = [{ ...cloned.textSegments[0], text, style: { ...baseStyle } }];
					}
					return cloned;
				}
				return el;
			}),
		);
	};

	return {
		activeSlide,
		selectedElementIds,
		addElement,
		updateElement,
		removeElement,
		transformElement,
		moveElement: transformElement,
		duplicateElement: duplicateElementById,
		bringForward,
		sendBackward,
		bringToFront,
		sendToBack,
		reorder,
		updateElementText,
	};
}
