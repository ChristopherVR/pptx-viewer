/**
 * Preset tables for the Picture Format > Adjust galleries (Corrections, Color).
 * Pure data: each preset carries the value it writes onto the picture's
 * `imageEffects` (the a14 Corrections / Color fields core already parses,
 * renders and serialises), in the units the model stores.
 *
 * @module render/ribbon-galleries/picture-adjust-catalog
 */

/** Sharpen/Soften presets in percent: negative softens, positive sharpens. */
export const SHARPEN_SOFTEN_PERCENTS = [-50, -25, 0, 25, 50] as const;

/** Brightness / contrast steps in percent, as PowerPoint's 5x5 grid. */
export const BRIGHTNESS_CONTRAST_STEPS = [-40, -20, 0, 20, 40] as const;

/** Colour saturation presets in percent (100 is unchanged). */
export const SATURATION_PERCENTS = [0, 33, 66, 100, 133, 166, 200, 300, 400] as const;

/** Colour temperature presets in Kelvin (6500 is neutral). */
export const TEMPERATURES_K = [4700, 5300, 5900, 6500, 7200, 8000, 8800, 9600, 10600] as const;

/** `a14:saturation/@sat` percent that leaves the picture unchanged. */
export const NEUTRAL_SATURATION_PERCENT = 100;
/** `a14:colorTemperature/@colorTemp` Kelvin value that leaves the picture unchanged. */
export const NEUTRAL_TEMPERATURE_K = 6500;

/** Black and White thresholds in percent (`a:biLevel/@thresh`). */
export const BI_LEVEL_THRESHOLDS = [25, 50, 75] as const;

/** `a:lum` values of PowerPoint's Washout recolor. */
export const WASHOUT_LUM = { bright: 70, contrast: -70 } as const;

/** Sepia as PowerPoint writes it: a black to warm-tan duotone. */
export const SEPIA_DUOTONE = { color1: '#000000', color2: '#D9C3A5' } as const;

/** Theme accent slots offered as duotone recolors, with fallbacks (Office theme). */
export const RECOLOR_ACCENTS: ReadonlyArray<{ key: string; fallback: string }> = [
	{ key: 'accent1', fallback: '#156082' },
	{ key: 'accent2', fallback: '#E97132' },
	{ key: 'accent3', fallback: '#196B24' },
	{ key: 'accent4', fallback: '#0F9ED5' },
	{ key: 'accent5', fallback: '#A02B93' },
	{ key: 'accent6', fallback: '#4EA72E' },
];

/** Signed percent for a label: `+20`, `-40`, `0`. */
export function signedPercent(value: number): string {
	return value > 0 ? `+${value}` : String(value);
}

function parseHex(color: string): [number, number, number] | null {
	const match = /^#?([0-9a-f]{6})$/iu.exec(color.trim());
	if (!match) {
		return null;
	}
	const n = Number.parseInt(match[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `color` mixed toward `target` by `amount` (0..1), as an upper-case `#RRGGBB`. */
export function mixHex(color: string, target: string, amount: number): string {
	const a = parseHex(color);
	const b = parseHex(target);
	if (!a || !b) {
		return color;
	}
	const channel = (i: number) =>
		Math.round(a[i] + (b[i] - a[i]) * amount)
			.toString(16)
			.padStart(2, '0');
	return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

/** The duotone colour pair of an accent recolor: black-to-accent (Dark), shade-to-white (Light). */
export function accentDuotone(
	accentHex: string,
	variant: 'dark' | 'light',
): { color1: string; color2: string } {
	return variant === 'dark'
		? { color1: '#000000', color2: accentHex.toUpperCase() }
		: { color1: mixHex(accentHex, '#000000', 0.45), color2: '#FFFFFF' };
}

/** Resolve accent `slot` from the deck's theme colour map, else the Office fallback. */
export function resolveAccentHex(
	themeColorMap: Readonly<Record<string, string>> | undefined,
	slot: { key: string; fallback: string },
): string {
	const value = themeColorMap?.[slot.key];
	return value && parseHex(value) ? `#${value.replace('#', '')}`.toUpperCase() : slot.fallback;
}
