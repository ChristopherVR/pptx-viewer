/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Emulate a real touch phone so the canvas takes its pointerType !== 'mouse'
// branch (handleStagePointerDown) — the path where tapping away while inline
// editing used to discard the typed text.
test.use({ ...devices['Pixel 7'] });

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);

async function openFixture(
	page: Page,
): Promise<{ source: Locator; target: Locator; stage: Locator }> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
	const target = page.locator('[data-pptx-element="true"]').filter({ hasText: 'TARGET' });
	const stage = page.locator('[aria-roledescription="slide"]').first();
	await source.waitFor();
	await target.waitFor();
	return { source, target, stage };
}

test.describe('mobile inline text editing (touch)', () => {
	test('typing then tapping another element keeps the text', async ({ page }) => {
		const { source, target } = await openFixture(page);

		// Double-tap (two quick taps) enters inline edit on touch. locator.tap
		// scrolls the shape into view so the taps land on it.
		await target.tap();
		await target.tap();

		const editor = page.locator('[data-inline-editor]');
		await editor.waitFor();
		await page.keyboard.type('XYZ');

		// Tapping another element must commit the pending edit (handleElementMouseDown).
		await source.tap();

		await expect(editor).toBeHidden();
		await expect(target).toContainText('XYZ');
	});

	test('typing then tapping empty canvas keeps the text', async ({ page }) => {
		const { target, stage } = await openFixture(page);

		await target.tap();
		await target.tap();

		const editor = page.locator('[data-inline-editor]');
		await editor.waitFor();
		await page.keyboard.type('EDIT');

		// Tap an empty region of the slide (bottom-centre, clear of both shapes).
		// On touch this starts a tap-sized marquee whose pointerup resolves to
		// clearSelection() — the path that used to drop the edit without saving.
		await stage.tap({ position: { x: 480, y: 480 } });

		await expect(editor).toBeHidden();
		await expect(target).toContainText('EDIT');
	});
});
