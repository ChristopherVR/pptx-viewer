/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Framework-neutral collaboration presence GEOMETRY.
 *
 * `collaboration.spec.ts` proves two peers connect; this proves that what they
 * draw for each other lands in the right place. Presence travels in unscaled
 * slide coordinates, so both halves of the mapping have to agree:
 *
 *   send: pointer client-space -> slide space (divide by the *stage* scale,
 *         measured from the stage origin)
 *   draw: slide space -> screen (the stage transform, applied exactly once)
 *
 * Getting either half wrong offsets every remote cursor and selection box, and
 * the error is invisible at 100% zoom in a maximised window: it only shows up
 * when the two peers' stages differ in size, which is why the guest here is
 * deliberately given a much smaller viewport than the host.
 *
 * Regression: the Angular viewer rendered both overlays as siblings of the
 * slide canvas (so `<main>` space, not slide space) and scaled them by the
 * user's zoom, which ignores the auto-fit factor folded into the stage
 * transform. Cursors and selection boxes landed far from the element they
 * pointed at, while the other four bindings were correct.
 *
 * DOM contract used here, emitted by all five bindings:
 *   `[data-pptx-element="true"]`      - a rendered element on the slide
 *   `[data-pptx-remote-selection]`    - a remote peer's selection box; the
 *                                        attribute value is the element id
 *   `[data-pptx-remote-cursor]`       - a remote peer's cursor; its top-left
 *                                        corner is the pointer tip
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** How far a drawn overlay may sit from where it belongs (device px). */
const TOLERANCE_PX = 2;

/** Index of the element the host selects: a mid-slide shape on the sample deck. */
const TARGET_INDEX = 6;

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error('expected the located node to have a bounding box');
	}
	return box;
}

async function openDeck(page: Page, roomId: string, name: string, sample: boolean): Promise<void> {
	const sampleParam = sample ? 'sample=1&' : '';
	await page.goto(
		`/?${sampleParam}room=${encodeURIComponent(roomId)}&transport=webrtc&name=${name}`,
	);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 30_000 });
}

function slideElements(page: Page): Locator {
	return page.locator('[data-pptx-element="true"]');
}

test.describe('collaboration presence geometry', () => {
	test.setTimeout(120_000);

	test('a peer draws remote selections and cursors in the right place at its own scale', async ({
		page,
	}, testInfo) => {
		const guest = await page.context().newPage();
		const roomId = `e2e-geom-${testInfo.project.name}-${Date.now()}`;

		try {
			// The guest is deliberately smaller: its auto-fit scale differs from the
			// host's, so any mapping that leaks the sender's scale (or skips the
			// receiver's) misplaces the overlays.
			await page.setViewportSize({ width: 1280, height: 900 });
			await guest.setViewportSize({ width: 900, height: 680 });

			await openDeck(page, roomId, 'host', true);
			await openDeck(guest, roomId, 'guest', false);

			// Wait for the deck to reach the guest through late-joiner sync.
			const hostCount = await slideElements(page).count();
			expect(hostCount).toBeGreaterThan(TARGET_INDEX);
			await expect
				.poll(async () => slideElements(guest).count(), { timeout: 30_000 })
				.toBe(hostCount);

			// Host: hover the centre of a shape and select it.
			const hostTarget = await boxOf(slideElements(page).nth(TARGET_INDEX));
			const centre = {
				x: hostTarget.x + hostTarget.width / 2,
				y: hostTarget.y + hostTarget.height / 2,
			};
			await page.bringToFront();
			await page.mouse.move(centre.x, centre.y, { steps: 8 });
			await page.mouse.click(centre.x, centre.y);
			// The cursor broadcast is throttled, so nudge again after the click to
			// make sure the final position is the one that goes on the wire.
			await page.waitForTimeout(300);
			await page.mouse.move(centre.x, centre.y, { steps: 2 });

			// Guest: the selection box must land exactly on ITS copy of the element.
			const remoteSelection = guest.locator('[data-pptx-remote-selection]').first();
			await expect(remoteSelection).toBeVisible({ timeout: 20_000 });

			const guestTarget = await boxOf(slideElements(guest).nth(TARGET_INDEX));
			const drawn = await boxOf(remoteSelection);
			expect(Math.abs(drawn.x - guestTarget.x)).toBeLessThanOrEqual(TOLERANCE_PX);
			expect(Math.abs(drawn.y - guestTarget.y)).toBeLessThanOrEqual(TOLERANCE_PX);
			expect(Math.abs(drawn.width - guestTarget.width)).toBeLessThanOrEqual(TOLERANCE_PX);
			expect(Math.abs(drawn.height - guestTarget.height)).toBeLessThanOrEqual(TOLERANCE_PX);

			// Guest: the remote cursor tip must sit inside that same element, since
			// that is where the host's pointer is.
			const remoteCursor = guest.locator('[data-pptx-remote-cursor]').first();
			await expect(remoteCursor).toBeVisible({ timeout: 20_000 });

			const tip = await boxOf(remoteCursor);
			expect(tip.x).toBeGreaterThanOrEqual(guestTarget.x - TOLERANCE_PX);
			expect(tip.x).toBeLessThanOrEqual(guestTarget.x + guestTarget.width + TOLERANCE_PX);
			expect(tip.y).toBeGreaterThanOrEqual(guestTarget.y - TOLERANCE_PX);
			expect(tip.y).toBeLessThanOrEqual(guestTarget.y + guestTarget.height + TOLERANCE_PX);
		} finally {
			await guest.close();
		}
	});
});
