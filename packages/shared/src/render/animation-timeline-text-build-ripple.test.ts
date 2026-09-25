/**
 * By-paragraph builds whose effect also ripples by letter / word
 * (`p:bldP build="p"` + `p:iterate type="lt" | "wd"`).
 *
 * The expected start times are PowerPoint's own, measured from
 * `Presentation.CreateVideo` captures of decks authored through COM (Fade,
 * 1 s, "By letter", 10% delay between letters): each letter starts 100 ms
 * after the previous one of its paragraph, and an "After previous" second
 * paragraph starts 1500 ms (1000 + 5 * 100) after the first.
 */
import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTimeline } from './animation-timeline-builder';
import { expandTextBuildAnimations } from './animation-timeline-text-build';
import type { TextBuildSegmentCounts } from './animation-timeline-text-build';
import { expandTextRangeAnimations } from './animation-timeline-text-range';

type Trigger = PptxNativeAnimation['trigger'];

const SIX_LETTERS: TextBuildSegmentCounts = {
	paragraphCount: 2,
	charCounts: [6, 6],
	wordCounts: [1, 1],
	paragraphLevels: [0, 0],
};

/** One PowerPoint-written by-paragraph step: scoped to paragraph `p` by `p:pRg`. */
function paragraphStep(
	p: number,
	trigger: Trigger,
	iterate: PptxNativeAnimation['iterate'],
	extra: Partial<PptxNativeAnimation> = {},
): PptxNativeAnimation {
	return {
		targetId: 'tb',
		presetClass: 'entr',
		presetId: 10,
		trigger,
		durationMs: 1000,
		buildType: 'byParagraph',
		iterate,
		// Parsed from `<p:pRg st="p" end="p"/>` (inclusive) into an exclusive end.
		textTarget: { type: 'pRg', start: p, end: p + 1 },
		...extra,
	} as PptxNativeAnimation;
}

/** The controller's pipeline: scope `p:txEl` ranges, then split the builds. */
function expand(
	anims: PptxNativeAnimation[],
	counts: TextBuildSegmentCounts = SIX_LETTERS,
): PptxNativeAnimation[] {
	const map = new Map([['tb', counts]]);
	return expandTextBuildAnimations(expandTextRangeAnimations(anims, map), map);
}

/** Absolute start (ms) of every step, per click group, keyed by element id. */
function startTimes(anims: PptxNativeAnimation[]): Array<Record<string, number>> {
	return buildTimeline(anims).clickGroups.map((group) =>
		Object.fromEntries(group.steps.map((step) => [step.elementId, step.delayMs])),
	);
}

const LETTERS_10PCT = { type: 'lt', tmPct: 10000 } as const;

describe('powerPoint-written by-paragraph + by-letter builds', () => {
	it('ripples each paragraph once, with an after-previous paragraph following the full ripple', () => {
		const expanded = expand([
			paragraphStep(0, 'onClick', LETTERS_10PCT),
			paragraphStep(1, 'afterPrevious', LETTERS_10PCT),
		]);

		// Exactly one sub-animation per letter: the paragraph-scoped step is not
		// re-split into every paragraph of the text box.
		expect(expanded.map((a) => a.targetId)).toStrictEqual([
			...[0, 1, 2, 3, 4, 5].map((i) => `tb::c0-${i}`),
			...[0, 1, 2, 3, 4, 5].map((i) => `tb::c1-${i}`),
		]);
		expect(expanded.every((a) => a.durationMs === 1000)).toBeTruthy();

		const groups = startTimes(expanded);
		expect(groups).toHaveLength(1);
		const [starts] = groups;
		expect([0, 1, 2, 3, 4, 5].map((i) => starts[`tb::c0-${i}`])).toStrictEqual([
			0, 100, 200, 300, 400, 500,
		]);
		// dur + (n - 1) * stagger = 1000 + 5 * 100.
		expect([0, 1, 2, 3, 4, 5].map((i) => starts[`tb::c1-${i}`])).toStrictEqual([
			1500, 1600, 1700, 1800, 1900, 2000,
		]);
	});

	it('gives an on-click paragraph its own click step, rippling from that click', () => {
		const groups = startTimes(
			expand([
				paragraphStep(0, 'onClick', LETTERS_10PCT),
				paragraphStep(1, 'onClick', LETTERS_10PCT),
			]),
		);

		expect(groups).toHaveLength(2);
		expect(Object.keys(groups[0]).every((id) => id.startsWith('tb::c0-'))).toBeTruthy();
		expect(groups[1]['tb::c1-0']).toBe(0);
		expect(groups[1]['tb::c1-5']).toBe(500);
	});

	it('ripples a with-previous (sub-level) paragraph in parallel with its opener', () => {
		// PowerPoint writes both steps as siblings of one `p:par` wrapper
		// (`withEffect`, delay 0), which the parser records as a shared
		// `parGroupIndex`.
		const sibling = { parGroupIndex: 0, parGroupDelayMs: 0 };
		const [starts] = startTimes(
			expand([
				paragraphStep(0, 'onClick', LETTERS_10PCT, sibling),
				paragraphStep(1, 'withPrevious', LETTERS_10PCT, sibling),
			]),
		);

		expect(starts['tb::c0-0']).toBe(0);
		expect(starts['tb::c1-0']).toBe(0);
		expect(starts['tb::c1-5']).toBe(500);
	});

	it('reverses the letters within each paragraph for iterate/@backwards', () => {
		const back = { ...LETTERS_10PCT, backwards: true };
		const [starts] = startTimes(
			expand([paragraphStep(0, 'onClick', back), paragraphStep(1, 'afterPrevious', back)]),
		);

		expect(starts['tb::c0-5']).toBe(0);
		expect(starts['tb::c0-0']).toBe(500);
		// Paragraph order is unchanged; only the letters inside each run backwards.
		expect(starts['tb::c1-5']).toBe(1500);
		expect(starts['tb::c1-0']).toBe(2000);
	});

	it('honours an absolute tmAbs interval', () => {
		const abs = { type: 'lt', tmAbs: 250 } as const;
		const [starts] = startTimes(
			expand([paragraphStep(0, 'onClick', abs), paragraphStep(1, 'afterPrevious', abs)]),
		);

		expect(starts['tb::c0-5']).toBe(1250);
		expect(starts['tb::c1-0']).toBe(2250);
	});

	it('ripples by word with a percentage interval', () => {
		const words = { type: 'wd', tmPct: 30000 } as const;
		const counts: TextBuildSegmentCounts = { ...SIX_LETTERS, wordCounts: [3, 3] };
		const [starts] = startTimes(
			expand(
				[paragraphStep(0, 'onClick', words), paragraphStep(1, 'afterPrevious', words)],
				counts,
			),
		);

		expect([0, 1, 2].map((i) => starts[`tb::w0-${i}`])).toStrictEqual([0, 300, 600]);
		expect([0, 1, 2].map((i) => starts[`tb::w1-${i}`])).toStrictEqual([1600, 1900, 2200]);
	});
});

describe('whole-shape by-paragraph + by-letter builds', () => {
	const wholeShape = (extra: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation =>
		({
			targetId: 'tb',
			presetClass: 'entr',
			presetId: 10,
			trigger: 'onClick',
			durationMs: 1000,
			buildType: 'byParagraph',
			iterate: LETTERS_10PCT,
			...extra,
		}) as PptxNativeAnimation;

	const THREE_PARAGRAPHS: TextBuildSegmentCounts = {
		paragraphCount: 3,
		charCounts: [3, 2, 3],
		wordCounts: [1, 1, 1],
		paragraphLevels: [0, 1, 0],
	};

	it('opens one click per bldLvl group and ripples a sub-bullet alongside its parent', () => {
		const groups = startTimes(expand([wholeShape()], THREE_PARAGRAPHS));

		expect(groups).toHaveLength(2);
		expect(groups[0]).toStrictEqual({
			'tb::c0-0': 0,
			'tb::c1-0': 0,
			'tb::c0-1': 100,
			'tb::c1-1': 100,
			'tb::c0-2': 200,
		});
		expect(groups[1]).toStrictEqual({ 'tb::c2-0': 0, 'tb::c2-1': 100, 'tb::c2-2': 200 });
	});

	it('reveals the groups last-first for p:bldP/@rev', () => {
		const groups = startTimes(expand([wholeShape({ buildReverse: true })], THREE_PARAGRAPHS));

		expect(Object.keys(groups[0])).toStrictEqual(['tb::c2-0', 'tb::c2-1', 'tb::c2-2']);
		expect(Object.keys(groups[1])).toContain('tb::c1-0');
	});

	it('advances a later group on its own after p:bldP/@advAuto instead of a click', () => {
		const expanded = expand([wholeShape({ buildAdvAutoMs: 750 })], THREE_PARAGRAPHS);
		const opener = expanded.find((a) => a.targetId === 'tb::c2-0');

		expect(opener?.trigger).toBe('afterDelay');
		expect(opener?.triggerDelayMs).toBe(750);
	});

	it('clears the build and iterate fields on every synthesized piece', () => {
		const expanded = expand([wholeShape()], THREE_PARAGRAPHS);

		expect(
			expanded.every(
				(a) => a.buildType === undefined && a.iterate === undefined && a.buildLevel === undefined,
			),
		).toBeTruthy();
	});

	it('keeps one paragraph-scoped step for a group with no letters', () => {
		const expanded = expand([wholeShape()], {
			paragraphCount: 2,
			charCounts: [2, 0],
			wordCounts: [1, 0],
			paragraphLevels: [0, 0],
		});

		expect(expanded.map((a) => a.targetId)).toStrictEqual(['tb::c0-0', 'tb::c0-1', 'tb::p1']);
		expect(expanded[2].trigger).toBe('onClick');
	});
});
