/**
 * Regression test: `p:animEffect/@filter` playback reaches the Angular
 * binding. Angular vendors `pptx-viewer-shared`'s source into
 * `internal/shared-src` at build time (`scripts/inline-shared.mjs`) and every
 * Angular source imports it through the `../internal/shared` barrel; this
 * proves THAT path carries the filter-fallback behaviour added to shared
 * (`render/animation-filter-effects.ts`), not just that shared's own unit
 * tests pass.
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTimeline } from '../internal/shared';

describe('angular: native animation @filter fallback', () => {
	it('plays a filter-only entrance animation with no presetId/presetClass', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: {
					family: 'slide',
					subtype: 'fromLeft',
					transition: 'in',
					raw: 'slide(fromLeft)',
				},
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		expect(step.keyframeName).toBe('pptx-flyInLeft');
	});

	it('falls back to the generic fade for a genuinely unmapped filter family', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape2',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 300,
				effectFilter: { family: 'newsflash', transition: 'out', raw: 'newsflash' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
