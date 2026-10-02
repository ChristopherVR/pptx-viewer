import type { RibbonControlId } from './customization/ribbon-control-ids';
import type { RibbonHomeClusterSpec, RibbonHomeControlSpec } from './ribbon-home-spec';

/** Builders shared by the Home family spec tables. */
export const control = (
	id: RibbonControlId,
	labelKey: string,
	fallback: string,
	testId?: string,
	extra: Partial<RibbonHomeControlSpec> = {},
): RibbonHomeControlSpec => ({ id, labelKey, fallback, testId, ...extra });

export const strip = (...controls: RibbonHomeControlSpec[]): RibbonHomeClusterSpec => ({
	controls,
});

export const pills = (
	chrome: string | undefined,
	...controls: RibbonHomeControlSpec[]
): RibbonHomeClusterSpec => ({ controls, free: true, chrome });

export const text = (key: string, fallback: string) => ({ key, fallback });
