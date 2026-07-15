/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Ribbon-tab cross-framework layout parity.
 *
 * Catches "lost flex context" bugs like the 2026-07-03 Angular ribbon-section
 * regression: an extracted section component (or a nested control group)
 * rendering multiple sibling group <div>s with no `display` set on its host
 * becomes a single block-level flex item, so its own children fall out of the
 * parent's `flex flex-nowrap` row and stack into 2-3 rows instead of one -
 * discovered live (Angular's Home tab measured 389px tall vs React/Vue's
 * 119px for identical content) across four separate call sites before being
 * fixed. This spec automates that comparison so a future regression - in any
 * of the five bindings, not just Angular - fails CI instead of needing a
 * manual visual diff.
 *
 * Each project compares its binding against the React reference. The React
 * project retains the original React/Vue/Angular comparison, while Vanilla
 * and Svelte projects compare their own demos with React. A tab silently
 * wrapping into one extra row inflates its height
 * by roughly 1.7-3x; normal icon/font/padding differences between frameworks
 * stay well under that. Also saves a screenshot of each tab x framework
 * combination to test-results/ribbon-tab-parity/ for human visual review.
 *
 * Run: bunx playwright test ribbon-tab-parity
 * All five demo servers are started by `playwright.config.ts`; each project
 * selects the comparisons it owns.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const deck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(new URL('../test-results/ribbon-tab-parity/', import.meta.url));

const FRAMEWORKS = {
	react: { name: 'react', port: 4173 },
	vue: { name: 'vue', port: 4175 },
	angular: { name: 'angular', port: 4174 },
	vanilla: { name: 'vanilla', port: 4176 },
	svelte: { name: 'svelte', port: 4177 },
} as const;

type Framework = (typeof FRAMEWORKS)[keyof typeof FRAMEWORKS];

function frameworksForProject(projectName: string): Framework[] {
	if (projectName === 'react') {
		return [FRAMEWORKS.react, FRAMEWORKS.vue, FRAMEWORKS.angular];
	}
	if (projectName === 'vanilla') {
		return [FRAMEWORKS.react, FRAMEWORKS.vanilla];
	}
	if (projectName === 'svelte') {
		return [FRAMEWORKS.react, FRAMEWORKS.svelte];
	}
	if (projectName === 'vue') {
		return [FRAMEWORKS.react, FRAMEWORKS.vue];
	}
	if (projectName === 'angular') {
		return [FRAMEWORKS.react, FRAMEWORKS.angular];
	}
	throw new Error(`Unknown Playwright project: ${projectName}`);
}

// Ordered to match the ribbon's own tab order. Slide Show is excluded: it can
// trigger presentation-mode side effects on some builds, which isn't this
// spec's concern (covered elsewhere) and isn't worth the flakiness risk here.
// "Text" and "Arrange" are also excluded: they aren't top-level ribbon tabs in
// the established bindings' `TOOLBAR_SECTIONS` (React/Vue identical and
// Angular mirrors React) - text/arrange controls are
// folded into the Home tab rather than a standalone tab button, so clicking a
// same-named "Text"/"Arrange" button here previously hit a *different*,
// selection-gated control (e.g. DrawingGroup's Arrange dropdown) and timed out.
const TABS = [
	'File',
	'Home',
	'Insert',
	'Draw',
	'Design',
	'Transitions',
	'Animations',
	'Review',
	'View',
	'Record',
	'Help',
] as const;

// A tab wrapping into one extra row typically inflates height by ~1.7-3x;
// normal cross-framework icon/font/padding differences stay well under 1.6x.
const MAX_HEIGHT_RATIO = 1.6;

async function loadDeck(page: Page, port: number): Promise<void> {
	await page.goto(`http://localhost:${port}/`);
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

interface TabMeasurement {
	height: number;
	rowBands: number[];
}

/** Locate a ribbon tab through the shared tablist contract. */
function ribbonTab(page: Page, name: string): Locator {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	return toolbar.getByRole('tab', { name, exact: true });
}

/** Switch to `tab` and measure the ribbon content row's total height plus its
 * distinct y-bands (rounded to the nearest 10px so sub-pixel/font differences
 * don't split a genuinely-single row into two bands) - the band count is
 * purely diagnostic context in failure messages, not asserted on directly,
 * since legitimate per-framework control groupings can differ slightly. */
async function measureTab(page: Page, tab: string): Promise<TabMeasurement> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await ribbonTab(page, tab).click();
	await page.waitForTimeout(150);

	const box = await toolbar.boundingBox();
	if (!box) {
		throw new Error(`ribbon toolbar not visible for tab "${tab}"`);
	}

	const rowBands = await toolbar.evaluate((el) => {
		const controls = [...el.querySelectorAll('button, select')].filter((c) => {
			const r = c.getBoundingClientRect();
			return r.width > 0 && r.height > 0;
		});
		const bands = new Set(controls.map((c) => Math.round(c.getBoundingClientRect().y / 10) * 10));
		return [...bands].sort((a, b) => a - b);
	});

	return { height: box.height, rowBands };
}

test.describe('ribbon tab layout parity', () => {
	for (const tab of TABS) {
		test(`"${tab}" tab: no framework wraps into extra rows vs React`, async ({
			browser,
		}, testInfo) => {
			const frameworks = frameworksForProject(testInfo.project.name);
			const pages = await Promise.all(
				frameworks.map(async (fw) => {
					const page = await browser.newPage();
					await loadDeck(page, fw.port);
					return { ...fw, page };
				}),
			);

			try {
				const results = await Promise.all(
					pages.map(async ({ name, page }) => {
						const { height, rowBands } = await measureTab(page, tab);
						await page.screenshot({
							path: resolve(
								shotDir,
								`${testInfo.project.name}-${tab.toLowerCase().replace(/\s+/gu, '-')}-${name}.png`,
							),
						});
						return { name, height, rowBands };
					}),
				);

				const heights = results.map((r) => r.height);
				const ratio = Math.max(...heights) / Math.min(...heights);
				const summary = results
					.map((r) => `${r.name}=${Math.round(r.height)}px (${r.rowBands.length} row-band(s))`)
					.join(', ');

				expect(
					ratio,
					`ribbon height ratio too large on "${tab}" tab - ${summary}. ` +
						`Likely cause: a component rendering multiple sibling elements with no ` +
						`display set on its host, so it falls out of the parent's flex row and ` +
						`stacks (needs display: contents on the host, or an explicit flex row ` +
						`wrapper around it - see git log for "stop ribbon groups stacking ` +
						`vertically" / "wrapping to a new row" for the established fix pattern).`,
				).toBeLessThanOrEqual(MAX_HEIGHT_RATIO);
			} finally {
				await Promise.all(pages.map(({ page }) => page.close()));
			}
		});
	}
});
