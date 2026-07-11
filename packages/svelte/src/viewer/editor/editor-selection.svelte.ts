/**
 * EditorSelection: the reactive multi-element selection for the Svelte editor.
 *
 * Holds an ordered list of selected element ids; the LAST id is the primary
 * selection (the one the overlay handles, gestures, and inline editing act
 * on), matching the React binding's `selectedElementIds` + primary convention.
 * Plain clicks call {@link set} (single selection), shift/ctrl clicks call
 * {@link toggle} (additive), and mutations that invalidate ids call
 * {@link prune}.
 */
export class EditorSelection {
	#ids = $state.raw<readonly string[]>([]);

	/** All selected ids in selection order (primary last). */
	get ids(): readonly string[] {
		return this.#ids;
	}

	/** The primary selected id (last selected), or null when empty. */
	get primary(): string | null {
		return this.#ids.length > 0 ? this.#ids[this.#ids.length - 1] : null;
	}

	/** Number of selected elements. */
	get size(): number {
		return this.#ids.length;
	}

	/** True when `id` is part of the selection. */
	has(id: string): boolean {
		return this.#ids.includes(id);
	}

	/** Replace the selection with a single id (or clear it with `null`). */
	set(id: string | null): void {
		this.#ids = id === null ? [] : [id];
	}

	/** Replace the selection with an explicit id list (primary = last). */
	setAll(ids: readonly string[]): void {
		this.#ids = [...ids];
	}

	/** Additive (shift/ctrl-click) toggle: add `id`, or remove it when present. */
	toggle(id: string): void {
		this.#ids = this.#ids.includes(id)
			? this.#ids.filter((existing) => existing !== id)
			: [...this.#ids, id];
	}

	/** Clear the selection. */
	clear(): void {
		this.#ids = [];
	}

	/** Drop ids that no longer resolve to an element (after remote/undo edits). */
	prune(exists: (id: string) => boolean): void {
		if (this.#ids.some((id) => !exists(id))) {
			this.#ids = this.#ids.filter(exists);
		}
	}
}
