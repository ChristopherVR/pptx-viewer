/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Share-dialog input focus, framework-neutral.
 *
 * Regression spec for a React-only bug where clicking an input inside the
 * Share dialog never kept focus: `useModalFocus` listed the (inline, so
 * identity-unstable) `onClose` prop in its effect deps, so every viewer
 * re-render tore down and re-armed the shared modal focus trap. The teardown
 * restored focus to the opener and the re-arm snapped it to the dialog's
 * first control (the x close button), yanking focus away from whatever input
 * the user had just clicked; typed text landed nowhere. The other bindings
 * arm `activateModalFocus` once per open (Vue watch, Angular signal effect,
 * Svelte action, Vanilla imperative show), but the failure mode is generic:
 * ANY binding that re-arms the trap while the dialog is open regresses the
 * same way, so every project runs the identical assertions.
 *
 * Contract exercised (all five bindings): a toolbar button with accessible
 * name "Share" opens a `role=dialog` panel containing text inputs; each
 * editable input must take focus on click, HOLD it across subsequent
 * renders, accept typed text, and Escape must still close the dialog (the
 * close callback is routed through the focus trap, so a fix that severs it
 * would pass the focus checks but fail the Escape check).
 *
 * Run: bunx playwright test share-dialog-focus
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const deck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
}

/** The Share dialog panel: the open `role=dialog` that contains form inputs. */
function shareDialog(page: Page): Locator {
	return page
		.getByRole('dialog')
		.filter({ has: page.locator('input') })
		.last();
}

async function openShareDialog(page: Page): Promise<Locator> {
	await page.getByRole('button', { name: 'Share', exact: true }).first().click();
	const dialog = shareDialog(page);
	await dialog.waitFor();
	return dialog;
}

test.describe('share dialog input focus', () => {
	test('every input takes focus on click, keeps it, and accepts typed text', async ({ page }) => {
		await loadDeck(page);
		const dialog = await openShareDialog(page);

		const inputs = dialog.locator('input[type="text"], input:not([type])');
		const count = await inputs.count();
		// Create-session view exposes at least session name + display name.
		expect(count, 'share dialog should expose text inputs').toBeGreaterThanOrEqual(2);

		for (let i = 0; i < count; i++) {
			const input = inputs.nth(i);
			if (!(await input.isVisible()) || !(await input.isEditable())) {
				continue;
			}

			await input.click();
			await expect(input, `input #${i} should be focused after click`).toBeFocused();

			// Let any state-driven re-render churn play out: the original bug
			// only stole focus when the viewer re-rendered while the dialog was
			// open (re-arming the focus trap snaps focus to the close button).
			await page.waitForTimeout(400);
			await expect(input, `input #${i} should STILL be focused after renders settle`).toBeFocused();

			await input.press('ControlOrMeta+a');
			await page.keyboard.type(`focus-check-${i}`);
			await expect(input, `typed text should land in input #${i}`).toHaveValue(`focus-check-${i}`);
			await expect(input, `input #${i} should keep focus while typing`).toBeFocused();
		}
	});

	test('Escape closes the dialog while an input is focused', async ({ page }) => {
		await loadDeck(page);
		const dialog = await openShareDialog(page);

		// :visible matters: Vanilla keeps the join-mode invitation input in the
		// DOM (display: none) while the create view is active.
		const input = dialog.locator('input[type="text"]:visible, input:not([type]):visible').first();
		await input.click();
		await expect(input).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});
});
