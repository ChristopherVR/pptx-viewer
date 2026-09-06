import type { PptxCustomProperty, PptxModifyVerifier } from 'pptx-viewer-core';
import type { ModifyPasswordCheckResult, ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { checkModifyPassword, readOnlyRecommendation } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = Extract<ModifyPasswordCheckResult, { ok: false }>['reason'];

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
	/**
	 * "Edit anyway": lifts the lock and hides the banner for this document, or
	 * (when `recommendation.requiresPassword` is set) opens the inline
	 * password prompt instead of unlocking immediately.
	 */
	editAnyway: () => void;
	/** "Dismiss": hides the banner but leaves the lock (if any) in place. */
	dismiss: () => void;
	/** Re-arm the recommendation for a newly loaded document. */
	reset: () => void;
	/** Whether the inline password prompt should render instead of the two buttons. */
	passwordPromptOpen: Ref<boolean>;
	/** Reason the last password attempt failed, or null before any attempt / after success. */
	passwordError: Ref<ModifyPasswordErrorReason | null>;
	/** True while `submitPassword`'s check is in flight (disables the form). */
	checkingPassword: Ref<boolean>;
	/** Check `password` against the deck's `modifyVerifier`; unlocks on a match. */
	submitPassword: (password: string) => Promise<void>;
	/** Close the password prompt without unlocking. */
	cancelPasswordPrompt: () => void;
}

export function useReadOnlyRecommendation(
	input: UseReadOnlyRecommendationInput,
): UseReadOnlyRecommendationResult {
	const dismissed = ref(false);
	const editAnywayGranted = ref(false);
	const passwordPromptOpen = ref(false);
	const passwordError = ref<ModifyPasswordErrorReason | null>(null);
	const checkingPassword = ref(false);

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

	function unlock(): void {
		editAnywayGranted.value = true;
		dismissed.value = true;
		passwordPromptOpen.value = false;
		passwordError.value = null;
	}

	function editAnyway(): void {
		if (recommendation.value.requiresPassword) {
			passwordPromptOpen.value = true;
			passwordError.value = null;
			return;
		}
		unlock();
	}

	function dismiss(): void {
		dismissed.value = true;
	}

	function cancelPasswordPrompt(): void {
		passwordPromptOpen.value = false;
		passwordError.value = null;
	}

	async function submitPassword(password: string): Promise<void> {
		checkingPassword.value = true;
		try {
			const result = await checkModifyPassword(input.modifyVerifier.value, password);
			if (result.ok) {
				unlock();
			} else {
				passwordError.value = result.reason;
			}
		} finally {
			checkingPassword.value = false;
		}
	}

	function reset(): void {
		dismissed.value = false;
		editAnywayGranted.value = false;
		passwordPromptOpen.value = false;
		passwordError.value = null;
		checkingPassword.value = false;
	}

	return {
		recommendation,
		showBanner,
		locked,
		editAnyway,
		dismiss,
		reset,
		passwordPromptOpen,
		passwordError,
		checkingPassword,
		submitPassword,
		cancelPasswordPrompt,
	};
}
