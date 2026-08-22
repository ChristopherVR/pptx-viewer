import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	extractBldPResumeAttrs,
	extractCTnTimingAttrs,
	extractSeqAttrs,
} from './animation-timing-attrs';

describe('extractCTnTimingAttrs', () => {
	it('reads a valid @fill value', () => {
		expect(extractCTnTimingAttrs({ '@_fill': 'hold' } as XmlObject).fill).toBe('hold');
		expect(extractCTnTimingAttrs({ '@_fill': 'remove' } as XmlObject).fill).toBe('remove');
	});

	it('ignores an unrecognized @fill value', () => {
		expect(extractCTnTimingAttrs({ '@_fill': 'bogus' } as XmlObject).fill).toBeUndefined();
	});

	it('reads a valid @restart value', () => {
		expect(extractCTnTimingAttrs({ '@_restart': 'never' } as XmlObject).restart).toBe('never');
	});

	it('parses a finite @repeatDur to milliseconds', () => {
		expect(extractCTnTimingAttrs({ '@_repeatDur': '4000' } as XmlObject).repeatDurMs).toBe(4000);
	});

	it('parses @repeatDur="indefinite" as Infinity', () => {
		expect(extractCTnTimingAttrs({ '@_repeatDur': 'indefinite' } as XmlObject).repeatDurMs).toBe(
			Infinity,
		);
	});

	it('normalizes @spd from 1000ths-of-a-percent to a plain percentage', () => {
		expect(extractCTnTimingAttrs({ '@_spd': '150000' } as XmlObject).speedPct).toBe(150);
	});

	it('ignores a non-positive @spd', () => {
		expect(extractCTnTimingAttrs({ '@_spd': '0' } as XmlObject).speedPct).toBeUndefined();
	});

	it('returns an empty object when no timing attributes are present', () => {
		expect(extractCTnTimingAttrs({} as XmlObject)).toStrictEqual({});
	});
});

describe('extractBldPResumeAttrs', () => {
	it('reads @rev as a boolean', () => {
		expect(extractBldPResumeAttrs({ '@_rev': '1' } as XmlObject).buildReverse).toBeTruthy();
		expect(extractBldPResumeAttrs({ '@_rev': 'true' } as XmlObject).buildReverse).toBeTruthy();
		expect(extractBldPResumeAttrs({} as XmlObject).buildReverse).toBeUndefined();
	});

	it('parses a finite @advAuto to milliseconds', () => {
		expect(extractBldPResumeAttrs({ '@_advAuto': '2500' } as XmlObject).buildAdvAutoMs).toBe(2500);
	});

	it('parses @advAuto="indefinite" as Infinity', () => {
		expect(extractBldPResumeAttrs({ '@_advAuto': 'indefinite' } as XmlObject).buildAdvAutoMs).toBe(
			Infinity,
		);
	});
});

describe('extractSeqAttrs', () => {
	it('returns an empty object for an undefined cTn', () => {
		expect(extractSeqAttrs(undefined)).toStrictEqual({});
	});

	it('reads @concurrent as a boolean', () => {
		expect(extractSeqAttrs({ '@_concurrent': '1' } as XmlObject).seqConcurrent).toBeTruthy();
		expect(extractSeqAttrs({} as XmlObject).seqConcurrent).toBeUndefined();
	});

	it('reads @nextAc / @prevAc from their fixed token sets', () => {
		expect(extractSeqAttrs({ '@_nextAc': 'seek' } as XmlObject).seqNextAction).toBe('seek');
		expect(extractSeqAttrs({ '@_prevAc': 'skipTimeNode' } as XmlObject).seqPrevAction).toBe(
			'skipTimeNode',
		);
	});

	it('ignores an unrecognized @nextAc / @prevAc token', () => {
		expect(extractSeqAttrs({ '@_nextAc': 'bogus' } as XmlObject).seqNextAction).toBeUndefined();
	});
});
