/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright support */
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

import { savePptxViaBackstage } from '../save-pptx';

export function requireCustomHostShell(): void {
	test.skip(
		!test.info().project.metadata.headless,
		'Custom host controls belong to the custom shell.',
	);
}

export async function expectHostOwnedShell(page: Page): Promise<void> {
	if (test.info().project.metadata.headless) {
		await expect(page.locator('[data-host-custom-shell]')).toBeVisible();
	}
}

/** Remote slide content can appear before the shell finishes loading its source. */
export async function waitForHostEditing(page: Page): Promise<void> {
	if (!test.info().project.metadata.headless) {
		return;
	}
	const status = page.getByRole('status', { name: 'Collaboration status', exact: true });
	if (await status.count()) {
		await expect(status).toContainText('Editable');
	}
}

/** Custom chrome owns Save; the full viewer still uses its actual File menu. */
export async function saveHostOwnedPresentation(page: Page): Promise<Download> {
	if (!test.info().project.metadata.headless) {
		return savePptxViaBackstage(page);
	}
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Save presentation', exact: true }).click();
	return download;
}

/** Route the neutral product cases to a standard viewer or custom host shell. */
export function hostOwnedSessionUrl(room: string, extra: Record<string, string>): string {
	const params = new URLSearchParams({
		externalSession: '1',
		room,
		server: process.env.PPTX_E2E_COLLAB_SERVER ?? 'ws://127.0.0.1:1234',
		name: 'Editor',
		headless: test.info().project.metadata.headless ? '1' : '0',
		...extra,
	});
	return `/?${params}`;
}
