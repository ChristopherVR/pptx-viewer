import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	resolveChartBuildMode,
	resolveDiagramBuildMode,
	resolveStepBuildDescriptor,
	computeBuildProgress,
	revealedStageCount,
} from './animation-build';

// ==========================================================================
// resolveChartBuildMode
// ==========================================================================

describe('resolveChartBuildMode', () => {
	it('maps series / category tokens', () => {
		expect(resolveChartBuildMode('series')).toBe('bySeries');
		expect(resolveChartBuildMode('category')).toBe('byCategory');
	});

	it('maps element-level tokens (both spellings) to byElement', () => {
		expect(resolveChartBuildMode('seriesElement')).toBe('byElement');
		expect(resolveChartBuildMode('categoryEl')).toBe('byElement');
	});

	it('falls back to asOne for allAtOnce / unknown', () => {
		expect(resolveChartBuildMode('allAtOnce')).toBe('asOne');
		expect(resolveChartBuildMode('bogus')).toBe('asOne');
		expect(resolveChartBuildMode(undefined)).toBe('asOne');
	});
});

// ==========================================================================
// resolveDiagramBuildMode
// ==========================================================================

describe('resolveDiagramBuildMode', () => {
	it('maps the level tokens', () => {
		expect(resolveDiagramBuildMode('lvlOne')).toBe('byLvl');
		expect(resolveDiagramBuildMode('lvlAtOnce')).toBe('byLvlAtOnce');
	});

	it('maps whole / allAtOnce to asOne', () => {
		expect(resolveDiagramBuildMode('whole')).toBe('asOne');
		expect(resolveDiagramBuildMode('allAtOnce')).toBe('asOne');
		expect(resolveDiagramBuildMode(undefined)).toBe('asOne');
	});

	it('maps one and traversal tokens to byOne', () => {
		expect(resolveDiagramBuildMode('one')).toBe('byOne');
		expect(resolveDiagramBuildMode('depthByNode')).toBe('byOne');
		expect(resolveDiagramBuildMode('cwIn')).toBe('byOne');
	});
});

// ==========================================================================
// resolveStepBuildDescriptor
// ==========================================================================

describe('resolveStepBuildDescriptor', () => {
	it('derives a chart descriptor from graphicBuildProperties sub-chart', () => {
		const anim: PptxNativeAnimation = {
			targetId: 'chart_1',
			graphicBuildProperties: {
				mode: 'sub',
				kind: 'chart',
				build: 'category',
				animateBackground: true,
			},
		};
		expect(resolveStepBuildDescriptor(anim)).toStrictEqual({
			kind: 'chart',
			mode: 'byCategory',
		});
	});

	it('derives a diagram descriptor from graphicBuildProperties sub-diagram', () => {
		const anim: PptxNativeAnimation = {
			targetId: 'dgm_1',
			graphicBuildProperties: {
				mode: 'sub',
				kind: 'diagram',
				build: 'lvlAtOnce',
				reverse: false,
			},
		};
		expect(resolveStepBuildDescriptor(anim)).toStrictEqual({
			kind: 'diagram',
			mode: 'byLvlAtOnce',
		});
	});

	it('derives a chart descriptor from oleChartBuild (p:bldOleChart/@bld)', () => {
		expect(
			resolveStepBuildDescriptor({ targetId: 'ole_1', oleChartBuild: 'series' }),
		).toStrictEqual({ kind: 'chart', mode: 'bySeries' });
		expect(
			resolveStepBuildDescriptor({ targetId: 'ole_2', oleChartBuild: 'categoryEl' }),
		).toStrictEqual({ kind: 'chart', mode: 'byElement' });
	});

	it('returns undefined for an allAtOnce OLE chart build', () => {
		expect(
			resolveStepBuildDescriptor({ targetId: 'ole_3', oleChartBuild: 'allAtOnce' }),
		).toBeUndefined();
	});

	it('derives a diagram descriptor from smartArtBuild (p:bldDgm/@bld)', () => {
		const anim: PptxNativeAnimation = { targetId: 'dgm_2', smartArtBuild: 'one' };
		expect(resolveStepBuildDescriptor(anim)).toStrictEqual({
			kind: 'diagram',
			mode: 'byOne',
		});
	});

	it('returns undefined for asOne / whole builds and for no build', () => {
		expect(resolveStepBuildDescriptor({ smartArtBuild: 'whole' })).toBeUndefined();
		expect(
			resolveStepBuildDescriptor({
				graphicBuildProperties: { mode: 'asOne' },
			}),
		).toBeUndefined();
		expect(resolveStepBuildDescriptor({ targetId: 'x' })).toBeUndefined();
	});
});

// ==========================================================================
// computeBuildProgress: advances with playback time
// ==========================================================================

describe('computeBuildProgress', () => {
	const timing = { delayMs: 100, durationMs: 400 };

	it('is 0 before the step delay elapses', () => {
		expect(computeBuildProgress(timing, 0)).toBe(0);
		expect(computeBuildProgress(timing, 100)).toBe(0);
	});

	it('advances monotonically through the duration', () => {
		const quarter = computeBuildProgress(timing, 200);
		const half = computeBuildProgress(timing, 300);
		const threeQuarter = computeBuildProgress(timing, 400);
		expect(quarter).toBeCloseTo(0.25, 5);
		expect(half).toBeCloseTo(0.5, 5);
		expect(threeQuarter).toBeCloseTo(0.75, 5);
		expect(half).toBeGreaterThan(quarter);
		expect(threeQuarter).toBeGreaterThan(half);
	});

	it('clamps to 1 at and beyond the end', () => {
		expect(computeBuildProgress(timing, 500)).toBe(1);
		expect(computeBuildProgress(timing, 999)).toBe(1);
	});

	it('snaps to 1 once past a zero-duration build', () => {
		expect(computeBuildProgress({ delayMs: 50, durationMs: 0 }, 10)).toBe(0);
		expect(computeBuildProgress({ delayMs: 50, durationMs: 0 }, 50)).toBe(1);
	});
});

// ==========================================================================
// revealedStageCount
// ==========================================================================

describe('revealedStageCount', () => {
	it('reveals nothing at progress 0 and everything at progress 1', () => {
		expect(revealedStageCount(0, 4)).toBe(0);
		expect(revealedStageCount(1, 4)).toBe(4);
	});

	it('reveals at least one stage for any positive progress', () => {
		expect(revealedStageCount(0.01, 4)).toBe(1);
	});

	it('rounds up partially-revealed stages and never exceeds the total', () => {
		expect(revealedStageCount(0.5, 4)).toBe(2);
		expect(revealedStageCount(0.6, 4)).toBe(3);
		expect(revealedStageCount(1.5, 4)).toBe(4);
	});

	it('handles a zero / negative stage count', () => {
		expect(revealedStageCount(0.5, 0)).toBe(0);
	});
});
