/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do all five bindings ship the same New Slide / Layout gallery?
 *
 * Both menus used to list layout names as plain text, which is not enough to
 * tell "Title and Content" from "Two Content" in a themed deck. They now draw
 * each layout's real artwork, and the Layout menu marks the layout the current
 * slide is already using.
 *
 * That marker is the part worth pinning across bindings, because it depends on
 * a value the loader did not used to set at all: `PptxSlide.layoutPath` existed
 * on the model but was never populated, so every "which layout is this slide
 * on" feature silently no-opped. A binding can regress to a name-only menu, or
 * lose the marker, without any unit suite noticing - the defect lives entirely
 * in template wiring.
 *
 * Covered per binding, against the React reference:
 *   - the Layout menu opens and offers at least one entry;
 *   - the entries render layout artwork, not just text;
 *   - exactly one entry is marked as the slide's current layout;
 *   - the five bindings agree on how many layouts the deck offers.
 *
 * Run: bunx playwright test layout-gallery-parity
 * All five demo servers are started by `playwright.config.ts`; each project
 * selects the comparisons it owns.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt } from './support/deck';
import { comparisonSet, originOf } from './support/frameworks';
import type { FrameworkDemo } from './support/frameworks';

const DECK = fixture('sample-deck.pptx');

/** Generous: five demos load the same deck concurrently in one test. */
const MENU_TIMEOUT_MS = 15_000;

/**
 * Open the Home tab's Layout menu.
 *
 * The bindings differ in how the menu is triggered - React, Vue and Svelte
 * toggle on click, Angular reveals on hover, Vanilla toggles on click - so this
 * hovers first and then clicks, which satisfies all three behaviours without
 * the spec branching on which binding it is driving.
 */
async function openLayoutMenu(page: Page): Promise<void> {
	const trigger = page.getByRole('button', { name: /^layout$/iu }).first();
	await trigger.waitFor({ timeout: MENU_TIMEOUT_MS });
	await trigger.hover();
	await trigger.click().catch(() => {
		// Angular's menu is hover-only; the hover above already opened it and the
		// click can land on the now-covering panel.
	});
}

/**
 * Every selectable entry in the open layout gallery.
 *
 * All five bindings tag their gallery with the same testid, so this spec needs
 * no per-binding selector (see `check-e2e-neutrality`). The `:visible` filter
 * matters: the New Slide menu reuses the same gallery, and three bindings keep
 * the closed one in the DOM rather than unmounting it.
 */
function layoutEntries(page: Page) {
	return page.locator('[data-testid="layout-gallery-menu"]:visible button');
}

async function readGallery(
	page: Page,
	framework: FrameworkDemo,
): Promise<{ count: number; currentMarked: number; withArtwork: number }> {
	await loadDeckAt(page, originOf(framework), DECK);
	await openLayoutMenu(page);

	const entries = layoutEntries(page);
	await expect(entries.first()).toBeVisible({ timeout: MENU_TIMEOUT_MS });

	// `aria-current` sits ON the tile button, so this narrows the same elements
	// rather than searching inside them.
	const currentMarked = await entries.and(page.locator('[aria-current="true"]')).count();
	// A tile that drew artwork has a scaled inner surface with rendered children;
	// a name-only entry has nothing but its label.
	const withArtwork = await entries.evaluateAll(
		(nodes) => nodes.filter((node) => node.querySelector('div,svg,img') !== null).length,
	);

	return { count: await entries.count(), currentMarked, withArtwork };
}

test.describe('layout gallery parity', () => {
	test('every binding draws layout artwork and marks the current layout', async ({
		browser,
	}, testInfo) => {
		const frameworks = comparisonSet(testInfo.project.name);
		const results: Array<{ framework: string; count: number; marked: number; artwork: number }> =
			[];

		for (const framework of frameworks) {
			const context = await browser.newContext();
			const page = await context.newPage();
			try {
				const gallery = await readGallery(page, framework);
				results.push({
					framework: framework.name,
					count: gallery.count,
					marked: gallery.currentMarked,
					artwork: gallery.withArtwork,
				});
			} finally {
				await context.close();
			}
		}

		for (const result of results) {
			expect(result.count, `${result.framework} offers no layouts`).toBeGreaterThan(0);
			expect(
				result.artwork,
				`${result.framework} renders name-only tiles (no layout artwork)`,
			).toBeGreaterThan(0);
			expect(result.marked, `${result.framework} does not mark the slide's current layout`).toBe(1);
		}

		// The layout list comes from core, so a binding disagreeing on how many
		// there are means it is scoping (or failing to scope) to the slide's
		// master differently from the others.
		const counts = new Set(results.map((result) => result.count));
		expect(counts.size, `layout counts diverge: ${JSON.stringify(results)}`).toBe(1);
	});
});
