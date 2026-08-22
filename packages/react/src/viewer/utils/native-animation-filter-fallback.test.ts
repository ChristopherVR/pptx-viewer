/**
 * Regression test: `p:animEffect/@filter` playback reaches the React
 * binding. React resolves `buildTimeline` through its own thin re-export
 * shim (`./animation-timeline-builder` -> `pptx-viewer-shared`); this proves
 * that path actually carries the filter-fallback behaviour added to shared
 * (see `render/animation-filter-effects.ts`), not just that shared's own
 * unit tests pass.
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTimeline } from './animation-timeline-builder';

describe('react: native animation @filter fallback', () => {
	it('plays a filter-only entrance animation with no presetId/presetClass', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape1',
				trigger: 'onClick',
				durationMs: 400,
				effectFilter: {
					family: 'checkerboard',
					subtype: 'across',
					transition: 'in',
					raw: 'checkerboard(across)',
				},
			} as PptxNativeAnimation,
		]);
		expect(timeline.clickGroups).toHaveLength(1);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.elementId).toBe('shape1');
		expect(step.keyframeName).toBe('pptx-checkerboardIn');
		expect(timeline.entranceElementIds.has('shape1')).toBeTruthy();
	});

	it('falls back to the generic fade for a genuinely unmapped filter family', () => {
		const timeline = buildTimeline([
			{
				targetId: 'shape2',
				presetClass: 'exit',
				trigger: 'onClick',
				durationMs: 300,
				effectFilter: { family: 'plus', transition: 'out', raw: 'plus' },
			} as PptxNativeAnimation,
		]);
		const step = timeline.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
	});
});
