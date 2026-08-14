/**
 * presentation-stage-animator.test.ts: the slide show's DOM applier, and the
 * timing contract it has to meet.
 *
 * THE REGRESSION (Angular only): a click-advance's CSS animation reached the
 * DOM one change-detection cycle plus one `afterNextRender` hook after the key
 * press that caused it, measured at ~24ms (1.5 frames) in the demo. React, Vue,
 * Svelte and Vanilla all have the animation on the element inside the key
 * handler's own task, so Angular alone dropped the first frame of every
 * entrance and `e2e/animation-entry-state.spec.ts` ("fly-in presetSubtype 8
 * enters from the left"), which reads the inline `animation` immediately after
 * pressing ArrowRight, saw an unanimated slide and pressed ArrowRight again -
 * which advanced straight past the group it was trying to observe.
 *
 * The fix is the synchronous applier the playback service now runs on every
 * playback state change; these tests pin it through the real production
 * symbols (no test double for either side).
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimationPlaybackService } from './animation-playback.service';
import { PresentationStageAnimator } from './presentation-stage-animator';

/**
 * A fly-in-from-the-left (`presetSubtype` 8) entrance on `targetId`, shaped
 * like slide 8 of `e2e/fixtures/issue-132-hr-deck.pptx`: one `onClick` effect
 * followed by staggered `withPrevious` ones in the SAME click group.
 */
function flyInLeft(targetId: string, delayMs = 0): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		presetId: 2,
		presetSubtype: 8,
		trigger: delayMs === 0 ? 'onClick' : 'withPrevious',
		delayMs,
		durationMs: 500,
	} as unknown as PptxNativeAnimation;
}

function slideWith(ids: string[], nativeAnimations: PptxNativeAnimation[]): PptxSlide {
	return {
		id: 'slide-8',
		elements: ids.map((id) => ({ type: 'shape', id, x: 0, y: 0, width: 10, height: 10 })),
		nativeAnimations,
	} as unknown as PptxSlide;
}

/** A stage root holding one `[data-element-id]` node per id. */
function stage(ids: string[]): HTMLElement {
	const root = document.createElement('div');
	for (const id of ids) {
		const node = document.createElement('div');
		node.dataset['elementId'] = id;
		root.appendChild(node);
	}
	document.body.appendChild(root);
	return root;
}

function nodeFor(root: HTMLElement, id: string): HTMLElement {
	const node = root.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
	if (!node) {
		throw new Error(`no staged node for ${id}`);
	}
	return node;
}

/**
 * The service + animator wired exactly as `PresentationOverlayComponent` wires
 * them. A bare injector rather than `TestBed`: this package has no Angular test
 * platform, and the service only needs `DestroyRef`.
 */
function harness(root: () => HTMLElement | null) {
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } }],
	});
	const playback = runInInjectionContext(injector, () => new AnimationPlaybackService());
	const animator = new PresentationStageAnimator(root, playback);
	playback.setStyleApplier(() => animator.applyAnimationStyles({ onlyWhenStaged: true }));
	return { playback, animator };
}

describe('presentationStageAnimator synchronous playback apply', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('stamps a click-group animation onto the stage inside advance(), with no render pass', () => {
		const root = stage(['a', 'b']);
		const { playback, animator } = harness(() => root);

		playback.setSlide(slideWith(['a', 'b'], [flyInLeft('a'), flyInLeft('b', 200)]));
		// The overlay's `afterNextRender` seed (entrance elements start hidden).
		animator.applyAnimationStyles();
		expect(nodeFor(root, 'a').style.visibility).toBe('hidden');

		expect(playback.advance()).toBeTruthy();

		// No timers flushed, no effect run, no second applyAnimationStyles(): the
		// animation must already be on the element, exactly as it is in the other
		// four bindings by the time the key handler returns.
		expect(nodeFor(root, 'a').getAttribute('style')).toContain('pptx-flyInLeft');
		expect(nodeFor(root, 'b').getAttribute('style')).toContain('pptx-flyInLeft');
		expect(nodeFor(root, 'a').style.visibility).toBe('');
	});

	it('clears a finished step synchronously when its cleanup timer fires', () => {
		const root = stage(['a']);
		const { playback, animator } = harness(() => root);

		playback.setSlide(slideWith(['a'], [flyInLeft('a')]));
		animator.applyAnimationStyles();
		playback.advance();
		expect(nodeFor(root, 'a').getAttribute('style')).toContain('pptx-flyInLeft');

		vi.advanceTimersByTime(2000);
		expect(nodeFor(root, 'a').getAttribute('style') ?? '').not.toContain('pptx-flyInLeft');
	});

	it('leaves the outgoing slide alone while the stage has not rendered the new one', () => {
		// The stage still holds slide 7 while the states already describe slide 8.
		const root = stage(['old-1']);
		nodeFor(root, 'old-1').style.visibility = 'hidden';
		const { playback } = harness(() => root);

		playback.setSlide(slideWith(['a'], [flyInLeft('a')]));
		playback.advance();

		// `onlyWhenStaged` skipped the apply: an outgoing element whose entrance
		// never played must not be revealed mid-transition.
		expect(nodeFor(root, 'old-1').style.visibility).toBe('hidden');
	});

	it('applies unconditionally without onlyWhenStaged (the afterNextRender path)', () => {
		const root = stage(['a']);
		const { playback, animator } = harness(() => root);

		playback.setSlide(slideWith(['a'], [flyInLeft('a')]));
		animator.applyAnimationStyles();

		expect(nodeFor(root, 'a').style.visibility).toBe('hidden');
	});
});
