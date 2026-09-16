/**
 * Export-surface test for `pptx-react-viewer/internals` (issue #290).
 *
 * A consumer embedding their own presentation stage needs the framework-
 * neutral slide-transition resolver/keyframes and the overlay components
 * that call them, without reaching into `pptx-viewer-shared` (a private,
 * unpublished workspace package). This asserts the whole surface is actually
 * importable from `./internals`, so a regression here (a stray rename, a
 * dropped re-export) fails the unit suite rather than only surfacing once a
 * consumer's build breaks.
 */
import { describe, expect, it } from 'vitest';

import * as internals from './internals';

describe('pptx-react-viewer/internals: slide-transition helpers', () => {
	it('exports the transition resolvers as functions', () => {
		expect(internals.resolveSlideTransition).toBeTypeOf('function');
		expect(internals.resolveTransitionDurationMs).toBeTypeOf('function');
		expect(internals.getSlideTransitionAnimations).toBeTypeOf('function');
		expect(internals.getCinematicTransitionAnimations).toBeTypeOf('function');
		expect(internals.getP14TransitionAnimations).toBeTypeOf('function');
		expect(internals.resolveDirection).toBeTypeOf('function');
		expect(internals.resolveDirection8).toBeTypeOf('function');
		expect(internals.resolveOrientation).toBeTypeOf('function');
		expect(internals.resolveWheelSpokeCount).toBeTypeOf('function');
	});

	it('exports non-empty keyframes CSS strings', () => {
		expect(internals.SLIDE_TRANSITION_KEYFRAMES).toBeTypeOf('string');
		expect(internals.SLIDE_TRANSITION_KEYFRAMES.length).toBeGreaterThan(0);
		expect(internals.SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-fade-in');
		// `_CSS` is the historical Vue-facing alias of the same string.
		expect(internals.SLIDE_TRANSITION_KEYFRAMES_CSS).toBe(internals.SLIDE_TRANSITION_KEYFRAMES);
		expect(internals.CINEMATIC_TRANSITION_KEYFRAMES).toBeTypeOf('string');
		expect(internals.P14_TRANSITION_KEYFRAMES_ALL).toBeTypeOf('string');
	});

	it('exports the duration/direction constants', () => {
		expect(internals.DEFAULT_TRANSITION_DURATION_MS).toBeTypeOf('number');
		expect(internals.DEFAULT_MORPH_DURATION_MS).toBeTypeOf('number');
		expect(internals.TRANSITION_SPEED_DURATION_MS).toBeTruthy();
		expect(internals.EASE).toBe('ease-in-out');
		expect(internals.RANDOM_ELIGIBLE_TYPES.length).toBeGreaterThan(0);
		expect(internals.WHEEL_SPOKE_COUNTS.length).toBeGreaterThan(0);
		expect(internals.INSTANT.outgoing).toBe('none');
	});

	it('exports the resolved transition for a "none" transition as instant', () => {
		expect(internals.resolveSlideTransition(undefined)).toStrictEqual(internals.INSTANT);
	});

	it('exports the presentation-mode transition overlay components', () => {
		expect(internals.PresentationTransitionOverlay).toBeTypeOf('function');
		expect(internals.MorphTransitionOverlay).toBeTypeOf('function');
		expect(internals.SlideLayer).toBeTypeOf('function');
		expect(internals.FragmentedTransitionLayer).toBeTypeOf('function');
	});
});
