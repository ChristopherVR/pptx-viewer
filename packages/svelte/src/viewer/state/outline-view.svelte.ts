/**
 * Outline-view session: the reactive shell around the shared outline model.
 *
 * Every rule about what a row is, what Tab does and which gesture produces a
 * new slide lives in `pptx-viewer-shared/render/outline-view` and
 * `.../outline-view-edit`. This class holds only what Svelte has to own: a
 * `rows` getter that re-reads the deck through the caller's accessor (so the
 * template tracks the slide state that produced it), the edit pipe back into
 * the binding's own undoable commit path, and the one-shot caret hand-off that
 * has to survive a re-render. Anything added here that starts to read like an
 * outline rule belongs in the shared module instead, or the five bindings begin
 * to disagree about what Enter does.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	applyOutlineEdit,
	buildOutline,
	mapOutlineKey,
	OUTLINE_ROW_ATTR,
} from 'pptx-viewer-shared';
import type { CanvasSize, OutlineEdit, OutlineRow } from 'pptx-viewer-shared';

export interface OutlineViewSessionInput {
	getSlides: () => PptxSlide[];
	/** Laid-out size the outline's created title element is sized against. */
	getCanvasSize: () => CanvasSize;
	/** False for a read-only deck, which makes every edit a no-op. */
	canEdit: () => boolean;
	/**
	 * Replaces the whole deck. Wired to the binding's generic multi-slide commit
	 * (`EditorState.commitSlides`) so an outline edit is one ordinary undo step
	 * rather than a second, outline-specific history path.
	 */
	onCommit: (slides: PptxSlide[]) => void;
	/** Moves the editor's active slide, so leaving the outline lands on it. */
	onActiveSlide: (index: number) => void;
}

export class OutlineViewSession {
	/**
	 * Row the caret should land on after the deck re-renders.
	 *
	 * Deliberately NOT a rune: it is a one-shot instruction consumed by the very
	 * effect that would re-run if writing it were tracked.
	 */
	#pendingFocusKey: string | null = null;
	readonly #input: OutlineViewSessionInput;

	constructor(input: OutlineViewSessionInput) {
		this.#input = input;
	}

	/** The deck's outline. A getter, so reading it in a template tracks the deck. */
	get rows(): OutlineRow[] {
		return buildOutline(this.#input.getSlides());
	}

	/** Apply one edit, or do nothing when it changes the deck in no way. */
	run(edit: OutlineEdit): void {
		if (!this.#input.canEdit()) {
			return;
		}
		const result = applyOutlineEdit(this.#input.getSlides(), edit, {
			canvas: this.#input.getCanvasSize(),
		});
		if (!result.changed) {
			return;
		}
		this.#input.onCommit(result.slides);
		this.#input.onActiveSlide(result.activeSlideIndex);
		this.#pendingFocusKey = result.focusKey;
	}

	/**
	 * Handle one key press inside a row. `preventDefault` is the shared module's
	 * call: Tab would otherwise walk out of the outline entirely, and Enter would
	 * submit a surrounding form on a host page that has one.
	 */
	handleKey(event: KeyboardEvent, rowKey: string): void {
		const { edit, preventDefault } = mapOutlineKey(event, rowKey);
		if (preventDefault) {
			event.preventDefault();
		}
		if (edit) {
			this.run(edit);
		}
	}

	/**
	 * Move the caret to the row the last edit asked for, once that row exists.
	 *
	 * Rows are matched by comparing the attribute rather than by an attribute
	 * selector: a row key embeds `|` separators, and quoting or escaping those
	 * into a selector is a per-engine hazard for no gain over a plain scan of a
	 * list that is only as long as the deck's text.
	 */
	restoreFocus(container: HTMLElement | undefined): void {
		const key = this.#pendingFocusKey;
		if (key === null || !container) {
			return;
		}
		this.#pendingFocusKey = null;
		const target = [...container.querySelectorAll<HTMLInputElement>(`[${OUTLINE_ROW_ATTR}]`)].find(
			(input) => input.getAttribute(OUTLINE_ROW_ATTR) === key,
		);
		if (!target || target.ownerDocument.activeElement === target) {
			return;
		}
		target.focus();
		target.setSelectionRange(target.value.length, target.value.length);
	}
}
