/** Finding empty slide background to right-click, shared by the context-menu specs. */
import type { Page } from '@playwright/test';

import type { Point } from './context-menu';

/**
 * A point on the slide that is empty background, found by hit-testing rather
 * than assumed: slide 1 of the sample deck has a full-height filled panel down
 * its left third, so a fixed point can open the ELEMENT menu instead.
 */
export async function emptyCanvasPoint(page: Page): Promise<Point> {
	const box = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
	if (!box) {
		throw new Error('slide stage has no bounding box');
	}
	const candidates: Point[] = [];
	for (const fy of [0.95, 0.9, 0.85, 0.8, 0.1, 0.05]) {
		for (const fx of [0.95, 0.9, 0.8, 0.7, 0.6, 0.5]) {
			candidates.push({ x: box.x + box.width * fx, y: box.y + box.height * fy });
		}
	}
	const found = await page.evaluate((points) => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		return (
			points.find((point) => {
				const hit = document.elementFromPoint(point.x, point.y);
				return Boolean(hit && stage?.contains(hit) && !hit.closest('[data-element-id]'));
			}) ?? null
		);
	}, candidates);
	if (!found) {
		throw new Error('no empty background point on the slide stage');
	}
	return found;
}
