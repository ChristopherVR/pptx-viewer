import { describe, it, expect } from 'vitest';

import { DEFAULT_BUILD_LEVEL, groupParagraphsByBuildLevel } from './animation-timeline-build-level';

describe('groupParagraphsByBuildLevel', () => {
	it('defaults to 1 (By 1st Level Paragraphs): top-level bullets each open a step, sub-bullets join them', () => {
		// title(0), sub(1), sub(1), title(0), sub(1)
		const levels = [0, 1, 1, 0, 1];
		expect(groupParagraphsByBuildLevel(levels)).toStrictEqual([
			[0, 1, 2],
			[3, 4],
		]);
		expect(groupParagraphsByBuildLevel(levels, DEFAULT_BUILD_LEVEL)).toStrictEqual([
			[0, 1, 2],
			[3, 4],
		]);
	});

	it('gives every paragraph its own step when all are top-level (flat list)', () => {
		expect(groupParagraphsByBuildLevel([0, 0, 0])).toStrictEqual([[0], [1], [2]]);
	});

	it('by 2nd level paragraphs (bldLvl=2) also opens a step for level-1 paragraphs', () => {
		// title(0), sub(1), subsub(2), sub(1)
		const levels = [0, 1, 2, 1];
		expect(groupParagraphsByBuildLevel(levels, 2)).toStrictEqual([[0], [1, 2], [3]]);
	});

	it('the first paragraph always opens a step even when its own level is >= buildLevel', () => {
		// A deck that starts indented (unusual, but must not crash or drop it).
		const levels = [1, 1, 0];
		expect(groupParagraphsByBuildLevel(levels, 1)).toStrictEqual([[0, 1], [2]]);
	});

	it('treats a missing/undefined level as top-level (0)', () => {
		const levels = [0, undefined as unknown as number, 1];
		// Paragraph 1 (level undefined -> 0) opens its OWN step since 0 < 1;
		// paragraph 2 (level 1) then attaches to it since 1 is not < 1.
		expect(groupParagraphsByBuildLevel(levels, 1)).toStrictEqual([[0], [1, 2]]);
	});

	it('returns one group per paragraph for an empty or single-paragraph list', () => {
		expect(groupParagraphsByBuildLevel([])).toStrictEqual([]);
		expect(groupParagraphsByBuildLevel([0])).toStrictEqual([[0]]);
	});
});
