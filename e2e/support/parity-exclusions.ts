/**
 * Narrowly-scoped, documented exclusions for known cross-binding divergences.
 *
 * The parity specs must stay green on main, but a widened assertion sometimes
 * reveals a GENUINE product divergence that cannot be fixed from the e2e side.
 * The policy is: never loosen the assertion for everyone; instead register the
 * one known divergence here-style, scoped as tightly as the defect (binding,
 * deck, slide, and a pattern matching only the offending problem line), with a
 * `why` explaining the root cause. Every entry is standing parity debt and
 * should disappear when the product bug is fixed - `unmatched` makes stale
 * entries visible so they get deleted rather than accumulating.
 *
 * @module e2e/support/parity-exclusions
 */

/** One known divergence to tolerate. */
export interface ParityExclusion {
	/** Candidate binding name this applies to, or every binding when omitted. */
	binding?: string;
	/** Context label (deck and/or slide prefix) this applies to, or everywhere when omitted. */
	where?: string;
	/** Matches the problem line(s) produced by the divergence. Keep it specific. */
	pattern: RegExp;
	/** Root cause. Required: an exclusion nobody can explain is a suppressed bug. */
	why: string;
}

/**
 * Drop the problem lines covered by `exclusions` for this binding + context.
 *
 * Call once per candidate binding per context label; the returned problems are
 * what the spec should still assert empty. Pass a shared `matched` set when
 * auditing which entries still earn their keep: an exclusion that never
 * matches anything is either stale (delete it) or mis-scoped.
 */
export function applyExclusions(
	problems: readonly string[],
	context: { binding: string; where?: string },
	exclusions: readonly ParityExclusion[],
	matched?: Set<ParityExclusion>,
): string[] {
	const applicable = exclusions.filter(
		(exclusion) =>
			(exclusion.binding === undefined || exclusion.binding === context.binding) &&
			(exclusion.where === undefined ||
				context.where === undefined ||
				context.where.startsWith(exclusion.where)),
	);
	return problems.filter((problem) => {
		const hit = applicable.find((exclusion) => exclusion.pattern.test(problem));
		if (hit) {
			matched?.add(hit);
			return false;
		}
		return true;
	});
}
