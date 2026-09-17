/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/** Public host controls and real editor gestures over an external WebSocket session. */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { hostOwnedSessionUrl } from './support/host-owned-session';

const elements = (page: Page) => page.locator('[data-pptx-viewport] [data-pptx-element="true"]');
const state = (page: Page) => page.getByLabel('Host session state', { exact: true });
const shape = (page: Page, index = 6) =>
	page.locator(`[data-pptx-viewport] [data-element-id="ppt/slides/slide1.xml-shape-${index}"]`);

async function open(page: Page, room: string, extra: Record<string, string> = {}): Promise<void> {
	await page.goto(hostOwnedSessionUrl(room, extra));
	await expect(state(page)).toContainText('Host: connected', { timeout: 30_000 });
	await expect(elements(page).first()).toBeVisible({ timeout: 30_000 });
	const headlessSave = page.getByRole('button', { name: 'Save shared snapshot', exact: true });
	if (await headlessSave.count()) {
		await expect(headlessSave).toBeEnabled({ timeout: 30_000 });
	}
}

async function identity(page: Page): Promise<string> {
	const text = await state(page).innerText();
	const client = /client: (\d+)/u.exec(text)?.[1];
	expect(client).toBeDefined();
	return client!;
}

async function updateCount(page: Page): Promise<number> {
	return Number(/updates: (\d+)/u.exec(await state(page).innerText())?.[1]);
}

async function box(target: Locator) {
	const value = await target.boundingBox();
	expect(value).not.toBeNull();
	return value!;
}

async function drag(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
	const before = await box(target);
	const x = before.x + before.width / 2;
	const y = before.y + before.height / 2;
	await page.mouse.click(x, y);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y + dy, { steps: 8 });
	await page.mouse.up();
}

function geometry(target: Locator): Promise<number[]> {
	return target.evaluate((element) => {
		const style = getComputedStyle(element);
		return [style.left, style.top, style.width, style.height].map(Number.parseFloat);
	});
}

async function samePosition(first: Locator, second: Locator): Promise<void> {
	// Inspector and read-only chrome change each peer's fit scale. Compare
	// actual rendered slide-space geometry, not unrelated viewport origins.
	await expect
		.poll(async () => {
			const a = await geometry(first);
			const b = await geometry(second);
			return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
		})
		.toBeLessThan(0.05);
}

async function replaceText(page: Page, original: string, replacement: string): Promise<void> {
	await elements(page).filter({ hasText: original }).dblclick();
	const editor = page.locator('[data-inline-editor]').first();
	await expect(editor).toBeVisible();
	await editor.press('ControlOrMeta+A');
	await page.keyboard.type(replacement);
	await state(page).click();
}

function draftContains(page: Page, text: string): Promise<boolean> {
	return page
		.locator('[data-inline-editor], [data-pptx-viewport] [data-pptx-element="true"]')
		.evaluateAll(
			(nodes, expected) =>
				nodes.some((node) => {
					if (!(node instanceof HTMLElement) || !node.getClientRects().length) {
						return false;
					}
					if (getComputedStyle(node).visibility === 'hidden') {
						return false;
					}
					return (node instanceof HTMLTextAreaElement ? node.value : node.innerText).includes(
						expected,
					);
				}),
			text,
		);
}

async function saveSnapshot(
	page: Page,
	route: 'host' | 'file' = 'host',
	savedPath?: string,
): Promise<string> {
	let download;
	if (route === 'host') {
		const pending = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Save shared snapshot', exact: true }).click();
		download = await pending;
	} else {
		download = await savePptxViaBackstage(page);
	}
	if (savedPath) {
		await download.saveAs(savedPath);
	}
	const path = savedPath ?? (await download.path());
	expect(path).not.toBeNull();
	return path!;
}

test.use({ viewport: { width: 1440, height: 1000 } });

test.describe('host-owned collaboration', () => {
	test.setTimeout(90_000);

	test('publishes a startup deck when the host is synced before attachment', async ({
		page,
		browser,
		baseURL,
	}, info) => {
		const context = await browser.newContext({ baseURL });
		const peer = await context.newPage();
		const room = `external-ready-attach-${info.project.name}-${Date.now()}`;
		try {
			await open(page, room, { sample: '1', attachSynced: '1' });
			await expect(state(page)).toContainText('synced: true');
			await expect(state(page)).not.toContainText('updates: 0;');
			await replaceText(page, 'Product Overview', 'Seeded before peer attachment');
			await open(peer, room, { name: 'Peer', attachSynced: '1' });
			await expect(elements(peer)).toHaveCount(await elements(page).count());
			await expect(
				elements(peer).filter({ hasText: 'Seeded before peer attachment' }),
			).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('waits beyond the built-in grace period for host readiness', async ({ page }, info) => {
		await open(page, `external-wait-${info.project.name}-${Date.now()}`, {
			sample: '1',
			paused: '1',
		});
		await expect(state(page)).toContainText('synced: false');
		const client = await identity(page);
		await page.waitForTimeout(3_500);
		await expect(state(page)).toContainText('updates: 0;');
		const before = await geometry(shape(page));
		await drag(page, shape(page), 45, 30);
		expect(await geometry(shape(page))).toEqual(before);
		const title = await box(elements(page).filter({ hasText: 'Product Overview' }));
		await page.mouse.dblclick(title.x + title.width / 2, title.y + title.height / 2);
		await expect(page.locator('[data-inline-editor]')).toHaveCount(0);
		await page.getByRole('button', { name: 'Resume readiness', exact: true }).click();
		await expect(state(page)).toContainText('synced: true');
		await expect(state(page)).not.toContainText('updates: 0;');
		expect(await identity(page)).toBe(client);
		await page.screenshot({ path: info.outputPath('ready-after-explicit-resume.png') });
	});

	test('disconnected editors stay read-only and receive peer edits on reconnect', async ({
		page,
		browser,
		baseURL,
	}, info) => {
		const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
		const peer = await context.newPage();
		const room = `external-reconnect-${info.project.name}-${Date.now()}`;
		try {
			await open(page, room, { sample: '1' });
			await open(peer, room, { name: 'Peer' });
			await expect(elements(peer)).toHaveCount(await elements(page).count());
			const client = await identity(page);
			await page.getByRole('button', { name: 'Disconnect session', exact: true }).click();
			await expect(state(page)).toContainText('Host: disconnected; synced: false');
			const before = await geometry(shape(page));
			await drag(page, shape(page), 45, 30);
			expect(await geometry(shape(page))).toEqual(before);
			const title = await box(elements(page).filter({ hasText: 'Product Overview' }));
			await page.mouse.dblclick(title.x + title.width / 2, title.y + title.height / 2);
			await expect(page.locator('[data-inline-editor]')).toHaveCount(0);
			await replaceText(peer, 'Product Overview', 'Peer changed while disconnected');
			await page.getByRole('button', { name: 'Reconnect session', exact: true }).click();
			await expect(state(page)).toContainText('Host: connected; synced: true');
			await expect(
				elements(page).filter({ hasText: 'Peer changed while disconnected' }),
			).toBeVisible();
			expect(await identity(page)).toBe(client);
			await drag(page, shape(page), 45, 30);
			await samePosition(shape(page), shape(peer));
			expect(await geometry(shape(page))).not.toEqual(before);
		} finally {
			await context.close();
		}
	});

	test('an active inline draft survives host readiness loss without a blur', async ({
		page,
		browser,
		baseURL,
	}, info) => {
		const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
		const peer = await context.newPage();
		const room = `external-active-draft-${info.project.name}-${Date.now()}`;
		const draft = 'Draft written before readiness paused';
		const blockedInput = 'UNREADY';
		try {
			await open(page, room, { sample: '1' });
			await open(peer, room, { name: 'Peer' });
			await expect(elements(peer)).toHaveCount(await elements(page).count());
			await elements(page).filter({ hasText: 'Product Overview' }).dblclick();
			const editor = page.locator('[data-inline-editor]').first();
			await expect(editor).toBeFocused();
			const pause = await box(page.getByRole('button', { name: 'Pause readiness', exact: true }));
			await page.mouse.move(pause.x + pause.width / 2, pause.y + pause.height / 2);
			await editor.press('ControlOrMeta+A');
			await page.keyboard.insertText('Draft written before ');
			await page.keyboard.insertText('readiness paused');
			// This host control preserves focus so blur cannot flush the draft first.
			// The second input may still be inside the live-patch throttle window.
			await page.mouse.down();
			await page.mouse.up();
			await expect(state(page)).toContainText('synced: false');
			await expect.poll(() => draftContains(page, draft)).toBe(true);
			await expect
				.poll(() =>
					page.locator('[data-inline-editor]').evaluateAll((nodes) =>
						nodes.every((node) => {
							if (node.closest('[inert]')) {
								return true;
							}
							if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
								return node.readOnly || node.disabled;
							}
							return node instanceof HTMLElement && !node.isContentEditable;
						}),
					),
				)
				.toBe(true);
			// Keep the browser's current focus: a real host readiness change must
			// stop further typing, even when an inline draft stays mounted.
			await page.keyboard.type(blockedInput);
			await expect.poll(() => draftContains(page, blockedInput)).toBe(false);
			await expect.poll(() => draftContains(page, draft)).toBe(true);
			await page.getByRole('button', { name: 'Resume readiness', exact: true }).click();
			await expect(state(page)).toContainText('synced: true');
			await state(page).click();
			await expect(elements(page).filter({ hasText: draft })).toBeVisible();
			await expect(elements(peer).filter({ hasText: draft })).toBeVisible();
			await expect(elements(page).filter({ hasText: blockedInput })).toHaveCount(0);
			await expect(elements(peer).filter({ hasText: blockedInput })).toHaveCount(0);
			const saved = await saveSnapshot(page, 'file', info.outputPath('active-draft.pptx'));
			const reopened = await context.newPage();
			await reopened.goto('/');
			await reopened.locator('#file-input').setInputFiles(saved);
			await expect(elements(reopened).filter({ hasText: draft })).toBeVisible({ timeout: 30_000 });
			await expect(elements(reopened).filter({ hasText: blockedInput })).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test('separate peers exchange simultaneous moves and a real text edit', async ({
		page,
		browser,
		baseURL,
	}, info) => {
		const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
		const peer = await context.newPage();
		const room = `external-edits-${info.project.name}-${Date.now()}`;
		try {
			await open(page, room, { sample: '1' });
			await open(peer, room, { name: 'Peer' });
			await expect(elements(peer)).toHaveCount(await elements(page).count());
			const beforeA = await box(shape(page, 6));
			const beforeB = await box(shape(peer, 8));
			await Promise.all([drag(page, shape(page, 6), 45, 30), drag(peer, shape(peer, 8), 35, 25)]);
			await expect.poll(async () => (await box(shape(page, 6))).x - beforeA.x).toBeGreaterThan(35);
			await expect.poll(async () => (await box(shape(peer, 8))).x - beforeB.x).toBeGreaterThan(25);
			await samePosition(shape(page, 6), shape(peer, 6));
			await samePosition(shape(page, 8), shape(peer, 8));
			await Promise.all([
				replaceText(page, 'Product Overview', 'Shared browser edit'),
				replaceText(peer, 'Q2 2026', 'Peer text change'),
			]);
			await page.screenshot({ path: info.outputPath('editing-peer.png') });
			await peer.screenshot({ path: info.outputPath('receiving-peer.png') });
			await expect(elements(peer).filter({ hasText: 'Shared browser edit' })).toBeVisible();
			await expect(elements(page).filter({ hasText: 'Peer text change' })).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('remount keeps the host session alive and adopts edits received while unmounted', async ({
		page,
		browser,
		baseURL,
	}, info) => {
		const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
		const peer = await context.newPage();
		const room = `external-remount-${info.project.name}-${Date.now()}`;
		try {
			await open(page, room, { sample: '1' });
			await open(peer, room, { name: 'Peer' });
			await expect(elements(peer)).toHaveCount(await elements(page).count());
			const client = await identity(page);
			const before = await updateCount(page);
			await page.getByRole('button', { name: 'Unmount editor', exact: true }).click();
			await expect(elements(page)).toHaveCount(0);
			await expect(state(page)).toContainText('editor: unmounted');
			await drag(peer, shape(peer), 55, 35);
			await expect.poll(() => updateCount(page)).toBeGreaterThan(before);
			await expect(state(page)).toContainText('Host: connected; synced: true');
			await expect(state(page)).toContainText('host data: retained');
			await page.getByRole('button', { name: 'Remount editor', exact: true }).click();
			await expect(shape(page)).toBeVisible();
			expect(await identity(page)).toBe(client);
			await samePosition(shape(page), shape(peer));
			await page.screenshot({ path: info.outputPath('remounted-editor.png') });
		} finally {
			await context.close();
		}
	});

	for (const readOnly of [
		{
			name: 'read-only peers receive changes without publishing edits',
			role: 'viewer',
			editable: '1',
		},
		{
			name: 'host-disabled editing receives changes without enabling edits',
			role: 'collaborator',
			editable: '0',
		},
	]) {
		test(readOnly.name, async ({ page, browser, baseURL }, info) => {
			const context = await browser.newContext({
				baseURL,
				viewport: { width: 1440, height: 1000 },
			});
			const peer = await context.newPage();
			const room = `external-readonly-${readOnly.editable}-${info.project.name}-${Date.now()}`;
			try {
				await open(page, room, { sample: '1' });
				await open(peer, room, {
					name: 'Reader',
					role: readOnly.role,
					editable: readOnly.editable,
				});
				await expect(elements(peer)).toHaveCount(await elements(page).count());
				await expect
					.poll(async () => (await geometry(shape(peer))).every(Number.isFinite))
					.toBe(true);
				const before = await geometry(shape(peer));
				await drag(peer, shape(peer), 50, 30);
				expect(await geometry(shape(peer))).toEqual(before);
				const text = await box(elements(peer).filter({ hasText: 'Product Overview' }));
				// A read-only element may intentionally have pointer-events:none.
				// Send an actual user double-click, not a forced locator action.
				await peer.mouse.dblclick(text.x + text.width / 2, text.y + text.height / 2);
				await expect(peer.locator('[data-inline-editor]')).toHaveCount(0);
				await drag(page, shape(page), 55, 35);
				await samePosition(shape(page), shape(peer));
				await replaceText(page, 'Product Overview', 'Updated for read-only peer');
				await expect(
					elements(peer).filter({ hasText: 'Updated for read-only peer' }),
				).toBeVisible();
				await peer.screenshot({ path: info.outputPath('read-only-peer.png') });
				if (readOnly.editable === '0') {
					const path = await saveSnapshot(peer);
					const reopened = await browser.newPage({
						baseURL,
						viewport: { width: 1440, height: 1000 },
					});
					try {
						await reopened.goto('/');
						await reopened.locator('#file-input').setInputFiles(path);
						await expect(
							elements(reopened).filter({ hasText: 'Updated for read-only peer' }),
						).toBeVisible({ timeout: 30_000 });
						// Shape parsing rounds OpenXML EMUs to whole slide pixels.
						// Keep live-peer geometry strict, but match that reopen contract.
						expect(await geometry(shape(reopened))).toEqual(
							(await geometry(shape(peer))).map(Math.round),
						);
						await reopened.screenshot({ path: info.outputPath('read-only-snapshot.png') });
					} finally {
						await reopened.close();
					}
				}
			} finally {
				await context.close();
			}
		});
	}

	for (const route of ['host', 'file'] as const) {
		test(`a collaborative ${route} save reopens with peer edits`, async ({
			page,
			browser,
			baseURL,
		}, info) => {
			const context = await browser.newContext({
				baseURL,
				viewport: { width: 1440, height: 1000 },
			});
			const peer = await context.newPage();
			const reopenedContext = await browser.newContext({
				baseURL,
				viewport: { width: 1440, height: 1000 },
			});
			const reopened = await reopenedContext.newPage();
			const room = `external-save-${info.project.name}-${Date.now()}`;
			try {
				await open(page, room, { sample: '1' });
				await open(peer, room, { name: 'Peer' });
				await expect(elements(peer)).toHaveCount(await elements(page).count());
				await replaceText(peer, 'Product Overview', 'Saved collaborative content');
				await expect(
					elements(page).filter({ hasText: 'Saved collaborative content' }),
				).toBeVisible();
				const path = await saveSnapshot(page, route);
				await reopened.goto('/');
				await reopened.locator('#file-input').setInputFiles(path);
				await expect(
					elements(reopened).filter({ hasText: 'Saved collaborative content' }),
				).toBeVisible({ timeout: 30_000 });
				await reopened.screenshot({ path: info.outputPath('reopened-snapshot.png') });
			} finally {
				await context.close();
				await reopenedContext.close();
			}
		});
	}
});
