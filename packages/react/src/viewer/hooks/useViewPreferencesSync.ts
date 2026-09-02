import type { PptxViewProperties } from 'pptx-viewer-core';
import type { DeckViewPreferences } from 'pptx-viewer-shared';
import {
	DEFAULT_VIEWER_PREFERENCES,
	viewerPreferencesFromViewProperties,
	viewPropertiesPatchFromPreferences,
} from 'pptx-viewer-shared';
import { useCallback, useEffect } from 'react';
import type React from 'react';

/**
 * useViewPreferencesSync: seeds the grid/snap/guides toggles from a loaded
 * deck's `ppt/viewProps.xml` (`viewerPreferencesFromViewProperties`), and
 * writes toggle changes back into `state.viewProperties`
 * (`viewPropertiesPatchFromPreferences`) so a save round-trips them.
 *
 * Seeding fires once per COMPLETED load (`loadVersion`, bumped by
 * `useLoadContent`'s `onContentApplied` after `state.viewProperties` has
 * already been set to the freshly parsed deck's), not on every
 * `viewProperties` reference change, so it does not re-fire in response to
 * its own write-back.
 *
 * Deliberately outside the undo stack: `useEditorHistory`'s change-detection
 * only watches `slides`/`canvasSize`/`templateElementsBySlideId`, so a
 * `viewProperties`-only update never registers as a history entry, matching
 * PowerPoint (view toggles are not undoable).
 */
export interface UseViewPreferencesSyncInput {
	loadVersion: number;
	viewProperties: PptxViewProperties | undefined;
	setViewProperties: React.Dispatch<React.SetStateAction<PptxViewProperties | undefined>>;
	snapToGrid: boolean;
	setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
	/** React's name for `p:viewPr/p:slideViewPr/@snapToObjects`. */
	snapToShape: boolean;
	setSnapToShape: React.Dispatch<React.SetStateAction<boolean>>;
	showGuides: boolean;
	setShowGuides: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseViewPreferencesSyncResult {
	handleSetSnapToGrid: (value: boolean) => void;
	handleSetSnapToShape: (value: boolean) => void;
	handleSetShowGuides: (value: boolean) => void;
}

export function useViewPreferencesSync(
	input: UseViewPreferencesSyncInput,
): UseViewPreferencesSyncResult {
	const {
		loadVersion,
		viewProperties,
		setViewProperties,
		snapToGrid,
		setSnapToGrid,
		snapToShape,
		setSnapToShape,
		showGuides,
		setShowGuides,
	} = input;

	useEffect(() => {
		const seeded = viewerPreferencesFromViewProperties(
			{ viewProperties },
			{ ...DEFAULT_VIEWER_PREFERENCES, snapToGrid, snapToObjects: snapToShape, showGuides },
		);
		setSnapToGrid(seeded.snapToGrid);
		setSnapToShape(seeded.snapToObjects ?? snapToShape);
		setShowGuides(seeded.showGuides ?? showGuides);
		// Re-seed only on a newly completed load, not on every `viewProperties`
		// identity change (a write-back below also creates a new reference).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loadVersion]);

	const patchViewProperties = useCallback(
		(prefsOverride: Partial<DeckViewPreferences>) => {
			setViewProperties((prev) => {
				const merged: DeckViewPreferences = {
					...DEFAULT_VIEWER_PREFERENCES,
					snapToGrid,
					snapToObjects: snapToShape,
					showGuides,
					gridSpacingCx: prev?.gridSpacing?.cx,
					gridSpacingCy: prev?.gridSpacing?.cy,
					...prefsOverride,
				};
				const patch = viewPropertiesPatchFromPreferences(merged);
				return {
					...prev,
					slideViewPr: { ...prev?.slideViewPr, ...patch.slideViewPr },
					...(patch.gridSpacing ? { gridSpacing: patch.gridSpacing } : {}),
				};
			});
		},
		[setViewProperties, snapToGrid, snapToShape, showGuides],
	);

	const handleSetSnapToGrid = useCallback(
		(value: boolean) => {
			setSnapToGrid(value);
			patchViewProperties({ snapToGrid: value });
		},
		[setSnapToGrid, patchViewProperties],
	);

	const handleSetSnapToShape = useCallback(
		(value: boolean) => {
			setSnapToShape(value);
			patchViewProperties({ snapToObjects: value });
		},
		[setSnapToShape, patchViewProperties],
	);

	const handleSetShowGuides = useCallback(
		(value: boolean) => {
			setShowGuides(value);
			patchViewProperties({ showGuides: value });
		},
		[setShowGuides, patchViewProperties],
	);

	return { handleSetSnapToGrid, handleSetSnapToShape, handleSetShowGuides };
}
