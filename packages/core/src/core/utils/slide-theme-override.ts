import type { PptxSlide, PptxThemeColorScheme } from '../types';
import { mergeThemeColorOverride } from './theme-override-utils';
import { buildThemeColorMap, reResolveSlideColors } from './theme-switching';

/**
 * Apply a colour-map override to one slide and immediately re-resolve its
 * theme-derived colours. The current override is used as the old effective
 * scheme so repeated edits and disabling the override remain reversible.
 */
export function applyThemeOverrideToSlide(
	slide: PptxSlide,
	baseColorScheme: PptxThemeColorScheme,
	nextOverride: Record<string, string> | undefined,
): PptxSlide {
	const previousScheme = mergeThemeColorOverride(baseColorScheme, slide.clrMapOverride);
	const nextScheme = mergeThemeColorOverride(baseColorScheme, nextOverride);
	const [remappedSlide] = reResolveSlideColors(
		[slide],
		buildThemeColorMap(previousScheme),
		nextScheme,
	);

	return {
		...remappedSlide,
		clrMapOverride: nextOverride ? { ...nextOverride } : undefined,
	};
}
