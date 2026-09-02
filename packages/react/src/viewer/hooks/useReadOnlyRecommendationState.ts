import { readOnlyRecommendation } from 'pptx-viewer-shared';
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { useCallback, useEffect, useState } from 'react';

/**
 * useReadOnlyRecommendationState: whether the currently loaded deck asked to
 * be opened read-only (`p:modifyVerifier` or "Mark as Final"), and the
 * banner/lock state a viewer shows for it.
 *
 * `setRecommendation` is threaded into `useLoadContent` exactly like every
 * other per-load setter, so a fresh load always overwrites the previous
 * deck's recommendation. The banner-visible / edit-anyway flags are session
 * state that resets on the SAME trigger `PowerPointViewer`'s Protected View
 * override already resets on (`content` changing), following that existing
 * pattern rather than inventing a second one.
 */
export function useReadOnlyRecommendationState(content: unknown) {
	const [recommendation, setRecommendation] = useState<ReadOnlyRecommendation>(() =>
		readOnlyRecommendation(undefined),
	);
	const [bannerHidden, setBannerHidden] = useState(false);
	const [editAnywayActive, setEditAnywayActive] = useState(false);

	useEffect(() => {
		setBannerHidden(false);
		setEditAnywayActive(false);
		// `content` is deliberately the sole trigger (a new load), not a value read
		// in the body; mirrors PowerPointViewer's `protectedViewOverridden` reset
		// effect.
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- see comment above
	}, [content]);

	const editAnyway = useCallback(() => {
		setEditAnywayActive(true);
		setBannerHidden(true);
	}, []);

	const dismiss = useCallback(() => {
		setBannerHidden(true);
	}, []);

	return {
		recommendation,
		setRecommendation,
		/** Whether the viewer's `canEdit` should be forced off. */
		locked: recommendation.defaultReadOnly && !editAnywayActive,
		bannerVisible: recommendation.kind !== null && !bannerHidden,
		editAnyway,
		dismiss,
	};
}

export type UseReadOnlyRecommendationStateResult = ReturnType<
	typeof useReadOnlyRecommendationState
>;
