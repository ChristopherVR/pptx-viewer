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
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import { fixture } from './support/deck';
import {
	hostOwnedSessionUrl,
	saveHostOwnedPresentation,
	waitForCollaborativeEditing,
} from './support/host-owned-session';
import { extractElementBlock, readZipPartText } from './support/pptx-xml';

async function paragraphFormattingDeck() {
	const zip = await JSZip.loadAsync(await readFile(fixture('text-layout.pptx')));
	const part = 'ppt/slides/slide1.xml';
	const xml = await zip.file(part)!.async('string');
	const anchor = '<a:lnSpc><a:spcPct val="150000"/></a:lnSpc>';
	expect(xml.split(anchor)).toHaveLength(2);
	zip.file(
		part,
		xml.replace(
			anchor,
			`${anchor}<a:spcBef><a:spcPts val="600"/></a:spcBef><a:spcAft><a:spcPts val="1200"/></a:spcAft>`,
		),
	);
	return {
		name: 'paragraph-formatting.pptx',
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		buffer: await zip.generateAsync({ type: 'nodebuffer' }),
	};
}

async function exportedParagraphProperties(page: Page, outputPath: string) {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	const backstage = page.getByRole('dialog', { name: 'File', exact: true });
	await backstage.getByRole('button', { name: 'Export', exact: true }).click();
	const download = page.waitForEvent('download');
	await backstage.getByRole('button', { name: /export as json/iu }).click();
	await (await download).saveAs(outputPath);
	const document = JSON.parse(await readFile(outputPath, 'utf8')) as {
		slides: {
			elements: {
				text?: string;
				textSegments?: { paragraphProperties?: Record<string, unknown> }[];
			}[];
		}[];
	};
	await page.keyboard.press('Escape');
	await expect(backstage).toBeHidden();
	const elements = document.slides.flatMap((slide) => slide.elements);
	const properties = (prefix: string) =>
		elements
			.find((element) => element.text?.startsWith(prefix))
			?.textSegments?.flatMap((segment) =>
				segment.paragraphProperties ? [segment.paragraphProperties] : [],
			);
	return { bullet: properties('Alpha'), spacing: properties('Loose spacing') };
}

async function consecutiveBreakDeck() {
	const zip = await JSZip.loadAsync(await readFile(fixture('text-layout.pptx')));
	const part = 'ppt/slides/slide1.xml';
	const xml = await zip.file(part)!.async('string');
	const anchor = '<a:t>Bulleted item</a:t></a:r>';
	expect(xml.split(anchor)).toHaveLength(2);
	zip.file(part, xml.replace(anchor, `${anchor}<a:br/><a:br/><a:r><a:t>AFTER</a:t></a:r>`));
	return {
		name: 'consecutive-breaks.pptx',
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		buffer: await zip.generateAsync({ type: 'nodebuffer' }),
	};
}

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

type CollaborationMode = 'built-in' | 'external';

async function openSameTextPeers(page: Page, mode: CollaborationMode) {
	const peer = await page.context().newPage();
	const participants = [page, peer];
	const room = `same-text-${mode}-${randomUUID()}`;
	try {
		for (const [index, participant] of participants.entries()) {
			if (mode === 'external') {
				await participant.goto(
					hostOwnedSessionUrl(room, { name: `Peer${index}`, sample: index === 0 ? '1' : '0' }),
				);
				await expect(participant.getByLabel('Host session state', { exact: true })).toContainText(
					'Host: connected; synced: true',
					{ timeout: 30_000 },
				);
			} else {
				await openCollaborativeDeck(participant, room, `Peer${index}`, index === 0);
				await expect(collaborationReady(participant)).toBeVisible({ timeout: 30_000 });
			}
			await expect(
				slideElements(participant).filter({ hasText: 'Product Overview' }),
			).toBeVisible();
			await waitForCollaborativeEditing(participant);
		}
		const id = await slideElements(page)
			.filter({ hasText: 'Product Overview' })
			.getAttribute('data-element-id');
		expect(id).not.toBeNull();
		const targets = participants.map((participant) =>
			participant.locator(`[data-pptx-viewport] [data-element-id="${id}"]`),
		);
		await Promise.all(targets.map((target) => target.dblclick()));
		const editors = participants.map((participant) =>
			participant.locator('[data-inline-editor]').first(),
		);
		for (const editor of editors) {
			await expect(editor).toBeVisible();
			await expect(editor).toBeFocused();
		}
		return { peer, participants, targets, editors };
	} catch (error) {
		await peer.close();
		throw error;
	}
}

/** Read only the visible editor DOM, never the collaboration document. */
async function inlineText(editor: Locator): Promise<string> {
	return editor.evaluate((element) =>
		element instanceof HTMLTextAreaElement ? element.value : (element as HTMLElement).innerText,
	);
}

async function inlineCaret(editor: Locator): Promise<number | null> {
	return editor.evaluate((element) => {
		if (element instanceof HTMLTextAreaElement) {
			return element.selectionStart === element.selectionEnd ? element.selectionStart : null;
		}
		const selection = element.ownerDocument.getSelection();
		if (
			!selection?.isCollapsed ||
			!selection.anchorNode ||
			!element.contains(selection.anchorNode)
		) {
			return null;
		}
		const range = element.ownerDocument.createRange();
		range.selectNodeContents(element);
		range.setEnd(selection.anchorNode, selection.anchorOffset);
		return range.toString().length;
	});
}

async function expectInlineText(editors: Locator[], expected: string): Promise<void> {
	for (const editor of editors) {
		await expect.poll(() => inlineText(editor)).toBe(expected);
	}
}

async function verifySavedText(page: Page, saved: string, expected: string): Promise<void> {
	const xml = await readZipPartText(await readFile(saved), 'ppt/slides/slide1.xml');
	const texts = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>([\s\S]*?)<\/p:sp>/gu)].map((shape) =>
		[...shape[1].matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/gu)]
			.map((paragraph) =>
				[...paragraph[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br(?:\s[^>]*)?\s*\/>/gu)]
					.map((run) => run[1] ?? '\n')
					.join(''),
			)
			.join('\n'),
	);
	expect(texts.filter((text) => text.includes('Product Overview'))).toEqual([expected]);
	const reopened = await page.context().newPage();
	try {
		await reopened.goto('/');
		await reopened.locator('#file-input').setInputFiles(saved);
		await expect(slideElements(reopened).filter({ hasText: 'Product Overview' })).toHaveText(
			expected,
			{ useInnerText: true },
		);
	} finally {
		await reopened.close();
	}
}

async function saveAndReopenText(page: Page, saved: string, expected: string): Promise<void> {
	await (await saveHostOwnedPresentation(page)).saveAs(saved);
	await verifySavedText(page, saved, expected);
}

test.describe('collaboration sync', () => {
	test.setTimeout(120_000);

	for (const mode of ['built-in', 'external'] as const) {
		for (const order of [
			[0, 1],
			[1, 0],
		]) {
			test(`same text box retains live text and caret with ${mode} and blur order ${order.join('-')}`, async ({
				page,
			}, testInfo) => {
				const { peer, participants, targets, editors } = await openSameTextPeers(page, mode);
				const expected = 'ALPHA Product Overview OMEGA';
				try {
					await Promise.all([editors[0].press('Home'), editors[1].press('End')]);
					await Promise.all([page.keyboard.type('ALPHA '), peer.keyboard.type(' OMEGA')]);
					await expectInlineText(editors, expected);
					await expect.poll(() => inlineCaret(editors[0])).toBe(6);
					await expect.poll(() => inlineCaret(editors[1])).toBe(expected.length);
					// Repeated characters must use the active local baseline, not delete
					// text already received from the other participant.
					await page.keyboard.type('111');
					await expectInlineText(editors, 'ALPHA 111Product Overview OMEGA');
					await editors[0].press('Backspace');
					await editors[0].press('Backspace');
					await editors[0].press('Backspace');
					await expectInlineText(editors, expected);
					await page.keyboard.type('222');
					await editors[0].press('ArrowLeft');
					await editors[0].press('ArrowLeft');
					await editors[0].press('ArrowLeft');
					await editors[0].press('Delete');
					await editors[0].press('Delete');
					await editors[0].press('Delete');
					await expectInlineText(editors, expected);
					for (const index of order) {
						await participants[index]
							.locator('[data-pptx-viewport]')
							.getByRole('group', { name: 'Project Atlas', exact: true })
							.click();
						await expect(editors[index]).toHaveCount(0);
					}
					for (const target of targets) {
						await expect(target).toHaveText(expected);
					}
					await saveAndReopenText(page, testInfo.outputPath('same-text.pptx'), expected);
				} finally {
					await peer.close();
				}
			});
		}

		test(`same text box keeps Unicode and Enter through ${mode} Save`, async ({
			page,
		}, testInfo) => {
			const { peer, editors } = await openSameTextPeers(page, mode);
			const expected = '🙂 Product Overview\n111';
			try {
				await Promise.all([editors[0].press('Home'), editors[1].press('End')]);
				await page.keyboard.insertText('🙂 ');
				await expectInlineText(editors, '🙂 Product Overview');
				await editors[1].press('Enter');
				await peer.keyboard.type('111');
				await expectInlineText(editors, expected);
				// This is the ordinary File > Save flow while both drafts are active.
				await saveAndReopenText(peer, testInfo.outputPath('same-text-enter.pptx'), expected);
			} finally {
				await peer.close();
			}
		});

		test(`same text box preserves browser composition during ${mode} remote editing`, async ({
			page,
		}, testInfo) => {
			const { peer, editors } = await openSameTextPeers(page, mode);
			const input = await page.context().newCDPSession(page);
			let downloads = 0;
			const countDownload = () => {
				downloads += 1;
			};
			page.on('download', countDownload);
			try {
				await Promise.all([editors[0].press('End'), editors[1].press('Home')]);
				// Chromium's input pipeline emits composition and beforeinput events.
				// This does not substitute for a native operating-system IME test.
				await input.send('Input.imeSetComposition', {
					text: 'に',
					selectionStart: 1,
					selectionEnd: 1,
				});
				await expect.poll(() => inlineText(editors[0])).toContain('に');
				await peer.keyboard.type('ALPHA ');
				await expect(editors[0]).toBeFocused();
				await expect.poll(() => inlineText(editors[0])).toContain('に');
				if (mode === 'external') {
					await page.getByRole('button', { name: 'Save shared snapshot', exact: true }).click();
					await expect(editors[0]).toBeFocused();
					await expect.poll(() => inlineText(editors[0])).toContain('に');
					// Unsupported composition may reject or return no content, but
					// must not download a file with stale or unaccepted text.
					expect(downloads).toBe(0);
				}
				await input.send('Input.imeSetComposition', {
					text: '日本',
					selectionStart: 2,
					selectionEnd: 2,
				});
				await input.send('Input.insertText', { text: '日本' });
				const expected = 'ALPHA Product Overview日本';
				await expectInlineText(editors, expected);
				await saveAndReopenText(page, testInfo.outputPath('same-text-composition.pptx'), expected);
				expect(downloads).toBe(1);
			} finally {
				page.off('download', countDownload);
				await input.detach();
				await peer.close();
			}
		});
	}

	test('same text box pending host snapshot retains live remote text without blur', async ({
		page,
	}, testInfo) => {
		const { peer, editors } = await openSameTextPeers(page, 'external');
		const expected = 'ALPHA Product Overview OMEGA';
		try {
			await Promise.all([editors[0].press('Home'), editors[1].press('End')]);
			await page.keyboard.type('ALPHA ');
			await expectInlineText(editors, 'ALPHA Product Overview');
			await peer.keyboard.type(' OMEGA');
			await expectInlineText(editors, expected);
			const download = page.waitForEvent('download');
			await page.getByRole('button', { name: 'Save shared snapshot', exact: true }).click();
			const saved = testInfo.outputPath('same-text-pending.pptx');
			await (await download).saveAs(saved);
			await expect(editors[0]).toBeFocused();
			await expectInlineText(editors, expected);
			await verifySavedText(page, saved, expected);
			// Preventing pointer-down blur must not prevent keyboard activation.
			const keyboardDownload = page.waitForEvent('download');
			await page.getByRole('button', { name: 'Save shared snapshot', exact: true }).focus();
			await page.keyboard.press('Enter');
			const keyboardSaved = testInfo.outputPath('same-text-keyboard-save.pptx');
			await (await keyboardDownload).saveAs(keyboardSaved);
			await verifySavedText(page, keyboardSaved, expected);
		} finally {
			await peer.close();
		}
	});

	test('same text box accepted draft survives readiness loss and does not replay on resume', async ({
		page,
	}, testInfo) => {
		const { peer, participants, targets, editors } = await openSameTextPeers(page, 'external');
		try {
			await editors[0].press('Home');
			await page.keyboard.type('ALPHA ');
			await expectInlineText(editors, 'ALPHA Product Overview');
			await page.getByRole('button', { name: 'Pause readiness', exact: true }).click();
			await expect(page.getByLabel('Host session state', { exact: true })).toContainText(
				'synced: false',
			);
			await expect
				.poll(() =>
					page
						.locator('[data-inline-editor]')
						.evaluateAll((elements) =>
							elements.every((element) =>
								element instanceof HTMLTextAreaElement
									? element.readOnly || element.disabled
									: !(element as HTMLElement).isContentEditable ||
										Boolean(element.closest('[inert]')),
							),
						),
				)
				.toBe(true);
			await expect(targets[0]).toHaveText('ALPHA Product Overview');
			await expect(targets[0]).toBeVisible();
			await page.keyboard.type('UNREADY');
			await editors[1].press('End');
			await peer.keyboard.type(' OMEGA');
			await peer
				.locator('[data-pptx-viewport]')
				.getByRole('group', { name: 'Project Atlas', exact: true })
				.click();
			const expected = 'ALPHA Product Overview OMEGA';
			await expect(targets[1]).toHaveText(expected);
			await saveAndReopenText(peer, testInfo.outputPath('same-text-readiness.pptx'), expected);
			await page.getByRole('button', { name: 'Resume readiness', exact: true }).click();
			await expect(page.getByLabel('Host session state', { exact: true })).toContainText(
				'synced: true',
			);
			for (const target of targets) {
				await expect(target).toHaveText(expected);
			}
			// Reopening and closing the local editor must not commit its stale pre-pause draft.
			await targets[0].dblclick();
			await expectInlineText([page.locator('[data-inline-editor]').first()], expected);
			await participants[0]
				.locator('[data-pptx-viewport]')
				.getByRole('group', { name: 'Project Atlas', exact: true })
				.click();
			for (const target of targets) {
				await expect(target).toHaveText(expected);
			}
		} finally {
			await peer.close();
		}
	});

	test('paragraph formatting survives peer sync and Save', async ({ page }, testInfo) => {
		const peer = await page.context().newPage();
		const roomId = `e2e-paragraphs-${testInfo.project.name}-${Date.now()}`;
		const expected = {
			bullet: [{ paragraphMarginLeft: 36, paragraphIndent: -36 }],
			spacing: [{ lineSpacing: 1.5, paragraphSpacingBefore: 8, paragraphSpacingAfter: 16 }],
		};
		try {
			await openCollaborativeDeck(page, roomId, 'host', true);
			await expect(collaborationReady(page)).toBeVisible({ timeout: 15_000 });
			await page
				.getByRole('toolbar', { name: 'Presentation toolbar' })
				.getByRole('tab', { name: 'File', exact: true })
				.click();
			const backstage = page.getByRole('dialog', { name: 'File', exact: true });
			await backstage.getByRole('button', { name: 'Open', exact: true }).click();
			const chooser = page.waitForEvent('filechooser');
			await backstage.getByRole('button', { name: /browse this device/iu }).click();
			await (await chooser).setFiles(await paragraphFormattingDeck());
			await expect(slideElements(page).filter({ hasText: 'Alpha' })).toBeVisible();
			expect(
				await exportedParagraphProperties(page, testInfo.outputPath('host-before-join.json')),
			).toEqual(expected);
			await openCollaborativeDeck(peer, roomId, 'peer');
			await expect(collaborationReady(peer)).toBeVisible({ timeout: 15_000 });
			await expect(slideElements(peer).filter({ hasText: 'Alpha' })).toBeVisible();
			for (const [index, participant] of [peer, page].entries()) {
				expect(
					await exportedParagraphProperties(
						participant,
						testInfo.outputPath(`participant-${index}.json`),
					),
				).toEqual(expected);
				const saved = testInfo.outputPath(`paragraphs-${index}.pptx`);
				await (await savePptxViaBackstage(participant)).saveAs(saved);
				const xml = await readZipPartText(await readFile(saved), 'ppt/slides/slide1.xml');
				const bullet = extractElementBlock(xml, 'p:sp', 'RunsAndBlanks');
				expect(bullet).toContain('marL="342900"');
				expect(bullet).toContain('indent="-342900"');
				const spacing = extractElementBlock(xml, 'p:sp', 'LooseSpacing');
				expect(spacing).toContain('<a:spcPct val="150000"');
				expect(spacing).toContain('<a:spcBef><a:spcPts val="600"');
				expect(spacing).toContain('<a:spcAft><a:spcPts val="1200"');
				const reopened = await page.context().newPage();
				try {
					await reopened.goto('/');
					await reopened.locator('#file-input').setInputFiles(saved);
					await expect(slideElements(reopened).filter({ hasText: 'Alpha' })).toBeVisible();
					expect(
						await exportedParagraphProperties(
							reopened,
							testInfo.outputPath(`reopened-${index}.json`),
						),
					).toEqual(expected);
				} finally {
					await reopened.close();
				}
			}
		} finally {
			await peer.close();
		}
	});

	test('consecutive soft breaks survive peer sync and Save', async ({ page }, testInfo) => {
		const peer = await page.context().newPage();
		const roomId = `e2e-breaks-${testInfo.project.name}-${Date.now()}`;
		const target = (participant: Page) => slideElements(participant).filter({ hasText: 'Alpha' });
		try {
			await openCollaborativeDeck(page, roomId, 'host', true);
			await expect(collaborationReady(page)).toBeVisible({ timeout: 15_000 });
			await page
				.getByRole('toolbar', { name: 'Presentation toolbar' })
				.getByRole('tab', { name: 'File', exact: true })
				.click();
			const backstage = page.getByRole('dialog', { name: 'File', exact: true });
			await backstage.getByRole('button', { name: 'Open', exact: true }).click();
			const chooser = page.waitForEvent('filechooser');
			await backstage.getByRole('button', { name: /browse this device/iu }).click();
			await (await chooser).setFiles(await consecutiveBreakDeck());
			await expect(target(page)).toContainText('AFTER');
			const originalBreaks = await target(page).locator('br').count();
			expect(originalBreaks).toBeGreaterThanOrEqual(2);

			// Import authored breaks: keyboard paragraph semantics differ between editors.
			// No simultaneous editing is needed to reproduce the shared codec loss.
			await openCollaborativeDeck(peer, roomId, 'peer');
			await expect(collaborationReady(peer)).toBeVisible({ timeout: 15_000 });
			await expect(target(peer)).toContainText('AFTER');
			await expect(target(peer).locator('br')).toHaveCount(originalBreaks);
			for (const [index, participant] of [page, peer].entries()) {
				const saved = testInfo.outputPath(`breaks-${index}.pptx`);
				await (await savePptxViaBackstage(participant)).saveAs(saved);
				const xml = await readZipPartText(await readFile(saved), 'ppt/slides/slide1.xml');
				const shape = extractElementBlock(xml, 'p:sp', 'RunsAndBlanks');
				expect(shape.match(/<a:br(?:\s|\/|>)/gu)).toHaveLength(2);
				const reopened = await page.context().newPage();
				try {
					await reopened.goto('/');
					await reopened.locator('#file-input').setInputFiles(saved);
					await expect(target(reopened)).toContainText('AFTER');
					await expect(target(reopened).locator('br')).toHaveCount(originalBreaks);
				} finally {
					await reopened.close();
				}
			}
		} finally {
			await peer.close();
		}
	});

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
