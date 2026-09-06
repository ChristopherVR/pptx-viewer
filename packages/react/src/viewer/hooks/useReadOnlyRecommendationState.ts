import type { PptxModifyVerifier } from 'pptx-viewer-core';
import { checkModifyPassword, readOnlyRecommendation } from 'pptx-viewer-shared';
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { useCallback, useEffect, useState } from 'react';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = 'wrong-password' | 'unsupported-algorithm';

/**
 * useReadOnlyRecommendationState: whether the currently loaded deck asked to
 * be opened read-only (`p:modifyVerifier` or "Mark as Final"), and the
 * banner/lock state a viewer shows for it.
 *
 * When the recommendation's `requiresPassword` is set (a `modifyVerifier`
 * with a hash this viewer can actually check), "Edit anyway" no longer lifts
 * the lock immediately: it opens an inline password prompt, and only a
 * correct password (verified by `checkModifyPassword` against core's ECMA-376
 * hash check) unlocks. A wrong password leaves the deck read-only, matching
 * PowerPoint's own "read-only recommended" prompt.
 *
 * `setRecommendation`/`setModifyVerifier` are threaded into `useLoadContent`
 * exactly like every other per-load setter, so a fresh load always overwrites
 * the previous deck's recommendation. The banner-visible / edit-anyway /
 * password-prompt flags are session state that resets on the SAME trigger
 * `PowerPointViewer`'s Protected View override already resets on (`content`
 * changing), following that existing pattern rather than inventing a second
 * one.
 */
export function useReadOnlyRecommendationState(content: unknown) {
	const [recommendation, setRecommendation] = useState<ReadOnlyRecommendation>(() =>
		readOnlyRecommendation(undefined),
	);
	const [modifyVerifier, setModifyVerifier] = useState<PptxModifyVerifier | undefined>(undefined);
	const [bannerHidden, setBannerHidden] = useState(false);
	const [editAnywayActive, setEditAnywayActive] = useState(false);
	const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
	const [passwordError, setPasswordError] = useState<ModifyPasswordErrorReason | null>(null);
	const [checkingPassword, setCheckingPassword] = useState(false);

	useEffect(() => {
		setBannerHidden(false);
		setEditAnywayActive(false);
		setPasswordPromptOpen(false);
		setPasswordError(null);
		setCheckingPassword(false);
		// `content` is deliberately the sole trigger (a new load), not a value read
		// in the body; mirrors PowerPointViewer's `protectedViewOverridden` reset
		// effect.
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- see comment above
	}, [content]);

	const unlock = useCallback(() => {
		setEditAnywayActive(true);
		setBannerHidden(true);
		setPasswordPromptOpen(false);
		setPasswordError(null);
	}, []);

	/** The banner's "Edit anyway": opens the password prompt when one is required, else unlocks. */
	const editAnyway = useCallback(() => {
		if (recommendation.requiresPassword) {
			setPasswordPromptOpen(true);
			setPasswordError(null);
			return;
		}
		unlock();
	}, [recommendation.requiresPassword, unlock]);

	const dismiss = useCallback(() => {
		setBannerHidden(true);
	}, []);

	const cancelPasswordPrompt = useCallback(() => {
		setPasswordPromptOpen(false);
		setPasswordError(null);
	}, []);

	/** Check `password` against the deck's `modifyVerifier`; unlocks on a match. */
	const submitPassword = useCallback(
		async (password: string) => {
			setCheckingPassword(true);
			try {
				const result = await checkModifyPassword(modifyVerifier, password);
				if (result.ok) {
					unlock();
				} else {
					setPasswordError(result.reason);
				}
			} finally {
				setCheckingPassword(false);
			}
			// Both deps ARE read above (inside the `try`), but the analyzer doesn't
			// see through an `await` call wrapped in try/finally and flags them as
			// extra; same false positive documented in `useLayoutSwitching.ts`.
		},
		// oxlint-disable-next-line react/memo-dependencies -- see comment above
		[modifyVerifier, unlock],
	);

	return {
		recommendation,
		setRecommendation,
		setModifyVerifier,
		/** Whether the viewer's `canEdit` should be forced off. */
		locked: recommendation.defaultReadOnly && !editAnywayActive,
		bannerVisible: recommendation.kind !== null && !bannerHidden,
		editAnyway,
		dismiss,
		/** Whether the inline password prompt should render in place of the banner's buttons. */
		passwordPromptOpen,
		/** Reason the last password attempt failed, or null before any attempt / after success. */
		passwordError,
		/** True while `submitPassword`'s check is in flight (disables the form). */
		checkingPassword,
		submitPassword,
		cancelPasswordPrompt,
	};
}

export type UseReadOnlyRecommendationStateResult = ReturnType<
	typeof useReadOnlyRecommendationState
>;
