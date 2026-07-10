import type { PptxElementAnimation } from 'pptx-viewer-core';
import {
	buildClickGroups,
	clampStep,
	pendingElementStyles,
	revealedElementStyles,
} from 'pptx-viewer-shared';
import type { AnimationClickGroup, CSSProperties } from 'pptx-viewer-shared';

/**
 * `AnimationPlayback`: reactive, click-stepped element-animation playback for
 * the Svelte binding's presentation mode. The Svelte-runes analogue of the Vue
 * `useAnimationPlayback` composable, kept out of the SFC so it is unit-testable
 * without a DOM.
 *
 * A slide carries an ordered list of {@link PptxElementAnimation}s. PowerPoint
 * groups them into "click groups": an `onClick` / `onShapeClick` / `onHover`
 * animation starts a new group, while `withPrevious` / `afterPrevious` fold
 * into the group in progress. Advancing the presentation one step reveals one
 * more click group; only when every group is revealed does the slide advance.
 *
 * All of the preset -> CSS mapping and delay chaining is delegated to the
 * framework-agnostic {@link buildClickGroups} / {@link revealedElementStyles} /
 * {@link pendingElementStyles} helpers in `pptx-viewer-shared`; this class only
 * owns the reactive step and exposes the resolved styles as plain getters
 * (reactive when read inside a `$derived` / `$effect` / template).
 */
export interface AnimationPlaybackDeps {
	/** The current slide's animations, in document/timeline order. */
	getAnimations(): PptxElementAnimation[];
}

export class AnimationPlayback {
	/** How many click groups have been revealed so far. */
	#step = $state(0);
	readonly #deps: AnimationPlaybackDeps;

	constructor(deps: AnimationPlaybackDeps) {
		this.#deps = deps;
	}

	/** The current slide's click groups (recomputed from the live animations). */
	get groups(): AnimationClickGroup[] {
		return buildClickGroups(this.#deps.getAnimations());
	}

	/** Number of click groups on the current slide (i.e. how many advance steps). */
	get groupCount(): number {
		return this.groups.length;
	}

	/** The current playback step (revealed click-group count). */
	get step(): number {
		return this.#step;
	}

	/** True once every click group has been revealed. */
	get isComplete(): boolean {
		return this.#step >= this.groupCount;
	}

	/**
	 * `elementId -> CSS` for every animation in the revealed groups (with the
	 * correct cumulative delay for sequential `afterPrevious` chains).
	 */
	get elementStyles(): Map<string, CSSProperties> {
		return revealedElementStyles(this.groups, this.#step);
	}

	/**
	 * `elementId -> hidden CSS` for entrances not yet revealed, so the host can
	 * pre-seed them (hide until their group plays) without a flash.
	 */
	get pendingStyles(): Map<string, CSSProperties> {
		return pendingElementStyles(this.groups, this.#step);
	}

	/**
	 * Reveal the next click group. Returns `true` if a group was revealed,
	 * `false` when playback was already complete (so the caller can fall through
	 * to slide navigation).
	 */
	advance(): boolean {
		const count = this.groupCount;
		if (this.#step >= count) {
			return false;
		}
		this.#step = clampStep(this.#step + 1, count);
		return true;
	}

	/** Reveal every click group at once (jump to the slide's final build state). */
	play(): void {
		this.#step = this.groupCount;
	}

	/** Reset playback to before the first click group. */
	reset(): void {
		this.#step = 0;
	}
}
