/**
 * Diffing two bindings' run metrics into human-readable parity problems.
 *
 * Split from `support/text-runs` (which measures) so each file stays inside the
 * repo's 300-line rule. The wording matters as much as the maths: every line
 * here has to name the property, both values, and enough context to be actioned
 * without opening a trace, because these reports are the whole output of a
 * cross-binding text-layout failure.
 *
 * @module e2e/support/text-run-diff
 */
import { RUN_TOLERANCE } from './text-runs';
import type { ElementRunMetrics, TextRunMetric } from './text-runs';

/** Properties that must match exactly, run for run. */
const EXACT_PROPERTIES = [
	'whiteSpace',
	'fontWeight',
	'fontStyle',
	'textAlign',
	'textTransform',
	'decoration',
] as const;

function diffRun(label: string, reference: TextRunMetric, candidate: TextRunMetric): string[] {
	const problems: string[] = [];
	const at = `${label} run ${reference.ordinal}`;

	if (reference.text !== candidate.text) {
		problems.push(`${at}: text is "${candidate.text}", reference has "${reference.text}"`);
		// Every metric below is measured over different glyphs, so comparing them
		// would report the same defect five more times in five wrong wordings.
		return problems;
	}
	for (const property of EXACT_PROPERTIES) {
		if (reference[property] !== candidate[property]) {
			problems.push(
				`${at}: ${property} is "${candidate[property]}", reference has "${reference[property]}"`,
			);
		}
	}
	const sizeDrift = Math.abs(reference.fontSizePx - candidate.fontSizePx);
	const sizeMismatch = sizeDrift > RUN_TOLERANCE.fontSizePx;
	if (sizeMismatch) {
		problems.push(
			`${at}: font-size is ${candidate.fontSizePx}px, reference has ${reference.fontSizePx}px ` +
				`(${(candidate.fontSizePx / (reference.fontSizePx || 1)) * 100 - 100 > 0 ? '+' : ''}` +
				`${Math.round((candidate.fontSizePx / (reference.fontSizePx || 1)) * 100 - 100)}%)`,
		);
	}
	if (reference.lineHeightRatio === null || candidate.lineHeightRatio === null) {
		if (reference.lineHeightRatio !== candidate.lineHeightRatio) {
			problems.push(
				`${at}: line-height ratio is ${candidate.lineHeightRatio ?? 'normal'}, ` +
					`reference has ${reference.lineHeightRatio ?? 'normal'}`,
			);
		}
	} else if (
		Math.abs(reference.lineHeightRatio - candidate.lineHeightRatio) > RUN_TOLERANCE.lineHeightRatio
	) {
		problems.push(
			`${at}: line-height is ${candidate.lineHeightRatio}x its font-size, ` +
				`reference has ${reference.lineHeightRatio}x`,
		);
	}
	// Advance is compared only once the sizes agree. It scales with font-size, so
	// running both checks on a mis-sized run reports one defect twice and buries
	// the family-fallback drift this measurement exists to expose.
	if (
		!sizeMismatch &&
		Math.abs(reference.advancePx - candidate.advancePx) > RUN_TOLERANCE.advancePx
	) {
		problems.push(
			`${at}: "${reference.sample}" advances ${candidate.advancePx} slide px, ` +
				`reference ${reference.advancePx} (resolved font: [${candidate.fontFamily}] ` +
				`vs reference [${reference.fontFamily}])`,
		);
	}
	if (Math.abs(reference.lineStartX - candidate.lineStartX) > RUN_TOLERANCE.lineStartX) {
		problems.push(
			`${at}: starts at x=${candidate.lineStartX} slide px within its element, ` +
				`reference at x=${reference.lineStartX}`,
		);
	}
	if (reference.lineCount !== candidate.lineCount) {
		problems.push(
			`${at}: wraps to ${candidate.lineCount} visual line(s), reference to ${reference.lineCount}`,
		);
	}
	return problems;
}

/** Every way `candidate`'s runs disagree with `reference`'s, in readable lines. */
export function diffTextRuns(
	reference: ElementRunMetrics[],
	candidate: ElementRunMetrics[],
): string[] {
	const problems: string[] = [];
	const byId = new Map(candidate.map((element) => [element.elementId, element]));

	for (const referenceElement of reference) {
		const label = `"${referenceElement.label}" [${referenceElement.elementId}]`;
		const match = byId.get(referenceElement.elementId);
		if (!match) {
			problems.push(
				`${label}: renders no text at all, the reference renders ${referenceElement.runs.length} run(s)`,
			);
			continue;
		}
		byId.delete(referenceElement.elementId);
		if (match.runs.length !== referenceElement.runs.length) {
			problems.push(
				`${label}: renders ${match.runs.length} text run(s) where the reference renders ` +
					`${referenceElement.runs.length} ` +
					`(candidate: ${match.runs.map((run) => `"${run.text}"`).join(', ')} | ` +
					`reference: ${referenceElement.runs.map((run) => `"${run.text}"`).join(', ')})`,
			);
		}
		const shared = Math.min(match.runs.length, referenceElement.runs.length);
		for (let i = 0; i < shared; i += 1) {
			problems.push(...diffRun(label, referenceElement.runs[i], match.runs[i]));
		}
	}
	for (const extra of byId.values()) {
		problems.push(
			`"${extra.label}" [${extra.elementId}]: renders ${extra.runs.length} run(s), the reference renders none`,
		);
	}
	return problems;
}
