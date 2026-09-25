import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getKinsokuLineBreakStyles } from './kinsoku-styles';

/**
 * `eaLnBrk="1"` is the default in every PowerPoint master, so the mapping
 * must never license mid-word breaks in Latin text off that flag alone: a
 * regression once turned it into `word-break: break-all` and every Latin
 * paragraph in all five bindings wrapped "electro / nic". Only `latinLnBrk`
 * (ECMA-376 21.1.2.2.10) allows a Latin word to be split.
 */
describe('getKinsokuLineBreakStyles', () => {
	it('returns an empty map with no style or no kinsoku flags', () => {
		expect(getKinsokuLineBreakStyles(undefined)).toStrictEqual({});
		expect(getKinsokuLineBreakStyles({ fontSize: 12 } as TextStyle)).toStrictEqual({});
	});

	it('eaLineBreak=true keeps Latin words whole (word-break normal, never break-all)', () => {
		const result = getKinsokuLineBreakStyles({ eaLineBreak: true });
		expect(result.lineBreak).toBe('strict');
		expect(result.wordBreak).toBe('normal');
		expect(result.overflowWrap).toBe('break-word');
	});

	it('eaLineBreak=false leaves kinsoku-off to the run text (no strict mode)', () => {
		// PowerPoint drops kinsoku with eaLnBrk="0" (COM); `strict` did the opposite.
		const result = getKinsokuLineBreakStyles({ eaLineBreak: false });
		expect(result.lineBreak).toBeUndefined();
		expect(result.wordBreak).toBeUndefined();
		expect(result.overflowWrap).toBe('break-word');
	});

	it('latinLineBreak=true is the only flag that splits Latin words', () => {
		expect(getKinsokuLineBreakStyles({ latinLineBreak: true }).wordBreak).toBe('break-all');
		expect(getKinsokuLineBreakStyles({ eaLineBreak: true, latinLineBreak: true }).wordBreak).toBe(
			'break-all',
		);
		expect(getKinsokuLineBreakStyles({ eaLineBreak: false, latinLineBreak: true }).wordBreak).toBe(
			'break-all',
		);
		expect(getKinsokuLineBreakStyles({ latinLineBreak: false }).wordBreak).toBeUndefined();
	});

	it('emits no CSS hanging-punctuation (it is built as run pieces instead)', () => {
		expect(
			getKinsokuLineBreakStyles({ hangingPunctuation: true }).hangingPunctuation,
		).toBeUndefined();
		expect(
			getKinsokuLineBreakStyles({ hangingPunctuation: false }).hangingPunctuation,
		).toBeUndefined();
	});
});
