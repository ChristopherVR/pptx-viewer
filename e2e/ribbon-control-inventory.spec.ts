/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings put the same controls on the ribbon?
 *
 * `ribbon-tab-parity` already guards the SHAPE of a tab: it fails when a group
 * falls out of its flex row and the ribbon doubles in height. That check is
 * blind to the far more common way a binding drifts, which is by simply never
 * having shipped a control. A tab that is missing Handout Master, or Settings,
 * or two thirds of the Review group, is shorter than the reference, not taller,
 * so every existing spec in this directory is happy with it. The gap surfaces
 * only when a user on the wrong binding goes looking for a button the docs
 * promised them, which is the divergence CLAUDE.md calls the most expensive
 * debt in this repo.
 *
 * So this spec inventories what each tab actually offers, by accessible name,
 * and diffs every binding against React. It separates four failures, because
 * they have four different causes and four different fixes:
 *
 *  - a control the reference offers and a binding does not: an unfinished port
 *  - a control a binding offers and the reference does not: a divergent design,
 *    or a group that was extended in one place only
 *  - a control both offer under different accessible names: a relabelling that
 *    was never propagated, which also quietly breaks every product spec here
 *    that addresses controls by name
 *  - a control both offer but only one leaves usable: a gating rule that was
 *    ported as a copy of the markup rather than a copy of the behaviour
 *
 * The report is exhaustive rather than thresholded. There is no defensible
 * tolerance for "most of the Review tab", and every line names a control a real
 * user can look for and fail to find.
 *
 * Run: bunx playwright test ribbon-control-inventory
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks } from './support/parity';
import type { FrameworkResult } from './support/parity';
import { collectRibbonInventory } from './support/ribbon-controls';
import type { RibbonInventory } from './support/ribbon-controls';
import {
	collectRibbonProblems,
	diffRibbonComposition,
	diffRibbonStates,
} from './support/ribbon-diff';

const SAMPLE = fixture('sample-deck.pptx');

/**
 * Read once, assert twice.
 *
 * Walking every tab of five demos is most of this spec's run time, and the two
 * assertions below are two readings of one inventory, so collecting per test
 * would double the cost to learn nothing new.
 */
let inventories: FrameworkResult<RibbonInventory>[] = [];

test.beforeAll(async ({ browser }, testInfo) => {
	test.setTimeout(180_000);
	inventories = await acrossFrameworks(
		browser,
		testInfo,
		async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			return collectRibbonInventory(page);
		},
		// Wide enough that no binding drops to its mobile ribbon, which would
		// compare a phone's control set against a desktop's.
		{ viewport: { width: 1440, height: 900 } },
	);
});

test.describe('cross-binding ribbon control inventory', () => {
	test('every ribbon tab offers the same controls in every binding', () => {
		// Guards the vacuous pass: an inventory that read nothing agrees with
		// every other inventory that read nothing.
		const everything = inventories.flatMap((entry) =>
			entry.value.flatMap((tabInventory) => tabInventory.controls),
		);
		expect(everything.length, 'no binding reported a single ribbon control').toBeGreaterThan(0);

		expect(collectRibbonProblems(inventories, diffRibbonComposition).join('\n\n')).toBe('');
	});

	test('ribbon controls agree on which of them are usable', () => {
		expect(collectRibbonProblems(inventories, diffRibbonStates).join('\n\n')).toBe('');
	});
});
