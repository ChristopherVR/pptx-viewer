import { describe, it, expect } from 'vitest';

import {
	breakAutoNumberRun,
	createAutoNumberSequence,
	nextAutoNumber,
} from './auto-number-sequence';

describe('nextAutoNumber', () => {
	it('counts consecutive paragraphs at the same level', () => {
		const sequence = createAutoNumberSequence();

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(1);
		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(2);
		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(3);
	});

	it('honours startAt for the first item of a list', () => {
		const sequence = createAutoNumberSequence();

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 4)).toBe(4);
		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 4)).toBe(5);
	});

	it('ignores preceding prose paragraphs', () => {
		const sequence = createAutoNumberSequence();
		breakAutoNumberRun(sequence, 0);
		breakAutoNumberRun(sequence, 0);

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(1);
	});

	it('restarts after the list is interrupted', () => {
		const sequence = createAutoNumberSequence();
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		breakAutoNumberRun(sequence, 0);

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(1);
	});

	it('restarts when the numbering scheme changes', () => {
		const sequence = createAutoNumberSequence();
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);

		expect(nextAutoNumber(sequence, 0, 'romanLcPeriod', 1)).toBe(1);
	});

	it('keeps a counter per indent level', () => {
		const sequence = createAutoNumberSequence();

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(1);
		expect(nextAutoNumber(sequence, 1, 'alphaLcParenR', 1)).toBe(1);
		expect(nextAutoNumber(sequence, 1, 'alphaLcParenR', 1)).toBe(2);
		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(2);
	});

	it('restarts a nested list under each parent item', () => {
		const sequence = createAutoNumberSequence();
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		nextAutoNumber(sequence, 1, 'alphaLcParenR', 1);
		nextAutoNumber(sequence, 1, 'alphaLcParenR', 1);
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);

		expect(nextAutoNumber(sequence, 1, 'alphaLcParenR', 1)).toBe(1);
	});
});

describe('breakAutoNumberRun', () => {
	it('leaves an outer list running when a nested paragraph breaks', () => {
		const sequence = createAutoNumberSequence();
		nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		breakAutoNumberRun(sequence, 1);

		expect(nextAutoNumber(sequence, 0, 'arabicPeriod', 1)).toBe(2);
	});

	it('ends nested lists when an outer paragraph breaks', () => {
		const sequence = createAutoNumberSequence();
		nextAutoNumber(sequence, 1, 'alphaLcParenR', 1);
		nextAutoNumber(sequence, 1, 'alphaLcParenR', 1);
		breakAutoNumberRun(sequence, 0);

		expect(nextAutoNumber(sequence, 1, 'alphaLcParenR', 1)).toBe(1);
	});
});
