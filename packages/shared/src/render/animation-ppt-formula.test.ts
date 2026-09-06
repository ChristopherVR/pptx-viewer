import { describe, expect, it } from 'vitest';

import { evaluatePptFormula } from './animation-ppt-formula';

describe('evaluatePptFormula', () => {
	it('evaluates a plain number', () => {
		expect(evaluatePptFormula('0')).toBe(0);
		expect(evaluatePptFormula('-1.0')).toBe(-1);
		expect(evaluatePptFormula('.25')).toBe(0.25);
	});

	it('resolves #ppt_x/#ppt_y/#ppt_w/#ppt_h, with or without the leading #', () => {
		const vars = { ppt_h: 0.3, ppt_w: 0.2, ppt_x: 0.5, ppt_y: 0.4 };
		expect(evaluatePptFormula('#ppt_x', vars)).toBe(0.5);
		expect(evaluatePptFormula('ppt_x', vars)).toBe(0.5);
		expect(evaluatePptFormula('#ppt_w*.05', vars)).toBeCloseTo(0.01);
		expect(evaluatePptFormula('#ppt_h/3+#ppt_w*0.1', vars)).toBeCloseTo(0.12);
	});

	it('honours outer parentheses and unary minus (Grow And Turn from=)', () => {
		expect(evaluatePptFormula('(-#ppt_w/2)', { ppt_w: 0.2 })).toBeCloseTo(-0.1);
		expect(evaluatePptFormula('(#ppt_x)', { ppt_x: 0.4 })).toBe(0.4);
	});

	it('applies + - * / with the usual precedence', () => {
		expect(evaluatePptFormula('1+2*3')).toBe(7);
		expect(evaluatePptFormula('(1+2)*3')).toBe(9);
		expect(evaluatePptFormula('10/2-3')).toBe(2);
		expect(evaluatePptFormula('2^3')).toBe(8);
		expect(evaluatePptFormula('-2^2')).toBe(-4); // unary binds tighter than nothing, ^ before unary's operand
	});

	it('resolves $ (the sampled interpolation parameter) and pi/e', () => {
		expect(evaluatePptFormula('$', { $: 0.5 })).toBe(0.5);
		expect(evaluatePptFormula('sin(pi*$)', { $: 0.5 })).toBeCloseTo(1);
		expect(evaluatePptFormula('#ppt_y-sin(pi*$)/3', { $: 0.5, ppt_y: 1 })).toBeCloseTo(1 - 1 / 3);
		expect(evaluatePptFormula('e')).toBeCloseTo(Math.E);
	});

	it('supports abs/sqrt/sin/cos/tan/atan/min/max', () => {
		expect(evaluatePptFormula('abs(-5)')).toBe(5);
		expect(evaluatePptFormula('sqrt(9)')).toBe(3);
		expect(evaluatePptFormula('cos(0)')).toBe(1);
		expect(evaluatePptFormula('tan(0)')).toBe(0);
		expect(evaluatePptFormula('atan(0)')).toBe(0);
		expect(evaluatePptFormula('min(3,1,2)')).toBe(1);
		expect(evaluatePptFormula('max(3,1,2)')).toBe(3);
	});

	it('is case-insensitive for identifiers', () => {
		expect(evaluatePptFormula('PPT_X+PI', { ppt_x: 1 })).toBeCloseTo(1 + Math.PI);
	});

	it('returns undefined, never throws, on malformed input', () => {
		expect(evaluatePptFormula('')).toBeUndefined();
		expect(evaluatePptFormula('#ppt_x +')).toBeUndefined();
		expect(evaluatePptFormula('((1+2)')).toBeUndefined();
		expect(evaluatePptFormula('1 2')).toBeUndefined();
		expect(evaluatePptFormula('unknownVar')).toBeUndefined();
		expect(evaluatePptFormula('sin(1,2)')).toBeUndefined(); // wrong arity
		expect(evaluatePptFormula('notAFunction(1)')).toBeUndefined();
	});

	it('returns undefined on a non-finite result instead of Infinity/NaN', () => {
		expect(evaluatePptFormula('1/0')).toBeUndefined();
		expect(evaluatePptFormula('0/0')).toBeUndefined();
	});
});
