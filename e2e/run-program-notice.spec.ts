/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * PowerPoint's "Run program" action (`ppaction://program`) during a running
 * show, run identically against every framework demo.
 *
 * A browser cannot launch a local executable, so the honest behavior on click
 * is a non-blocking notice naming the exact resolved command (see
 * `packages/shared/src/render/run-program-notice.ts`), not silent nothing and
 * not a modal dialog. The fixture (`e2e/fixtures/run-program-action.pptx`,
 * built by `generate-run-program-fixture.ts`) is a single slide with one
 * rectangle whose Action Settings click is `ppaction://program`, target
 * `notepad.exe C:\temp\notes.txt`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Deliberately NOT imported from the generator: that module pulls in
// `pptx-viewer-core`, and a worker must not fail to start just because
// `packages/core/dist` is mid-rebuild.
import {
	RUN_PROGRAM_COMMAND,
	RUN_PROGRAM_SHAPE_ID as ACTION_SHAPE_ID,
} from './fixtures/run-program-fixture-constants';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/run-program-action.pptx', import.meta.url)),
);

/** Load the fixture and enter the running show. */
async function startShow(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator(`[data-element-id="${ACTION_SHAPE_ID}"]`).first().waitFor({ timeout: 30_000 });
	await page.waitForTimeout(600);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1200);
}

/** Click the centre of the action shape on the topmost (show) stage. */
async function clickActionShape(page: Page): Promise<void> {
	const matches = page.locator(`[data-element-id="${ACTION_SHAPE_ID}"]`);
	const box = await matches.last().boundingBox();
	expect(box, `${ACTION_SHAPE_ID} is rendered`).not.toBeNull();
	await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.describe('slide-show run-program action', () => {
	test.beforeEach(async ({ context }) => {
		// The Copy button writes via the async Clipboard API; grant both
		// directions so the spec can also read back what was written.
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	});

	test('clicking a Run-Program shape shows a non-blocking notice naming the exact command', async ({
		page,
	}) => {
		await startShow(page);
		await clickActionShape(page);

		const notice = page.locator('[data-testid="pptx-run-program-notice"]').last();
		await expect(notice).toBeVisible({ timeout: 8000 });
		await expect(notice).toHaveAttribute('data-target', RUN_PROGRAM_COMMAND);
		await expect(notice).toContainText(RUN_PROGRAM_COMMAND);

		// Non-blocking: the show is still running (no native dialog, no exit),
		// the single-slide stage is still on screen.
		await expect(page.locator('[aria-roledescription="slide"]').last()).toBeVisible();
	});

	test('the Copy button copies the exact command to the clipboard', async ({ page }) => {
		await startShow(page);
		await clickActionShape(page);

		const notice = page.locator('[data-testid="pptx-run-program-notice"]').last();
		await expect(notice).toBeVisible({ timeout: 8000 });
		await notice.locator('[data-testid="pptx-run-program-notice-copy"]').last().click();

		await expect
			.poll(async () => page.evaluate(() => navigator.clipboard.readText()), {
				message: 'the copy button writes the exact command to the clipboard',
				timeout: 8000,
			})
			.toBe(RUN_PROGRAM_COMMAND);
	});

	test('the click is spent on the action, not treated as a native dialog', async ({ page }) => {
		await startShow(page);

		let dialogSeen = false;
		page.on('dialog', (dialog) => {
			dialogSeen = true;
			void dialog.dismiss();
		});

		await clickActionShape(page);
		await page.waitForTimeout(1000);

		expect(dialogSeen, 'no native confirm/alert dialog was opened').toBe(false);
	});
});
