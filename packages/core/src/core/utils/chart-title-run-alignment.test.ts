import { describe, expect, it } from 'vitest';

import { distributeTitleRunsText } from './chart-title-run-alignment';

describe('distributeTitleRunsText', () => {
	it('returns undefined for an empty run list', () => {
		expect(distributeTitleRunsText([], 'anything')).toBeUndefined();
	});

	it('keeps a single unchanged run and appends trailing text to it', () => {
		expect(distributeTitleRunsText(['Revenue'], 'Revenue Growth')).toStrictEqual([
			'Revenue Growth',
		]);
	});

	it('distributes an append across two unchanged runs onto the last one', () => {
		expect(distributeTitleRunsText(['Revenue', ' Growth'], 'Revenue Growth 2024')).toStrictEqual([
			'Revenue',
			' Growth 2024',
		]);
	});

	it('confines a middle-run rewrite to that run alone', () => {
		expect(
			distributeTitleRunsText(['Revenue ', 'Growth', ' Report'], 'Revenue Increase Report'),
		).toStrictEqual(['Revenue ', 'Increase', ' Report']);
	});

	it('returns undefined for a two-run title whose LAST run is edited (no later run to anchor on)', () => {
		// With only two runs, a change to the last run's own text has no
		// subsequent run boundary to realign against, so this degrades to the
		// same fallback an unrelated rewrite gets; the three-run case (a
		// changed run sandwiched between two unchanged ones) is what
		// `distributes ... onto that run alone` above covers.
		expect(distributeTitleRunsText(['Q4', ' Sales'], 'Q4 Total Sales')).toBeUndefined();
	});

	it('returns undefined when no later run boundary survives (an unrelated rewrite)', () => {
		expect(
			distributeTitleRunsText(['Revenue', ' Growth'], 'Completely Different Title'),
		).toBeUndefined();
	});

	it('returns undefined when only the first of three runs still resolves', () => {
		// 'Growth' and 'Report' both vanish: no anchor to realign the tail onto.
		expect(
			distributeTitleRunsText(['Revenue ', 'Growth', ' Report'], 'Revenue Something Else'),
		).toBeUndefined();
	});

	it('clears an intermediate run absorbed entirely by an edit spanning past it', () => {
		// Run 'B' vanishes and 'C' is nowhere to be found either, but 'D'
		// resurfaces: the whole 'xyz' gap lands on run 1 (the first
		// non-matching run), run 2 ('C') is cleared since it was skipped over,
		// and run 3 ('D') resumes as an unchanged anchor.
		expect(distributeTitleRunsText(['A', 'B', 'C', 'D'], 'AxyzD')).toStrictEqual([
			'A',
			'xyz',
			'',
			'D',
		]);
	});
});
