/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Element-level accessibility fields (alt text + title) on a plain text box,
 * run identically against every framework demo.
 *
 * A shape's `p:nvSpPr/p:cNvPr/@descr` and `@title` parse into the element's
 * `altText`/`title` fields (`PptxNonVisualDescription`) and every binding's
 * inspector shows an "Accessibility" section for a shape, text box or
 * connector selection. This spec types into both fields, saves through the
 * backstage, and checks the raw slide XML of the download, then reloads the
 * saved deck and reads the fields back through the same inspector.
 *
 * The two inputs are located by their i18n placeholder contract
 * (`pptx.elementAccessibility.*Placeholder` in
 * `packages/shared/src/i18n/translations-en.ts`), which no other inspector
 * field shares: a chart's data "Title" field and a picture's own alt-text
 * field both label themselves differently. `visible=true` matters for the
 * vanilla binding, whose inspector keeps every section in the DOM and toggles
 * `hidden`.
 *
 * Fixture: `text-style-emphasis.pptx` (see its generator), whose text boxes
 * carry no authored alt text or title.
 *
 * Run: bunx playwright test element-accessibility
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { BOLD_TARGET_TEXT } from './fixtures/generate-text-style-emphasis-fixture';
import { savePptxViaBackstage } from './save-pptx';
import { elementWithText, fixture, inspector, loadDeck, selectElement } from './support/deck';
import { downloadBytes } from './support/exports';
import { extractElementBlock, readZipPartText } from './support/pptx-xml';

const DECK = fixture('text-style-emphasis.pptx');
const ALT_TEXT = 'A bold emphasis target, described for screen readers';
const TITLE = 'Emphasis target';

function altTextInput(page: Page): Locator {
	return inspector(page)
		.getByPlaceholder('Describe this element for accessibility', { exact: true })
		.locator('visible=true')
		.first();
}

function titleInput(page: Page): Locator {
	return inspector(page)
		.getByPlaceholder('Accessibility title (optional)', { exact: true })
		.locator('visible=true')
		.first();
}

async function selectTarget(page: Page): Promise<void> {
	const target = elementWithText(page, BOLD_TARGET_TEXT);
	await target.waitFor();
	await selectElement(page, target);
	await expect(inspector(page)).toBeVisible();
}

async function fillAndCommit(input: Locator, value: string): Promise<void> {
	await expect(input).toBeVisible();
	await input.fill(value);
	// Every binding commits these fields on change/blur, not per keystroke.
	await input.press('Tab');
}

test.describe('element accessibility (alt text + title)', () => {
	test('the inspector exposes editable alt text and title for a text box', async ({ page }) => {
		await loadDeck(page, DECK);
		await selectTarget(page);

		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		// Deselect and reselect: the value must come back from the model, not
		// from the input's own uncommitted state.
		await page.mouse.click(5, 5);
		await page.waitForTimeout(200);
		await selectTarget(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});

	test('both fields reach p:cNvPr in the saved slide XML and survive a reload', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await selectTarget(page);
		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);
		const savedPath = await download.path();
		expect(bytes.length, 'the saved .pptx must not be empty').toBeGreaterThan(0);
		expect(savedPath, 'the browser must retain the downloaded file').not.toBeNull();

		const slideXml = await readZipPartText(bytes, 'ppt/slides/slide1.xml');
		// Throws when no `p:sp` block carries the text, which is the assertion.
		const shape = extractElementBlock(slideXml, 'p:sp', BOLD_TARGET_TEXT);
		const cNvPr = /<p:cNvPr\b[^>]*>/u.exec(shape)?.[0] ?? '';
		expect(cNvPr).toContain(`descr="${ALT_TEXT}"`);
		expect(cNvPr).toContain(`title="${TITLE}"`);

		await loadDeck(page, savedPath!);
		await selectTarget(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});
});
