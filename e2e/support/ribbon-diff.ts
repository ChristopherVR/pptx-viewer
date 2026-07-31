/**
 * Comparing two ribbon inventories without drowning the real gaps in wording.
 *
 * The naive diff of two name sets is almost useless here. The bindings label
 * the same button differently (`Image` against `Insert image`, `Reset` against
 * `Reset Slide`, `Custom show` against `Custom Shows`), so a plain set
 * difference reports every relabelling twice, once as a missing control and
 * once as an extra one, and buries the handful of buttons that genuinely were
 * never built under a hundred lines of synonyms.
 *
 * So names are paired in two passes: exact first (case and trailing
 * punctuation folded), then by a deliberately narrow synonym rule, one name
 * being a prefix of the other or its word set being a subset. Those two shapes
 * cover how relabelling actually happens in this repo (a verb or a noun added
 * to an existing label) and are tight enough that two unrelated buttons do not
 * pair. What survives the pairing is the real answer: this binding has no such
 * control at all.
 *
 * A relabelling is still reported, because the product specs in this directory
 * address controls by accessible name and a rename in one binding is what
 * breaks them, but it is reported as one line that names both labels rather
 * than as a phantom missing-plus-extra pair.
 *
 * @module e2e/support/ribbon-diff
 */
import { formatDiff, splitReference } from './parity';
import type { FrameworkResult } from './parity';
import type { RibbonControl, RibbonInventory, RibbonTabInventory } from './ribbon-controls';

/** Match names the way a user reads them, not the way a designer cased them. */
function nameKey(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s+/gu, ' ')
		.replace(/[.:…]+$/u, '')
		.trim();
}

interface NameTally {
	/** Name as the binding renders it, for the report. */
	display: string;
	total: number;
	enabled: number;
}

function tally(controls: RibbonControl[]): Map<string, NameTally> {
	const counts = new Map<string, NameTally>();
	for (const control of controls) {
		const key = nameKey(control.name);
		const entry = counts.get(key) ?? { display: control.name, total: 0, enabled: 0 };
		entry.total += 1;
		entry.enabled += control.disabled ? 0 : 1;
		counts.set(key, entry);
	}
	return counts;
}

/**
 * True when two normalised names are plausibly the same control, relabelled.
 *
 * The prefix arm needs a floor on the shorter name or it degenerates: a button
 * whose only label is the glyph "S" would claim to be a relabelled "Section".
 */
function isRelabelling(reference: string, candidate: string): boolean {
	const shorter = Math.min(reference.length, candidate.length);
	if (shorter >= 3 && (reference.startsWith(candidate) || candidate.startsWith(reference))) {
		return true;
	}
	const left = new Set(reference.split(' '));
	const right = new Set(candidate.split(' '));
	const [fewer, more] = left.size <= right.size ? [left, right] : [right, left];
	return [...fewer].every((word) => more.has(word));
}

/**
 * Reference name key -> the candidate name key it corresponds to, or null.
 *
 * Exact names are claimed first. A leftover reference name is then called a
 * relabelling only when the two pick each other out uniquely: one unclaimed
 * candidate could be it, and that candidate could be nothing else. Anything
 * ambiguous is left unpaired and reported as a missing control plus an extra
 * one, which is the honest reading. React's `Zoom` dropdown sits beside a
 * binding's `Zoom in` and `Zoom out`, and its `Increase Font Size` beside a
 * binding's single `Font size`; naming either of those a rename would be a
 * confident lie about a group that was genuinely built differently.
 */
function pairNames(
	wanted: Map<string, NameTally>,
	got: Map<string, NameTally>,
): Map<string, string | null> {
	const pairs = new Map<string, string | null>();
	const claimed = new Set<string>();
	for (const key of wanted.keys()) {
		if (got.has(key)) {
			pairs.set(key, key);
			claimed.add(key);
		}
	}
	const spare = [...wanted.keys()].filter((key) => !pairs.has(key));
	for (const key of spare) {
		const forwards = [...got.keys()].filter(
			(other) => !claimed.has(other) && isRelabelling(key, other),
		);
		const backwards =
			forwards.length === 1 ? spare.filter((other) => isRelabelling(other, forwards[0])) : [];
		const relabelled = backwards.length === 1 ? forwards[0] : null;
		pairs.set(key, relabelled);
		if (relabelled) {
			claimed.add(relabelled);
		}
	}
	return pairs;
}

interface TabPair {
	tab: string;
	reference: RibbonTabInventory;
	candidate: RibbonTabInventory;
}

function pairTabs(reference: RibbonInventory, candidate: RibbonInventory): TabPair[] {
	const byTab = new Map(candidate.map((entry) => [entry.tab, entry]));
	return reference.flatMap((entry) => {
		const match = byTab.get(entry.tab);
		return match ? [{ tab: entry.tab, reference: entry, candidate: match }] : [];
	});
}

/** The tab-level disagreement, if the two bindings do not even agree the tab exists. */
function diffTabPresence(pair: TabPair): string | null {
	if (pair.reference.present && !pair.candidate.present) {
		return `${pair.tab}: the ribbon has no such tab, the reference does`;
	}
	if (!pair.reference.present && pair.candidate.present) {
		return `${pair.tab}: the ribbon offers this tab, the reference does not`;
	}
	return null;
}

/** Which controls a binding is missing, has spare, relabelled, or duplicated. */
export function diffRibbonComposition(
	reference: RibbonInventory,
	candidate: RibbonInventory,
): string[] {
	const problems: string[] = [];
	for (const pair of pairTabs(reference, candidate)) {
		const presence = diffTabPresence(pair);
		if (presence) {
			problems.push(presence);
			continue;
		}
		const { tab } = pair;
		const wanted = tally(pair.reference.controls);
		const got = tally(pair.candidate.controls);
		const pairs = pairNames(wanted, got);

		for (const [key, entry] of wanted) {
			const matchKey = pairs.get(key) ?? null;
			const match = matchKey === null ? undefined : got.get(matchKey);
			if (!match) {
				problems.push(`${tab}: does not offer "${entry.display}"`);
				continue;
			}
			if (matchKey !== key) {
				problems.push(`${tab}: labels "${entry.display}" as "${match.display}"`);
			}
			if (match.total !== entry.total) {
				problems.push(
					`${tab}: offers ${match.total} control(s) named "${match.display}", ` +
						`reference offers ${entry.total}`,
				);
			}
		}

		const claimed = new Set([...pairs.values()].filter((key) => key !== null));
		for (const [key, entry] of got) {
			if (!claimed.has(key)) {
				problems.push(`${tab}: offers "${entry.display}", which the reference does not`);
			}
		}
	}
	return problems;
}

/** Where two bindings offer the same control but disagree on whether it is usable. */
export function diffRibbonStates(reference: RibbonInventory, candidate: RibbonInventory): string[] {
	const problems: string[] = [];
	for (const pair of pairTabs(reference, candidate)) {
		if (!pair.reference.present || !pair.candidate.present) {
			continue;
		}
		const wanted = tally(pair.reference.controls);
		const got = tally(pair.candidate.controls);
		const pairs = pairNames(wanted, got);

		for (const [key, entry] of wanted) {
			const matchKey = pairs.get(key) ?? null;
			const match = matchKey === null ? undefined : got.get(matchKey);
			// A control the binding renders a different NUMBER of is a composition
			// problem; reporting its state as well would double-count one defect.
			if (!match || match.total !== entry.total || match.enabled === entry.enabled) {
				continue;
			}
			problems.push(
				`${pair.tab}: "${match.display}" is ${match.enabled > 0 ? 'enabled' : 'disabled'}, ` +
					`reference renders it ${entry.enabled > 0 ? 'enabled' : 'disabled'}`,
			);
		}
	}
	return problems;
}

/**
 * Every binding's disagreement with the reference, as one flat list.
 *
 * Flat and complete on purpose: asserting per binding stops at the first one
 * that fails, so a gap the other three share reads as that binding's fault.
 */
export function collectRibbonProblems(
	results: FrameworkResult<RibbonInventory>[],
	diff: (reference: RibbonInventory, candidate: RibbonInventory) => string[],
): string[] {
	const { reference, candidates } = splitReference(results);
	return candidates.flatMap((candidate) => {
		const problems = diff(reference.value, candidate.value);
		return problems.length === 0 ? [] : [formatDiff(candidate.framework.name, problems, 200)];
	});
}
