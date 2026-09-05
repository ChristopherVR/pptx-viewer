import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type {
	AnimationTimeline,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';
import {
	collectChartBuildInfo,
	extractStepGraphicElement,
	resolveChartRevealDescriptor,
} from './chart-reveal-descriptor';

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
	return {
		elementId: 'chart1',
		cssAnimation: '',
		keyframeName: '',
		trigger: 'onClick',
		delayMs: 0,
		durationMs: 0,
		fillMode: 'both',
		presetClass: 'entr',
		build: { kind: 'chart', mode: 'bySeries' },
		...overrides,
	};
}

function makeGroup(steps: TimelineStep[]): TimelineClickGroup {
	return { steps, totalDurationMs: 0 };
}

function makeTimeline(clickGroups: TimelineClickGroup[]): AnimationTimeline {
	return {
		clickGroups,
		entranceElementIds: new Set(),
		keyframesCss: '',
		interactiveSequences: new Map(),
		hoverSequences: new Map(),
	};
}

describe('extractStepGraphicElement', () => {
	it('reads p:spTgt/p:graphicEl indices from a shape target', () => {
		const anim = {
			targetId: 'chart1',
			target: {
				type: 'shape',
				shapeId: 'chart1',
				graphicElement: { kind: 'chart', seriesIdx: 1, categoryIdx: 2, bldStep: 'seriesEl' },
			},
		} as PptxNativeAnimation;
		expect(extractStepGraphicElement(anim)).toStrictEqual({
			seriesIdx: 1,
			categoryIdx: 2,
			bldStep: 'seriesEl',
		});
	});

	it('returns undefined for a shape target with no graphicElement', () => {
		const anim = {
			targetId: 'el1',
			target: { type: 'shape', shapeId: 'el1' },
		} as PptxNativeAnimation;
		expect(extractStepGraphicElement(anim)).toBeUndefined();
	});

	it('returns undefined for a non-shape target', () => {
		const anim = { targetId: 'el1', target: { type: 'slide' } } as PptxNativeAnimation;
		expect(extractStepGraphicElement(anim)).toBeUndefined();
	});
});

describe('resolveChartRevealDescriptor', () => {
	it('returns an empty-but-defined descriptor when nothing has fired yet', () => {
		expect(resolveChartRevealDescriptor([], true)).toStrictEqual({
			background: false,
			series: new Set(),
			categories: new Set(),
			points: [],
		});
	});

	it('background is shown throughout (even at zero stages) when animateBackground is false', () => {
		expect(resolveChartRevealDescriptor([], false).background).toBeTruthy();
	});

	it('background becomes true once any stage has fired, regardless of animateBackground', () => {
		const step = makeStep({ graphicElement: { seriesIdx: 0, bldStep: 'series' } });
		expect(resolveChartRevealDescriptor([step], true).background).toBeTruthy();
	});

	it('accumulates whole-series reveals regardless of firing order (reverse-order series build)', () => {
		// PowerPoint's "Enter by Series, Reverse Order" fires seriesIdx 2, then 1,
		// then 0: the authored SET must end up {2}, {1,2}, {0,1,2} in that order,
		// not a forward count-based guess.
		const step2 = makeStep({ graphicElement: { seriesIdx: 2, bldStep: 'series' } });
		const step1 = makeStep({ graphicElement: { seriesIdx: 1, bldStep: 'series' } });
		const afterFirstClick = resolveChartRevealDescriptor([step2], true);
		expect(afterFirstClick?.series).toStrictEqual(new Set([2]));
		const afterSecondClick = resolveChartRevealDescriptor([step2, step1], true);
		expect(afterSecondClick?.series).toStrictEqual(new Set([2, 1]));
	});

	it('accumulates whole-category reveals', () => {
		const step = makeStep({ graphicElement: { categoryIdx: 3, bldStep: 'category' } });
		const descriptor = resolveChartRevealDescriptor([step], true);
		expect(descriptor?.categories).toStrictEqual(new Set([3]));
		expect(descriptor?.series.size).toBe(0);
	});

	it('accumulates individual (series, category) cells for a by-element build', () => {
		const stepA = makeStep({
			graphicElement: { seriesIdx: 0, categoryIdx: 1, bldStep: 'seriesEl' },
		});
		const stepB = makeStep({
			graphicElement: { seriesIdx: 1, categoryIdx: 0, bldStep: 'seriesEl' },
		});
		const descriptor = resolveChartRevealDescriptor([stepA, stepB], true);
		expect(descriptor?.points).toStrictEqual([
			{ seriesIdx: 0, categoryIdx: 1 },
			{ seriesIdx: 1, categoryIdx: 0 },
		]);
	});

	it('falls back to undefined when any fired step lacks graphicElement data', () => {
		const indexed = makeStep({ graphicElement: { seriesIdx: 0, bldStep: 'series' } });
		const unindexed = makeStep({ graphicElement: undefined });
		expect(resolveChartRevealDescriptor([indexed, unindexed], true)).toBeUndefined();
	});
});

describe('collectChartBuildInfo', () => {
	it('collects mode + animateBackground from the first chart-build step per element', () => {
		const timeline = makeTimeline([
			makeGroup([
				makeStep({ build: { kind: 'chart', mode: 'byCategory', animateBackground: false } }),
			]),
			makeGroup([
				makeStep({ build: { kind: 'chart', mode: 'byCategory', animateBackground: false } }),
			]),
		]);
		const info = collectChartBuildInfo(timeline);
		expect(info.get('chart1')).toStrictEqual({ mode: 'byCategory', animateBackground: false });
	});

	it('defaults animateBackground to true when the descriptor omits it', () => {
		const timeline = makeTimeline([
			makeGroup([makeStep({ build: { kind: 'chart', mode: 'bySeries' } })]),
		]);
		expect(collectChartBuildInfo(timeline).get('chart1')?.animateBackground).toBeTruthy();
	});

	it('ignores diagram builds and steps with no build at all', () => {
		const timeline = makeTimeline([
			makeGroup([
				makeStep({ elementId: 'dgm1', build: { kind: 'diagram', mode: 'byOne' } }),
				makeStep({ elementId: 'el1', build: undefined }),
			]),
		]);
		expect(collectChartBuildInfo(timeline).size).toBe(0);
	});

	it('scans interactive and hover sequences too', () => {
		const timeline: AnimationTimeline = {
			...makeTimeline([]),
			interactiveSequences: new Map([
				['trigger1', [makeGroup([makeStep({ build: { kind: 'chart', mode: 'byElement' } })])]],
			]),
		};
		expect(collectChartBuildInfo(timeline).get('chart1')?.mode).toBe('byElement');
	});
});
