/**
 * Framework-agnostic export-progress maths shared by the React, Vue, and Angular
 * bindings. A long export (multi-slide PDF/GIF/video) iterates per slide; this
 * module maps a `(current, total)` slide cursor onto the 0-100 percentage the
 * progress modal renders, and builds the matching "slide N of M" status label.
 *
 * Keeping the mapping here means every binding shows identical progress
 * behaviour (the same phase split, the same final 95/100 reserved tail) without
 * re-deriving the arithmetic in each export handler.
 */

/** Reserved tail percentages for the post-capture assembly/save phase. */
export const EXPORT_ASSEMBLING_PERCENT = 95;
export const EXPORT_DONE_PERCENT = 100;

/** Clamp an arbitrary number into the inclusive `[0, 100]` integer range. */
export function clampPercent(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Map a per-slide cursor onto a percentage that fills a band `[0, span]`.
 *
 * @param current - Zero-based index of the slide about to be processed.
 * @param total   - Total slide count (guarded against zero).
 * @param span    - Upper bound of the band to fill (default 90, leaving a tail
 *                  for the assembly/save phase). Pass 45 for a two-phase export
 *                  (capture then record), then offset the record phase by 45.
 */
export function slideProgressPercent(current: number, total: number, span: number = 90): number {
	if (total <= 0) {
		return 0;
	}
	return clampPercent((current / total) * span);
}

/**
 * Map the recording phase of a two-phase (capture + record) export onto the
 * upper half of the bar: capture fills `[0, 45]`, recording fills `[45, 90]`.
 */
export function recordProgressPercent(current: number, total: number): number {
	if (total <= 0) {
		return 45;
	}
	return clampPercent(45 + (current / total) * 45);
}

/**
 * Build a localisable "{verb} slide N of M" status label. `current` is
 * zero-based (matching the export loop cursor); the label shows the 1-based
 * slide number.
 */
export function slideStatusLabel(verb: string, current: number, total: number): string {
	return `${verb} slide ${current + 1} of ${total}...`;
}

/** The cooperative-cancellation error every export loop throws on abort. */
export function exportAbortError(): DOMException {
	return new DOMException('Export cancelled', 'AbortError');
}

/** True when an error is the `AbortError` produced by {@link exportAbortError}. */
export function isExportAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === 'AbortError';
}
