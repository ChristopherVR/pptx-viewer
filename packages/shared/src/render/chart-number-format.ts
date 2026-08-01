/**
 * ECMA-376 / SpreadsheetML number-format codes, applied to chart labels.
 *
 * A chart's value axis and its data labels both carry a `c:numFmt/@formatCode`
 * (or inherit one from the series' `c:numCache/c:formatCode` when
 * `@sourceLinked="1"`). Ignoring it is what made a percentage chart render its
 * axis as `0.1 0.2 0.3` and its bars as `0.52` where PowerPoint shows `10% 20%
 * 30%` and `52%`: the cached values ARE fractions, and the format code is the
 * only thing that says so.
 *
 * This covers the codes charts actually use - literal text, digit placeholders,
 * thousands separators, percent, scientific notation, and the
 * `positive;negative;zero` section split - and deliberately stops short of a
 * full Excel format engine. Anything it does not recognise falls back to the
 * caller's default rendering, so an exotic code degrades to today's output
 * rather than to a wrong number.
 */

/** Format codes that mean "no explicit format"; the caller's default wins. */
const GENERAL = new Set(['', 'general', '@']);

/** Split a format code into its `positive;negative;zero;text` sections. */
function sections(code: string): string[] {
	const out: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < code.length; i += 1) {
		const ch = code[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
			continue;
		}
		if (ch === '\\') {
			current += ch + (code[i + 1] ?? '');
			i += 1;
			continue;
		}
		if (ch === ';' && !inQuotes) {
			out.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out;
}

/** Pick the section that applies to `value` (positive / negative / zero). */
function sectionFor(value: number, parts: string[]): { code: string; forcePositive: boolean } {
	if (parts.length === 1) {
		return { code: parts[0], forcePositive: false };
	}
	if (value < 0 && parts[1] !== undefined) {
		// A dedicated negative section supplies its own sign (often none, or
		// parentheses), so the magnitude is formatted unsigned.
		return { code: parts[1], forcePositive: true };
	}
	if (value === 0 && parts[2] !== undefined) {
		return { code: parts[2], forcePositive: false };
	}
	return { code: parts[0], forcePositive: false };
}

/** The numeric placeholder run of a format section, and the literals around it. */
interface Pattern {
	prefix: string;
	suffix: string;
	/** Digits required left of the point (`0` placeholders). */
	intDigits: number;
	/** Digits shown right of the point: `[required, optional]`. */
	decimals: { required: number; optional: number };
	/** `#,##0` style grouping. */
	grouped: boolean;
	/** Multiplier applied before formatting: 100 per `%`, 0.001 per trailing `,`. */
	scale: number;
	/** `0.00E+00` scientific notation. */
	scientific: boolean;
}

const PLACEHOLDER = /[0#?]/u;

/**
 * Parse one format section. Returns `undefined` when the section contains no
 * numeric placeholder at all, which means the caller should fall back.
 */
function parsePattern(code: string): Pattern | undefined {
	let scale = 1;
	let scientific = false;
	const chars: Array<{ ch: string; literal: boolean }> = [];

	let inQuotes = false;
	for (let i = 0; i < code.length; i += 1) {
		const ch = code[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (inQuotes) {
			chars.push({ ch, literal: true });
			continue;
		}
		if (ch === '\\' || ch === '*' || ch === '_') {
			// Escape / repeat / skip-width: the next char is a literal (and for
			// `_` the width padding is not reproducible in SVG text anyway).
			const next = code[i + 1];
			i += 1;
			if (ch === '\\' && next !== undefined) {
				chars.push({ ch: next, literal: true });
			}
			continue;
		}
		if (ch === '%') {
			scale *= 100;
			chars.push({ ch, literal: true });
			continue;
		}
		if (ch === 'E' && (code[i + 1] === '+' || code[i + 1] === '-')) {
			scientific = true;
			chars.push({ ch: 'E', literal: false });
			i += 1;
			continue;
		}
		if (ch === '[') {
			// Colour / condition / locale block: skipped wholesale.
			const close = code.indexOf(']', i);
			i = close === -1 ? code.length : close;
			continue;
		}
		chars.push({ ch, literal: false });
	}

	const firstDigit = chars.findIndex((c) => !c.literal && PLACEHOLDER.test(c.ch));
	if (firstDigit === -1) {
		return undefined;
	}
	let lastDigit = firstDigit;
	for (let i = chars.length - 1; i >= firstDigit; i -= 1) {
		const c = chars[i];
		if (!c.literal && (PLACEHOLDER.test(c.ch) || c.ch === '.' || c.ch === ',' || c.ch === 'E')) {
			lastDigit = i;
			break;
		}
	}

	const numeric = chars.slice(firstDigit, lastDigit + 1);
	const prefix = chars
		.slice(0, firstDigit)
		.map((c) => c.ch)
		.join('');
	const suffix = chars
		.slice(lastDigit + 1)
		.map((c) => c.ch)
		.join('');

	// Trailing commas immediately before the decimal point (or at the end of the
	// integer run) scale by thousands; a comma between placeholders groups.
	let grouped = false;
	let intDigits = 0;
	let required = 0;
	let optional = 0;
	let afterPoint = false;
	let inExponent = false;
	for (let i = 0; i < numeric.length; i += 1) {
		const { ch, literal } = numeric[i];
		if (literal) {
			continue;
		}
		if (ch === 'E') {
			inExponent = true;
			continue;
		}
		if (inExponent) {
			continue;
		}
		if (ch === '.') {
			afterPoint = true;
			continue;
		}
		if (ch === ',') {
			const next = numeric.slice(i + 1).find((c) => !c.literal);
			if (!next || next.ch === '.' || !PLACEHOLDER.test(next.ch)) {
				scale /= 1000;
			} else {
				grouped = true;
			}
			continue;
		}
		if (!PLACEHOLDER.test(ch)) {
			continue;
		}
		if (afterPoint) {
			if (ch === '0') {
				required += 1;
			} else {
				optional += 1;
			}
		} else if (ch === '0') {
			intDigits += 1;
		}
	}

	return {
		prefix,
		suffix,
		intDigits,
		decimals: { required, optional },
		grouped,
		scale,
		scientific,
	};
}

/** Apply `#,###` grouping to the integer part of an already-rounded string. */
function group(intPart: string): string {
	return intPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
}

/** Render `value` through a parsed pattern. */
function applyPattern(value: number, pattern: Pattern, forcePositive: boolean): string {
	const scaled = value * pattern.scale;
	const magnitude = forcePositive ? Math.abs(scaled) : scaled;

	if (pattern.scientific) {
		const digits = pattern.decimals.required + pattern.decimals.optional;
		const exponential = magnitude.toExponential(digits);
		const [mantissa, exponent] = exponential.split('e');
		const sign = exponent.startsWith('-') ? '-' : '+';
		const power = Math.abs(Number(exponent)).toString().padStart(2, '0');
		return `${pattern.prefix}${mantissa}E${sign}${power}${pattern.suffix}`;
	}

	const maxDecimals = pattern.decimals.required + pattern.decimals.optional;
	let body = magnitude.toFixed(maxDecimals);
	if (pattern.decimals.optional > 0) {
		// Optional (`#`/`?`) decimals are dropped when they are zero.
		body = body.replace(/(\.\d*?)0+$/u, '$1').replace(/\.$/u, '');
		const [, frac = ''] = body.split('.');
		if (frac.length < pattern.decimals.required) {
			body = Number(body).toFixed(pattern.decimals.required);
		}
	}

	const [rawIntPart, fracPart] = body.split('.');
	let intPart = rawIntPart;
	const negative = intPart.startsWith('-');
	if (negative) {
		intPart = intPart.slice(1);
	}
	if (intPart.length < pattern.intDigits) {
		intPart = intPart.padStart(pattern.intDigits, '0');
	}
	if (pattern.intDigits === 0 && intPart === '0' && fracPart !== undefined) {
		// `#.##` drops the leading zero; `0.##` keeps it.
		intPart = '';
	}
	if (pattern.grouped) {
		intPart = group(intPart);
	}

	const number = fracPart === undefined ? intPart : `${intPart}.${fracPart}`;
	return `${negative ? '-' : ''}${pattern.prefix}${number}${pattern.suffix}`;
}

/**
 * Format `value` with an ECMA-376 number-format code.
 *
 * Returns `undefined` when the code is absent, `General`, or beyond this
 * subset, which tells the caller to keep its own default formatting.
 */
export function formatChartNumber(value: number, formatCode?: string): string | undefined {
	if (!Number.isFinite(value)) {
		return undefined;
	}
	const code = (formatCode ?? '').trim();
	if (GENERAL.has(code.toLowerCase())) {
		return undefined;
	}
	// Date/time codes are the province of `chart-date-axis`; a value axis never
	// carries one, and mistaking `d` for a digit would corrupt the label.
	if (/(?:^|[^\\"])(?:yy|mm?m|dd?|hh|ss)/iu.test(code) && !/[0#?]/u.test(code)) {
		return undefined;
	}
	const { code: section, forcePositive } = sectionFor(value, sections(code));
	const pattern = parsePattern(section);
	if (!pattern) {
		return undefined;
	}
	try {
		return applyPattern(value, pattern, forcePositive);
	} catch {
		return undefined;
	}
}
