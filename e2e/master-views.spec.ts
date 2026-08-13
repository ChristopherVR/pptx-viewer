/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	HANDOUT_MASTER_BACKGROUND,
	HANDOUT_MASTER_TEXT,
	NOTES_MASTER_BACKGROUND,
	NOTES_MASTER_TEXT,
} from './fixtures/generate-master-views-fixture';
import { LAYOUT_SHAPE_TEXT, MASTER_SHAPE_TEXT } from './fixtures/generate-template-editing-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/master-views.pptx', import.meta.url)),
);
/**
 * A deck whose slide master and slide layout each carry a real decorative
 * shape. `master-views.pptx` is built by `PptxHandler.createBlank`, whose
 * generated master and layouts have empty shape trees, so it cannot show
 * whether the Slides tab paints anything.
 */
const templateFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/template-editing.pptx', import.meta.url)),
);
const outputDir = fileURLToPath(new URL('../test-results/master-views/', import.meta.url));
const UPDATED_NOTES_BACKGROUND = '#1a73e8';

/**
 * A shape painted from a slide master's or layout's OWN shape tree.
 *
 * The id namespace is the cross-binding contract here, and it is what makes
 * this assertion meaningful: the same artwork also reaches the ordinary slide
 * canvas as an inherited copy under `master-` / `layout-` ids, so matching on
 * the visible text alone would pass against the deck behind the master view.
 * `slide-master-` / `slide-layout-` ids exist only on a part's own tree.
 */
function masterPartShape(page: Page, prefix: 'slide-master-' | 'slide-layout-'): Locator {
	return page.locator(`[data-element-id^="${prefix}"]`);
}

function toolbar(page: Page): Locator {
	return page.getByRole('toolbar', { name: 'Presentation toolbar' });
}

function ribbonTab(page: Page, name: string): Locator {
	return toolbar(page).getByRole('tab', { name, exact: true });
}

function masterTabs(page: Page): Locator {
	return page
		.getByRole('tablist')
		.filter({ has: page.getByRole('tab', { name: 'Handout', exact: true }) })
		.first();
}

async function openFixture(page: Page, path = fixturePath): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(path);
	await page.locator('[aria-roledescription="slide"]').first().waitFor();
}

async function enterMasterView(page: Page): Promise<void> {
	await ribbonTab(page, 'View').click();
	await toolbar(page).getByRole('button', { name: 'Slide Master', exact: true }).click();
	await expect(masterTabs(page)).toBeVisible();
	await expect(masterTabs(page).getByRole('tab', { name: 'Slides', exact: true })).toHaveAttribute(
		'aria-selected',
		'true',
	);
}

async function selectMasterTab(page: Page, name: 'Slides' | 'Notes' | 'Handout'): Promise<void> {
	await masterTabs(page).getByRole('tab', { name, exact: true }).click();
	await expect(masterTabs(page).getByRole('tab', { name, exact: true })).toHaveAttribute(
		'aria-selected',
		'true',
	);
}

async function closeMasterView(page: Page): Promise<void> {
	const sidebar = masterTabs(page).locator('..');
	await sidebar.getByRole('button').first().click();
	await expect(masterTabs(page)).toHaveCount(0);
}

async function saveDeck(page: Page, projectName: string): Promise<string> {
	await ribbonTab(page, 'File').click();
	const downloadPromise = page.waitForEvent('download');
	await toolbar(page)
		.getByRole('button', {
			name: /^Save(?: as)?(?: Presentation)?(?: \(\.pptx\)| \.pptx)?$/u,
		})
		.first()
		.click();
	const download = await downloadPromise;
	const savedPath = resolve(outputDir, `${projectName}-master-views-saved.pptx`);
	await download.saveAs(savedPath);
	return savedPath;
}

test.describe('slide master tab parity', () => {
	/**
	 * View > Slide Master was a blank page on every real deck in all five
	 * bindings: `PptxSlideMaster.elements` / `PptxSlideLayout.elements` were
	 * declared, read by all five master views, and never populated by the
	 * loader. This spec missed it for the same reason it survived so long -
	 * every content assertion was on the Notes and Handout tabs, which are the
	 * two parts that did get their shape trees parsed.
	 */
	test('paints the slide master and layout shape trees', async ({ page }, testInfo) => {
		await openFixture(page, templateFixturePath);
		await enterMasterView(page);

		// The Slides tab opens on the master itself, so its own artwork paints.
		await expect(masterPartShape(page, 'slide-master-').first()).toBeVisible();
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }).first(),
		).toBeVisible();

		// Every layout's tree is parsed too, and the rail previews them.
		await expect(
			masterPartShape(page, 'slide-layout-').filter({ hasText: LAYOUT_SHAPE_TEXT }).first(),
		).toHaveCount(1);

		// And it survives a real save -> reload, so the shape tree is not being
		// rebuilt into something the loader can no longer see.
		await closeMasterView(page);
		const savedPath = await saveDeck(page, `${testInfo.project.name}-slides-tab`);
		await openFixture(page, savedPath);
		await enterMasterView(page);
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }).first(),
		).toBeVisible();
	});
});

test.describe('notes and handout master parity', () => {
	test('navigates, edits, saves, and reloads master properties', async ({ page }, testInfo) => {
		await openFixture(page);
		await enterMasterView(page);

		await selectMasterTab(page, 'Notes');
		await expect(page.getByText(NOTES_MASTER_TEXT, { exact: true })).toBeVisible();
		const notesBackground = page.getByLabel('Master background color');
		await expect(notesBackground).toHaveValue(NOTES_MASTER_BACKGROUND.toLowerCase());
		await notesBackground.fill(UPDATED_NOTES_BACKGROUND);
		await expect(notesBackground).toHaveValue(UPDATED_NOTES_BACKGROUND);

		await selectMasterTab(page, 'Handout');
		await expect(page.getByText(HANDOUT_MASTER_TEXT, { exact: true })).toBeVisible();
		const handoutBackground = page.getByLabel('Master background color');
		await expect(handoutBackground).toHaveValue(HANDOUT_MASTER_BACKGROUND.toLowerCase());
		const ninePerPage = masterTabs(page)
			.locator('..')
			.getByRole('button', { name: '9', exact: true });
		await ninePerPage.click();
		await expect(ninePerPage).toHaveAttribute('aria-pressed', 'true');

		await closeMasterView(page);
		const savedPath = await saveDeck(page, testInfo.project.name);

		await openFixture(page, savedPath);
		await enterMasterView(page);
		await selectMasterTab(page, 'Notes');
		await expect(page.getByLabel('Master background color')).toHaveValue(UPDATED_NOTES_BACKGROUND);
		await expect(page.getByText(NOTES_MASTER_TEXT, { exact: true })).toBeVisible();
		await selectMasterTab(page, 'Handout');
		await expect(page.getByText(HANDOUT_MASTER_TEXT, { exact: true })).toBeVisible();
		await expect(
			masterTabs(page).locator('..').getByRole('button', { name: '9', exact: true }),
		).toHaveAttribute('aria-pressed', 'true');
	});
});
