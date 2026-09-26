/**
 * sRGB <-> linear-light channel conversion (IEC 61966-2-1 transfer function).
 *
 * PowerPoint mixes a colour's `a:tint` / `a:shade` with white / black in
 * linear light (see `color-transforms.ts`).
 *
 * @module color-linear
 */
import { clampUnitInterval } from './color-primitives';

/** An sRGB channel (0-255) as linear light (0-1). */
export function srgb255ToLinear(channel: number): number {
	const c = clampUnitInterval(channel / 255);
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** A linear-light channel (0-1) as an sRGB channel (0-255, unrounded). */
export function linearToSrgb255(linear: number): number {
	const c = clampUnitInterval(linear);
	return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
}
