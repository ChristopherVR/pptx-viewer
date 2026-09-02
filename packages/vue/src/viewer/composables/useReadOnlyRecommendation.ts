import type { PptxCustomProperty, PptxModifyVerifier } from 'pptx-viewer-core';
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { readOnlyRecommendation } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * useReadOnlyRecommendation: the Trust-Center-style banner shown when a
 * loaded deck asks to be opened read-only (`p:modifyVerifier`, or `docProps/
 * custom.xml`'s "Mark as Final"), and the lock that goes with it.
 *
 * Mirrors `PowerPointViewer.vue`'s existing Protected View mechanism
 * (`protectedViewActive`/`protectedViewDismissed`/`enableEditing`) rather than
 * inventing a second one: `locked` feeds the SAME `canEditEffective` gate
 * every edit entry point already reads, and `reset()` is called from the same
 * `watch(activeContent, ...)` handler that resets Protected View, so a newly
 * opened document is evaluated fresh even if a previous one was unlocked.
 */
export interface UseReadOnlyRecommendationInput {
	modifyVerifier: Ref<PptxModifyVerifier | undefined>;
	customProperties: Ref<PptxCustomProperty[]>;
}

export interface UseReadOnlyRecommendationResult {
	/** The current recommendation (`kind: null` when the deck asks for nothing). */
	recommendation: ComputedRef<ReadOnlyRecommendation>;
	/** Whether the banner should render. */
	showBanner: ComputedRef<boolean>;
	/** Whether editing should currently be blocked because of this recommendation. */
	locked: ComputedRef<boolean>;
	/** "Edit anyway": lifts the lock and hides the banner for this document. */
	editAnyway: () => void;
	/** "Dismiss": hides the banner but leaves the lock (if any) in place. */
	dismiss: () => void;
	/** Re-arm the recommendation for a newly loaded document. */
	reset: () => void;
}

export function useReadOnlyRecommendation(
	input: UseReadOnlyRecommendationInput,
): UseReadOnlyRecommendationResult {
	const dismissed = ref(false);
	const editAnywayGranted = ref(false);

	const recommendation = computed<ReadOnlyRecommendation>(() =>
		readOnlyRecommendation({
			modifyVerifier: input.modifyVerifier.value,
			customProperties: input.customProperties.value,
		}),
	);

	const showBanner = computed(() => recommendation.value.kind !== null && !dismissed.value);
	const locked = computed(
		() =>
			recommendation.value.kind !== null &&
			recommendation.value.defaultReadOnly &&
			!editAnywayGranted.value,
	);

	function editAnyway(): void {
		editAnywayGranted.value = true;
		dismissed.value = true;
	}

	function dismiss(): void {
		dismissed.value = true;
	}

	function reset(): void {
		dismissed.value = false;
		editAnywayGranted.value = false;
	}

	return { recommendation, showBanner, locked, editAnyway, dismiss, reset };
}
