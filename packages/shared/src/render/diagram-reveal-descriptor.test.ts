import { describe, expect, it } from 'vitest';

import type {
	AnimationTimeline,
	TimelineClickGroup,
	TimelineStep,
} from './animation-timeline-types';
import {
	collectDiagramBuildInfo,
	resolveDiagramRevealDescriptor,
} from './diagram-reveal-descriptor';

function makeStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
	return {
		elementId: 'dgm1',
		cssAnimation: '',
		keyframeName: '',
		trigger: 'onClick',
		delayMs: 0,
		durationMs: 0,
		fillMode: 'both',
		presetClass: 'entr',
		build: { kind: 'diagram', mode: 'byOne' },
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

describe('resolveDiagramRevealDescriptor', () => {
	it('returns an empty-but-defined descriptor when nothing has fired yet', () => {
		expect(resolveDiagramRevealDescriptor([])).toStrictEqual({
			background: false,
			nodeIds: new Set(),
		});
	});

	it('background becomes true once any node-revealing step has fired', () => {
		const step = makeStep({ graphicElement: { id: 'n1', bldStep: 'sp' } });
		expect(resolveDiagramRevealDescriptor([step]).background).toBeTruthy();
	});

	it('a bldStep="bg" step reveals the background without adding a node id', () => {
		const step = makeStep({ graphicElement: { bldStep: 'bg' } });
		const descriptor = resolveDiagramRevealDescriptor([step]);
		expect(descriptor?.background).toBeTruthy();
		expect(descriptor?.nodeIds.size).toBe(0);
	});

	it('accumulates node ids regardless of firing order (reverse/by-branch build)', () => {
		// PowerPoint's "Reverse Order" / by-branch traversals fire node ids out of
		// document-list order: the authored SET must reflect exactly what fired.
		const stepC = makeStep({ graphicElement: { id: 'c', bldStep: 'sp' } });
		const stepA = makeStep({ graphicElement: { id: 'a', bldStep: 'sp' } });
		const afterFirstClick = resolveDiagramRevealDescriptor([stepC]);
		expect(afterFirstClick?.nodeIds).toStrictEqual(new Set(['c']));
		const afterSecondClick = resolveDiagramRevealDescriptor([stepC, stepA]);
		expect(afterSecondClick?.nodeIds).toStrictEqual(new Set(['c', 'a']));
	});

	it('falls back to undefined when any fired step lacks graphicElement data', () => {
		const indexed = makeStep({ graphicElement: { id: 'a', bldStep: 'sp' } });
		const unindexed = makeStep({ graphicElement: undefined });
		expect(resolveDiagramRevealDescriptor([indexed, unindexed])).toBeUndefined();
	});

	it('an exotic graphicEl with neither id nor a bg bldStep contributes nothing', () => {
		const step = makeStep({ graphicElement: { bldStep: 'future' } });
		expect(resolveDiagramRevealDescriptor([step])).toStrictEqual({
			background: true,
			nodeIds: new Set(),
		});
	});
});

describe('collectDiagramBuildInfo', () => {
	it('collects mode from the first diagram-build step per element', () => {
		const timeline = makeTimeline([
			makeGroup([makeStep({ build: { kind: 'diagram', mode: 'byLvlAtOnce' } })]),
			makeGroup([makeStep({ build: { kind: 'diagram', mode: 'byOne' } })]),
		]);
		expect(collectDiagramBuildInfo(timeline).get('dgm1')).toStrictEqual({ mode: 'byLvlAtOnce' });
	});

	it('ignores chart builds and steps with no build at all', () => {
		const timeline = makeTimeline([
			makeGroup([
				makeStep({ elementId: 'chart1', build: { kind: 'chart', mode: 'bySeries' } }),
				makeStep({ elementId: 'el1', build: undefined }),
			]),
		]);
		expect(collectDiagramBuildInfo(timeline).size).toBe(0);
	});

	it('scans interactive and hover sequences too', () => {
		const timeline: AnimationTimeline = {
			...makeTimeline([]),
			hoverSequences: new Map([
				['trigger1', [makeGroup([makeStep({ build: { kind: 'diagram', mode: 'byLvl' } })])]],
			]),
		};
		expect(collectDiagramBuildInfo(timeline).get('dgm1')?.mode).toBe('byLvl');
	});
});
