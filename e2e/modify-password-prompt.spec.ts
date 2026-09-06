/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The read-only recommendation banner's modify-password unlock prompt,
 * driven the same way in all five demos.
 *
 * `modify-password.pptx` (see `fixtures/modify-password.pptx`) is a
 * one-slide deck PowerPoint itself protected via File > Info > Protect
 * Presentation > "Set Password to Modify" (COM `Presentation.WritePassword`),
 * with the password `letmeedit123`. Its `p:modifyVerifier` therefore carries a
 * REAL, checkable SHA-512 hash identified the way PowerPoint itself writes it
 * (`cryptAlgorithmSid`, no `algorithmName` attribute), unlike
 * `parity-wave4.pptx`'s fabricated verifier (missing an algorithm identifier
 * entirely, so it recommends read-only without gating "Edit anyway" on a
 * password - see that spec's banner tests).
 *
 * PowerPoint's own behaviour is the ground truth this pins: a wrong password
 * leaves the deck read-only, and only the correct one unlocks it.
 *
 * Every locator is a `data-testid` from the shared banding contract
 * (`packages/shared/src/render/read-only-recommendation.ts` +
 * `checkModifyPassword`), so a binding that renders the prompt with a
 * different hook is a parity bug in that binding, not a reason to add a
 * fallback here.
 *
 * Run: bunx playwright test modify-password-prompt
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeck } from './support/deck';

const MODIFY_PASSWORD_DECK = fixture('modify-password.pptx');
const CORRECT_PASSWORD = 'letmeedit123';

test.describe('modify-password unlock prompt', () => {
	test('a real modifyVerifier hash shows the banner and requires a password', async ({ page }) => {
		await loadDeck(page, MODIFY_PASSWORD_DECK);

		const banner = page.getByTestId('pptx-readonly-banner');
		await expect(banner).toBeVisible();
		await expect(banner).toHaveAttribute('data-kind', 'modifyVerifier');

		// "Edit anyway" opens the password prompt instead of unlocking
		// immediately: the banner (and the lock it represents) must still be up.
		await page.getByTestId('pptx-readonly-edit-anyway').click();
		await expect(page.getByTestId('pptx-readonly-password-form')).toBeVisible();
		await expect(banner).toBeVisible();
	});

	test('a wrong password stays read-only and reports the error', async ({ page }) => {
		await loadDeck(page, MODIFY_PASSWORD_DECK);
		await page.getByTestId('pptx-readonly-edit-anyway').click();

		const input = page.getByTestId('pptx-readonly-password-input');
		await expect(input).toBeVisible();
		await input.fill('definitely-wrong');
		await page.getByTestId('pptx-readonly-unlock').click();

		await expect(page.getByTestId('pptx-readonly-password-error')).toBeVisible();
		// Still locked: the form (not the edit-anyway/dismiss pair) is still up,
		// and the banner itself never went away.
		await expect(page.getByTestId('pptx-readonly-password-form')).toBeVisible();
		await expect(page.getByTestId('pptx-readonly-banner')).toBeVisible();
	});

	test('the correct password unlocks editing and closes the prompt', async ({ page }) => {
		await loadDeck(page, MODIFY_PASSWORD_DECK);
		await page.getByTestId('pptx-readonly-edit-anyway').click();

		const input = page.getByTestId('pptx-readonly-password-input');
		await input.fill(CORRECT_PASSWORD);
		await page.getByTestId('pptx-readonly-unlock').click();

		// Unmounted or hidden are both fine (see `parity-wave4.spec.ts`'s banner
		// tests): a binding may keep the node and toggle `hidden` rather than
		// tear it down.
		await expect(page.getByTestId('pptx-readonly-banner')).toBeHidden();
	});

	test('"Cancel" closes the prompt without unlocking', async ({ page }) => {
		await loadDeck(page, MODIFY_PASSWORD_DECK);
		await page.getByTestId('pptx-readonly-edit-anyway').click();
		await expect(page.getByTestId('pptx-readonly-password-form')).toBeVisible();

		await page.getByTestId('pptx-readonly-password-cancel').click();

		await expect(page.getByTestId('pptx-readonly-password-form')).toBeHidden();
		// Cancelling is not "Edit anyway": the deck is still locked, so the
		// banner (with its plain edit-anyway/dismiss pair) must still be up.
		await expect(page.getByTestId('pptx-readonly-banner')).toBeVisible();
		await expect(page.getByTestId('pptx-readonly-edit-anyway')).toBeVisible();
	});
});
