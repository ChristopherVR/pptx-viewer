/**
 * Unit tests for chart-trendline-equation-format.ts: Excel-style trendline
 * equation text (significant digits, per-family layout).
 */
import { describe, expect, it } from 'vitest';

import {
	formatExponentialEquation,
	formatLinearEquation,
	formatLogarithmicEquation,
	formatPolynomialEquation,
	formatPowerEquation,
	formatTrendlineCoefficient,
} from './chart-trendline-equation-format';

describe('formatTrendlineCoefficient', () => {
	it('rounds to 4 significant digits, not 2 fixed decimals', () => {
		// .toFixed(2) would flatten this to "0.00" and erase the fit entirely.
		expect(formatTrendlineCoefficient(0.0037421)).toBe('0.003742');
	});

	it('drops insignificant trailing zeros', () => {
		expect(formatTrendlineCoefficient(2.5)).toBe('2.5');
	});

	it('formats a typical mid-range coefficient to 4 significant figures', () => {
		expect(formatTrendlineCoefficient(2.074483)).toBe('2.074');
	});

	it('returns "0" for exactly zero (and -0)', () => {
		expect(formatTrendlineCoefficient(0)).toBe('0');
		expect(formatTrendlineCoefficient(-0)).toBe('0');
	});

	it('preserves the sign for a negative coefficient', () => {
		expect(formatTrendlineCoefficient(-0.070368)).toBe('-0.07037');
	});
});

describe('formatLinearEquation', () => {
	it('formats a positive intercept with a plus sign', () => {
		expect(formatLinearEquation(2.5, 1.2)).toBe('y = 2.5x + 1.2');
	});

	it('formats a negative intercept with a minus sign (never "+ -1.2")', () => {
		expect(formatLinearEquation(2.5, -1.2)).toBe('y = 2.5x - 1.2');
	});
});

describe('formatExponentialEquation', () => {
	it('matches Excel\'s own "y = a e^(bx)" layout with a space before e', () => {
		expect(formatExponentialEquation(2.0745, 0.7488)).toBe('y = 2.075 e^(0.7488x)');
	});
});

describe('formatPowerEquation', () => {
	it('formats as "y = a x^b" with no space before x', () => {
		expect(formatPowerEquation(2.9756, 0.4935)).toBe('y = 2.976x^0.4935');
	});
});

describe('formatLogarithmicEquation', () => {
	it('formats as "y = a ln(x) + b"', () => {
		expect(formatLogarithmicEquation(3.1, -0.4)).toBe('y = 3.1ln(x) - 0.4');
	});
});

describe('formatPolynomialEquation', () => {
	it('renders coefficients in DESCENDING powers, ascending input order', () => {
		// coeffsAscending = [a0, a1, a2, a3] = [6.4133, -0.5735, 0.9432, -0.0704]
		const equation = formatPolynomialEquation([6.4133, -0.5735, 0.9432, -0.0704]);
		expect(equation).toBe('y = -0.0704x^3 + 0.9432x^2 - 0.5735x + 6.413');
	});

	it('drops the exponent on x^1 and the variable on the constant term', () => {
		const equation = formatPolynomialEquation([5, 2]);
		expect(equation).toBe('y = 2x + 5');
	});

	it('never emits a redundant leading "+" on the highest-order term', () => {
		const equation = formatPolynomialEquation([0, 0, 3]);
		expect(equation.startsWith('y = 3x^2')).toBeTruthy();
	});
});
