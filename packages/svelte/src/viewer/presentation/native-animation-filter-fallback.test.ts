/**
 * Regression test: `p:animEffect/@filter` playback reaches the Svelte
 * binding. Svelte's presentation playback (`animation-playback.svelte.ts`)
 * drives `PresentationAnimationController` from `pptx-viewer-shared`, which
 * internally builds the timeline via `buildTimeline`; this proves Svelte's
 * own module resolution path carries the filter-fallback behaviour added to
 * shared (`render/animation-filter-effects.ts`).
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { buildTimeline } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

describe('svelte: native animation @filter fallback', () => {
	it('plays a filter-only entrance animation with no presetId/presetClass', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: {
					family: 'barn',
					subtype: 'inVertical',
					transition: 'in',
					raw: 'barn(inVertical)',
				},
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		expect(step.keyframeName).toMatch(/^pptx-tl-dir-/);
	});

	it('falls back to the generic fade for a genuinely unmapped filter family', () => {
		// `wedge` used to be this test's example but graduated to a real
		// dedicated keyframe; `pixelate` is a raster/canvas-only effect this
		// engine's CSS-keyframe architecture cannot express, so it stays
		// unmapped (see the `p:animEffect/@filter` row in limitations.md).
		const timeline = buildTimeline([
			{
				targetId: 'shape2',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 300,
				effectFilter: { family: 'pixelate', transition: 'out', raw: 'pixelate' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
