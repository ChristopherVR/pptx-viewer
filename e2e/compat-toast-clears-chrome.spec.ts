/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The compatibility-notice stack must sit on the canvas, clear of the chrome
 * around it: it used to render on top of the docked Properties panel (anchored
 * to the viewer root, which spans the panel) and on top of the "Speaker notes"
 * strip (only the status bar was cleared). Both are measured, per binding,
 * without any framework-specific selector:
 *
 * - the strip is found as the first ancestor of the notes body
 *   (`#slide-notes-content`) that reaches above it, i.e. the container that
 *   also holds the strip's header;
 * - the panel is the `Properties` complementary landmark.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

// The OLE fixture raises PARTIAL_OLE_SUPPORT, a real load-time notice.
const fixturePath = resolve(fileURLToPath(new URL('./fixtures/ole-embed.pptx', import.meta.url)));

const stack = (page: Page) => page.locator('[data-testid="pptx-compat-toasts"]');

async function toggleNotes(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: 'Toggle notes', exact: true })
		.filter({ visible: true })
		.last()
		.click();
}

/** Top edge (px) of the whole notes strip, header included. */
async function notesStripTop(page: Page): Promise<number> {
	return page.locator('#slide-notes-content').evaluate((body) => {
		const bodyTop = body.getBoundingClientRect().top;
		let node: Element | null = body;
		while (node?.parentElement) {
			const top = node.getBoundingClientRect().top;
			if (top < bodyTop - 4) {
				return top;
			}
			node = node.parentElement;
		}
		return bodyTop;
	});
}

test.describe('compat toast clears the surrounding chrome', () => {
	test.beforeEach(async ({ page }) => {
		await resetTabSession(page);
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(fixturePath);
		await expect(stack(page)).toBeVisible();
	});

	test('stays left of the docked Properties panel', async ({ page }) => {
		const panel = page.getByRole('complementary', { name: /properties/i }).first();
		await expect(panel).toBeVisible();
		const toast = (await stack(page).boundingBox())!;
		const panelBox = (await panel.boundingBox())!;
		expect(toast.x + toast.width).toBeLessThanOrEqual(panelBox.x + 1);
	});

	test('rises above the notes strip when it expands and drops when it collapses', async ({
		page,
	}) => {
		const collapsedBottom = async () => {
			const box = (await stack(page).boundingBox())!;
			return box.y + box.height;
		};
		const before = await collapsedBottom();

		await toggleNotes(page);
		await expect(page.locator('#slide-notes-content')).toBeVisible();
		await expect
			.poll(async () => (await collapsedBottom()) <= (await notesStripTop(page)) + 1)
			.toBe(true);
		const expanded = await collapsedBottom();
		expect(expanded).toBeLessThan(before);

		await toggleNotes(page);
		await expect.poll(collapsedBottom).toBeGreaterThan(expanded);
	});
});
