/**
 * RecentColorsContext: the deck's "Recent Colors" row (`p:clrMru`), shared by
 * every colour picker in the inspector.
 *
 * React previously threaded a `recentColors` prop down through
 * `FillStrokeProperties` -> `StrokeEffectsSection` -> `ColorPickerRow`, and
 * every call site fed it a hard-coded empty array (`ShapeTextPanels`'s
 * `EMPTY_RECENT_COLORS`); the fill colour's own `ColorPickerRow` did not even
 * receive the prop. A context avoids re-creating that plumbing (and its gaps)
 * for every picker: `ColorPickerRow` and `DebouncedColorInput` both read
 * `pushColor` from here directly, so a colour picked ANYWHERE in the
 * inspector (fill, stroke, text, background, table cell, chart series, ...)
 * feeds the same MRU list, seeded once from the loaded deck.
 */
import { createContext, useContext } from 'react';

export interface RecentColorsContextValue {
	recentColors: string[];
	/** Fold a picked colour into the list and persist it (`p:clrMru`). */
	pushColor: (hex: string) => void;
}

const DEFAULT_VALUE: RecentColorsContextValue = {
	recentColors: [],
	pushColor: () => {},
};

const RecentColorsContext = createContext<RecentColorsContextValue>(DEFAULT_VALUE);

export const RecentColorsProvider = RecentColorsContext.Provider;

export function useRecentColors(): RecentColorsContextValue {
	return useContext(RecentColorsContext);
}
