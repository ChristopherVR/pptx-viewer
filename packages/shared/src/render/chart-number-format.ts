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
 * rather than to a wrong number. The numeric-placeholder pattern engine itself
 * lives in `chart-number-format-pattern.ts`.
 */
import { applyPattern, parsePattern } from './chart-number-format-pattern';

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

/** A formatted number, plus a colour from its section's `[Red]`/`[Blue]`/etc. token, when present. */
export interface FormattedChartNumber {
	text: string;
	color?: string;
}

/**
 * Format `value` with an ECMA-376 number-format code, also surfacing a
 * `[Red]`/`[Blue]`/etc. section colour when the code declares one.
 *
 * Returns `undefined` when the code is absent, `General`, or beyond this
 * subset, which tells the caller to keep its own default formatting.
 */
export function formatChartNumberWithColor(
	value: number,
	formatCode?: string,
): FormattedChartNumber | undefined {
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
		return { text: applyPattern(value, pattern, forcePositive), color: pattern.color };
	} catch {
		return undefined;
	}
}

/**
 * Format `value` with an ECMA-376 number-format code.
 *
 * Returns `undefined` when the code is absent, `General`, or beyond this
 * subset, which tells the caller to keep its own default formatting.
 */
export function formatChartNumber(value: number, formatCode?: string): string | undefined {
	return formatChartNumberWithColor(value, formatCode)?.text;
}
