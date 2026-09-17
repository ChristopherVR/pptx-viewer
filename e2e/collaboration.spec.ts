/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Framework-neutral real-time collaboration sync.
 *
 * Every demo accepts `?room=<id>&transport=webrtc` and mounts the same shared
 * Yjs collaboration model. Two pages in one browser context join a unique
 * serverless room and expose the same connected-presence state. This keeps
 * the product test independent from the
 * documentation demos' websocket relay and Share-dialog presentation.
 *
 * Beyond presence, an actual EDIT must travel: the host drags an element and
 * the peer's copy of that element (matched by `data-element-id`) has to move
 * by the same amount. Overlay placement (cursors/selection boxes) is covered
 * separately by `collab-presence-geometry.spec.ts`.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openCollaborativeDeck(
	page: Page,
	roomId: string,
	name: string,
	sample = false,
): Promise<void> {
	const sampleParam = sample ? 'sample=1&' : '';
	await page.goto(
		`/?${sampleParam}room=${encodeURIComponent(roomId)}&transport=webrtc&name=${name}`,
	);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 20_000 });
}

function collaborationReady(page: Page) {
	return page.getByRole('status', { name: 'Collaboration: Connected', exact: true });
}

function slideElements(page: Page) {
	return page.locator('[data-pptx-viewport] [data-pptx-element="true"]');
}

async function beginTextEdit(page: Page, original: string, replacement: string) {
	await slideElements(page).filter({ hasText: original }).dblclick();
	const editor = page.locator('[data-inline-editor]').first();
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+A');
	await page.keyboard.type(replacement);
	return editor;
}

test.describe('collaboration sync', () => {
	test.setTimeout(120_000);

	test('two peers connect through the shared WebRTC room', async ({ page }, testInfo) => {
		const peer = await page.context().newPage();
		const roomId = `e2e-${testInfo.project.name}-${Date.now()}`;

		try {
			await Promise.all([
				openCollaborativeDeck(page, roomId, 'host'),
				openCollaborativeDeck(peer, roomId, 'peer'),
			]);

			await expect(collaborationReady(page)).toBeVisible({ timeout: 15_000 });
			await expect(collaborationReady(peer)).toBeVisible({ timeout: 15_000 });
		} finally {
			await peer.close();
		}
	});

	test('a host drag is observed by the peer', async ({ page }, testInfo) => {
		const peer = await page.context().newPage();
		const roomId = `e2e-edit-${testInfo.project.name}-${Date.now()}`;
		const dragBy = { x: 80, y: 50 };

		try {
			// The host seeds the room with the sample deck; the peer joins empty and
			// receives the deck through late-joiner sync.
			await openCollaborativeDeck(page, roomId, 'host', true);
			await openCollaborativeDeck(peer, roomId, 'peer');
			await expect(collaborationReady(page)).toBeVisible({ timeout: 15_000 });
			await expect(collaborationReady(peer)).toBeVisible({ timeout: 15_000 });

			const hostCount = await slideElements(page).count();
			expect(hostCount).toBeGreaterThan(0);
			await expect
				.poll(async () => slideElements(peer).count(), { timeout: 30_000 })
				.toBe(hostCount);

			// Pick a mid-slide element and pair it with the peer's copy by id.
			const target = slideElements(page).nth(Math.min(6, hostCount - 1));
			const elementId = await target.getAttribute('data-element-id');
			expect(elementId).not.toBeNull();
			const peerTarget = peer.locator(`[data-pptx-viewport] [data-element-id="${elementId}"]`);
			const peerBefore = await peerTarget.boundingBox();
			expect(peerBefore).not.toBeNull();

			// Host: select, then drag the element.
			const box = (await target.boundingBox())!;
			const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
			await page.bringToFront();
			await page.mouse.click(centre.x, centre.y);
			await page.waitForTimeout(300);
			await page.mouse.move(centre.x, centre.y);
			await page.mouse.down();
			for (let step = 1; step <= 8; step++) {
				await page.mouse.move(centre.x + (dragBy.x * step) / 8, centre.y + (dragBy.y * step) / 8);
			}
			await page.mouse.up();

			// The host's own copy moved (sanity check that the drag landed) ...
			const hostAfter = (await page
				.locator(`[data-pptx-viewport] [data-element-id="${elementId}"]`)
				.boundingBox())!;
			const hostDelta = { x: hostAfter.x - box.x, y: hostAfter.y - box.y };
			expect(Math.abs(hostDelta.x - dragBy.x)).toBeLessThanOrEqual(5);
			expect(Math.abs(hostDelta.y - dragBy.y)).toBeLessThanOrEqual(5);

			// ... and the peer observes the same geometry change. Both pages share
			// one viewport size, so their stage scales match and the on-screen
			// delta is comparable directly (tolerance for rounding).
			await expect
				.poll(
					async () => {
						const now = await peerTarget.boundingBox();
						return now ? Math.round(now.x - peerBefore!.x) : 0;
					},
					{ timeout: 20_000 },
				)
				.toBeGreaterThan(dragBy.x - 6);
			const peerAfter = (await peerTarget.boundingBox())!;
			expect(Math.abs(peerAfter.x - peerBefore!.x - hostDelta.x)).toBeLessThanOrEqual(3);
			expect(Math.abs(peerAfter.y - peerBefore!.y - hostDelta.y)).toBeLessThanOrEqual(3);
		} finally {
			await peer.close();
		}
	});

	test('different text boxes retain concurrent edits during a remote update', async ({
		page,
	}, testInfo) => {
		const peer = await page.context().newPage();
		const roomId = `e2e-text-${testInfo.project.name}-${Date.now()}`;
		try {
			await openCollaborativeDeck(page, roomId, 'host', true);
			await openCollaborativeDeck(peer, roomId, 'peer');
			await expect(collaborationReady(page)).toBeVisible({ timeout: 15_000 });
			await expect(collaborationReady(peer)).toBeVisible({ timeout: 15_000 });
			await expect(slideElements(peer).filter({ hasText: 'Q2 2026' })).toBeVisible();

			const [, peerEditor] = await Promise.all([
				beginTextEdit(page, 'Product Overview', 'Shared browser edit'),
				beginTextEdit(peer, 'Q2 2026', 'Peer text'),
			]);
			// Commit one box while the other is still being edited. The incoming
			// repaint must preserve the other editor, its focus, and its draft.
			await collaborationReady(page).click();
			await expect(slideElements(peer).filter({ hasText: 'Shared browser edit' })).toBeVisible();
			await expect(peerEditor).toBeFocused();
			await peer.keyboard.type(' continued');
			await collaborationReady(peer).click();

			for (const participant of [page, peer]) {
				await expect(
					slideElements(participant).filter({ hasText: 'Shared browser edit' }),
				).toBeVisible();
				await expect(
					slideElements(participant).filter({ hasText: 'Peer text continued' }),
				).toBeVisible();
			}
		} finally {
			await peer.close();
		}
	});
});
