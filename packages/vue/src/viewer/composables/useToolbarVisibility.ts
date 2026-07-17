import type { ToolbarActionId, ToolbarTabDefinition } from 'pptx-viewer-shared';
import { filterVisibleTabs, isActionHidden, TOOLBAR_TABS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';

export interface UseToolbarVisibilityResult {
	/** True when `id` is in the host's `hiddenActions` list (a button/tab to hide). */
	isHidden: (id: ToolbarActionId) => boolean;
	/** The canonical ribbon-tab list, filtered down to the ones the host has not hidden. */
	visibleTabs: ComputedRef<ToolbarTabDefinition[]>;
}

/**
 * useToolbarVisibility: turns a host's `hiddenActions?: ToolbarActionId[]` prop
 * into per-button visibility checks and a filtered ribbon-tab list, keeping
 * that matching logic out of the toolbar/ribbon component files themselves.
 * All of the actual matching lives in `pptx-viewer-shared`
 * (`isActionHidden` / `filterVisibleTabs` / `TOOLBAR_TABS`); this composable
 * just adapts it to Vue's reactivity so callers can read `hiddenActions`
 * through a getter, the same convention as the other ribbon-props composables
 * (see `useRibbonProps.ts`).
 *
 * @param hiddenActions getter for the host's `hiddenActions` prop (undefined or empty = hide nothing).
 */
export function useToolbarVisibility(
	hiddenActions: () => readonly ToolbarActionId[] | undefined,
): UseToolbarVisibilityResult {
	const isHidden = (id: ToolbarActionId): boolean => isActionHidden(id, hiddenActions());
	const visibleTabs = computed(() => filterVisibleTabs(TOOLBAR_TABS, hiddenActions()));
	return { isHidden, visibleTabs };
}
