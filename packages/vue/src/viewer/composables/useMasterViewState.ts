import type { MasterViewTab } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

export interface UseMasterViewStateResult {
	showMasterView: Ref<boolean>;
	masterViewTab: Ref<MasterViewTab>;
	activeMasterIndex: Ref<number>;
	activeLayoutIndex: Ref<number | null>;
	handoutSlidesPerPage: Ref<number>;
	onSelectMaster: (index: number) => void;
	onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
}

/**
 * useMasterViewState: View ▸ Master Views overlay (slide / notes / handout
 * masters). Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useMasterViewState(): UseMasterViewStateResult {
	const showMasterView = ref(false);
	const masterViewTab = ref<MasterViewTab>('slides');
	const activeMasterIndex = ref(0);
	const activeLayoutIndex = ref<number | null>(null);
	const handoutSlidesPerPage = ref(6);

	function onSelectMaster(index: number): void {
		activeMasterIndex.value = index;
		activeLayoutIndex.value = null;
	}
	function onSelectLayout(masterIndex: number, layoutIndex: number): void {
		activeMasterIndex.value = masterIndex;
		activeLayoutIndex.value = layoutIndex;
	}

	return {
		showMasterView,
		masterViewTab,
		activeMasterIndex,
		activeLayoutIndex,
		handoutSlidesPerPage,
		onSelectMaster,
		onSelectLayout,
	};
}
