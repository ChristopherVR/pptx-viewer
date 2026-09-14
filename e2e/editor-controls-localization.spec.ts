/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { translationsDe, translationsEs, translationsFr } from '../packages/locales/src';
import { translationsEn } from '../packages/shared/src/i18n/translations-en';
import { loadDeck } from './support/deck';
import { openOptionsDialog, optionsCategory, pickOptionsEntry } from './support/settings-dialog';

test.use({ viewport: { width: 1920, height: 1080 } });

for (const { dictionary, nativeLabel } of [
	{ dictionary: translationsDe, nativeLabel: 'Deutsch' },
	{ dictionary: translationsEs, nativeLabel: 'Español' },
	{ dictionary: translationsFr, nativeLabel: 'Français' },
]) {
	test(`${nativeLabel} translates inspector navigation and alignment buttons`, async ({ page }) => {
		await loadDeck(page);
		const dialog = await openOptionsDialog(page, [
			translationsEn['pptx.options.title'],
			dictionary['pptx.options.title'],
		]);
		await optionsCategory(dialog, translationsEn['pptx.settings.language']).click();
		await pickOptionsEntry(dialog, nativeLabel);
		await dialog.getByRole('button', { name: dictionary['pptx.common.ok'], exact: true }).click();
		await expect(
			page.getByRole('tab', { name: dictionary['pptx.ribbon.tab.home'], exact: true }).first(),
		).toBeVisible();
		for (const key of [
			'pptx.documentProperties.statistics.elements',
			'pptx.inspector.properties',
		]) {
			await expect(
				page
					.getByRole('button', { name: dictionary[key], exact: true })
					.or(page.getByRole('tab', { name: dictionary[key], exact: true }))
					.first(),
			).toBeVisible();
		}
		for (const direction of ['Left', 'Center', 'Right', 'Top', 'Middle', 'Bottom']) {
			await expect(
				page
					.getByRole('button', { name: dictionary[`pptx.ribbon.align${direction}`], exact: true })
					.first(),
			).toBeVisible();
		}
	});
}
