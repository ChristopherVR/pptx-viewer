/**
 * Regression test: `p:animEffect/@filter` playback reaches the Vue binding.
 * Vue resolves `pptx-viewer-shared` to source via its own `vitest.config.ts`
 * alias, so this proves Vue's own module resolution path carries the
 * filter-fallback behaviour added to shared (`render/animation-filter-effects.ts`).
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { buildTimeline } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

describe('vue: native animation @filter fallback', () => {
	it('plays a filter-only entrance animation with no presetId/presetClass', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: { family: 'wipe', subtype: 'up', transition: 'in', raw: 'wipe(up)' },
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		expect(step.keyframeName).toMatch(/^pptx-tl-dir-/);
		expect(timeline.keyframesCss).toContain(step.keyframeName);
	});

	it('falls back to the generic fade for a genuinely unmapped filter family', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape2',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 300,
				effectFilter: { family: 'diamond', transition: 'out', raw: 'diamond' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
