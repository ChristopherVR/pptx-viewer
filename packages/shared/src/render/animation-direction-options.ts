/**
 * `animation-direction-options` - which directions the Animation pane offers
 * for a preset: only the ones PowerPoint itself has a variant (a
 * `presetSubtype`) for, so a picked direction always saves as a subtype and
 * behaviour tree PowerPoint recognises.
 *
 * Ground truth: every `MsoAnimEffect` was driven through COM with every
 * `MsoAnimDirection` it accepts and the saved subtype read back (core's
 * `animation-behavior-captures.json`). Fly and Crawl accept all eight
 * directions (edges and corners); Wipe, Peek and Stretch accept the four
 * edges; Float In has no direction at all (Float Up / Float Down are
 * separate presets), so it no longer shows a picker that saved nothing.
 *
 * @module render/animation-direction-options
 */
import type { PptxAnimationDirection, PptxElementAnimation } from 'pptx-viewer-core';

/** Every direction value, edges first then corners. */
export const DIRECTION_VALUES: readonly PptxAnimationDirection[] = [
	'fromTop',
	'fromBottom',
	'fromLeft',
	'fromRight',
	'fromTopLeft',
	'fromTopRight',
	'fromBottomLeft',
	'fromBottomRight',
];

const EDGES: readonly PptxAnimationDirection[] = DIRECTION_VALUES.slice(0, 4);

const PRESET_DIRECTIONS: Readonly<Record<string, readonly PptxAnimationDirection[]>> = {
	flyIn: DIRECTION_VALUES,
	flyOut: DIRECTION_VALUES,
	crawlIn: DIRECTION_VALUES,
	crawlOut: DIRECTION_VALUES,
	wipeIn: EDGES,
	wipeOut: EDGES,
	peekIn: EDGES,
	peekOut: EDGES,
	stretchIn: EDGES,
};

/** Presets that expose the direction picker. */
export const DIRECTIONAL_PRESETS: ReadonlySet<string> = new Set(Object.keys(PRESET_DIRECTIONS));

/** The directions `preset` offers, empty when it has none. */
export function directionValuesForPreset(
	preset: string | undefined,
): readonly PptxAnimationDirection[] {
	return (preset && PRESET_DIRECTIONS[preset]) || [];
}

/**
 * The direction a picker shows for an entry: its own, else PowerPoint's
 * default for every directional preset here ("From Bottom", subtype 4;
 * Stretch's default "Across" has no picker value, so its first edge).
 */
export function effectiveDirection(
	entry: Pick<PptxElementAnimation, 'direction'> | undefined,
	values: readonly PptxAnimationDirection[],
): PptxAnimationDirection | undefined {
	if (entry?.direction && values.includes(entry.direction)) {
		return entry.direction;
	}
	return values.includes('fromBottom') ? 'fromBottom' : values[0];
}

/**
 * The directions offered for an element's animation entry: its entrance's,
 * else its exit's (the pane edits one `direction` per entry). Empty when the
 * element has no directional preset.
 */
export function directionValuesFor(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): readonly PptxAnimationDirection[] {
	const entry = slideAnimations.find((a) => a.elementId === elementId);
	if (!entry) {
		return [];
	}
	const entrance = directionValuesForPreset(entry.entrance);
	return entrance.length > 0 ? entrance : directionValuesForPreset(entry.exit);
}
