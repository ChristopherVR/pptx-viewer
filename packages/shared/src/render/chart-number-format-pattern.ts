/**
 * chart-number-format-pattern.ts: the numeric-placeholder pattern engine
 * behind `chart-number-format.ts`, split out to keep that file within the
 * repo's ~300-LOC limit.
 *
 * @module chart-number-format-pattern
 */

/**
 * ECMA-376 18.8.30's fixed 8-name colour list for a format section's leading
 * `[Red]`/`[Blue]`/etc. token. `[ColorN]` (indexed palette) and conditions
 * (`[>100]`) are not colours and are ignored, same as any unrecognised token:
 * a colour hint that cannot be resolved falls back to the caller's own
 * colour rather than crashing.
 */
const NAMED_FORMAT_COLORS: Record<string, string> = {
	black: '#000000',
	blue: '#0000FF',
	cyan: '#00FFFF',
	green: '#00FF00',
	magenta: '#FF00FF',
	red: '#FF0000',
	white: '#FFFFFF',
	yellow: '#FFFF00',
};

/** The numeric placeholder run of a format section, and the literals around it. */
export interface Pattern {
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
	/** Colour from a recognised `[Red]`/`[Blue]`/etc. token in this section. */
	color?: string;
}

const PLACEHOLDER = /[0#?]/u;

/**
 * Parse one format section. Returns `undefined` when the section contains no
 * numeric placeholder at all, which means the caller should fall back.
 */
export function parsePattern(code: string): Pattern | undefined {
	let scale = 1;
	let scientific = false;
	let color: string | undefined;
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
			// Colour / condition / locale block: skipped wholesale, except a
			// recognised named colour, whose value the caller can apply to the
			// rendered text (the number itself is unaffected either way).
			const close = code.indexOf(']', i);
			const token = code.slice(i + 1, close === -1 ? code.length : close);
			const named = NAMED_FORMAT_COLORS[token.trim().toLowerCase()];
			if (named && color === undefined) {
				color = named;
			}
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
		color,
	};
}

/** Apply `#,###` grouping to the integer part of an already-rounded string. */
function group(intPart: string): string {
	return intPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
}

/** Render `value` through a parsed pattern. */
export function applyPattern(value: number, pattern: Pattern, forcePositive: boolean): string {
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
