/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 1920, height: 1080 } });

interface RealWorldFixture {
	filename: string;
	slides: number;
}

const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));

const FIXTURES: readonly RealWorldFixture[] = [
	{ filename: '36_Slides_Extra_Large_22_5_MB_578ce6bbf3.pptx', slides: 36 },
	{ filename: 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx', slides: 12 },
	{ filename: 'Japanese_10_Slides_1_8_MB_bbd4090b55.pptx', slides: 10 },
	{ filename: 'Mathematical_Equations_11_Slides_46_KB_3c22e70f4d.pptx', slides: 10 },
	{ filename: 'Non_Latin_Arabic_RTL_text_11_Slides_7_3_MB_7f135c4f96.pptx', slides: 11 },
	{ filename: 'Simplified_Chinese_10_Slides_1_8_MB_792c2c1166.pptx', slides: 10 },
	{ filename: 'Slide_Animations_Speaker_comments_8_Slides_2_7_MB_c8f64d1a03.pptx', slides: 8 },
];

function fixturePath(fixture: RealWorldFixture): string {
	return resolve(fixtureDirectory, fixture.filename);
}

function slideRegion(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]');
}

async function loadFixture(page: Page, fixture: RealWorldFixture): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath(fixture));
	await slideRegion(page).waitFor({ timeout: 120_000 });
	await page.locator('[data-pptx-element="true"]').first().waitFor({ timeout: 120_000 });
}

test.describe('real-world presentation fixtures', () => {
	test.beforeEach(({ page: _page }, testInfo) => {
		test.skip(testInfo.project.name !== 'react', 'This visual audit targets the React viewer.');
	});
	for (const fixture of FIXTURES) {
		test(`loads ${fixture.filename}`, async ({ page }) => {
			await loadFixture(page, fixture);

			await expect(page.locator('[data-pptx-viewport]')).toBeVisible();
			await expect(page.getByText(new RegExp(`1 of ${fixture.slides}`, 'u'))).toBeVisible();
			expect(await page.locator('[data-pptx-element="true"]').count()).toBeGreaterThan(0);

			// Preserve the rendered result as a Playwright artifact for comparison
			// with the matching PowerPoint reference export during visual audits.
			await test.info().attach('react-slide-1', {
				body: await page.locator('[data-pptx-viewport]').screenshot(),
				contentType: 'image/png',
			});
		});
	}

	test('navigates the large presentation to its final slide', async ({ page }) => {
		const fixture = FIXTURES[0]!;
		await loadFixture(page, fixture);
		const slidesPane = page.getByRole('navigation', { name: 'Slides' });
		await slidesPane.getByText(String(fixture.slides), { exact: true }).click();
		await expect(
			page.getByText(new RegExp(`${fixture.slides} of ${fixture.slides}`, 'u')),
		).toBeVisible();
	});
});
