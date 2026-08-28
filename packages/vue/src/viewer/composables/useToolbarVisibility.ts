import type { ToolbarActionId, ToolbarTabDefinition, ViewerOptions } from 'pptx-viewer-shared';
import {
	filterVisibleTabs,
	isActionHidden,
	resolveVisibleRibbonTabs,
	TOOLBAR_TABS,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';

export interface UseToolbarVisibilityResult {
	/** True when `id` is in the host's `hiddenActions` list (a button/tab to hide). */
	isHidden: (id: ToolbarActionId) => boolean;
	/**
	 * The canonical ribbon-tab list, filtered down to the ones the host has not
	 * hidden AND the ones the user has not unticked in File > Options >
	 * Customize Ribbon (when `viewerOptions` is supplied).
	 */
	visibleTabs: ComputedRef<ToolbarTabDefinition[]>;
}

/**
 * useToolbarVisibility: turns a host's `hiddenActions?: ToolbarActionId[]` prop
 * (and, optionally, File > Options > Customize Ribbon's `hiddenTabIds`) into
 * per-button visibility checks and a filtered ribbon-tab list, keeping that
 * matching logic out of the toolbar/ribbon component files themselves. All of
 * the actual matching lives in `pptx-viewer-shared` (`isActionHidden` /
 * `filterVisibleTabs` / `resolveVisibleRibbonTabs` / `TOOLBAR_TABS`); this
 * composable just adapts it to Vue's reactivity so callers can read both
 * inputs through getters, the same convention as the other ribbon-props
 * composables (see `useRibbonProps.ts`).
 *
 * The two hiding mechanisms are independent and both apply: a host can hide a
 * tab via `hiddenActions` regardless of the user's own Customize Ribbon
 * choice, and a user's Customize Ribbon choice hides a tab regardless of what
 * the host passed. The File tab always survives (`resolveVisibleRibbonTabs`).
 *
 * @param hiddenActions getter for the host's `hiddenActions` prop (undefined or empty = hide nothing).
 * @param viewerOptions getter for the live File > Options snapshot; omit (or
 *   return `undefined`) to skip the Customize Ribbon filter, e.g. for a caller
 *   that only needs `isHidden` and has no options store in scope.
 */
export function useToolbarVisibility(
	hiddenActions: () => readonly ToolbarActionId[] | undefined,
	viewerOptions?: () => ViewerOptions | undefined,
): UseToolbarVisibilityResult {
	const isHidden = (id: ToolbarActionId): boolean => isActionHidden(id, hiddenActions());
	const visibleTabs = computed(() => {
		const options = viewerOptions?.();
		const tabs = options ? resolveVisibleRibbonTabs(options, TOOLBAR_TABS) : TOOLBAR_TABS;
		return filterVisibleTabs(tabs, hiddenActions());
	});
	return { isHidden, visibleTabs };
}
