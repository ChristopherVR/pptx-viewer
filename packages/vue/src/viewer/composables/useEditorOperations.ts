import {
	cloneElement,
	cloneSlide,
	duplicateElement,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

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

	// -- CRUD --------------------------------------------------------------

	const addElement = (element: PptxElement): void => {
		const cloned = cloneElement(element);
		commitElements((elements) => [...elements, cloned]);
		selectedElementIds.value = [cloned.id];
	};

	const updateElement = (elementId: string, updates: Partial<PptxElement>): void => {
		commitElements((elements) =>
			elements.map((el) =>
				el.id === elementId ? ({ ...cloneElement(el), ...updates } as PptxElement) : el,
			),
		);
	};

	const removeElement = (elementId: string): void => {
		commitElements((elements) => elements.filter((el) => el.id !== elementId));
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
		const slide = slides.value[activeSlideIndex.value];
		const source = slide?.elements.find((el) => el.id === elementId);
		if (!source) {
			return undefined;
		}
		// Core `duplicateElement` deep-clones and re-assigns ids (incl. group
		// children). Offset by 20px so the copy is visibly distinct.
		const copy = duplicateElement(source);
		copy.x += 20;
		copy.y += 20;
		commitElements((elements) => [...elements, copy]);
		selectedElementIds.value = [copy.id];
		return copy.id;
	};

	// -- Z-order -----------------------------------------------------------

	const swapLayer = (elementId: string, direction: 1 | -1): void => {
		const slide = slides.value[activeSlideIndex.value];
		if (!slide) {
			return;
		}
		const index = slide.elements.findIndex((el) => el.id === elementId);
		if (index === -1) {
			return;
		}
		const target = index + direction;
		if (target < 0 || target >= slide.elements.length) {
			return;
		}
		commitElements((elements) => {
			const next = [...elements];
			const tmp = next[index];
			next[index] = next[target];
			next[target] = tmp;
			return next;
		});
	};

	const bringForward = (elementId: string): void => swapLayer(elementId, 1);
	const sendBackward = (elementId: string): void => swapLayer(elementId, -1);

	const reorder = (elementId: string, toIndex: number): void => {
		const slide = slides.value[activeSlideIndex.value];
		if (!slide) {
			return;
		}
		const from = slide.elements.findIndex((el) => el.id === elementId);
		if (from === -1) {
			return;
		}
		const clamped = Math.max(0, Math.min(toIndex, slide.elements.length - 1));
		if (clamped === from) {
			return;
		}
		commitElements((elements) => {
			const next = [...elements];
			const [moved] = next.splice(from, 1);
			next.splice(clamped, 0, moved);
			return next;
		});
	};

	// -- Text --------------------------------------------------------------

	const updateElementText = (elementId: string, text: string, nodeId?: string): void => {
		commitElements((elements) =>
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
		reorder,
		updateElementText,
	};
}
