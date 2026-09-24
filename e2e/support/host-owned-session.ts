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
export async function waitForHostEditing(
	page: Page,
	scenario: Record<string, string>,
): Promise<void> {
	if (
		!test.info().project.metadata.headless ||
		scenario.paused === '1' ||
		scenario.role === 'viewer' ||
		scenario.editable === '0'
	) {
		return;
	}
	// Every custom-shell demo renders the same localised readout (shared
	// `describeCollaborationShellState`) under this label. No escape hatch when
	// it is missing: three demos once lacked it, this silently returned, and a
	// vanilla peer double-clicked before its edit gate opened.
	const status = page.getByRole('status', { name: 'Collaboration status', exact: true });
	await expect(status).toContainText('Editable', { timeout: 30_000 });
}

/** Wait for the public edit gate before opening a connected text editor. */
export async function waitForCollaborativeEditing(page: Page): Promise<void> {
	if (test.info().project.metadata.headless) {
		await expectHostOwnedShell(page);
		await waitForHostEditing(page, {});
		return;
	}
	await expect(page.getByRole('button', { name: 'New Slide', exact: true })).toBeEnabled();
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
		server:
			process.env.PPTX_E2E_COLLAB_SERVER ??
			`ws://127.0.0.1:${1234 + Number(process.env.PPTX_E2E_PORT_OFFSET ?? 0)}`,
		name: 'Editor',
		headless: test.info().project.metadata.headless ? '1' : '0',
		...extra,
	});
	return `/?${params}`;
}
