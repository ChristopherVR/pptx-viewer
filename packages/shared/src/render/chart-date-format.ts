/**
 * chart-date-format.ts: a small Excel/ECMA-376 date-format-code renderer for
 * date-axis labels and date-valued data labels.
 *
 * `chart-date-axis.ts`'s `formatDate` used to only sniff whether a format code
 * CONTAINED the substrings `"yyyy"`/`"d"` and always emit one of three fixed
 * shapes (`"D Mon"`, `"Mon YYYY"`, `"YYYY"`) via a hardcoded `en-US` short-month
 * `toLocaleString`. It ignored the code's actual punctuation/order and
 * numeric-vs-name choice entirely, so `mm/dd/yyyy` rendered as `"5 Jan 2024"`
 * instead of `"01/05/2024"`, and `mmmm yyyy` (full month name) rendered
 * identically to `mmm yyyy`.
 *
 * This module renders the tokens charts actually use: `yyyy`/`yy`,
 * `mmmm`/`mmm`/`mm`/`m`, `dddd`/`ddd`/`dd`/`d`, `hh`/`h`, `mm`/`m` (minutes,
 * when adjacent to an hour or second token), `ss`/`s`, `AM/PM`/`A/P`, plus
 * quoted literal text and `\`-escapes. Anything the tokenizer finds no
 * `y`/`m`/`d`/`h`/`s` letter in falls back to the historical calendar-unit
 * heuristic, so an absent or unusable code degrades to today's output rather
 * than to garbage.
 *
 * @module chart-date-format
 */

const MONTH_ABBR = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];
const MONTH_FULL = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One scanned unit of a format code: a run of the same date/time letter, a literal run, or an AM/PM marker. */
type RawToken =
	| { kind: 'letters'; letter: 'y' | 'm' | 'd' | 'h' | 's'; count: number }
	| { kind: 'literal'; text: string }
	| { kind: 'ampm'; upper: boolean; short: boolean };

/** Split a format code into literal runs, AM/PM markers, and `y`/`m`/`d`/`h`/`s` letter runs. */
function scanDateFormatTokens(code: string): RawToken[] {
	const tokens: RawToken[] = [];
	let i = 0;
	while (i < code.length) {
		const ch = code[i];
		if (ch === '"') {
			const close = code.indexOf('"', i + 1);
			tokens.push({
				kind: 'literal',
				text: close === -1 ? code.slice(i + 1) : code.slice(i + 1, close),
			});
			i = close === -1 ? code.length : close + 1;
			continue;
		}
		if (ch === '\\') {
			tokens.push({ kind: 'literal', text: code[i + 1] ?? '' });
			i += 2;
			continue;
		}
		const rest = code.slice(i);
		if (/^am\/pm/iu.test(rest)) {
			tokens.push({ kind: 'ampm', upper: ch === ch.toUpperCase(), short: false });
			i += 5;
			continue;
		}
		if (/^a\/p/iu.test(rest)) {
			tokens.push({ kind: 'ampm', upper: ch === ch.toUpperCase(), short: true });
			i += 3;
			continue;
		}
		if (/[ymdhs]/iu.test(ch)) {
			let j = i + 1;
			while (j < code.length && code[j].toLowerCase() === ch.toLowerCase()) {
				j += 1;
			}
			tokens.push({
				kind: 'letters',
				letter: ch.toLowerCase() as 'y' | 'm' | 'd' | 'h' | 's',
				count: j - i,
			});
			i = j;
			continue;
		}
		tokens.push({ kind: 'literal', text: ch });
		i += 1;
	}
	return tokens;
}

function findNonLiteral(
	tokens: readonly RawToken[],
	index: number,
	step: 1 | -1,
): RawToken | undefined {
	for (let i = index + step; i >= 0 && i < tokens.length; i += step) {
		if (tokens[i].kind !== 'literal') {
			return tokens[i];
		}
	}
	return undefined;
}

function pad(n: number, width: number): string {
	return String(n).padStart(width, '0');
}

/** Render one classified date-part token (year/month/day/hour/minute/second). */
function renderDatePart(
	part: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
	count: number,
	date: Date,
	twelveHour: boolean,
): string {
	switch (part) {
		case 'year':
			return count >= 4 ? pad(date.getUTCFullYear(), 4) : pad(date.getUTCFullYear() % 100, 2);
		case 'month':
			if (count >= 4) {
				return MONTH_FULL[date.getUTCMonth()] ?? '';
			}
			if (count === 3) {
				return MONTH_ABBR[date.getUTCMonth()] ?? '';
			}
			return count >= 2 ? pad(date.getUTCMonth() + 1, 2) : String(date.getUTCMonth() + 1);
		case 'day':
			if (count >= 4) {
				return WEEKDAY_FULL[date.getUTCDay()] ?? '';
			}
			if (count === 3) {
				return WEEKDAY_ABBR[date.getUTCDay()] ?? '';
			}
			return count >= 2 ? pad(date.getUTCDate(), 2) : String(date.getUTCDate());
		case 'hour': {
			const h24 = date.getUTCHours();
			const h = twelveHour ? (h24 % 12 === 0 ? 12 : h24 % 12) : h24;
			return count >= 2 ? pad(h, 2) : String(h);
		}
		case 'minute':
			return count >= 2 ? pad(date.getUTCMinutes(), 2) : String(date.getUTCMinutes());
		case 'second':
			return count >= 2 ? pad(date.getUTCSeconds(), 2) : String(date.getUTCSeconds());
	}
}

/**
 * Render `date` through an Excel/ECMA-376 date-format code. `m` is ambiguous
 * in Excel's own grammar (month vs. minute); it is read as minutes only when
 * it sits immediately next to an hour or second token, skipping over literal
 * separators like `:` (the same rule that lets Excel tell `h:mm` from
 * `mmm yyyy` apart), and as month otherwise.
 */
function renderExcelDateFormat(date: Date, code: string): string {
	const tokens = scanDateFormatTokens(code);
	const hasAmPm = tokens.some((t) => t.kind === 'ampm');
	let out = '';
	for (const [index, token] of tokens.entries()) {
		if (token.kind === 'literal') {
			out += token.text;
			continue;
		}
		if (token.kind === 'ampm') {
			const hour = date.getUTCHours(),
				text = token.short ? (hour < 12 ? 'A' : 'P') : hour < 12 ? 'AM' : 'PM';
			out += token.upper ? text : text.toLowerCase();
			continue;
		}
		if (token.letter === 'm') {
			const prev = findNonLiteral(tokens, index, -1),
				next = findNonLiteral(tokens, index, 1),
				isMinute =
					(prev?.kind === 'letters' && prev.letter === 'h') ||
					(next?.kind === 'letters' && next.letter === 's');
			out += renderDatePart(isMinute ? 'minute' : 'month', token.count, date, hasAmPm);
			continue;
		}
		const part = { y: 'year', d: 'day', h: 'hour', s: 'second' } as const;
		out += renderDatePart(part[token.letter], token.count, date, hasAmPm);
	}
	return out;
}

/**
 * Format a date-axis / date-valued label. Tries the source `format` code
 * (when it contains at least one recognised date/time letter) through the
 * token renderer above; falls back to a calendar-unit-sized heuristic
 * (`"D Mon"` / `"Mon YYYY"` / `"YYYY"`) when the code is absent or unusable,
 * matching the engine's pre-token-renderer output.
 */
export function formatDate(date: Date, unit: 'days' | 'months' | 'years', format?: string): string {
	if (format && /[ymdhs]/iu.test(format)) {
		const rendered = renderExcelDateFormat(date, format);
		if (rendered.length > 0) {
			return rendered;
		}
	}
	const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
		year = String(date.getUTCFullYear()),
		day = String(date.getUTCDate());
	if (unit === 'years') {
		return year;
	}
	if (unit === 'months') {
		return `${month} ${year}`;
	}
	return `${day} ${month}`;
}
