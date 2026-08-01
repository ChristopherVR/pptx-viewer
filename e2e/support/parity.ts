/**
 * Driving several bindings in one test, and reporting where they disagree.
 *
 * A parity spec states a scenario once ("load this deck, select the title, open
 * the Home tab") and this harness replays it against React plus whichever
 * bindings the current Playwright project owns, then diffs the results. The
 * spec never names a framework, never sees a port, and never branches: that is
 * what keeps it honest as the same suite run five ways.
 *
 * @module e2e/support/parity
 */
import type { Browser, Page, TestInfo } from '@playwright/test';

import type { ElementFingerprint, SlideFingerprint } from './fingerprint';
import { comparisonSet, REFERENCE, urlOf } from './frameworks';
import type { FrameworkDemo } from './frameworks';

/** A per-framework result of replaying the scenario. */
export interface FrameworkResult<T> {
	framework: FrameworkDemo;
	value: T;
}

/** How far two bindings may drift before it counts as a parity break. */
export interface ParityTolerance {
	/** Position/size drift, in percentage points of the stage box. */
	rect: number;
	/** Type-scale drift, in percentage points of the stage's layout height. */
	font: number;
	/** Per-channel colour drift, 0-255. */
	color: number;
	/** Stage aspect-ratio drift. */
	aspect: number;
}

/**
 * Defaults chosen from measured cross-binding noise on the sample deck.
 *
 * Sub-pixel layout rounding moves a box by well under half a percent of the
 * stage, and the bindings share the type-scale maths outright, so anything
 * above these numbers is a real difference rather than measurement jitter.
 */
export const DEFAULT_TOLERANCE: ParityTolerance = {
	rect: 1.2,
	font: 0.35,
	color: 3,
	aspect: 0.02,
};

/**
 * How to open the pages a parity scenario runs against.
 *
 * `device` takes a Playwright device descriptor (`devices['Pixel 7']`) so a
 * parity spec can state "and again on a phone" without owning a viewport table.
 * Chrome that only exists below the mobile breakpoint (the phone presenter
 * console, the bottom action bar) is otherwise unreachable from these specs,
 * and unreachable chrome is exactly where the five bindings drift.
 */
export interface AcrossFrameworksOptions {
	path?: string;
	viewport?: { width: number; height: number };
	/** A `devices[...]` descriptor; its viewport is used unless `viewport` overrides it. */
	device?: Parameters<Browser['newPage']>[0];
}

/**
 * Open one page per framework in this project's comparison set, run `scenario`
 * against each, and hand back the results paired with their binding.
 *
 * Pages are opened concurrently (five cold demo loads in series is most of a
 * minute) and always closed, including when the scenario throws.
 */
export async function acrossFrameworks<T>(
	browser: Browser,
	testInfo: TestInfo,
	scenario: (page: Page, origin: string) => Promise<T>,
	options: AcrossFrameworksOptions = {},
): Promise<FrameworkResult<T>[]> {
	const frameworks = comparisonSet(testInfo.project.name);
	const pageOptions =
		options.device || options.viewport
			? { ...options.device, ...(options.viewport ? { viewport: options.viewport } : {}) }
			: undefined;
	const opened = await Promise.all(
		frameworks.map(async (framework) => {
			const page = await browser.newPage(pageOptions);
			return { framework, page };
		}),
	);
	try {
		return await Promise.all(
			opened.map(async ({ framework, page }) => ({
				framework,
				value: await scenario(page, urlOf(framework, options.path ?? '/')),
			})),
		);
	} finally {
		await Promise.all(opened.map(({ page }) => page.close()));
	}
}

/** Split results into the React reference and everything measured against it. */
export function splitReference<T>(results: FrameworkResult<T>[]): {
	reference: FrameworkResult<T>;
	candidates: FrameworkResult<T>[];
} {
	const reference = results.find((result) => result.framework.name === REFERENCE.name);
	if (!reference) {
		throw new Error('the comparison set must always include the reference binding');
	}
	return {
		reference,
		candidates: results.filter((result) => result.framework.name !== REFERENCE.name),
	};
}

function parseColor(value: string): [number, number, number, number] | null {
	const match = /rgba?\(([^)]+)\)/u.exec(value);
	if (!match) {
		return null;
	}
	const parts = match[1].split(/[,/]/u).map((part) => Number.parseFloat(part));
	if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
		return null;
	}
	return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** True when two computed colours are the same to within `tolerance` per channel. */
export function colorsMatch(a: string, b: string, tolerance: number): boolean {
	if (a === b) {
		return true;
	}
	const left = parseColor(a);
	const right = parseColor(b);
	if (!left || !right) {
		return false;
	}
	// Fully transparent paints look identical whatever their nominal channels.
	if (left[3] === 0 && right[3] === 0) {
		return true;
	}
	return (
		Math.abs(left[0] - right[0]) <= tolerance &&
		Math.abs(left[1] - right[1]) <= tolerance &&
		Math.abs(left[2] - right[2]) <= tolerance &&
		Math.abs(left[3] - right[3]) <= 0.05
	);
}

function describe(element: ElementFingerprint): string {
	return element.text ? `"${element.text}"` : `element #${element.index}`;
}

function diffElement(
	reference: ElementFingerprint,
	candidate: ElementFingerprint,
	tolerance: ParityTolerance,
): string[] {
	const problems: string[] = [];
	const label = describe(reference);

	// Compared explicitly rather than left to the pairing key: elements pair by
	// `data-element-id`, so without this a binding that renders an unsubstituted
	// field placeholder ("Slide #" instead of "Slide 1") pairs happily with the
	// reference and the difference goes unreported.
	if (reference.text !== candidate.text) {
		problems.push(
			`${label}: renders the text "${candidate.text}", reference renders "${reference.text}"`,
		);
	}

	for (const axis of ['x', 'y', 'width', 'height'] as const) {
		const drift = Math.abs(reference.rect[axis] - candidate.rect[axis]);
		if (drift > tolerance.rect) {
			problems.push(
				`${label}: ${axis} differs by ${drift.toFixed(2)}% of the stage ` +
					`(reference ${reference.rect[axis].toFixed(2)}%, candidate ${candidate.rect[axis].toFixed(2)}%)`,
			);
		}
	}

	if (reference.type && candidate.type) {
		const sizeDrift = Math.abs(reference.type.sizePct - candidate.type.sizePct);
		if (sizeDrift > tolerance.font) {
			problems.push(
				`${label}: font-size differs by ${sizeDrift.toFixed(2)}% of stage height ` +
					`(reference ${reference.type.sizePct.toFixed(2)}%, candidate ${candidate.type.sizePct.toFixed(2)}%)`,
			);
		}
		const lineDrift = Math.abs(reference.type.lineHeightPct - candidate.type.lineHeightPct);
		if (lineDrift > tolerance.font) {
			problems.push(`${label}: line-height differs by ${lineDrift.toFixed(2)}% of stage height`);
		}
		for (const property of [
			'family',
			'weight',
			'style',
			'align',
			'transform',
			'decoration',
		] as const) {
			if (reference.type[property] !== candidate.type[property]) {
				problems.push(
					`${label}: font ${property} is "${candidate.type[property]}", reference has "${reference.type[property]}"`,
				);
			}
		}
		if (!colorsMatch(reference.type.color, candidate.type.color, tolerance.color)) {
			problems.push(
				`${label}: text colour is ${candidate.type.color}, reference has ${reference.type.color}`,
			);
		}
	} else if (Boolean(reference.type) !== Boolean(candidate.type)) {
		problems.push(
			`${label}: ${candidate.type ? 'renders text the reference does not' : 'renders no text, but the reference does'}`,
		);
	}

	if (!colorsMatch(reference.background, candidate.background, tolerance.color)) {
		problems.push(
			`${label}: background is ${candidate.background}, reference has ${reference.background}`,
		);
	}
	if (reference.kinds.join(',') !== candidate.kinds.join(',')) {
		problems.push(
			`${label}: renders [${candidate.kinds.join(', ') || 'no sub-renderers'}], ` +
				`reference renders [${reference.kinds.join(', ') || 'no sub-renderers'}]`,
		);
	}

	return problems;
}

/**
 * Every way `candidate` disagrees with `reference`, in human-readable lines.
 *
 * Elements are paired by their fingerprint key (their text, or their DOM index
 * when they carry none), so an element that only one binding renders is
 * reported as missing or extra rather than silently shifting every later
 * comparison by one.
 */
export function diffSlides(
	reference: SlideFingerprint,
	candidate: SlideFingerprint,
	tolerance: ParityTolerance = DEFAULT_TOLERANCE,
): string[] {
	const problems: string[] = [];

	if (Math.abs(reference.aspect - candidate.aspect) > tolerance.aspect) {
		problems.push(`stage aspect ratio is ${candidate.aspect}, reference has ${reference.aspect}`);
	}

	const candidateByKey = new Map(candidate.elements.map((element) => [element.key, element]));
	for (const referenceElement of reference.elements) {
		const match = candidateByKey.get(referenceElement.key);
		if (!match) {
			problems.push(`${describe(referenceElement)}: not rendered at all`);
			continue;
		}
		candidateByKey.delete(referenceElement.key);
		problems.push(...diffElement(referenceElement, match, tolerance));
	}
	for (const extra of candidateByKey.values()) {
		problems.push(`${describe(extra)}: rendered, but the reference has no such element`);
	}

	return problems;
}

/** Format a diff for an assertion message, capped so the report stays readable. */
export function formatDiff(candidateName: string, problems: string[], limit = 25): string {
	const shown = problems.slice(0, limit);
	const omitted = problems.length - shown.length;
	const header = `${candidateName} differs from the ${REFERENCE.name} reference in ${problems.length} way(s):`;
	const body = shown.map((problem) => `  - ${problem}`).join('\n');
	const tail = omitted > 0 ? `\n  ...and ${omitted} more` : '';
	return `${header}\n${body}${tail}`;
}

/**
 * Every candidate's disagreement with the reference, as one flat list.
 *
 * Assert on this rather than looping and asserting per candidate: a per-candidate
 * assertion throws on the first binding that fails, so the remaining bindings are
 * never compared and a defect shared by all four reads as a defect in one. That
 * mistake hid a repo-wide font-fallback bug behind a single binding's name.
 */
export function collectParityProblems<T extends SlideFingerprint>(
	results: FrameworkResult<T>[],
	tolerance?: ParityTolerance,
): string[] {
	const { reference, candidates } = splitReference(results);
	return candidates.flatMap((candidate) => {
		const problems = diffSlides(reference.value, candidate.value, tolerance);
		return problems.length === 0 ? [] : [formatDiff(candidate.framework.name, problems)];
	});
}
