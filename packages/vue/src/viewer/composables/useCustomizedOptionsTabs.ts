/**
 * useCustomizedOptionsTabs: the File > Options category rail after the host's
 * UI customisation, plus the active-tab state that falls back when the tab it
 * points at is hidden.
 *
 * Kept out of `SettingsDialog.vue` so the SFC stays presentation. The rail is
 * `customizeOptionsTabs(VIEWER_OPTIONS_TABS, resolved)` (hidden pages,
 * sections and settings removed, locked settings marked `readOnly`), and the
 * synthetic AI tab shows only when the host configured an assistant AND did
 * not hide its page; both decisions live in `pptx-viewer-shared`.
 */
import {
	customizeOptionsTabs,
	isOptionsPageVisible,
	VIEWER_OPTIONS_TABS,
} from 'pptx-viewer-shared';
import type { ViewerOptionsTabDefinition, ViewerOptionsTabId } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useResolvedCustomization } from './useViewerCustomization';

/** Synthetic tab id for the AI section (appended only when enabled). */
export const AI_OPTIONS_TAB_ID = 'ai';

export type OptionsDialogTabId = ViewerOptionsTabId | typeof AI_OPTIONS_TAB_ID;

export interface UseCustomizedOptionsTabsResult {
	/** The rail's schema tabs, customised. */
	visibleTabs: ComputedRef<readonly ViewerOptionsTabDefinition[]>;
	/** Whether the synthetic AI tab is offered. */
	showAiTab: ComputedRef<boolean>;
	activeTabId: Ref<OptionsDialogTabId>;
	/** The active schema tab (the first visible one when the id is hidden or `ai`). */
	activeTab: ComputedRef<ViewerOptionsTabDefinition | undefined>;
}

export function useCustomizedOptionsTabs(aiEnabled: () => boolean): UseCustomizedOptionsTabsResult {
	const resolved = useResolvedCustomization();
	const visibleTabs = computed(() => customizeOptionsTabs(VIEWER_OPTIONS_TABS, resolved.value));
	const showAiTab = computed(
		() => aiEnabled() && isOptionsPageVisible(resolved.value, AI_OPTIONS_TAB_ID),
	);
	const activeTabId = ref<OptionsDialogTabId>('general');
	const activeTab = computed(
		() => visibleTabs.value.find((tab) => tab.id === activeTabId.value) ?? visibleTabs.value[0],
	);

	// A tab the host just hid (or the AI tab losing its assistant) falls back
	// to the first visible tab instead of leaving the pane blank.
	watch(
		[visibleTabs, showAiTab],
		() => {
			const id = activeTabId.value;
			const stillVisible =
				id === AI_OPTIONS_TAB_ID ? showAiTab.value : visibleTabs.value.some((tab) => tab.id === id);
			if (!stillVisible) {
				const first = visibleTabs.value[0];
				activeTabId.value = first ? first.id : showAiTab.value ? AI_OPTIONS_TAB_ID : 'general';
			}
		},
		{ immediate: true },
	);

	return { visibleTabs, showAiTab, activeTabId, activeTab };
}
