import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { mruColorsPatch, pushRecentColor } from 'pptx-viewer-shared';
import { useCallback } from 'react';
import type React from 'react';

/**
 * useRecentColorsSync: folds a picked colour into the deck's "Recent Colors"
 * list and writes it back into `presentationProperties.mruColors` (`p:clrMru`)
 * OUTSIDE the undo stack, the same way `useViewPreferencesSync` writes view
 * toggles back: `useEditorHistory`'s change detection only watches
 * `slides`/`canvasSize`/`templateElementsBySlideId`, so this never registers
 * as an undo entry, matching PowerPoint (recent colours are not undoable).
 *
 * The actual fold ({@link applyRecentColorPick}) is a plain function with no
 * React imports, so it is unit-tested directly; the hook only wires it to
 * the two state setters.
 */

export interface UseRecentColorsSyncInput {
	setRecentColors: React.Dispatch<React.SetStateAction<string[]>>;
	setPresentationProperties: React.Dispatch<React.SetStateAction<PptxPresentationProperties>>;
}

export interface UseRecentColorsSyncResult {
	/** Fold `hex` into the recent list and persist it; a no-op for an invalid colour. */
	pushColor: (hex: string) => void;
}

/**
 * The next recent-colours list and the deck patch to persist it, or `null`
 * when `hex` was not a valid colour (`pushRecentColor` returns the SAME
 * array reference in that case).
 */
export function applyRecentColorPick(
	recent: readonly string[],
	hex: string,
): { recentColors: string[]; patch: Pick<PptxPresentationProperties, 'mruColors'> } | null {
	const next = pushRecentColor(recent, hex);
	if (next === recent) {
		return null;
	}
	return { recentColors: next, patch: mruColorsPatch(next) };
}

export function useRecentColorsSync(input: UseRecentColorsSyncInput): UseRecentColorsSyncResult {
	const { setRecentColors, setPresentationProperties } = input;

	const pushColor = useCallback(
		(hex: string) => {
			setRecentColors((prev) => {
				const applied = applyRecentColorPick(prev, hex);
				if (!applied) {
					return prev;
				}
				setPresentationProperties((properties) => ({ ...properties, ...applied.patch }));
				return applied.recentColors;
			});
		},
		[setRecentColors, setPresentationProperties],
	);

	return { pushColor };
}
