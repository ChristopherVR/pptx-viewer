/**
 * Export-surface test for `pptx-angular-viewer/internals` (issue #290).
 *
 * ng-packagr compiles this library from ONE entry file (`src/public-api.ts`;
 * see `ng-package.json` `lib.entryFile`), so the published `./internals`
 * subpath in `package.json` points at the exact same built FESM/`.d.ts` as the
 * package root (`src/internals.ts`'s own header comment explains why: ~150
 * source files cannot be relocated into an isolated secondary entry point).
 * A source-level unit test therefore has to import through `public-api.ts`
 * (which composes both `./viewer` and `./internals`) to see what a consumer
 * of `pptx-angular-viewer/internals` actually gets, rather than importing
 * `./internals` in isolation, which by itself does not re-export
 * `transition-helpers.ts` (that flows in via `./viewer` instead).
 */
import { describe, expect, it } from 'vitest';

import * as publicApi from './public-api';

describe('pptx-angular-viewer/internals: slide-transition helpers', () => {
	it('exports the transition resolvers as functions', () => {
		expect(publicApi.resolveSlideTransition).toBeTypeOf('function');
		expect(publicApi.resolveTransitionDurationMs).toBeTypeOf('function');
		expect(publicApi.getSlideTransitionAnimations).toBeTypeOf('function');
		expect(publicApi.getCinematicTransitionAnimations).toBeTypeOf('function');
		expect(publicApi.getP14TransitionAnimations).toBeTypeOf('function');
		expect(publicApi.resolveDirection).toBeTypeOf('function');
		expect(publicApi.resolveDirection8).toBeTypeOf('function');
		expect(publicApi.resolveOrientation).toBeTypeOf('function');
		expect(publicApi.resolveWheelSpokeCount).toBeTypeOf('function');
	});

	it('exports non-empty keyframes CSS strings', () => {
		expect(publicApi.SLIDE_TRANSITION_KEYFRAMES).toBeTypeOf('string');
		expect(publicApi.SLIDE_TRANSITION_KEYFRAMES.length).toBeGreaterThan(0);
		expect(publicApi.SLIDE_TRANSITION_KEYFRAMES).toContain('@keyframes pptx-tr-fade-in');
		expect(publicApi.SLIDE_TRANSITION_KEYFRAMES_CSS).toBe(publicApi.SLIDE_TRANSITION_KEYFRAMES);
		expect(publicApi.CINEMATIC_TRANSITION_KEYFRAMES).toBeTypeOf('string');
		expect(publicApi.P14_TRANSITION_KEYFRAMES_ALL).toBeTypeOf('string');
	});

	it('exports shared duration constants under a name distinct from the Angular-local default', () => {
		// Shared's React/Vue-parity default (1000ms), aliased so it never
		// collides with Angular's own, smaller, floored
		// `DEFAULT_TRANSITION_DURATION_MS` policy constant (see
		// `transition-helpers.ts`, still exported for backward compatibility but
		// no longer consulted by the presentation overlay).
		expect(publicApi.SHARED_DEFAULT_TRANSITION_DURATION_MS).toBeTypeOf('number');
		expect(publicApi.SHARED_DEFAULT_TRANSITION_DURATION_MS).toBe(1000);
		expect(publicApi.DEFAULT_MORPH_DURATION_MS).toBeTypeOf('number');
		expect(publicApi.TRANSITION_SPEED_DURATION_MS).toBeTruthy();
		expect(publicApi.EASE).toBe('ease-in-out');
		expect(publicApi.RANDOM_ELIGIBLE_TYPES.length).toBeGreaterThan(0);
		expect(publicApi.WHEEL_SPOKE_COUNTS.length).toBeGreaterThan(0);
		expect(publicApi.INSTANT.outgoing).toBe('none');
	});

	it('exports the presentation transition overlay component', () => {
		expect(publicApi.PresentationTransitionOverlayComponent).toBeTruthy();
	});
});
