import { THEME_PRESETS, applyThemeToData, themeColorSchemesEqual } from 'pptx-viewer-core';
import type {
	PptxHandler,
	PptxData,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemePreset,
} from 'pptx-viewer-core';
/**
 * useThemeSwitching: React hook for switching presentation themes.
 *
 * Provides a list of built-in theme presets and functions to apply them
 * to the current presentation, updating all element colours immediately.
 */
import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseThemeSwitchingInput {
	/** Ref to the PptxHandler instance. */
	handlerRef: RefObject<PptxHandler | null>;
	/** Current parsed presentation data (null when nothing is loaded). */
	data: PptxData | null;
	/** Callback to update the presentation data after theme switch. */
	onDataChange: (newData: PptxData) => void;
	/** Optional callback fired when theme switch completes successfully. */
	onThemeChanged?: (preset: PptxThemePreset) => void;
}

export interface ThemeSwitchingResult {
	/** All available built-in theme presets. */
	presets: readonly PptxThemePreset[];

	/**
	 * Apply a theme preset to the current presentation.
	 * Updates both the in-memory ZIP and all resolved element colours.
	 */
	switchToPreset: (preset: PptxThemePreset) => Promise<void>;

	/**
	 * Apply a custom colour scheme (and optional font scheme) to the
	 * current presentation.
	 */
	switchToCustom: (
		colorScheme: PptxThemeColorScheme,
		fontScheme?: PptxThemeFontScheme,
		themeName?: string,
	) => Promise<void>;

	/**
	 * Get the preset matching the current presentation theme (if any).
	 * Returns undefined if the current theme does not match a built-in preset.
	 */
	currentPreset: PptxThemePreset | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook providing theme switching capabilities for the PowerPoint viewer.
 *
 * @example
 * ```tsx
 * const { presets, switchToPreset, currentPreset } = useThemeSwitching({
 *   handlerRef,
 *   data,
 *   onDataChange: setData,
 * });
 *
 * return (
 *   <div>
 *     {presets.map(preset => (
 *       <button
 *         key={preset.id}
 *         onClick={() => switchToPreset(preset)}
 *         aria-pressed={preset.id === currentPreset?.id}
 *       >
 *         {preset.name}
 *       </button>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useThemeSwitching(input: UseThemeSwitchingInput): ThemeSwitchingResult {
	const { handlerRef, data, onDataChange, onThemeChanged } = input;

	const switchToPreset = useCallback(
		async (preset: PptxThemePreset) => {
			const handler = handlerRef.current;
			if (!handler || !data) {
				return;
			}

			try {
				// Update the ZIP-level theme data for save round-trip
				await handler.applyTheme(preset.colorScheme, preset.fontScheme, preset.name);

				// Re-resolve all element colours in the parsed data
				const newData = applyThemeToData(data, preset.colorScheme, preset.fontScheme, preset.name);

				onDataChange(newData);
				onThemeChanged?.(preset);
			} catch (error) {
				console.error('Failed to switch theme preset:', error);
			}
		},
		[handlerRef, data, onDataChange, onThemeChanged],
	);

	const switchToCustom = useCallback(
		async (
			colorScheme: PptxThemeColorScheme,
			fontScheme?: PptxThemeFontScheme,
			themeName?: string,
		) => {
			const handler = handlerRef.current;
			if (!handler || !data) {
				return;
			}

			try {
				await handler.applyTheme(colorScheme, fontScheme ?? {}, themeName);

				const newData = applyThemeToData(data, colorScheme, fontScheme, themeName);

				onDataChange(newData);
			} catch (error) {
				console.error('Failed to switch to custom theme:', error);
			}
		},
		[handlerRef, data, onDataChange],
	);

	const currentPreset = useMemo(() => {
		if (!data?.theme?.colorScheme) {
			return undefined;
		}
		return THEME_PRESETS.find((p) =>
			themeColorSchemesEqual(data.theme?.colorScheme, p.colorScheme),
		);
	}, [data?.theme?.colorScheme]);

	return {
		presets: THEME_PRESETS,
		switchToPreset,
		switchToCustom,
		currentPreset,
	};
}
