/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { chainedDeck } from './support/chained-motion-deck';
import { resetTabSession } from './support/deck';

test('animation-only shape click plays both path segments without advancing', async ({ page }) => {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles({
		name: 'chained-motion.pptx',
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		buffer: await chainedDeck(),
	});
	await page.locator('[data-element-id]').first().waitFor();
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	const stage = page.locator('[data-pptx-presenting]').first();
	const trigger = stage.locator('[data-pptx-anim-trigger]').first();
	await expect(trigger).toBeVisible();
	await trigger.click();
	await expect
		.poll(() =>
			stage
				.locator('[data-element-id]')
				.evaluateAll((nodes) =>
					nodes.some((node) => (node as HTMLElement).style.animation.includes('transform')),
				),
		)
		.toBe(true);
	const samples = await stage.evaluate(async (root) => {
		const target = [...root.querySelectorAll<HTMLElement>('[data-element-id]')].find((el) =>
			el.style.animation.includes('transform'),
		)!;
		const animation = target.getAnimations()[0];
		animation.pause();
		const positions: number[][] = [];
		for (const time of [0, 1000, 2000, 2500]) {
			animation.currentTime = time;
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
			const matrix = new DOMMatrix(getComputedStyle(target).transform);
			positions.push([matrix.m41, matrix.m42]);
		}
		return positions;
	});
	expect(samples[0][0]).toBeCloseTo(0, 0);
	expect(samples[0][1]).toBeCloseTo(0, 0);
	expect(samples[1][0]).toBeGreaterThan(20);
	expect(samples[1][1]).toBeCloseTo(0, 0);
	expect(samples[2][0]).toBeGreaterThan(samples[1][0]);
	expect(samples[2][1]).toBeGreaterThan(10);
	expect(samples[3][1]).toBeGreaterThan(samples[2][1]);
	await expect(stage).toBeVisible();
});
