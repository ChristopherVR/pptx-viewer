/**
 * useSelection: reactive selection state for the editor.
 *
 * Tracks which element ids are currently selected and exposes the usual
 * single / additive / toggle / clear operations. Mirrors the React
 * `useElementSelection` surface but in Vue's reactive idiom.
 */
import { computed, readonly, ref } from 'vue';
import type { ComputedRef, DeepReadonly, Ref } from 'vue';

export interface UseSelectionResult {
	/** Read-only reactive list of selected element ids (insertion order). */
	selectedIds: DeepReadonly<Ref<string[]>>;
	/** True when nothing is selected. */
	isEmpty: ComputedRef<boolean>;
	/**
	 * Select a single id. With `additive`, add it to the current selection
	 * (without removing the rest); otherwise replace the selection with `id`.
	 */
	select: (id: string, additive?: boolean) => void;
	/** Add `id` if absent, remove it if present (additive toggle). */
	toggle: (id: string) => void;
	/** Replace the entire selection with `ids` (deduplicated, order preserved). */
	selectMany: (ids: readonly string[]) => void;
	/** Clear the selection. */
	clear: () => void;
	/** Whether `id` is currently selected. */
	isSelected: (id: string) => boolean;
}

/**
 * Create a selection store.
 *
 * @param initial Optional initial selection.
 */
export function useSelection(initial: readonly string[] = []): UseSelectionResult {
	const selectedIds = ref<string[]>(dedupe(initial));

	const isEmpty = computed(() => selectedIds.value.length === 0);

	function isSelected(id: string): boolean {
		return selectedIds.value.includes(id);
	}

	function select(id: string, additive = false): void {
		if (additive) {
			if (!selectedIds.value.includes(id)) {
				selectedIds.value = [...selectedIds.value, id];
			}
			return;
		}
		// Replace selection, but avoid a needless write when already exactly this.
		if (selectedIds.value.length === 1 && selectedIds.value[0] === id) {
			return;
		}
		selectedIds.value = [id];
	}

	function toggle(id: string): void {
		if (selectedIds.value.includes(id)) {
			selectedIds.value = selectedIds.value.filter((existing) => existing !== id);
		} else {
			selectedIds.value = [...selectedIds.value, id];
		}
	}

	function selectMany(ids: readonly string[]): void {
		selectedIds.value = dedupe(ids);
	}

	function clear(): void {
		if (selectedIds.value.length > 0) {
			selectedIds.value = [];
		}
	}

	return {
		selectedIds: readonly(selectedIds),
		isEmpty,
		select,
		toggle,
		selectMany,
		clear,
		isSelected,
	};
}

/** Remove duplicate ids while preserving first-seen order. */
function dedupe(ids: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		if (!seen.has(id)) {
			seen.add(id);
			out.push(id);
		}
	}
	return out;
}
