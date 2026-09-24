/**
 * chart-trendline-equation-format.ts: Excel-style trendline equation text
 * formatting.
 *
 * Excel's own trendline equation display (`c:trendlineLbl` with
 * `c:dispEq val="1"`) rounds every coefficient to a handful of SIGNIFICANT
 * digits in plain decimal notation, not a fixed number of decimal places: a
 * small slope like 0.003742 stays "0.003742"-ish (four significant figures),
 * where `.toFixed(2)` would flatten it to "0.00" and silently erase the fit.
 * It also lays out each trendline family in its own fixed shape (exponential
 * as `y = a e^(bx)`, a polynomial in DESCENDING powers), which this module
 * is the single source of truth for so it cannot drift between the fit types.
 *
 * @module chart-trendline-equation-format
 */

/** Excel's own significant-digit count for a trendline equation coefficient. */
const SIGNIFICANT_DIGITS = 4;

/**
 * Format one coefficient to `SIGNIFICANT_DIGITS` significant figures in plain
 * decimal notation (falls back to exponential only where `Number#toString`
 * itself would, i.e. extreme magnitudes), with insignificant trailing zeros
 * dropped. `-0` normalises to `"0"`.
 */
export function formatTrendlineCoefficient(value: number): string {
	if (!Number.isFinite(value) || value === 0) {
		return '0';
	}
	// `toPrecision` rounds to N significant digits (possibly as exponential
	// notation for extreme magnitudes); round-tripping through `Number` then
	// `String` drops insignificant trailing zeros and only KEEPS exponential
	// notation where plain decimal would be absurd, matching Excel's own
	// General-format display.
	const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
	return rounded === 0 ? '0' : String(rounded);
}

/** `sign` + `formatted absolute value`, for gluing a term onto a running equation. */
function signedTerm(value: number): { sign: '+' | '-'; abs: string } {
	return { sign: value < 0 ? '-' : '+', abs: formatTrendlineCoefficient(Math.abs(value)) };
}

/** `y = mx + b` (linear) or `y = mx - b` when the intercept is negative. */
export function formatLinearEquation(slope: number, intercept: number): string {
	const { sign, abs } = signedTerm(intercept);
	return `y = ${formatTrendlineCoefficient(slope)}x ${sign} ${abs}`;
}

/** `y = a e^(bx)`: Excel's own exponential trendline layout. */
export function formatExponentialEquation(a: number, b: number): string {
	return `y = ${formatTrendlineCoefficient(a)} e^(${formatTrendlineCoefficient(b)}x)`;
}

/** `y = a ln(x) + b` (logarithmic), `-` glue when the intercept is negative. */
export function formatLogarithmicEquation(slope: number, intercept: number): string {
	const { sign, abs } = signedTerm(intercept);
	return `y = ${formatTrendlineCoefficient(slope)}ln(x) ${sign} ${abs}`;
}

/** `y = a x^b` (power). */
export function formatPowerEquation(a: number, b: number): string {
	return `y = ${formatTrendlineCoefficient(a)}x^${formatTrendlineCoefficient(b)}`;
}

/**
 * `y = a_n x^n + ... + a_1 x + a_0`: a polynomial in DESCENDING powers of x
 * (Excel's own layout), from `coeffsAscending` ([a0, a1, ..., an], the order
 * `fitPolynomial` returns them in). The highest-order term never shows a
 * redundant leading `+`; `x^1` drops its exponent; the constant term (`x^0`)
 * drops the variable entirely.
 */
export function formatPolynomialEquation(coeffsAscending: readonly number[]): string {
	const order = coeffsAscending.length - 1;
	let out = 'y = ';
	for (let power = order; power >= 0; power--) {
		const coeff = coeffsAscending[power] ?? 0;
		const { sign, abs } = signedTerm(coeff);
		const variable = power === 0 ? '' : power === 1 ? 'x' : `x^${power}`;
		out +=
			power === order
				? `${sign === '-' ? '-' : ''}${abs}${variable}`
				: ` ${sign} ${abs}${variable}`;
	}
	return out;
}
