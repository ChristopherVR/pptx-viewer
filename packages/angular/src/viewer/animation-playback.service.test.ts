/**
 * animation-playback.service.test.ts: the main-sequence click path of the
 * Angular slide show, pinned through the real service (bare injector, no
 * TestBed: the service only needs `DestroyRef`).
 *
 * The seek case is the one the shared `advanceMainSequence` extraction exists
 * for: before it, only React honoured `p:seq/@nextAc="seek"`, so a click that
 * landed while a build was still animating skipped a step here.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimationPlaybackService } from './animation-playback.service';

function seekAnim(targetId: string): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		trigger: 'onClick',
		durationMs: 5000,
		seqNextAction: 'seek',
	} as unknown as PptxNativeAnimation;
}

function slideWith(ids: string[], nativeAnimations: PptxNativeAnimation[]): PptxSlide {
	return {
		id: 'slide-1',
		elements: ids.map((id) => ({ type: 'shape', id, x: 0, y: 0, width: 10, height: 10 })),
		nativeAnimations,
	} as unknown as PptxSlide;
}

function createService(): AnimationPlaybackService {
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } }],
	});
	return runInInjectionContext(injector, () => new AnimationPlaybackService());
}

describe('animation-playback.service main-sequence advance', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('a second advance inside a nextAc="seek" group fast-forwards it instead of skipping ahead', () => {
		const playback = createService();
		playback.setSlide(slideWith(['a', 'b'], [seekAnim('a'), seekAnim('b')]));
		const states = () => playback.presentationElementStates();

		expect(playback.advance()).toBeTruthy();
		expect(states().get('a')?.cssAnimation).toBeTruthy();

		// Mid-flight: the click is consumed by finishing `a`, and `b` stays hidden.
		expect(playback.advance()).toBeTruthy();
		expect(states().get('a')?.visible).toBeTruthy();
		expect(states().get('a')?.cssAnimation).toBeUndefined();
		expect(states().get('b')?.visible).toBeFalsy();
		expect(playback.isComplete()).toBeFalsy();

		// Settled: the next click starts group two.
		expect(playback.advance()).toBeTruthy();
		expect(states().get('b')?.visible).toBeTruthy();
		expect(playback.isComplete()).toBeTruthy();
	});

	it('a slide change drops the seek target so a stale group is never seeked', () => {
		const playback = createService();
		playback.setSlide(slideWith(['a', 'b'], [seekAnim('a'), seekAnim('b')]));
		playback.advance();

		playback.setSlide(slideWith(['c'], [seekAnim('c')]));

		// Would have been a seek of the previous slide's group; must be a real advance.
		expect(playback.advance()).toBeTruthy();
		expect(playback.presentationElementStates().get('c')?.visible).toBeTruthy();
		expect(playback.isComplete()).toBeTruthy();
	});
});

describe('animation-playback.service geometry/theme render context wiring', () => {
	// Grow And Turn's own ground-truth markup: `from="(-#ppt_w/2)" to="(#ppt_x)"`
	// on a `ppt_x` attribute animation (see animation-ppt-formula-ground-truth.md).
	function growAndTurnSlide(): PptxSlide {
		return {
			elements: [{ height: 100, id: 'a', type: 'shape', width: 200, x: 200, y: 150 }],
			id: 'slide-1',
			nativeAnimations: [
				{
					attributeAnimations: [
						{ attrName: 'ppt_x', from: '(-#ppt_w/2)', keyframes: [], to: '(#ppt_x)' },
					],
					durationMs: 600,
					presetClass: 'entr',
					targetId: 'a',
					trigger: 'onClick',
				} as unknown as PptxNativeAnimation,
			],
		} as unknown as PptxSlide;
	}

	it('resolves the cross-axis fly-in formula when slide size is passed through setSlide', () => {
		const playback = createService();
		playback.setSlide(growAndTurnSlide(), true, { slideHeightPx: 720, slideWidthPx: 960 });
		// centre x = (200 + 200/2) / 960 = 0.3125; from = -100/960 = -0.104167;
		// delta = -0.104167 - 0.3125 = -0.416667 -> formatted to 4dp.
		expect(playback.keyframesCss()).toContain('-0.4167');
	});

	it('falls back to canned timing when slide size is not passed', () => {
		const playback = createService();
		playback.setSlide(growAndTurnSlide());
		expect(playback.keyframesCss()).not.toContain('-0.4167');
	});
});
