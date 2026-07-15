/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Framework-neutral real-time collaboration sync.
 *
 * Every demo accepts `?room=<id>&transport=webrtc` and mounts the same shared
 * Yjs collaboration model. Two pages in one browser context join a unique
 * serverless room and expose the same connected-presence state. This keeps
 * the product test independent from the
 * documentation demos' websocket relay and Share-dialog presentation.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openCollaborativeDeck(page: Page, roomId: string, name: string): Promise<void> {
	await page.goto(`/?room=${encodeURIComponent(roomId)}&transport=webrtc&name=${name}`);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 20_000 });
}

function collaborationReady(page: Page) {
	return page
		.locator('[aria-label*="Collaboration:"][aria-label*="Connected"]')
		.or(
			page
				.getByRole('button', { name: 'Share', exact: true })
				.filter({ hasText: /Sharing\s*\(\d+\)/u }),
		)
		.filter({ visible: true })
		.first();
}

test.describe('collaboration sync', () => {
	test.setTimeout(90_000);

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
});
