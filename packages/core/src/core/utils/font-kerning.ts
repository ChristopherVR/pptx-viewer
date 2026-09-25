/**
 * Pair kerning for the COM-measured font tables
 * (`font-advance-widths-*.generated.ts`, `scripts/make-font-advance-table.ps1`).
 *
 * PowerPoint kerns a run at or above 12pt (the default `a:rPr kern="1200"`
 * every SmartArt run carries): measured against COM `TextRange.BoundWidth`,
 * summing the table's advances plus these pair adjustments reproduces whole
 * Aptos labels to within 0.2pt at 20pt and 37pt, where the advances alone
 * are off by up to 3.5pt ("Node Five", "To"); below 12pt the unkerned sum is
 * the one that matches (within 0.125pt at 11pt).
 */

/** Kerning applies from 12pt, i.e. 16 CSS px. */
export const KERNING_MIN_SIZE_PX = 16;

/**
 * Decode the generated compact form: whitespace-separated tokens, each the
 * two-character pair followed by its per-1000-em adjustment (`'To-96.25'`).
 */
export function decodeKerningPairs(encoded: string): Readonly<Record<string, number>> {
	const out: Record<string, number> = {};
	for (const token of encoded.split(/\s+/u)) {
		if (token.length < 3) {
			continue;
		}
		const pair = token.slice(0, 2);
		const value = Number(token.slice(2));
		if (Number.isFinite(value)) {
			out[pair] = value;
		}
	}
	return out;
}
