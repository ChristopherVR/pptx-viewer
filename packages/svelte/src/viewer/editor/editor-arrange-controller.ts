import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';

import {
	alignSelectedOnSlide,
	distributeSelectedOnSlide,
	flipSelectedOnSlide,
	groupSelectedOnSlide,
	ungroupOnSlide,
} from './editor-arrange-ops';
import type { EditorState } from './editor-state.svelte';

/**
 * The Home tab's multi-select-aware Arrange group (align / distribute /
 * flip / group / ungroup), split out of `EditorState` to keep it under the
 * repo's 300-LOC budget. Reads `editor.selection.ids` (the ordered
 * multi-selection) rather than just the primary id, matching React's
 * `selectedElementIds` semantics.
 */
export class EditorArrangeController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** Commit `compute(slides)` against the currently editable element layer. */
	#mutate(compute: (slides: EditorState['slides']) => EditorState['slides'] | null): void {
		const activeSlide = {
			id: 'active-layer',
			elements: this.#editor.activeElements,
		} as EditorState['slides'][number];
		const next = compute([activeSlide]);
		if (next) {
			this.#editor.commitActiveElements(next[0].elements);
		}
	}

	/** Align every selected element to `edge` (needs >= 2 selected). */
	alignSelected(edge: AlignEdge): void {
		const ids = this.#editor.selection.ids;
		this.#mutate((slides) => alignSelectedOnSlide(slides, 0, ids, edge));
	}

	/** Distribute the selected elements evenly along `axis` (needs >= 3 selected). */
	distributeSelected(axis: DistributeAxis): void {
		const ids = this.#editor.selection.ids;
		this.#mutate((slides) => distributeSelectedOnSlide(slides, 0, ids, axis));
	}

	/** Flip every selected element across `axis`. */
	flipSelected(axis: 'horizontal' | 'vertical'): void {
		const ids = this.#editor.selection.ids;
		this.#mutate((slides) => flipSelectedOnSlide(slides, 0, ids, axis));
	}

	/** Group the selected elements (needs >= 2 selected). Selects the new group. */
	groupSelected(): void {
		const ids = this.#editor.selection.ids;
		let groupId: string | null = null;
		this.#mutate((slides) => {
			const result = groupSelectedOnSlide(slides, 0, ids, this.#editor.editTemplateMode);
			groupId = result?.groupId ?? null;
			return result?.slides ?? null;
		});
		if (groupId) {
			this.#editor.selection.set(groupId);
		}
	}

	/** Ungroup the primary selected group element. Selects the ungrouped children. */
	ungroupSelected(): void {
		const id = this.#editor.selectedElementId;
		if (!id) {
			return;
		}
		let childIds: string[] = [];
		this.#mutate((slides) => {
			const result = ungroupOnSlide(slides, 0, id, this.#editor.editTemplateMode);
			childIds = result?.childIds ?? [];
			return result?.slides ?? null;
		});
		if (childIds.length > 0) {
			this.#editor.selection.setAll(childIds);
		}
	}
}
