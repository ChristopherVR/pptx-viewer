/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';

for (const height of [900, 600]) {
	test(`thumbnail borders fit the default slides pane at ${height}px height`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height });
		await loadDeck(page);
		const pane = page.locator('[data-pptx-chrome="slides"]');
		await expect(pane).toBeVisible();
		const frames = pane.locator('[data-pptx-chrome="slide-frame"]');
		await expect(frames.first()).toBeVisible();
		const geometry = await pane.evaluate((rail) => {
			const list = rail.querySelector<HTMLElement>('[data-pptx-chrome="slide-list"]')!;
			const listBox = list.getBoundingClientRect();
			// clientWidth excludes the vertical scrollbar. A frame can be inside the
			// pane's outer box and still be clipped by the narrower scroll viewport.
			const left = listBox.left + list.clientLeft;
			const right = left + list.clientWidth;
			return {
				width: rail.getBoundingClientRect().width,
				scrolls: list.scrollHeight > list.clientHeight,
				overflow: list.scrollWidth - list.clientWidth,
				frames: Array.from(rail.querySelectorAll('[data-pptx-chrome="slide-frame"]')).map(
					(frame) => {
						const box = frame.getBoundingClientRect();
						return {
							width: box.width,
							leftMargin: box.left - left,
							rightMargin: right - box.right,
						};
					},
				),
			};
		});
		expect(geometry.width).toBeCloseTo(180, 0);
		if (height === 600) {
			expect(geometry.scrolls).toBe(true);
		}
		expect(geometry.overflow).toBeLessThanOrEqual(1);
		expect(geometry.frames.length).toBeGreaterThan(0);
		for (const frame of geometry.frames) {
			expect(frame.width).toBeGreaterThan(100);
			expect(frame.leftMargin).toBeGreaterThanOrEqual(0);
			expect(frame.rightMargin).toBeGreaterThanOrEqual(0);
		}
	});
}
