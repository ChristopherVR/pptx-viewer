/** Context for substituting field placeholders (slide number, date/time). */
export interface FieldSubstitutionContext {
  slideNumber?: number;
  dateTimeText?: string;
  /** OOXML date-format pattern from header/footer settings (e.g. "M/d/yyyy"). */
  dateFormat?: string;
}

/**
 * Map OOXML predefined datetime field types (datetime1-datetime13) to format
 * patterns as defined in ISO/IEC 29500 §19.7.26.
 */
const DATETIME_TYPE_FORMATS: Record<string, string> = {
  datetime1: "M/d/yyyy",
  datetime2: "EEEE, MMMM d, yyyy",
  datetime3: "d MMMM yyyy",
  datetime4: "MMMM d, yyyy",
  datetime5: "dd-MMM-yy",
  datetime6: "MMMM yy",
  datetime7: "MMM-yy",
  datetime8: "M/d/yyyy h:mm a",
  datetime9: "M/d/yyyy h:mm:ss a",
  datetime10: "H:mm",
  datetime11: "H:mm:ss",
  datetime12: "h:mm a",
  datetime13: "h:mm:ss a",
};

/**
 * Format a Date using a simple OOXML-style date/time pattern.
 *
 * Supports tokens: yyyy, yy, EEEE (full weekday), EEE (abbr weekday),
 * MMMM, MMM, MM, M, dd, d, HH, H, hh, h, mm, ss, a (AM/PM).
 *
 * Token replacement is done largest-first so shorter tokens don't
 * clobber longer ones (e.g. M vs MM vs MMM vs MMMM).
 */
function formatDateWithPattern(date: Date, pattern: string): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const h12 = (h: number) => (h === 0 ? 12 : h > 12 ? h - 12 : h);
  const hours = date.getHours();

  // Use a sequential replacement approach that replaces longest tokens first
  // and uses sentinel chars to avoid double-replacement.
  let result = pattern;

  // Four-char tokens first
  result = result.replace(/yyyy/g, String(date.getFullYear()));
  result = result.replace(/EEEE/g, days[date.getDay()]);
  result = result.replace(/MMMM/g, months[date.getMonth()]);

  // Three-char tokens
  result = result.replace(/EEE/g, days[date.getDay()].slice(0, 3));
  result = result.replace(/MMM/g, months[date.getMonth()].slice(0, 3));

  // Two-char tokens
  result = result.replace(/yy/g, String(date.getFullYear()).slice(2));
  result = result.replace(/MM/g, pad(date.getMonth() + 1));
  result = result.replace(/dd/g, pad(date.getDate()));
  result = result.replace(/HH/g, pad(hours));
  result = result.replace(/hh/g, pad(h12(hours)));
  result = result.replace(/mm/g, pad(date.getMinutes()));
  result = result.replace(/ss/g, pad(date.getSeconds()));

  // Single-char tokens (use negative lookbehind/lookahead to avoid matching inside longer tokens)
  result = result.replace(
    /(?<![A-Za-z])M(?![A-Za-z])/g,
    String(date.getMonth() + 1),
  );
  result = result.replace(
    /(?<![A-Za-z])d(?![A-Za-z])/g,
    String(date.getDate()),
  );
  result = result.replace(/(?<![A-Za-z])H(?![A-Za-z])/g, String(hours));
  result = result.replace(/(?<![A-Za-z])h(?![A-Za-z])/g, String(h12(hours)));

  // AM/PM marker
  result = result.replace(/\ba\b/g, hours >= 12 ? "PM" : "AM");

  return result;
}

/**
 * Resolve a formatted date string for a given field type.
 *
 * Resolution order:
 * 1. Explicit `dateFormat` from header/footer settings (the `@_dtFmt` attribute).
 * 2. Predefined format from the field type (`datetime1`-`datetime13`).
 * 3. Locale-aware fallback via `toLocaleDateString()`.
 */
export function resolveFieldDateText(
  fieldType: string,
  dateFormat?: string,
): string {
  const now = new Date();
  // Explicit format string from the PPTX header/footer settings
  if (dateFormat) {
    return formatDateWithPattern(now, dateFormat);
  }
  // Map known OOXML datetime field types to their predefined format
  const knownFormat = DATETIME_TYPE_FORMATS[fieldType.toLowerCase()];
  if (knownFormat) {
    return formatDateWithPattern(now, knownFormat);
  }
  // Fallback: locale string
  return now.toLocaleDateString();
}

/**
 * Apply field substitution to a text segment if it has a `fieldType`.
 * Returns the substituted text, or the original text if no substitution applies.
 */
export function substituteFieldText(
  segmentText: string,
  fieldType: string | undefined,
  ctx?: FieldSubstitutionContext,
): string {
  if (!fieldType || !ctx) return segmentText;
  const fl = fieldType.toLowerCase();
  if (fl === "slidenum" && ctx.slideNumber != null) {
    return String(ctx.slideNumber);
  }
  if (fl.startsWith("datetime")) {
    // Use format-aware date text (prefer explicit dateFormat, then field type mapping)
    return resolveFieldDateText(fl, ctx.dateFormat);
  }
  return segmentText;
}
