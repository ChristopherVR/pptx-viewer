/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck } from './support/deck';

/** Exercise the real registered controls after each viewer bundle has initialized. */
async function mountContract(page: Page): Promise<void> {
	await loadDeck(page);
	await page.evaluate(() => {
		const root = document.createElement('div');
		root.dataset.testid = 'web-control-contract';
		root.style.cssText =
			'position:fixed;top:200px;left:20px;z-index:99999;background:#fff;padding:8px;--pptx-foreground:#123456;--pptx-primary:#2456ab;--pptx-ring:#2456ab';
		for (const suffix of ['A', 'B']) {
			const command = document.createElement('pptx-ui-ribbon-command');
			command.setAttribute('label', `Command ${suffix}`);
			command.setAttribute('data-ribbon-control', 'slideShow.setUp.hideSlide');
			command.setAttribute('compact', '');
			command.dataset.requests = '0';
			command.addEventListener('command-request', () => {
				command.dataset.requests = String(Number(command.dataset.requests) + 1);
			});
			const toggle = document.createElement('pptx-ui-ribbon-toggle');
			toggle.setAttribute('label', `Toggle ${suffix}`);
			toggle.setAttribute('data-ribbon-control', 'slideShow.captions.subtitles');
			const options = document.createElement('pptx-ui-slide-show-options') as HTMLElement & {
				presentationProperties: Record<string, unknown>;
				labels: Record<string, string>;
			};
			options.dataset.instance = suffix;
			options.dataset.edits = '0';
			options.labels = { useTimings: `Timings ${suffix}` };
			options.presentationProperties = { advanceMode: 'useTimings' };
			options.addEventListener('show-options-change', (event) => {
				options.presentationProperties = {
					...options.presentationProperties,
					...(event as CustomEvent).detail,
				};
				options.dataset.edits = String(Number(options.dataset.edits) + 1);
			});
			root.append(command, toggle, options);
		}
		document.body.append(root);
	});
}

test('web controls inherit tokens, show keyboard focus and isolate state through reconnect', async ({
	page,
}) => {
	await mountContract(page);
	expect(
		await page.evaluate(() =>
			Reflect.get(
				customElements.get('pptx-ui-ribbon-command')!,
				Symbol.for('pptx-viewer.web-control-contract'),
			),
		),
	).toBe(1);
	const root = page.getByTestId('web-control-contract');
	const button = root.getByRole('button', { name: 'Command A' });
	await expect(button).toHaveCSS('color', 'rgb(18, 52, 86)');
	await root.evaluate((element) =>
		(element as HTMLElement).style.setProperty('--pptx-foreground', '#abcdef'),
	);
	await expect(button).toHaveCSS('color', 'rgb(171, 205, 239)');
	await page.keyboard.press('Tab');
	await button.focus();
	await expect(button).toHaveCSS('outline-style', 'solid');
	await expect(button).toHaveCSS('outline-width', '2px');
	await page.keyboard.press('Space');
	await expect(root.locator('pptx-ui-ribbon-command').first()).toHaveAttribute(
		'data-requests',
		'1',
	);
	await expect(root.locator('pptx-ui-ribbon-command').nth(1)).toHaveAttribute('data-requests', '0');
	const first = root.locator('[data-instance="A"]');
	await first.evaluate((element) => {
		const parent = element.parentElement!;
		element.remove();
		parent.append(element);
	});
	await first.getByRole('checkbox', { name: 'Timings A' }).click();
	await expect(first).toHaveAttribute('data-edits', '1');
	await expect(first.getByRole('checkbox', { name: 'Timings A' })).not.toBeChecked();
	await expect(root.getByRole('checkbox', { name: 'Timings B' })).toBeChecked();
	await expect(root.locator('[data-instance="B"]')).toHaveAttribute('data-edits', '0');
	await page.emulateMedia({ forcedColors: 'active' });
	// The checkbox click switched to pointer modality; re-enter keyboard navigation.
	await page.keyboard.press('Tab');
	await button.focus();
	await expect(button).toHaveCSS('outline-style', 'solid');
	await expect(button).toHaveCSS('outline-width', '2px');
	await expect(button).not.toHaveCSS('color', 'rgb(171, 205, 239)');
});

test.describe('touch contract', () => {
	test.use({ hasTouch: true });
	test('compact commands and toggle labels have 44px touch targets', async ({ page }) => {
		await mountContract(page);
		const root = page.getByTestId('web-control-contract');
		const command = root.getByRole('button', { name: 'Command A' });
		expect((await command.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		const label = root.locator('pptx-ui-ribbon-toggle').first().locator('label');
		expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await command.tap();
		await expect(root.locator('pptx-ui-ribbon-command').first()).toHaveAttribute(
			'data-requests',
			'1',
		);
	});
});
