/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

/**
 * Wave-4 B4: the Slide Master view sidebar's Insert / Duplicate / Delete /
 * Rename Layout commands, in every binding. The commands are ZIP surgery in
 * core and a decision list in shared (`masterViewCrudActions`); what this
 * pins per binding is the WIRING: the row exists, a click adopts the rebuilt
 * deck (the rail grows/shrinks), the fresh selection follows the command, and
 * a rename reaches the rail label.
 */

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/master-views.pptx', import.meta.url)),
);
const RENAMED_LAYOUT = 'Wave4 Renamed Layout';

function ribbonTab(page: Page, name: string): Locator {
	return page.getByRole('tab', { name, exact: true }).first();
}

function masterTabs(page: Page): Locator {
	return page
		.getByRole('tablist')
		.filter({ has: page.getByRole('tab', { name: 'Handout', exact: true }) })
		.first();
}

/** The sidebar that owns the master tablist. */
function sidebar(page: Page): Locator {
	return masterTabs(page).locator('..');
}

function crudButton(page: Page, id: string): Locator {
	return sidebar(page).getByTestId(`pptx-master-crud-${id}`);
}

/**
 * The rail's master + layout entries plus the close control: every sidebar
 * button that is neither a tab nor a CRUD command. Only DELTAS are asserted,
 * so the constant close control never matters.
 */
function railEntries(page: Page): Locator {
	return sidebar(page).locator('button:not([role="tab"]):not([data-testid^="pptx-master-crud-"])');
}

async function loadDeck(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-roledescription="slide"]').first().waitFor();
}

async function enterMasterView(page: Page): Promise<void> {
	await ribbonTab(page, 'View').click();
	await page
		.getByRole('toolbar')
		.first()
		.getByRole('button', { name: 'Slide Master', exact: true })
		.click();
	await expect(masterTabs(page)).toBeVisible();
}

test.describe('slide master view CRUD', () => {
	test('inserts a layout, renames it, and deletes it again', async ({ page }) => {
		await loadDeck(page);
		await enterMasterView(page);

		await expect(crudButton(page, 'addLayout')).toBeEnabled();
		const before = await railEntries(page).count();
		expect(before).toBeGreaterThan(0);

		await crudButton(page, 'addLayout').click();
		await expect(railEntries(page)).toHaveCount(before + 1);
		// The new layout is the selection, so its own commands are live.
		await expect(crudButton(page, 'deleteLayout')).toBeEnabled();
		await expect(crudButton(page, 'renameLayout')).toBeEnabled();

		page.once('dialog', (dialog) => void dialog.accept(RENAMED_LAYOUT));
		await crudButton(page, 'renameLayout').click();
		await expect(sidebar(page).getByRole('button', { name: RENAMED_LAYOUT })).toBeVisible();

		await crudButton(page, 'deleteLayout').click();
		await expect(railEntries(page)).toHaveCount(before);
		await expect(sidebar(page).getByRole('button', { name: RENAMED_LAYOUT })).toHaveCount(0);
	});

	test('a layout a slide uses cannot be deleted', async ({ page }) => {
		await loadDeck(page);
		await enterMasterView(page);

		// The fixture's slide sits on the first layout: select it and expect
		// the shared rule to disable Delete with the in-use reason.
		await sidebar(page).getByRole('button', { name: 'Title Slide' }).first().click();
		await expect(crudButton(page, 'duplicateLayout')).toBeEnabled();
		await expect(crudButton(page, 'deleteLayout')).toBeDisabled();
		await expect(crudButton(page, 'deleteLayout')).toHaveAttribute('title', /in use|used by/iu);
	});
});
