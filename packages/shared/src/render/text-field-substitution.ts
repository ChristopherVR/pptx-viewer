/**
 * Text-field placeholder substitution, shared by every binding's text
 * renderer.
 *
 * Pure string logic: resolves OOXML field runs (slide number, date/time,
 * header/footer, document properties, slide title) into their display text.
 * Extracted from the React `viewer/utils/text-field-substitution` module so
 * every binding substitutes identically. The locale-aware datetime engine
 * lives in `text-field-datetime.ts`.
 */

import { formatLocalizedDateTimeField, isEnglishLocale } from './text-field-datetime';

/** Context for substituting field placeholders (slide number, date/time, header/footer, etc.). */
export interface FieldSubstitutionContext {
	slideNumber?: number;
	dateTimeText?: string;
	/**
	 * The deck's master date-field default TYPE (`a:fld/@type` on the slide
	 * master's `dt` placeholder, e.g. "datetime2"; see `header-footer-parts.ts`).
	 * This is a field TYPE, not a format pattern, and is used ONLY as a
	 * fallback for a field authored with the generic, unnumbered `datetime`
	 * type - a field that already names its own `datetime1`-`datetime13` type
	 * always uses that type, never this one (see `substituteFieldText`).
	 */
	dateFormat?: string;
	/** Footer text from PptxHeaderFooter settings. */
	footerText?: string;
	/** Header text from PptxHeaderFooter settings. */
	headerText?: string;
	/** Custom document properties for `docproperty` field substitution (keyed by property name). */
	customProperties?: ReadonlyArray<{ name: string; value: string }>;
	/** Locale string for date/time formatting (e.g. "en-US"). Falls back to browser default. */
	locale?: string;
	/** Title text extracted from the first title placeholder on the slide. */
	slideTitle?: string;
}

/**
 * Map OOXML predefined datetime field types (datetime1-datetime13) to English
 * format patterns as defined in ISO/IEC 29500 19.7.26. Used directly for an
 * English locale (or no locale at all, the overwhelming common case); a
 * non-English locale renders through `formatLocalizedDateTimeField` instead
 * (see that module's doc comment for why the two diverge).
 */
const DATETIME_TYPE_FORMATS: Record<string, string> = {
	datetime1: 'M/d/yyyy',
	datetime2: 'EEEE, MMMM d, yyyy',
	datetime3: 'd MMMM yyyy',
	datetime4: 'MMMM d, yyyy',
	datetime5: 'dd-MMM-yy',
	datetime6: 'MMMM yy',
	datetime7: 'MMM-yy',
	datetime8: 'M/d/yyyy h:mm a',
	datetime9: 'M/d/yyyy h:mm:ss a',
	datetime10: 'H:mm',
	datetime11: 'H:mm:ss',
	datetime12: 'h:mm a',
	datetime13: 'h:mm:ss a',
};

/** A locale's month names (index 0 = January), long or short form. */
function monthNames(locale: string | undefined, style: 'long' | 'short'): string[] {
	const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', { month: style });
	return Array.from({ length: 12 }, (_, month) => formatter.format(new Date(2000, month, 1)));
}

/** A locale's weekday names (index 0 = Sunday), long or short form. */
function weekdayNames(locale: string | undefined, style: 'long' | 'short'): string[] {
	const formatter = new Intl.DateTimeFormat(locale ?? 'en-US', { weekday: style });
	// 2023-01-01 is a Sunday; offsetting by `day` walks Sun..Sat in order.
	return Array.from({ length: 7 }, (_, day) => formatter.format(new Date(2023, 0, 1 + day)));
}

/**
 * Format a Date using a simple OOXML-style date/time pattern.
 *
 * Supports tokens: yyyy, yy, EEEE (full weekday), EEE (abbr weekday),
 * MMMM, MMM, MM, M, dd, d, HH, H, hh, h, mm, ss, a (AM/PM).
 *
 * Token replacement is done largest-first so shorter tokens don't clobber
 * longer ones (e.g. M vs MM vs MMM vs MMMM). Month/weekday names come from
 * `locale` (via `Intl`) rather than a hardcoded English array, so a caller
 * that reaches this engine with a non-English locale (the `datetime`
 * catch-all type, which `formatLocalizedDateTimeField` does not special-case)
 * still gets translated names, only in the English field order.
 */
function formatDateWithPattern(date: Date, pattern: string, locale?: string): string {
	const months = monthNames(locale, 'long');
	const monthsShort = monthNames(locale, 'short');
	const days = weekdayNames(locale, 'long');
	const daysShort = weekdayNames(locale, 'short');
	const pad = (n: number) => String(n).padStart(2, '0');
	const h12 = (h: number) => (h === 0 ? 12 : h > 12 ? h - 12 : h);
	const hours = date.getHours();

	// Sequential replacement, longest tokens first so shorter tokens don't
	// clobber the longer ones.
	let result = pattern;

	// Four-char tokens first
	result = result.replace(/yyyy/gu, String(date.getFullYear()));
	result = result.replace(/EEEE/gu, days[date.getDay()]);
	result = result.replace(/MMMM/gu, months[date.getMonth()]);

	// Three-char tokens
	result = result.replace(/EEE/gu, daysShort[date.getDay()]);
	result = result.replace(/MMM/gu, monthsShort[date.getMonth()]);

	// Two-char tokens
	result = result.replace(/yy/gu, String(date.getFullYear()).slice(2));
	result = result.replace(/MM/gu, pad(date.getMonth() + 1));
	result = result.replace(/dd/gu, pad(date.getDate()));
	result = result.replace(/HH/gu, pad(hours));
	result = result.replace(/hh/gu, pad(h12(hours)));
	result = result.replace(/mm/gu, pad(date.getMinutes()));
	result = result.replace(/ss/gu, pad(date.getSeconds()));

	// Single-char tokens (lookbehind/lookahead avoid matching inside longer tokens)
	result = result.replace(/(?<![A-Za-z])M(?![A-Za-z])/gu, String(date.getMonth() + 1));
	result = result.replace(/(?<![A-Za-z])d(?![A-Za-z])/gu, String(date.getDate()));
	result = result.replace(/(?<![A-Za-z])H(?![A-Za-z])/gu, String(hours));
	result = result.replace(/(?<![A-Za-z])h(?![A-Za-z])/gu, String(h12(hours)));

	// AM/PM marker
	result = result.replace(/\ba\b/gu, hours >= 12 ? 'PM' : 'AM');

	return result;
}

/**
 * Resolve a formatted date string for a given field type.
 *
 * Resolution order:
 * 1. The field's own type (`fieldType`), when it is one of the predefined
 *    `datetime1`-`datetime13` slugs - a non-English `locale` renders it
 *    through the locale's own native convention; English (or no locale)
 *    renders the literal pattern.
 * 2. `dateFormat` (the deck's master date-field default TYPE) as a fallback,
 *    for the generic, unnumbered `datetime` field type only.
 * 3. A locale-aware fallback via `toLocaleDateString()`.
 *
 * `dateFormat` is a field TYPE (e.g. "datetime2"), never a raw format
 * pattern: it must not override a field that already names its own
 * `datetime1`-`datetime13` type, which is what made every date field on a
 * deck with header/footer date settings render that literal type string
 * ("datetime2") instead of a formatted date - the type string was being fed
 * to the pattern engine as if it were itself a pattern.
 */
export function resolveFieldDateText(
	fieldType: string,
	dateFormat?: string,
	locale?: string,
): string {
	const now = new Date();
	const ownType = fieldType.toLowerCase();
	const effectiveType =
		DATETIME_TYPE_FORMATS[ownType] !== undefined ? ownType : (dateFormat?.toLowerCase() ?? ownType);

	if (!isEnglishLocale(locale)) {
		const localized = formatLocalizedDateTimeField(effectiveType, now, locale as string);
		if (localized !== undefined) {
			return localized;
		}
	}
	const pattern = DATETIME_TYPE_FORMATS[effectiveType];
	if (pattern) {
		return formatDateWithPattern(now, pattern, locale);
	}
	return now.toLocaleDateString(locale);
}

/**
 * Apply field substitution to a text segment if it has a `fieldType`.
 * Returns the substituted text, or the original text if no substitution applies.
 *
 * @param runLocale The field run's own `a:fld/a:rPr@lang`, when the caller has
 *   it (see `TextSegment.style.language`). Takes priority over `ctx.locale`
 *   for every locale-sensitive substitution: a field's own authored language
 *   is more specific than the deck-wide default.
 */
export function substituteFieldText(
	segmentText: string,
	fieldType: string | undefined,
	ctx?: FieldSubstitutionContext,
	runLocale?: string,
): string {
	if (!fieldType || !ctx) {
		return segmentText;
	}
	const fl = fieldType.toLowerCase();
	const locale = runLocale ?? ctx.locale;
	if (fl === 'slidenum' && ctx.slideNumber !== undefined) {
		return String(ctx.slideNumber);
	}
	if (fl.startsWith('datetime')) {
		// Use format-aware date text (the field's own type wins; `dateFormat`
		// only fills in for the generic, unnumbered `datetime` type).
		return resolveFieldDateText(fl, ctx.dateFormat, locale);
	}
	// Footer field -> resolve from header/footer settings
	if (fl === 'footer' && ctx.footerText !== undefined) {
		return ctx.footerText;
	}
	// Header field -> resolve from header/footer settings
	if (fl === 'header' && ctx.headerText !== undefined) {
		return ctx.headerText;
	}
	// Current date -> system date formatted with locale
	if (fl === 'currentdate') {
		return new Date().toLocaleDateString(locale);
	}
	// Current time -> system time formatted with locale
	if (fl === 'currenttime') {
		return new Date().toLocaleTimeString(locale);
	}
	// Slide title -> resolved from the first title placeholder on the slide
	if (fl === 'slidetitle' && ctx.slideTitle !== undefined) {
		return ctx.slideTitle;
	}
	// Document property -> look up by name from custom properties
	if (fl.startsWith('docproperty') && ctx.customProperties) {
		// Field type format: "docproperty" or "docproperty.PropertyName"
		const dotIdx = fieldType.indexOf('.');
		const propName = dotIdx >= 0 ? fieldType.substring(dotIdx + 1).trim() : '';
		if (propName) {
			const prop = ctx.customProperties.find(
				(p) => p.name.toLowerCase() === propName.toLowerCase(),
			);
			if (prop) {
				return prop.value;
			}
		}
	}
	return segmentText;
}
