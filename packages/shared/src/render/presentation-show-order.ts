/**
 * presentation-show-order.ts: which slides a running slide show visits, and in
 * what order.
 *
 * PowerPoint's "Hide Slide" marks a slide to be SKIPPED while presenting while
 * keeping it in the deck, the editor, the thumbnail rail and the slide sorter.
 * That single rule reaches into next, previous, Home, End, the end-of-show
 * boundary and presenter view's next-slide preview, so every binding needs the
 * same answer to "what comes after this slide". Four of the five bindings
 * previously answered `currentIndex + 1` and presented slides their author had
 * deliberately hidden; the rule lives here so they cannot drift again.
 *
 * Deliberately NOT covered here:
 * - Jumping to a slide by typing its number. PowerPoint reaches a HIDDEN slide
 *   that way on purpose (it is the documented escape hatch for backup slides),
 *   so a direct jump must bypass this module and clamp against the whole deck.
 * - Where a show STARTS. "From Current Slide" on a hidden slide is an explicit
 *   request for that slide, exactly like a typed jump, so it is honoured; the
 *   first forward press then escapes to the next slide the show visits.
 * - The editor, the thumbnail rail and the slide sorter, which all keep showing
 *   hidden slides (usually dimmed). Hiding is a slide-show rule, not a deck rule.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */

/**
 * The slide fields the show-order rules read. Deliberately structural rather
 * than `PptxSlide` so a binding can pass its own lighter view model.
 */
export interface ShowOrderSlide {
	/** Relationship id (`r:id` in `p:sldIdLst`), how custom shows name slides. */
	readonly rId?: string;
	/** Slide id, the fallback key when a custom show stores ids instead. */
	readonly id?: string;
	/** `p:sld/@show="0"`: skip this slide during the show. */
	readonly hidden?: boolean;
}

/**
 * An active custom show's membership. Accepts either key the bindings carry:
 * `slideRIds` (core's parsed `p:custShow`) or `slideIds`.
 */
export interface ShowOrderCustomShow {
	readonly slideRIds?: readonly string[];
	readonly slideIds?: readonly string[];
}

export interface NextShowSlideOptions {
	/**
	 * PowerPoint's "Loop continuously until Esc". When set, running off the end
	 * wraps to the first slide of the show instead of ending it.
	 */
	readonly loop?: boolean;
}

/** Resolve a custom show's membership to deck indexes, preserving show order. */
function resolveCustomShowIndexes(
	slides: readonly ShowOrderSlide[],
	customShow: ShowOrderCustomShow,
): number[] {
	const keys = customShow.slideRIds ?? customShow.slideIds;
	if (!keys || keys.length === 0) {
		return [];
	}
	const byKey = new Map<string, number>();
	slides.forEach((slide, index) => {
		// `id` is registered first so a matching `rId` wins on collision: custom
		// shows name slides by relationship id in every deck PowerPoint writes.
		if (slide.id !== undefined && !byKey.has(slide.id)) {
			byKey.set(slide.id, index);
		}
	});
	slides.forEach((slide, index) => {
		if (slide.rId !== undefined) {
			byKey.set(slide.rId, index);
		}
	});
	const resolved: number[] = [];
	for (const key of keys) {
		const index = byKey.get(key);
		if (index !== undefined) {
			resolved.push(index);
		}
	}
	return resolved;
}

/**
 * The ordered deck indexes a running show visits: the active custom show's
 * membership (or the whole deck) with hidden slides removed.
 *
 * Hidden slides are dropped from a custom show too. Membership and the Hide
 * Slide checkbox are independent switches in PowerPoint and hiding wins, so a
 * slide pulled out of rotation stays out of every show it belongs to.
 *
 * When that leaves nothing to present the result falls back, first to the
 * unfiltered membership and then to the whole deck. This is a deliberate
 * deviation: PowerPoint would put up an immediate end-of-show screen, but an
 * embedded viewer that answers "Present" with an inert black rectangle reads as
 * a broken component, and a deck where EVERY slide is hidden is far more likely
 * to be mis-tagged than genuinely unpresentable.
 */
export function resolveShowSlideIndexes(
	slides: readonly ShowOrderSlide[],
	activeCustomShow?: ShowOrderCustomShow | null,
): number[] {
	const all: number[] = [];
	for (let index = 0; index < slides.length; index++) {
		all.push(index);
	}
	const base = activeCustomShow ? resolveCustomShowIndexes(slides, activeCustomShow) : all;
	const effectiveBase = base.length > 0 ? base : all;
	const visible = effectiveBase.filter((index) => !slides[index]?.hidden);
	return visible.length > 0 ? visible : effectiveBase;
}

/**
 * The show position of `deckIndex`, or -1 when the show does not include it.
 *
 * A show CAN sit on a slide it does not include: PowerPoint's typed-number jump
 * lands on hidden slides on purpose, and an audience display is pushed whatever
 * index the presenter is on. Both need next/previous to keep working from there.
 */
function showPosition(deckIndex: number, showIndexes: readonly number[]): number {
	return showIndexes.indexOf(deckIndex);
}

/**
 * The next slide the show visits after `deckIndex`, or `undefined` when the
 * show has run off its end (the caller then raises the end-of-show screen or
 * exits, per "End with black slide").
 *
 * From a slide the show does not include, "next" is the first show slide that
 * comes later in the DECK, which is how a presenter escapes forward from a
 * hidden slide they jumped to by number.
 */
export function nextShowSlideIndex(
	deckIndex: number,
	showIndexes: readonly number[],
	options?: NextShowSlideOptions,
): number | undefined {
	if (showIndexes.length === 0) {
		return undefined;
	}
	const position = showPosition(deckIndex, showIndexes);
	if (position >= 0) {
		if (position + 1 < showIndexes.length) {
			return showIndexes[position + 1];
		}
		return options?.loop ? showIndexes[0] : undefined;
	}
	for (const candidate of showIndexes) {
		if (candidate > deckIndex) {
			return candidate;
		}
	}
	return options?.loop ? showIndexes[0] : undefined;
}

/**
 * The slide the show returns to before `deckIndex`, or `undefined` at the
 * start of the show (the caller then stays put; PowerPoint never wraps
 * backward, not even with "Loop continuously").
 */
export function previousShowSlideIndex(
	deckIndex: number,
	showIndexes: readonly number[],
): number | undefined {
	if (showIndexes.length === 0) {
		return undefined;
	}
	const position = showPosition(deckIndex, showIndexes);
	if (position >= 0) {
		return position > 0 ? showIndexes[position - 1] : undefined;
	}
	// Off-list (a hidden slide reached by typed number): step back to the last
	// show slide that comes earlier in the deck. `findLast` is unavailable here
	// (Angular vendors this source and compiles it at a lower lib target), so
	// this scans forward and keeps the last match.
	let previous: number | undefined;
	for (const candidate of showIndexes) {
		if (candidate < deckIndex) {
			previous = candidate;
		}
	}
	return previous;
}

/**
 * Whether the show has a slide after `deckIndex`.
 *
 * Distinct from `nextShowSlideIndex(...).loop`: a looping show ALWAYS has a
 * next slide, but "is this the end of the deck" still decides whether a
 * non-looping show puts up the end screen, so this ignores looping entirely.
 */
export function hasShowSlideAfter(deckIndex: number, showIndexes: readonly number[]): boolean {
	return nextShowSlideIndex(deckIndex, showIndexes) !== undefined;
}

/**
 * The slide a presenter view previews as "coming up next".
 *
 * It MUST be the slide the next forward press will actually land on, so this
 * runs the same show-order rule rather than reading `slides[index + 1]`: a
 * preview that shows a hidden slide the show is about to skip is worse than no
 * preview, because the presenter rehearses a segue to a slide the room never
 * sees. Custom shows are out of scope here (presenter previews run against the
 * live deck); pass explicit show indexes to `nextShowSlideIndex` when one is
 * active.
 */
export function nextPresentedSlide<T extends ShowOrderSlide>(
	slides: readonly T[],
	deckIndex: number,
): T | undefined {
	const next = nextShowSlideIndex(deckIndex, resolveShowSlideIndexes(slides));
	return next === undefined ? undefined : slides[next];
}

/** The show's first slide (PowerPoint's Home key), or `undefined` when empty. */
export function firstShowSlideIndex(showIndexes: readonly number[]): number | undefined {
	return showIndexes.length > 0 ? showIndexes[0] : undefined;
}

/** The show's last slide (PowerPoint's End key), or `undefined` when empty. */
export function lastShowSlideIndex(showIndexes: readonly number[]): number | undefined {
	return showIndexes.length > 0 ? showIndexes[showIndexes.length - 1] : undefined;
}
