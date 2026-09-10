/**
 * SmartArt DiagramML interpreter - shared numeric-compare helpers for
 * `dgm:if` (`ST_FunctionType`) evaluation.
 *
 * Split out of `smartart-layout-interpreter-when.ts` (the repo's per-file
 * line budget): both that file's `evaluateWhen` and
 * `smartart-layout-interpreter-when-var.ts`'s `evaluateVar` need the same
 * "parse a branch threshold" and "apply `@op` to a numeric pair" logic.
 * Pure TypeScript - no framework code, no DOM.
 */

/** Parse a numeric branch threshold, or `undefined` when non-numeric. */
export function toNumber(value: string): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Apply `when.operator` to compare `actual` against a numeric `threshold`. */
export function compareNumeric(
	actual: number,
	operator: string,
	threshold: number,
): boolean | undefined {
	switch (operator) {
		case 'equ':
			return actual === threshold;
		case 'neq':
			return actual !== threshold;
		case 'gt':
			return actual > threshold;
		case 'lt':
			return actual < threshold;
		case 'gte':
			return actual >= threshold;
		case 'lte':
			return actual <= threshold;
		default:
			return undefined;
	}
}
