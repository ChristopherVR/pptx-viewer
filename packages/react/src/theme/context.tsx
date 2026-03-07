import { createContext, useContext, useMemo } from "react";
import type { ViewerTheme } from "./types";
import { themeToCssVars } from "./css-vars";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ViewerThemeContext = createContext<ViewerTheme | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ViewerThemeProviderProps {
	theme?: ViewerTheme;
	children: React.ReactNode;
}

/**
 * Provides a `ViewerTheme` to all descendant viewer components.
 *
 * Typically you do **not** need to use this directly — passing a `theme`
 * prop to `<PowerPointViewer>` is sufficient. This provider is exposed
 * for advanced use-cases where you want to wrap multiple viewers or
 * share a theme across a wider subtree.
 */
export function ViewerThemeProvider({
	theme,
	children,
}: ViewerThemeProviderProps) {
	return (
		<ViewerThemeContext.Provider value={theme}>
			{children}
		</ViewerThemeContext.Provider>
	);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the active `ViewerTheme` (if any) from the nearest
 * `ViewerThemeProvider`.
 */
export function useViewerTheme(): ViewerTheme | undefined {
	return useContext(ViewerThemeContext);
}

/**
 * Returns a memoised `style` object containing CSS custom properties
 * derived from the active theme. Spread this onto the viewer root element.
 */
export function useThemeStyle(
	theme: ViewerTheme | undefined,
): React.CSSProperties | undefined {
	return useMemo(() => {
		if (!theme) return undefined;
		const vars = themeToCssVars(theme);
		if (Object.keys(vars).length === 0) return undefined;
		return vars as React.CSSProperties;
	}, [theme]);
}
