/**
 * Locale-aware formatting for the OOXML predefined datetime field types
 * (`datetime1`-`datetime13`, ECMA-376 19.7.26), used by `a:fld` runs (slide
 * date/time placeholders, header/footer date fields).
 *
 * Split out of `text-field-substitution.ts` to keep that module focused; this
 * is the piece that has to reason about locale, the other only about which
 * OOXML field type maps to which display text.
 *
 * The English patterns below (`M/d/yyyy`, `MMMM d, yyyy`, ...) are the LITERAL
 * shape of each type, verified against PowerPoint through COM. PowerPoint does
 * NOT translate that literal token order into every other language: it
 * renders the same semantic date/time style (short date, full
 * date-with-weekday, long date, 24-hour time, 12-hour time) using the
 * requesting locale's own native convention - field order, separators,
 * month/weekday names, and whether that locale even has a 12-hour/AM-PM
 * concept at all. Verified against PowerPoint through COM for de-DE (datetime
 * 1/2/4/12) and fr-FR (datetime1); see `text-field-substitution.test.ts` for
 * the exact strings. A locale without concrete COM evidence still renders
 * through the same ICU-backed `Intl` calls a browser uses everywhere else in
 * this app, which is the best framework-neutral approximation available.
 */

/** Whether `locale` should use the literal English token patterns. No locale
 * (the overwhelming common case: a deck with no `a:fld/a:rPr@lang`) keeps
 * today's English-only behaviour unchanged. */
export function isEnglishLocale(locale: string | undefined): boolean {
	return !locale || locale.toLowerCase().startsWith('en');
}

/**
 * `Intl.DateTimeFormat(locale, { dateStyle }).format(date)`, but with the
 * year part always rendered in full (4 digits, in the locale's own numbering
 * system).
 *
 * `dateStyle: 'short'` renders a 2-digit year for several locales (en-US,
 * de-DE) but a 4-digit year for others (fr-FR, ja-JP): PowerPoint's
 * `datetime1` always uses a 4-digit year regardless of locale (verified via
 * COM: de-DE renders "24.09.2026", not "24.09.26"), so the 2-digit locales
 * need their year part corrected; the already-4-digit locales are a no-op.
 */
function fullYearDateStyle(
	date: Date,
	locale: string,
	dateStyle: 'short' | 'long' | 'full',
): string {
	try {
		const parts = new Intl.DateTimeFormat(locale, { dateStyle }).formatToParts(date);
		const fullYear = new Intl.NumberFormat(locale, { useGrouping: false }).format(
			date.getFullYear(),
		);
		return parts.map((part) => (part.type === 'year' ? fullYear : part.value)).join('');
	} catch {
		return date.toLocaleDateString(locale);
	}
}

/** One locale-formatted date/time component (month name, 2-digit year, ...). */
function component(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
	try {
		return new Intl.DateTimeFormat(locale, options).format(date);
	} catch {
		return '';
	}
}

/**
 * Locale-native time of day. `datetime10`/`datetime11` are always 24-hour by
 * spec (forced `hour12: false`); `datetime12`/`datetime13` are 12-hour ONLY
 * for locales that have that convention - `hour12` is left for `Intl` to
 * decide (its default per locale) rather than forced `true`, because forcing
 * a 12-hour clock on a locale with no native AM/PM concept renders the
 * un-translated English "AM"/"PM" token (verified via COM: de-DE's `datetime12`
 * renders the bare "5:50", not "5:50 AM").
 */
function localTime(
	date: Date,
	locale: string,
	hour12: boolean | undefined,
	seconds: boolean,
): string {
	const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
	if (seconds) {
		options.second = '2-digit';
	}
	if (hour12 !== undefined) {
		options.hour12 = hour12;
	}
	try {
		return new Intl.DateTimeFormat(locale, options).format(date);
	} catch {
		return date.toLocaleTimeString(locale);
	}
}

/**
 * Render one of the predefined `datetime1`-`datetime13` OOXML field types for
 * a non-English `locale`, using the locale's own native date/time convention.
 *
 * Returns `undefined` for a type this module does not (yet) special-case, so
 * the caller falls back to the literal English pattern engine.
 */
export function formatLocalizedDateTimeField(
	type: string,
	date: Date,
	locale: string,
): string | undefined {
	switch (type) {
		case 'datetime1':
			return fullYearDateStyle(date, locale, 'short');
		case 'datetime2':
			return fullYearDateStyle(date, locale, 'full');
		case 'datetime3':
		case 'datetime4':
			// English is the one locale where these two differ (day-first-no-comma
			// vs. month-first-with-comma); every other locale has a single native
			// "long date" convention, so both collapse onto it (verified via COM:
			// de-DE's `datetime4` renders "24. September 2026", the SAME day-first
			// shape German's `datetime2` uses for its date portion).
			return fullYearDateStyle(date, locale, 'long');
		case 'datetime5':
			return `${component(date, locale, { day: '2-digit' })}-${component(date, locale, { month: 'short' })}-${component(date, locale, { year: '2-digit' })}`;
		case 'datetime6':
			return `${component(date, locale, { month: 'long' })} ${component(date, locale, { year: '2-digit' })}`;
		case 'datetime7':
			return `${component(date, locale, { month: 'short' })}-${component(date, locale, { year: '2-digit' })}`;
		case 'datetime8':
			return `${fullYearDateStyle(date, locale, 'short')} ${localTime(date, locale, undefined, false)}`;
		case 'datetime9':
			return `${fullYearDateStyle(date, locale, 'short')} ${localTime(date, locale, undefined, true)}`;
		case 'datetime10':
			return localTime(date, locale, false, false);
		case 'datetime11':
			return localTime(date, locale, false, true);
		case 'datetime12':
			return localTime(date, locale, undefined, false);
		case 'datetime13':
			return localTime(date, locale, undefined, true);
		default:
			return undefined;
	}
}
