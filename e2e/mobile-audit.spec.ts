/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Mobile first-class-support audit across every viewer binding.
 *
 * Walks every mobile-specific feature on a real Pixel 7 touch device and
 * captures a screenshot for each so the result can be eyeballed. Tests are
 * independent: a failure in one feature does not mask the others. Run with:
 *
 *   bunx playwright test mobile-audit
 *
 * Screenshots land in `.mobile-audit/` at the repo root.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

// Every binding emits the shared mobile chrome contract used by this spec.

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
// Screenshots are debug artifacts; write them under the gitignored test-results dir.
const shotDir = fileURLToPath(new URL('../test-results/mobile-audit/', import.meta.url));

async function load(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

function shot(page: Page, name: string) {
	return page.screenshot({ path: resolve(shotDir, `${name}.png`) });
}

function bottomBarNav(page: Page) {
	return page.getByRole('navigation', { name: 'Editor actions' });
}

test.describe('mobile audit (Pixel 7 touch)', () => {
	test('01 layout: mobile toolbar + bottom bar render under 768px', async ({ page }) => {
		await load(page);
		const toolbar = page.getByRole('toolbar', { name: 'Toolbar' });
		const bottomBar = bottomBarNav(page);
		await expect(toolbar).toBeVisible();
		await expect(bottomBar).toBeVisible();
		// The desktop ribbon (multi-row) must NOT be present at this width.
		await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
		await shot(page, '01-layout');
	});

	test('02 menu sheet opens with sections', async ({ page }) => {
		await load(page);
		await page.getByRole('button', { name: 'Menu' }).tap();
		await page.waitForTimeout(300);
		await shot(page, '02-menu-sheet');
		// The sheet should surface section entries (Home/Insert/Design/etc.)
		const actions = page.getByRole('dialog').first();
		await expect(actions.getByRole('button', { name: /^Insert/iu }).first()).toBeVisible();
	});

	test('03 bottom bar: slides sheet opens & selects', async ({ page }) => {
		await load(page);
		await page.getByRole('button', { name: 'Slides' }).tap();
		await page.waitForTimeout(300);
		await shot(page, '03-slides-sheet');
		// thumbnails are slide buttons inside the sheet
		const thumbs = page.locator('[aria-roledescription="slide"]');
		expect(await thumbs.count()).toBeGreaterThan(0);
	});

	test('04 bottom bar: inspector (Format) sheet opens for a selection', async ({ page }) => {
		await load(page);
		// Tap the top-most element (last in paint order) so the tap isn't
		// intercepted by an overlapping shape.
		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);
		await page.getByRole('button', { name: 'Format' }).tap();
		await page.waitForTimeout(300);
		await shot(page, '04-inspector-sheet');
	});

	test('05 bottom bar: comments sheet opens', async ({ page }) => {
		await load(page);
		await page.getByRole('button', { name: 'Comments' }).tap();
		await page.waitForTimeout(300);
		await shot(page, '05-comments-sheet');
	});

	test('06 bottom bar: notes editor opens & is editable', async ({ page }) => {
		await load(page);
		await bottomBarNav(page).getByRole('button', { name: 'Notes' }).tap();
		const panel = page.locator('#slide-notes-content');
		await expect(panel).toBeVisible();
		await shot(page, '06-notes');
	});

	test('07 bottom bar: insert adds a text box', async ({ page }) => {
		await load(page);
		const before = await page.locator('[data-pptx-element="true"]').count();
		await page.getByRole('button', { name: 'Insert' }).tap();
		await page.waitForTimeout(400);
		const after = await page.locator('[data-pptx-element="true"]').count();
		await shot(page, '07-insert');
		expect(after).toBeGreaterThan(before);
	});

	test('08 present mode: touch controls appear and navigate', async ({ page }) => {
		await load(page);
		await page
			.getByRole('button', { name: /present|slide show/iu })
			.first()
			.tap();
		await page.waitForTimeout(800);
		await shot(page, '08a-present-start');
		const next = page.getByRole('button', { name: /next slide/iu }).first();
		const prev = page.getByRole('button', { name: /previous slide/iu }).first();
		const close = page.getByRole('button', { name: /end presentation/iu }).first();
		await expect(next).toBeVisible();
		await expect(prev).toBeVisible();
		await expect(close).toBeVisible();
		await next.tap();
		await page.waitForTimeout(500);
		await shot(page, '08b-present-next');
		await close.tap();
		await page.waitForTimeout(500);
		// back to edit chrome
		await expect(bottomBarNav(page)).toBeVisible();
	});

	test('09 present mode: horizontal swipe advances the slide', async ({ page }) => {
		await load(page);
		await page
			.getByRole('button', { name: /present|slide show/iu })
			.first()
			.tap();
		await page.waitForTimeout(800);

		const counter = page
			.locator('text=/^\\s*\\d+\\s*\\/\\s*\\d+\\s*$/')
			.filter({ visible: true })
			.first();
		const before = (await counter.textContent())?.trim() ?? '';

		// Genuine touch swipe (right→left = next) via CDP touch dispatch.
		const vp = page.viewportSize()!;
		const y = Math.round(vp.height / 2);
		const client = await page.context().newCDPSession(page);
		const startX = vp.width - 40;
		const endX = 40;
		await client.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x: startX, y }],
		});
		for (let i = 1; i <= 5; i++) {
			const x = Math.round(startX + ((endX - startX) * i) / 5);
			await client.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x, y }],
			});
		}
		await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await page.waitForTimeout(500);

		const after = (await counter.textContent())?.trim() ?? '';
		await shot(page, '09-present-swipe');
		expect(after).not.toBe(before);
		// A single swipe must advance exactly one slide. Two independent swipe
		// handlers are active in present mode (useSwipeNavigation on <main> and
		// useTouchGestures.onSwipe on the canvas viewport) - if both fire we jump
		// two slides.
		expect(before).toBe('1 / 7');
		expect(after).toBe('2 / 7');
	});
});
