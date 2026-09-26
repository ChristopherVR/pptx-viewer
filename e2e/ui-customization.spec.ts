/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The shared UI customisation model (`ViewerCustomization`), end to end.
 *
 * Every binding takes the same object through its `customization` prop /
 * input / option and exposes the same imperative helpers on its handle; the
 * decisions are made once in `packages/shared/src/render/customization`. The
 * unit suites pin the decision functions and each binding's wiring, but the
 * failure this spec exists for is the one those suites cannot see: a binding
 * whose template simply never consults the resolved customisation, so every
 * test is green and the tab is still on screen.
 *
 * The demos read `?customization=<json>` (see `demos/shared/demo-customization.ts`)
 * and expose the live component handle as `window.__pptxViewer`, so
 * the same steps run unchanged against all five demos.
 *
 * Run: PPTX_E2E_PORT_OFFSET=600 bunx playwright test ui-customization --project=react
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openMenuOn, stageElements } from './support/context-menu';
import { loadDeck, ribbonTab, SAMPLE_DECK } from './support/deck';
import { openOptionsDialog, optionsCategory } from './support/settings-dialog';

test.use({ viewport: { width: 1440, height: 900 } });

const OPTIONS_TITLES = ['Options'];

function withCustomization(customization: object): string {
	return `/?customization=${encodeURIComponent(JSON.stringify(customization))}`;
}

type CustomizationCall = [method: string, ...args: unknown[]];

type HandleWindow = { __pptxViewer?: Record<string, (...args: unknown[]) => void> };

/**
 * Call one customisation helper on the live component handle every demo
 * exposes as `window.__pptxViewer` in development.
 */
async function callCustomization(page: Page, ...call: CustomizationCall): Promise<void> {
	await page.waitForFunction(
		(method) => typeof (window as HandleWindow).__pptxViewer?.[method] === 'function',
		call[0],
	);
	await page.evaluate(([method, ...args]) => {
		(window as HandleWindow).__pptxViewer?.[method as string]?.(...args);
	}, call);
}

test.describe('UI customization', () => {
	test('File > Options checkboxes expose one accessible Space-key contract', async ({ page }) => {
		await loadDeck(page);
		let dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		await optionsCategory(dialog, 'General').click();
		let checkbox = dialog.getByRole('checkbox', {
			name: 'Show Mini Toolbar on selection',
		});
		await expect(checkbox).toBeVisible();
		await expect(checkbox).toHaveAttribute('role', 'checkbox');
		await expect(checkbox).toHaveAttribute('checked', '');
		await checkbox.focus();
		await page.keyboard.press('Space');
		await expect(checkbox).not.toHaveAttribute('checked');

		await dialog.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(dialog).not.toBeVisible();
		dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		await optionsCategory(dialog, 'General').click();
		checkbox = dialog.getByRole('checkbox', {
			name: 'Show Mini Toolbar on selection',
		});
		await expect(checkbox).not.toHaveAttribute('checked');
	});

	test('a ribbon tab hidden through the customization prop never renders', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK, withCustomization({ ribbon: { hiddenTabs: ['draw'] } }));
		await expect(ribbonTab(page, 'Insert')).toBeVisible();
		await expect(ribbonTab(page, 'Draw')).toHaveCount(0);
	});

	test('the imperative API hides and restores a ribbon tab live', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await expect(ribbonTab(page, 'Insert')).toBeVisible();
		await callCustomization(page, 'hideRibbonTab', 'insert');
		await expect(ribbonTab(page, 'Insert')).toHaveCount(0);
		await callCustomization(page, 'showRibbonTab', 'insert');
		await expect(ribbonTab(page, 'Insert')).toBeVisible();
	});

	test('File > Options drops a hidden page and renders a locked setting read-only', async ({
		page,
	}) => {
		await loadDeck(
			page,
			SAMPLE_DECK,
			withCustomization({
				options: { hiddenPages: ['trust'], locked: { 'general.userName': 'Kiosk User' } },
			}),
		);
		const dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		await expect(optionsCategory(dialog, 'General')).toBeVisible();
		await expect(optionsCategory(dialog, 'Trust Center')).toHaveCount(0);
		const userName = dialog.getByLabel('User name', { exact: true });
		await expect(userName).toBeDisabled();
		await expect(userName).toHaveValue('Kiosk User');
	});

	test('a hidden element context-menu command is not offered', async ({ page }) => {
		await loadDeck(
			page,
			SAMPLE_DECK,
			withCustomization({ contextMenu: { hiddenElementCommands: ['delete', 'duplicate'] } }),
		);
		const menu = await openMenuOn(page, stageElements(page).first());
		expect(menu.present).toBeTruthy();
		expect(menu.labels).toContain('copy');
		expect(menu.labels).not.toContain('delete');
		expect(menu.labels).not.toContain('duplicate');
	});
});
