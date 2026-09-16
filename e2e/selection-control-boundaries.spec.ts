/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { readFile, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

import { fixture, loadDeck, slideElements, viewport } from './support/deck';

/** Reachability includes the complete pointer target, not only its painted dot. */
async function reachable(knob: Locator): Promise<void> {
	await expect
		.poll(() =>
			knob.evaluate((button) => {
				const boxes = [button, ...button.querySelectorAll('[data-pptx-handle-hit]')].map((n) =>
					n.getBoundingClientRect(),
				);
				const rect = {
					left: Math.min(...boxes.map((r) => r.left)),
					right: Math.max(...boxes.map((r) => r.right)),
					top: Math.min(...boxes.map((r) => r.top)),
					bottom: Math.max(...boxes.map((r) => r.bottom)),
				};
				const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
				for (let node = button.parentElement; node; node = node.parentElement) {
					const style = getComputedStyle(node);
					const bounds = node.getBoundingClientRect();
					const sx = node.offsetWidth ? bounds.width / node.offsetWidth : 1;
					const sy = node.offsetHeight ? bounds.height / node.offsetHeight : 1;
					if (/hidden|clip|auto|scroll/u.test(style.overflowX)) {
						clip.left = Math.max(clip.left, bounds.left + node.clientLeft * sx);
						clip.right = Math.min(
							clip.right,
							bounds.left + (node.clientLeft + node.clientWidth) * sx,
						);
					}
					if (/hidden|clip|auto|scroll/u.test(style.overflowY)) {
						clip.top = Math.max(clip.top, bounds.top + node.clientTop * sy);
						clip.bottom = Math.min(
							clip.bottom,
							bounds.top + (node.clientTop + node.clientHeight) * sy,
						);
					}
				}
				const owner = document.elementFromPoint(
					(rect.left + rect.right) / 2,
					(rect.top + rect.bottom) / 2,
				);
				return {
					contained:
						rect.left >= clip.left &&
						rect.top >= clip.top &&
						rect.right <= clip.right &&
						rect.bottom <= clip.bottom,
					ownsCenter: owner?.closest('button') === button,
					rect,
					clip,
					owner: owner?.outerHTML.slice(0, 200),
				};
			}),
		)
		.toMatchObject({ contained: true, ownsCenter: true });
}

async function selectTarget(page: Page, target: Locator): Promise<Locator> {
	const box = (await target.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	const knob = viewport(page)
		.getByRole('button', { name: /^rotate element$/iu })
		.first();
	await expect(knob).toBeVisible();
	return knob;
}

for (const coarse of [false, true]) {
	test.describe(coarse ? 'coarse boundary controls' : 'fine boundary controls', () => {
		test.use({ hasTouch: coarse, viewport: { width: 1440, height: 600 } });
		for (const [name, x, y, width, height, rotation] of [
			['top', 450, 0, 300, 80, 0],
			['right', 1110, 300, 300, 80, 90],
			['bottom', 450, 640, 300, 80, 180],
			['left', -130, 300, 300, 80, 270],
			['short', 450, 300, 350, 32, 0],
			['full slide', 0, 0, 1280, 720, 0],
		] as const) {
			test(`Rotate stays reachable at ${name} without moving slide content`, async ({
				page,
			}, testInfo) => {
				const zip = await JSZip.loadAsync(await readFile(fixture('format-painter.pptx')));
				const path = 'ppt/slides/slide1.xml';
				zip.file(
					path,
					(await zip.file(path)!.async('string')).replace(/<p:sp>[\s\S]*?<\/p:sp>/gu, (shape) =>
						shape.includes('>TARGET<')
							? shape
									.replace(/<a:xfrm\b[^>]*>/u, `<a:xfrm rot="${rotation * 60000}">`)
									.replace(/<a:off\b[^>]*>/u, `<a:off x="${x * 9525}" y="${y * 9525}">`)
									.replace(/<a:ext\b[^>]*>/u, `<a:ext cx="${width * 9525}" cy="${height * 9525}">`)
							: '',
					),
				);
				const deck = testInfo.outputPath('boundary.pptx');
				await writeFile(deck, await zip.generateAsync({ type: 'nodebuffer' }));
				await loadDeck(page, deck);
				const target = slideElements(page).filter({ hasText: 'TARGET' }).first();
				const geometry = () =>
					target.evaluate((element) => {
						const style = (element as HTMLElement).style;
						return [style.left, style.top, style.width, style.height];
					});
				const before = await geometry();
				const shapeBefore = (await target.boundingBox())!;
				const knob = await selectTarget(page, target);
				await reachable(knob);
				expect(await geometry()).toEqual(before);
				expect((await target.boundingBox())!.width).toBeCloseTo(shapeBefore.width, 1);
				const shape = (await target.boundingBox())!;
				const box = (await knob.boundingBox())!;
				const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
				const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
				const radians = (12 * Math.PI) / 180;
				const end = {
					x:
						center.x +
						(start.x - center.x) * Math.cos(radians) -
						(start.y - center.y) * Math.sin(radians),
					y:
						center.y +
						(start.x - center.x) * Math.sin(radians) +
						(start.y - center.y) * Math.cos(radians),
				};
				const delta =
					((Math.atan2(end.y - center.y, end.x - center.x) -
						Math.atan2(start.y - center.y, start.x - center.x)) *
						180) /
					Math.PI;
				const translate = await knob.evaluate((button) => (button as HTMLElement).style.translate);
				await page.mouse.move(start.x, start.y);
				await page.mouse.down();
				await page.mouse.move(end.x, end.y, { steps: 3 });
				await expect
					.poll(() =>
						target.evaluate((element) => {
							const matrix = new DOMMatrix(getComputedStyle(element).transform);
							return ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360;
						}),
					)
					.toBeCloseTo((rotation + delta + 360) % 360, 0);
				expect(await knob.evaluate((button) => (button as HTMLElement).style.translate)).toBe(
					translate,
				);
				await page.mouse.up();
				await reachable(knob);
				expect(await geometry()).toEqual(before);
				await page
					.getByRole('button', { name: /^undo$/iu })
					.first()
					.click();
				if (!(await knob.isVisible())) {
					await selectTarget(page, target);
				}
				await reachable(knob);
				expect(await geometry()).toEqual(before);
				if (name === 'top') {
					await target.dblclick();
					const editor = viewport(page).locator('[data-inline-editor][contenteditable="true"]');
					await expect(editor).toBeVisible();
					await editor.fill('TARGET edited');
					await editor.click();
					await expect(editor).toBeFocused();
					await reachable(knob);
					const control = (await knob.boundingBox())!;
					await page.mouse.move(control.x + control.width / 2, control.y + control.height / 2);
					await page.mouse.down();
					await page.mouse.move(
						control.x + control.width / 2 + 8,
						control.y + control.height / 2 + 4,
					);
					await page.mouse.up();
					await expect(viewport(page)).toContainText('TARGET edited');
				}
			});
		}
	});
}
