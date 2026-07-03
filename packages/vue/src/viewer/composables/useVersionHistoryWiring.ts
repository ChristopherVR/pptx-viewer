import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { compareSlides } from './slide-compare';
import type { CompareResult } from './slide-compare';
import { useVersionHistory } from './useVersionHistory';
import type { UseVersionHistoryResult } from './useVersionHistory';

export interface UseVersionHistoryWiringInput {
	slides: Ref<PptxSlide[]>;
	pushHistory: () => void;
}

export interface UseVersionHistoryWiringResult {
	versionHistory: UseVersionHistoryResult;
	showVersionHistory: Ref<boolean>;
	compareResult: Ref<CompareResult | null>;
	compareVersionId: Ref<string | null>;
	showCompare: ComputedRef<boolean>;
	onVersionRestore: (id: string) => void;
	onVersionDelete: (id: string) => void;
	onVersionCompare: (id: string) => void;
	onCompareClose: () => void;
	onCompareAcceptAll: () => void;
}

/**
 * useVersionHistoryWiring: File ▸ Version History panel plus the
 * restore-vs-current compare view, layered on top of the underlying
 * `useVersionHistory` snapshot store. Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useVersionHistoryWiring(
	input: UseVersionHistoryWiringInput,
): UseVersionHistoryWiringResult {
	const { slides, pushHistory } = input;

	const versionHistory = useVersionHistory({ slides, pushHistory });
	const showVersionHistory = ref(false);
	const compareResult = ref<CompareResult | null>(null);
	const compareVersionId = ref<string | null>(null);
	const showCompare = computed(() => compareResult.value !== null);

	function onVersionRestore(id: string): void {
		versionHistory.restore(id);
		showVersionHistory.value = false;
	}
	function onVersionDelete(id: string): void {
		versionHistory.remove(id);
	}
	function onVersionCompare(id: string): void {
		const version = versionHistory.versions.value.find((v) => v.id === id);
		if (!version) {
			return;
		}
		compareVersionId.value = id;
		compareResult.value = compareSlides(version.slides, slides.value);
	}
	function onCompareClose(): void {
		compareResult.value = null;
		compareVersionId.value = null;
	}
	function onCompareAcceptAll(): void {
		if (compareVersionId.value) {
			versionHistory.restore(compareVersionId.value);
		}
		onCompareClose();
		showVersionHistory.value = false;
	}

	return {
		versionHistory,
		showVersionHistory,
		compareResult,
		compareVersionId,
		showCompare,
		onVersionRestore,
		onVersionDelete,
		onVersionCompare,
		onCompareClose,
		onCompareAcceptAll,
	};
}
