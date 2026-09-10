/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Dense-panel usability at 360x640, run identically against every framework
 * demo.
 *
 * Closes the "Small screens: dense panels need space" limitations.md row:
 * every data-dense panel (chart/table data+style editors, animation panel,
 * inspector sub-panels, AI panel, comments, options/print/share dialogs) must
 * be usable at 360x640 (a small phone), not just "adapts down to ~360px" for
 * the chrome around it. Backed by `packages/shared/src/render/responsive/`'s
 * pure decision functions, consumed by all five bindings.
 *
 * Two verification strategies, chosen per panel by how the panel is reached:
 *
 *  - "resize in place": open the panel at a comfortable desktop size (where
 *    every binding already has an established, reliable open path), capture
 *    its exposed control names, then shrink the SAME open instance to
 *    360x640 and re-assert. This is the same technique
 *    `toolbar-breakpoints.spec.ts`'s "dynamic resize" test already uses for
 *    chrome-level verification, applied here at the panel level. Used for
 *    Options, Print, Share and the AI panel.
 *  - "load at target size": load the deck directly at 360x640 and reach the
 *    panel through the mobile-native path (the bottom bar's Format/Comments
 *    buttons), matching `mobile-audit.spec.ts`'s established pattern, then
 *    separately load at 1280x800 through the desktop path to compare control
 *    names. Used for the inspector-hosted panels (chart/table data+style
 *    editors, animation panel, inspector sub-panels) and comments, where a
 *    resize would cross the mobile/desktop chrome boundary and swap DOM
 *    subtrees (bottom sheet vs side panel) rather than just reflow.
 *
 * Touch targets: only DISCRETE, one-per-row controls (buttons, tabs, links,
 * standalone form fields) are held to the 44px WCAG target. A chart/table
 * data grid's per-CELL value inputs are deliberately exempt, matching WCAG's
 * own "dense, repeating control" exception (forcing every spreadsheet-style
 * cell to 44px would make a modest chart grid taller than the viewport for no
 * accessibility gain, and no mobile spreadsheet app does this either) - see
 * `packages/shared/src/render/responsive/dense-grid-layout.ts`'s doc comment.
 * Cell inputs are instead required only to stay inside their scrollable
 * container (no page-level overflow) and to keep a sane minimum width via
 * `getDenseGridLayoutPlan`.
 *
 * Run: bunx playwright test dense-panel-360
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { openAiPanel, aiPanel, aiToggle, seedMockAiProvider } from './support/ai-panel';
import {
	elementsOfType,
	fixture,
	inspector,
	resetTabSession,
	selectElement,
	slideElements,
	thumbnail,
} from './support/deck';

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
// A dedicated single-slide chart fixture (already used by
// `element-accessibility-graphic-frame.spec.ts`), rather than hunting for
// which slide of the 7-slide sample deck happens to carry a chart element.
const CHART_DECK = fixture('chart-title-runs.pptx');
/** The sample deck's "Plans" slide (5 of 7) is the one with a table. */
const TABLE_SLIDE_NUMBER = 5;

const DESKTOP = { width: 1280, height: 800 } as const;
const PHONE = { width: 360, height: 640 } as const;
const MIN_TOUCH_TARGET = 44;
// Playwright bounding boxes are float CSS px; allow a hair of rounding slack
// rather than flake on a control that is exactly on the line.
const TOUCH_TARGET_TOLERANCE = 1;

async function load(page: Page, fixturePath: string = deck): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
	const overflow = await page.evaluate(() => {
		const el = document.scrollingElement ?? document.documentElement;
		return { scrollW: el.scrollWidth, clientW: el.clientWidth };
	});
	expect(overflow.scrollW, `${label}: page must not scroll horizontally`).toBeLessThanOrEqual(
		overflow.clientW + 1,
	);
}

/** Discrete, one-per-row interactive controls: NOT a dense grid's per-cell inputs. */
const CONTROL_SELECTOR = 'button, [role="button"], a[href], [role="tab"], select';

/**
 * Every visible, enabled discrete control inside `container` clears the WCAG
 * touch target on its smaller side. Zero-size (`display:none`-ancestor)
 * boxes are skipped: `isVisible()`/CSS `:visible` already gate the query, but
 * a transitioning/animating element can still momentarily report a
 * degenerate box, which is not a layout defect this spec is checking for.
 */
/**
 * Color-swatch buttons ("Blue Fill", "Accent 2", ...): a densely packed,
 * repeating palette grid, WCAG 2.5.8's own cited example of a control exempt
 * from the 44px minimum (adjacent hit areas don't overlap and a mis-tap is
 * low-cost/reversible - the same reasoning documented on
 * `getDenseGridLayoutPlan` for a chart/table grid's per-cell inputs). Matched
 * by name rather than a container selector because the swatch gallery has no
 * single shared class across every inspector sub-panel that hosts one.
 *
 * The 12 `a:clrScheme` slots surface under TWO wordings depending on which
 * picker renders them (`schema-label-keys.ts`'s doc comment): "Background N /
 * Text N" in some pickers, "Dark N / Light N" in others (both are real
 * PowerPoint conventions for the same 12 slots), plus "Hyperlink" /
 * "Followed Hyperlink" - all from the same repeating grid as "Accent N", so
 * all get the same exemption. The "Standard Colors" row (FillStrokeSubComponents.tsx
 * and friends) names its 10 fixed swatches "<Prefix> <ColorName>" (the same
 * `ColorPickerRow` renders it for both Fill and Stroke pickers, so both
 * "Fill Black" and "Stroke Black" occur) from `OFFICE_COLOR_SWATCHES` in
 * `color-swatches.ts` - matched by the exact 10-colour catalogue, not a loose
 * `\w+ \w+` pattern, so it can never accidentally exempt an unrelated
 * "Fill mode"-style select/button that happens to start with a similar word.
 */
const COLOR_SWATCH_NAME =
	/\bfill$|^(accent|background|text|dark|light) \d|^(hyperlink|followed hyperlink)$|^\w+ (black|white|red|green|blue|orange|purple|cyan|pink|gray)$/iu;

async function assertMinTouchTargets(container: Locator, label: string): Promise<void> {
	// `.all()`, not `count()` + `.nth(i)` in a loop: `.nth(i)` re-runs the
	// CONTROL_SELECTOR query against the live DOM on every single access, so a
	// panel that re-renders mid-loop (observed on Vue's Share dialog, whose
	// connection-status row swaps content as it connects) can shift which
	// element index `i` resolves to between the `count()` call and a later
	// `nth(i)`, or make `nth(i)` point at nothing. `.all()` resolves every
	// matching element once, up front, into a stable array.
	const controls = await container.locator(CONTROL_SELECTOR).all();
	let checked = 0;
	for (const control of controls) {
		if (!(await control.isVisible().catch(() => false))) {
			continue;
		}
		if (await control.isDisabled().catch(() => false)) {
			continue;
		}
		// A control from the up-front `.all()` snapshot can still be removed by
		// a re-render before its own turn in the loop; treat that the same as
		// "not visible" (skip it) rather than letting the whole assertion throw.
		const box = await control.boundingBox().catch(() => null);
		if (!box || box.width === 0 || box.height === 0) {
			continue;
		}
		const smaller = Math.min(box.width, box.height);
		const name =
			(await control.getAttribute('aria-label').catch(() => null)) ??
			(await control.textContent().catch(() => null)) ??
			'';
		if (COLOR_SWATCH_NAME.test(name.trim())) {
			continue;
		}
		expect(
			smaller,
			`${label}: control "${name.trim().slice(0, 40)}" (${box.width.toFixed(0)}x${box.height.toFixed(0)}) must clear the ${MIN_TOUCH_TARGET}px touch target`,
		).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET - TOUCH_TARGET_TOLERANCE);
		checked++;
	}
	expect(checked, `${label}: expected at least one checkable control`).toBeGreaterThan(0);
}

/** Computed accessible names of every discrete control inside `container`, as a set. */
async function controlNameSet(container: Locator): Promise<Set<string>> {
	const handle = await container.elementHandle();
	if (!handle) {
		return new Set();
	}
	const names = await container.page().evaluate((root: Element) => {
		const out: string[] = [];
		for (const el of root.querySelectorAll(
			'button, [role="button"], a[href], [role="tab"], select',
		)) {
			if (!(el as HTMLElement).checkVisibility?.()) {
				continue;
			}
			const name = (
				el.getAttribute('aria-label') ??
				el.getAttribute('title') ??
				el.textContent ??
				''
			)
				.trim()
				.replace(/\s+/gu, ' ');
			if (name) {
				out.push(name);
			}
		}
		return out;
	}, handle);
	return new Set(names);
}

/** Elements present in `expected` but missing from `actual` (a real regression, not extra chrome). */
function missingFrom(expected: Set<string>, actual: Set<string>): string[] {
	return [...expected].filter((name) => !actual.has(name));
}

// ── Options / Print / Share / AI panel: resize in place ─────────────────────

async function openOptionsDialogAny(page: Page): Promise<Locator> {
	await page.getByRole('tab', { name: 'File', exact: true }).click();
	const backstage = page.locator('[role="dialog"][aria-label="File"]');
	await backstage.waitFor();
	await backstage.locator('aside nav button').last().click();
	const dialog = page
		.getByRole('dialog')
		.filter({ hasText: /options/iu })
		.first();
	await dialog.waitFor();
	return dialog;
}

/**
 * Open a File-backstage entry (e.g. "Print", "Share") that is a two-step
 * flow: the nav rail switches the backstage to that entry's own page, which
 * then shows an action CARD that must be clicked to actually invoke the
 * action and open the real dialog. Clicking only the nav item (as Options'
 * direct-invoke path allows) leaves the backstage itself open on that page -
 * which is a real dialog too, so a naive "any newly-visible dialog" check
 * does not catch the miss.
 *
 * The card does NOT carry the nav item's exact text: every binding renders
 * both from the same `pptx-viewer-shared` `BACKSTAGE_NAV` / `backstageCardsFor`
 * tables, and those two tables word the entry differently on purpose (the nav
 * rail is a short category label, "Print"; the card is the actual action,
 * "Print Presentation") - matching product behaviour across all five
 * bindings, not a binding-specific gap. `cardText` is that card's own text
 * (its `<strong>` title, matched by Playwright's `getByText` as the
 * innermost element whose own text equals it exactly).
 */
async function openBackstageEntry(
	page: Page,
	entryText: string,
	cardText: string,
	confirmButtonName: string,
): Promise<Locator> {
	await page.getByRole('tab', { name: 'File', exact: true }).click();
	const backstage = page.locator('[role="dialog"][aria-label="File"]');
	await backstage.waitFor();

	// Step 1: the nav click switches the backstage to the entry's own page,
	// which renders an action card carrying `cardText`. Wait for that
	// specific card to become visible rather than a fixed delay, so a slow
	// re-render can never race the next click.
	await backstage.getByText(entryText, { exact: true }).first().click();
	const card = backstage.getByText(cardText, { exact: true }).last();
	await card.waitFor({ state: 'visible', timeout: 10_000 });

	// Step 2: the card invokes the real action and closes the backstage.
	// Waiting for the backstage to actually disappear (rather than a fixed
	// delay) is what makes the dialog lookup below unambiguous: while the
	// backstage is still in the DOM, its own nav item (also named
	// `entryText`) can itself read as a "dialog containing a button named
	// `confirmButtonName`" match if `confirmButtonName === entryText`.
	await card.click();
	await backstage.waitFor({ state: 'hidden', timeout: 10_000 });

	const dialog = page
		.getByRole('dialog')
		.filter({ has: page.getByRole('button', { name: confirmButtonName, exact: true }) })
		.last();
	await dialog.waitFor({ state: 'visible', timeout: 10_000 });
	return dialog;
}

async function resizeAndReverify(page: Page, dialog: Locator, label: string): Promise<void> {
	const before = await controlNameSet(dialog);
	expect(before.size, `${label}: expected controls at desktop width`).toBeGreaterThan(0);

	await page.setViewportSize(PHONE);

	// No fixed settle delay: `toBeVisible()` already polls until true (or its
	// own timeout), which is what actually makes this deterministic - a CSS
	// media-query reflow has no async gap a blind wait would need to cover.
	await expect(dialog, `${label}: dialog stays open across the resize`).toBeVisible();
	await assertNoHorizontalOverflow(page, label);
	await assertMinTouchTargets(dialog, label);

	const after = await controlNameSet(dialog);
	expect(
		missingFrom(before, after),
		`${label}: every control visible at 1280px must still be reachable at 360px`,
	).toStrictEqual([]);
}

test.describe('dense panels at 360x640: resize in place', () => {
	test.use({ viewport: DESKTOP });

	test('Options dialog', async ({ page }) => {
		await load(page);
		const dialog = await openOptionsDialogAny(page);
		await resizeAndReverify(page, dialog, 'Options dialog');
	});

	test('Print dialog', async ({ page }) => {
		await load(page);
		const dialog = await openBackstageEntry(page, 'Print', 'Print Presentation', 'Print');
		await resizeAndReverify(page, dialog, 'Print dialog');
	});

	test('Share dialog', async ({ page }) => {
		await load(page);
		await page.getByRole('button', { name: 'Share', exact: true }).first().click();
		const dialog = page
			.getByRole('dialog')
			.filter({ has: page.locator('input') })
			.last();
		await dialog.waitFor();
		await resizeAndReverify(page, dialog, 'Share dialog');
	});

	test('AI panel', async ({ page }) => {
		// Must be seeded before the first navigation, or the toggle may not
		// render at all in a demo with no AI provider configured.
		await seedMockAiProvider(page);
		await load(page);
		const opened = await openAiPanel(page);
		test.skip(!opened, 'AI toggle not present in this build');
		const panel = aiPanel(page);
		const before = await controlNameSet(panel);
		expect(before.size, 'AI panel: expected controls at desktop width').toBeGreaterThan(0);

		await page.setViewportSize(PHONE);
		await page.waitForTimeout(300);
		// The toggle may re-mount a mobile-specific clone; re-resolve the panel
		// through the currently-visible toggle rather than assuming the same node.
		if (!(await panel.isVisible().catch(() => false))) {
			await aiToggle(page).click();
		}
		await expect(aiPanel(page)).toBeVisible();
		await assertNoHorizontalOverflow(page, 'AI panel');
		await assertMinTouchTargets(aiPanel(page), 'AI panel');
	});
});

// ── Inspector-hosted panels + comments: load at target size ─────────────────

async function openInspectorDesktop(page: Page): Promise<void> {
	const alreadyOpen = inspector(page);
	if (await alreadyOpen.isVisible().catch(() => false)) {
		return;
	}
	const toggle = page.getByRole('button', { name: 'Toggle inspector panel' });
	if (await toggle.isVisible().catch(() => false)) {
		await toggle.click();
		await page.waitForTimeout(200);
	}
}

async function openInspectorMobile(page: Page, element: Locator): Promise<void> {
	// `.click()`, not `.tap()`: this spec runs under the plain "Desktop Chrome"
	// device profile (no `hasTouch`), so a genuine touch gesture is unavailable
	// and unnecessary - only the resulting selection/tap handlers matter here.
	await element.click();
	await page.waitForTimeout(200);
	await page.getByRole('button', { name: 'Format' }).click();
	await page.waitForTimeout(300);
}

/**
 * `role` here is the semantic branch key this function switches on ('table'
 * loads the Plans slide via mobile nav, 'chart' loads the dedicated chart
 * fixture); the DOM lookup, though, must match the actual
 * `aria-roledescription` `pptx-viewer-shared`'s `getAriaRoleDescription`
 * stamps on the rendered element, which is a human-readable phrase, not the
 * bare `PptxElement['type']` - `'table'` renders as `aria-roledescription="data
 * table"`, not `"table"` (matching every binding, since all consume the same
 * shared function). `'chart'` happens to render as literally `"chart"`, which
 * is why only the table case needed this mapping to surface as a real
 * failure.
 */
const ARIA_ROLE_DESCRIPTION_FOR: Readonly<Record<string, string>> = {
	table: 'data table',
	chart: 'chart',
};

/**
 * Open the inspector for `elementsOfType(page, role)` (or any element when
 * `role` is null) at `viewport`, returning its control-name set once
 * assertions pass. Desktop uses the toggle + click path; the phone size uses
 * the mobile bottom-bar Format sheet, matching `mobile-audit.spec.ts`. A
 * `'table'` role loads the sample deck's "Plans" slide (5 of 7, the one with
 * a table); a `'chart'` role loads the dedicated single-slide chart fixture
 * instead of hunting for which sample-deck slide happens to carry a chart.
 */
async function inspectorControlNames(
	page: Page,
	role: string | null,
	viewport: { width: number; height: number },
	label: string,
): Promise<Set<string>> {
	await page.setViewportSize(viewport);
	await load(page, role === 'chart' ? CHART_DECK : deck);
	if (role === 'table') {
		if (viewport.width < 768) {
			// The desktop thumbnail rail is not rendered at mobile widths; the
			// same slide picker lives inside the bottom bar's "Slides" sheet,
			// matching `mobile-table.spec.ts`'s established navigation.
			await page
				.getByRole('navigation', { name: 'Editor actions' })
				.getByRole('button', { name: /^Slides$/u })
				.click();
			const sheet = page.getByRole('dialog').filter({ hasText: 'Slides' });
			await expect(sheet).toBeVisible();
			// Matched by a stable per-slide label, not by its title text: a
			// slide row below the fold in this list can render its title text
			// lazily (only once scrolled near), so waiting on "Plans"
			// specifically raced that lazy fill-in and timed out on some
			// bindings even though the row itself - and its tap target - was
			// already present and clickable. Two accessible shapes exist
			// across bindings for the same row - a `button` labelled
			// "Go to slide N" (matching the desktop thumbnail rail's own
			// `thumbnail()` helper above) on most, an `option` in a
			// `listbox` labelled "Slide N" on Angular's - so this checks
			// both rather than assuming every binding's mobile Slides sheet
			// shares the desktop rail's exact ARIA shape. Deliberately no
			// `force: true`: Playwright's own actionability wait (visible +
			// stable + receives events) is what correctly rides out the
			// sheet's slide-up transform animation (`MobileSheet`'s
			// `slide-in-from-bottom duration-200`) - `force` bypasses exactly
			// that stability check, which is what made a plain fixed-delay
			// click flaky.
			const plansEntry = sheet
				.getByRole('button', { name: new RegExp(`^Go to slide ${TABLE_SLIDE_NUMBER}$`, 'iu') })
				.or(sheet.getByRole('option', { name: new RegExp(`^Slide ${TABLE_SLIDE_NUMBER}$`, 'iu') }))
				// Vanilla names each row button after the slide's own title
				// ("Plans", not "Go to slide N"/"Slide N") and renders every
				// row's content eagerly (no lazy fill-in), so this alternative
				// is safe there without reintroducing the lazy-render race the
				// other two patterns exist to avoid.
				.or(sheet.getByRole('button', { name: 'Plans', exact: true }));
			await plansEntry.waitFor({ state: 'visible', timeout: 15_000 });
			await plansEntry.scrollIntoViewIfNeeded();
			await plansEntry.click();
		} else {
			await thumbnail(page, TABLE_SLIDE_NUMBER).click();
		}
		await page.waitForTimeout(300);
	}
	const target = (
		role ? elementsOfType(page, ARIA_ROLE_DESCRIPTION_FOR[role] ?? role) : slideElements(page)
	).last();
	await target.waitFor();

	if (viewport.width < 768) {
		await openInspectorMobile(page, target);
	} else {
		await openInspectorDesktop(page);
		await selectElement(page, target);
		await page.waitForTimeout(300);
	}

	const panel = inspector(page);
	await expect(panel, `${label}: inspector must be visible`).toBeVisible();
	await assertNoHorizontalOverflow(page, label);
	// The 44px WCAG target only applies below the mobile breakpoint (matching
	// `getDensePanelTouchTargetPx`); at desktop width the shared functions
	// intentionally keep the smaller, mouse-sized 28px default, so asserting
	// 44px there would fail on correct, by-design desktop sizing.
	if (viewport.width < 768) {
		await assertMinTouchTargets(panel, label);
	}
	return controlNameSet(panel);
}

test.describe('dense panels at 360x640: load at target size', () => {
	for (const [label, role] of [
		['Chart data + type/format editor', 'chart'],
		['Table data + style editor', 'table'],
		['Inspector sub-panels + animation panel', null],
	] as const) {
		test(label, async ({ page }) => {
			const phoneNames = await inspectorControlNames(page, role, PHONE, `${label} (360px)`);
			const desktopNames = await inspectorControlNames(page, role, DESKTOP, `${label} (1280px)`);
			expect(
				missingFrom(desktopNames, phoneNames),
				`${label}: every control exposed at 1280px must also be reachable at 360px`,
			).toStrictEqual([]);
		});
	}

	test('Comments panel', async ({ page }) => {
		await page.setViewportSize(PHONE);
		await load(page);
		await page
			.getByRole('button', { name: /^comments$/iu })
			.first()
			.click();
		await page.waitForTimeout(300);
		const sheet = page.locator('[data-pptx-inspector]:visible, [role="dialog"]:visible').last();
		await expect(sheet).toBeVisible();
		await assertNoHorizontalOverflow(page, 'Comments panel');
		// The sample deck starts with no comments, so the panel's own "Add
		// Comment" submit button is disabled (empty draft) until something is
		// typed - some bindings gate it on draft content, others do not, so an
		// empty-draft run privileges whichever binding happens to leave it
		// enabled instead of testing the real control. Typing a draft first
		// checks the actual submit button every binding's user would reach,
		// not an accident of which one disables it.
		const draft = sheet.locator('textarea').first();
		if (await draft.isVisible().catch(() => false)) {
			await draft.fill('Touch target check');
		}
		await assertMinTouchTargets(sheet, 'Comments panel');
	});
});
