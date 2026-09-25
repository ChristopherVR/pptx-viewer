import type { TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { getKinsokuLineBreakStyles } from './kinsoku-styles';

describe('getKinsokuLineBreakStyles', () => {
	// ── Undefined / empty input ───────────────────────────────────────────

	it('returns empty object when textStyle is undefined', () => {
		expect(getKinsokuLineBreakStyles(undefined)).toStrictEqual({});
	});

	it('returns empty object when textStyle has no kinsoku-related flags', () => {
		const style: TextStyle = { fontSize: 24, bold: true };
		expect(getKinsokuLineBreakStyles(style)).toStrictEqual({});
	});

	// ── eaLineBreak ──────────────────────────────────────────────────────

	it('sets lineBreak=strict and keeps Latin words whole when eaLineBreak is true', () => {
		const style: TextStyle = { eaLineBreak: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBe('strict');
		expect(result.wordBreak).toBe('normal');
		expect(result.overflowWrap).toBe('break-word');
	});

	it('leaves kinsoku-off to the run text when eaLineBreak is false (no strict mode)', () => {
		const style: TextStyle = { eaLineBreak: false };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBeUndefined();
		expect(result.overflowWrap).toBe('break-word');
	});

	it('does not set wordBreak when eaLineBreak is false', () => {
		const style: TextStyle = { eaLineBreak: false };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.wordBreak).toBeUndefined();
	});

	// ── hangingPunctuation ───────────────────────────────────────────────

	it('emits no CSS hanging-punctuation when hangingPunctuation is true (run pieces do it)', () => {
		const style: TextStyle = { hangingPunctuation: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.hangingPunctuation).toBeUndefined();
	});

	it('emits no CSS hanging-punctuation when hangingPunctuation is false', () => {
		const style: TextStyle = { hangingPunctuation: false };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.hangingPunctuation).toBeUndefined();
	});

	it('does not set hangingPunctuation when flag is undefined', () => {
		const style: TextStyle = { eaLineBreak: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.hangingPunctuation).toBeUndefined();
	});

	// ── latinLineBreak ───────────────────────────────────────────────────

	it('sets wordBreak=break-all when latinLineBreak is true', () => {
		const style: TextStyle = { latinLineBreak: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.wordBreak).toBe('break-all');
		expect(result.overflowWrap).toBe('break-word');
	});

	it('does not set wordBreak when latinLineBreak is false', () => {
		const style: TextStyle = { latinLineBreak: false };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.wordBreak).toBeUndefined();
	});

	// ── Combinations ─────────────────────────────────────────────────────

	it('combines eaLineBreak=true with hangingPunctuation=true', () => {
		const style: TextStyle = { eaLineBreak: true, hangingPunctuation: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBe('strict');
		expect(result.wordBreak).toBe('normal');
		expect(result.overflowWrap).toBe('break-word');
		expect(result.hangingPunctuation).toBeUndefined();
	});

	it('combines eaLineBreak=false with hangingPunctuation=false', () => {
		const style: TextStyle = { eaLineBreak: false, hangingPunctuation: false };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBeUndefined();
		expect(result.overflowWrap).toBe('break-word');
		expect(result.hangingPunctuation).toBeUndefined();
	});

	it('combines eaLineBreak=true with latinLineBreak=true', () => {
		const style: TextStyle = { eaLineBreak: true, latinLineBreak: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBe('strict');
		// only latinLineBreak=true licenses mid-word breaks; eaLineBreak alone never does
		expect(result.wordBreak).toBe('break-all');
		expect(result.overflowWrap).toBe('break-word');
	});

	it('combines all three flags: eaLineBreak=true, hangingPunctuation=true, latinLineBreak=true', () => {
		const style: TextStyle = {
			eaLineBreak: true,
			hangingPunctuation: true,
			latinLineBreak: true,
		};
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBe('strict');
		expect(result.wordBreak).toBe('break-all');
		expect(result.overflowWrap).toBe('break-word');
		expect(result.hangingPunctuation).toBeUndefined();
	});

	it('combines eaLineBreak=false with hangingPunctuation=true', () => {
		const style: TextStyle = { eaLineBreak: false, hangingPunctuation: true };
		const result = getKinsokuLineBreakStyles(style);
		expect(result.lineBreak).toBeUndefined();
		expect(result.overflowWrap).toBe('break-word');
		expect(result.hangingPunctuation).toBeUndefined();
		expect(result.wordBreak).toBeUndefined();
	});

	// ── latinLineBreak overrides wordBreak from eaLineBreak ──────────────

	it('latinLineBreak=true sets wordBreak even when eaLineBreak is false', () => {
		const style: TextStyle = { eaLineBreak: false, latinLineBreak: true };
		const result = getKinsokuLineBreakStyles(style);
		// latinLineBreak=true alone licenses wordBreak=break-all
		expect(result.lineBreak).toBeUndefined();
		expect(result.wordBreak).toBe('break-all');
		expect(result.overflowWrap).toBe('break-word');
	});

	// ── Does not interfere with other TextStyle properties ───────────────

	it('ignores non-kinsoku TextStyle properties', () => {
		const style: TextStyle = {
			fontFamily: 'Noto Sans CJK',
			fontSize: 18,
			bold: true,
			color: '#000000',
			align: 'left',
		};
		const result = getKinsokuLineBreakStyles(style);
		expect(result).toStrictEqual({});
	});
});
