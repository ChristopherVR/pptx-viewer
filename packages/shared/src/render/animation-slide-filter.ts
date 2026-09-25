/**
 * `animation-slide-filter`: the `slide(<fromEdge>)` `p:animEffect` filter as
 * the element's content sliding in through a fixed window.
 *
 * Ground truth (PowerPoint 365, a COM-authored Wipe whose `@filter` was
 * rewritten to `slide(fromLeft)` / `slide(fromBottom)` by hand, then
 * `Presentation.CreateVideo` at 62.5 fps on a 200x200 rectangle carrying
 * text): the content itself translates in from the named edge, clipped to a
 * window fixed on the slide. The window is the box plus a soft ramp about
 * 14% of the box extent wide that lies OUTSIDE the box on the entry side, so
 * the content starts fully inside that ramp (translated by 114%) and ends at
 * rest. Progress is linear. The exit plays the same slide time-reversed: the
 * content leaves through the edge it names.
 *
 * `cover`, `uncover`, `push` and `pull` are NOT animated by PowerPoint at
 * all (same capture method): the entrance appears at the effect's start and
 * the exit vanishes at its end, which the `cutIn`/`cutOut` keyframes already
 * play (see `animation-filter-effects`).
 *
 * The window is a gradient mask sized 3x the box on the travel axis; its
 * `mask-position` moves opposite to the `transform` so the window stays put
 * on the slide while the content moves. Both animate linearly between two
 * keyframes, so they stay in lockstep under any timing function.
 *
 * @module render/animation-slide-filter
 */

/** The edge the content enters through (the `slide(from*)` subtype). */
export type SlideFromEdge = 'Left' | 'Right' | 'Top' | 'Bottom';

/** Soft ramp width outside the box, as a fraction of the box extent. */
export const SLIDE_FEATHER = 0.14;

/** Every slide keyframe name, by class and edge. */
export type SlideFilterEffectName = `slideIn${SlideFromEdge}` | `slideOut${SlideFromEdge}`;

const EDGES: readonly SlideFromEdge[] = ['Left', 'Right', 'Top', 'Bottom'];

const TOKEN_TO_EDGE: Readonly<Record<string, SlideFromEdge>> = {
	fromLeft: 'Left',
	fromRight: 'Right',
	fromTop: 'Top',
	fromBottom: 'Bottom',
};

/** The slide effect for a filter subtype token (bottom edge when absent/unknown). */
export function slideFilterEffectName(
	subtype: string | undefined,
	isExit: boolean,
): SlideFilterEffectName {
	const edge = (subtype && TOKEN_TO_EDGE[subtype]) || 'Bottom';
	return isExit ? `slideOut${edge}` : `slideIn${edge}`;
}

function pct(value: number): string {
	return `${(value * 100).toFixed(3)}%`;
}

interface SlideFrame {
	transform: string;
	maskImage: string;
	maskSize: string;
	maskPosition: string;
}

/**
 * The transform + window mask at linear progress `p` (0 = content fully
 * outside the window, 1 = at rest) for content entering through `edge`.
 *
 * Derivation (for `Left`, box width `W`, window `[-F W, W]` on the slide,
 * mask image `3W` wide with the window at image `[W, (2 + F) W]`): the
 * content translates by `T = -(1 + F) W (1 - p)`, so the image offset that
 * keeps the window fixed is `o = -(1 + F) W p`, a `mask-position` of
 * `p (1 + F) / 2` of the `2W` free travel. `Right`/`Bottom` mirror it.
 */
export function slideFrameAt(edge: SlideFromEdge, progress: number): SlideFrame {
	const p = Math.max(0, Math.min(1, progress));
	const horizontal = edge === 'Left' || edge === 'Right';
	const fromStart = edge === 'Left' || edge === 'Top';
	const travel = (1 + SLIDE_FEATHER) * (1 - p);
	const q = (p * (1 + SLIDE_FEATHER)) / 2;
	const position = fromStart ? q : 1 - q;
	const sign = fromStart ? '-' : '';
	const translate = horizontal
		? `translateX(${sign}${pct(travel)})`
		: `translateY(${sign}${pct(travel)})`;
	const direction = horizontal
		? fromStart
			? 'to right'
			: 'to left'
		: fromStart
			? 'to bottom'
			: 'to top';
	const rampEnd = (1 + SLIDE_FEATHER) / 3;
	const windowEnd = (2 + SLIDE_FEATHER) / 3;
	const maskImage = `linear-gradient(${direction}, transparent ${pct(1 / 3)}, #000 ${pct(rampEnd)}, #000 ${pct(windowEnd)}, transparent ${pct(windowEnd)})`;
	return {
		transform: translate,
		maskImage,
		maskSize: horizontal ? '300% 100%' : '100% 300%',
		maskPosition: horizontal ? `${pct(position)} 0%` : `0% ${pct(position)}`,
	};
}

function frameDecl(frame: SlideFrame): string {
	return `transform: ${frame.transform}; mask-image: ${frame.maskImage}; mask-size: ${frame.maskSize}; mask-repeat: no-repeat; mask-position: ${frame.maskPosition}; opacity: 1;`;
}

/** CamelCase inline-style map for a slide entrance's HIDDEN state. */
export function slideInitialStyle(edge: SlideFromEdge): Record<string, string | number> {
	const frame = slideFrameAt(edge, 0);
	return { ...frame, maskRepeat: 'no-repeat', opacity: 1 };
}

/** The entrance edge a `slideIn*` effect name encodes, or `undefined`. */
export function slideEntranceEdge(effect: string): SlideFromEdge | undefined {
	return EDGES.find((edge) => effect === `slideIn${edge}`);
}

function buildKeyframes(edge: SlideFromEdge, isExit: boolean): string {
	const name = isExit ? `slideOut${edge}` : `slideIn${edge}`;
	const from = frameDecl(slideFrameAt(edge, isExit ? 1 : 0));
	const to = frameDecl(slideFrameAt(edge, isExit ? 0 : 1));
	return `@keyframes pptx-${name} {\n\tfrom { ${from} }\n\tto { ${to} }\n}`;
}

/** Static `@keyframes` for every slide edge, entrance and exit. */
export const SLIDE_FILTER_KEYFRAME_DEFINITIONS = Object.fromEntries(
	EDGES.flatMap((edge) => [
		[`slideIn${edge}`, buildKeyframes(edge, false)],
		[`slideOut${edge}`, buildKeyframes(edge, true)],
	]),
) as Record<SlideFilterEffectName, string>;
