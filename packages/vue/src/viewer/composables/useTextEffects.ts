/**
 * Pure helpers shared by the Vue text-effects authoring UI (shadow / glow /
 * reflection, text warp, and 3D-text). Framework-light: only depends on core
 * `TextStyle` typing, so the SFCs stay thin presentation. Mirrors the React
 * `TextEffectsPanel` / `Text3DProperties` defaults and the `numChange` factory.
 */
import type { TextStyle } from 'pptx-viewer-core';

/** EMU per typographic point (1pt = 12700 EMU). */
export const EMU_PER_PT = 12700;

/** Convert EMU to points for display (0 when unset). */
export function emuToPt(emu: number | undefined): number {
	if (!emu) {
		return 0;
	}
	return Math.round(emu / EMU_PER_PT);
}

/** Convert points to EMU for storage. */
export function ptToEmu(pt: number): number {
	return Math.round(pt * EMU_PER_PT);
}

/** Clamp `value` into the inclusive `[lo, hi]` range. */
export function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

/**
 * Factory mirroring React's `numChange`: given an `apply` callback, returns a
 * builder that takes a `fn` mapping a numeric input value to a `TextStyle`
 * patch and yields a DOM input handler. The handler reads the field value and,
 * when finite, forwards `fn(value)` to `apply`.
 */
export function createNumberHandler(
	apply: (patch: Partial<TextStyle>) => void,
): (fn: (v: number) => Partial<TextStyle>) => (event: Event) => void {
	return (fn) => (event) => {
		const v = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(v)) {
			apply(fn(v));
		}
	};
}

// ── Default effect objects (mirror the React enable/disable branches) ───────

export const DEFAULT_TEXT_SHADOW: Partial<TextStyle> = {
	textShadowColor: '#000000',
	textShadowBlur: 4,
	textShadowOffsetX: 2,
	textShadowOffsetY: 2,
	textShadowOpacity: 0.5,
};

export const CLEAR_TEXT_SHADOW: Partial<TextStyle> = {
	textShadowColor: undefined,
	textShadowBlur: undefined,
	textShadowOffsetX: undefined,
	textShadowOffsetY: undefined,
	textShadowOpacity: undefined,
};

export const DEFAULT_TEXT_GLOW: Partial<TextStyle> = {
	textGlowColor: '#ffff00',
	textGlowRadius: 6,
	textGlowOpacity: 0.6,
};

export const CLEAR_TEXT_GLOW: Partial<TextStyle> = {
	textGlowColor: undefined,
	textGlowRadius: undefined,
	textGlowOpacity: undefined,
};

export const DEFAULT_TEXT_REFLECTION: Partial<TextStyle> = {
	textReflection: true,
	textReflectionBlur: 1,
	textReflectionStartOpacity: 0.5,
	textReflectionEndOpacity: 0,
	textReflectionOffset: 3,
};

export const CLEAR_TEXT_REFLECTION: Partial<TextStyle> = {
	textReflection: undefined,
	textReflectionBlur: undefined,
	textReflectionStartOpacity: undefined,
	textReflectionEndOpacity: undefined,
	textReflectionOffset: undefined,
};
