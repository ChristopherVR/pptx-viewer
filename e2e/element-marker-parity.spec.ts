/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does every binding agree on HOW MANY elements a slide has?
 *
 * `element-contract-parity` walks the contract element by element, pairing by
 * `data-element-id`; it therefore cannot see a binding that renders the right
 * nodes but tags a different SUBSET of them with `data-pptx-element="true"`.
 * That is exactly what had happened: React withheld the marker from group
 * CHILDREN while still giving them the id, the role, the accessible name and
 * `data-pptx-action`, so on the reporter's wheel slides React advertised 28
 * elements where the other four advertised 33, and slide 12 counted 6 against
 * 12. Nothing looked different; every consumer that enumerates or fingerprints
 * elements by the marker simply got a different answer per binding.
 *
 * The contract settled on, and pinned here, is the inclusive one: the marker
 * goes on every node that exposes an element id, group children included. It is
 * not a selection key (a click on a grouped child resolves UP to the group via
 * `resolveTopLevelElementId`, which walks `data-element-id`), so marking a
 * child cannot change what a click selects; it means "this node is a rendered
 * slide element carrying the element contract", and a grouped shape is one.
 *
 * Run: bunx playwright test element-marker-parity
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks, formatDiff, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

/** Slides of the reporter's deck that put content inside groups. */
const SLIDES = [1, 2, 3, 12];

/** How many nodes the stage marks, and how many carry an element id. */
interface MarkerCount {
	slide: number;
	marked: number;
	withId: number;
}

async function countMarkers(
	page: import('@playwright/test').Page,
	slide: number,
): Promise<MarkerCount> {
	const counts = await page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		if (!stage) {
			return { marked: 0, withId: 0 };
		}
		return {
			marked: stage.querySelectorAll('[data-pptx-element="true"]').length,
			withId: stage.querySelectorAll('[data-element-id]').length,
		};
	});
	return { slide, ...counts };
}

test.describe('cross-binding element marker', () => {
	test('every binding marks the same elements, group children included', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, fixture('solution-explorer.pptx'));
			const perSlide: MarkerCount[] = [];
			for (const slide of SLIDES) {
				if (slide > 1) {
					await thumbnail(page, slide).click();
					await slideStage(page).waitFor();
				}
				// Angular and Svelte apply the contract in a microtask after mount.
				await expect
					.poll(async () => (await countMarkers(page, slide)).marked, { timeout: 15_000 })
					.toBeGreaterThan(0);
				perSlide.push(await countMarkers(page, slide));
			}
			return perSlide;
		});

		const { reference, candidates } = splitReference(results);

		// Half the contract is internal to each binding: the marker set and the id
		// set must be the SAME set, or a consumer that selects on one and reads the
		// other silently disagrees with itself.
		const problems: string[] = [];
		for (const result of results) {
			for (const count of result.value) {
				if (count.marked !== count.withId) {
					problems.push(
						formatDiff(result.framework.name, [
							`slide ${count.slide}: marks ${count.marked} elements but ${count.withId} carry an id`,
						]),
					);
				}
			}
		}

		for (const candidate of candidates) {
			const perBinding = reference.value.flatMap((expected, index) => {
				const actual = candidate.value[index];
				return actual && actual.marked !== expected.marked
					? [
							`slide ${expected.slide}: marks ${actual.marked} elements, reference marks ${expected.marked}`,
						]
					: [];
			});
			if (perBinding.length > 0) {
				problems.push(formatDiff(candidate.framework.name, perBinding));
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});
});
