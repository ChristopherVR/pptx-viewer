/**
 * ThemeColorMapContext: the loaded deck's resolved theme colour map
 * (`dk1`/`lt1`/`dk2`/`lt2`/`accent1..6`/`hlink`/`folHlink` plus the
 * `bg1`/`tx1`/`bg2`/`tx2` aliases, matching `PptxData.themeColorMap`'s
 * shape), shared by every colour picker in the ribbon toolbar and the
 * inspector so each one can render PowerPoint's real "Theme Colors" grid
 * (`buildThemeColorSwatchGrid`) instead of a hard-coded Office palette.
 *
 * Mirrors {@link ../RecentColorsContext}'s rationale: the provider must sit
 * above both `ViewerToolbarSection` and `ViewerMainContent`, which are
 * siblings in `PowerPointViewer.tsx`, so a value threaded as a prop only
 * through one branch would leave the other reading the empty default.
 */
import { createContext, useContext } from 'react';

export type ThemeColorMapValue = Readonly<Record<string, string>> | undefined;

const ThemeColorMapContext = createContext<ThemeColorMapValue>(undefined);

export const ThemeColorMapProvider = ThemeColorMapContext.Provider;

/** The deck's resolved theme colour map, or `undefined` before a deck is loaded. */
export function useThemeColorMap(): ThemeColorMapValue {
	return useContext(ThemeColorMapContext);
}
