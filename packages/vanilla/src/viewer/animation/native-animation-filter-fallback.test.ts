/**
 * Regression test: `p:animEffect/@filter` playback reaches the Vanilla
 * binding. Vanilla's presentation playback (`presentation-playback.ts`)
 * drives `PresentationAnimationController` from `pptx-viewer-shared`, which
 * internally builds the timeline via `buildTimeline`; this proves Vanilla's
 * own module resolution path carries the filter-fallback behaviour added to
 * shared (`render/animation-filter-effects.ts`).
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { buildTimeline } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

describe('vanilla: native animation @filter fallback', () => {
	it('plays a filter-only entrance animation with no presetId/presetClass', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: { family: 'zoom', subtype: 'in', transition: 'in', raw: 'zoom(in)' },
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		expect(step.keyframeName).toBe('pptx-zoomIn');
	});

	it('falls back to the generic fade for a genuinely unmapped filter family', () => {
		// `pixelate` used to be this test's example but graduated to a real
		// dedicated keyframe; `image` substitutes a second AUTHORED image
		// mid-transition that the OOXML payload never carries, so it stays
		// unmapped (see the `p:animEffect/@filter` row in limitations.md).
		const timeline = buildTimeline([
			{
				targetId: 'shape2',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 300,
				effectFilter: { family: 'image', transition: 'out', raw: 'image' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
