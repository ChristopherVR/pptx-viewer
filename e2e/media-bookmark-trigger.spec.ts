/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * "On bookmark" trigger, authored in each demo's animation panel and saved
 * the way PowerPoint writes it.
 *
 * Ground truth (COM, 2026-09-25): `Sequence.AddTriggerEffect(shape,
 * msoAnimEffectFade, msoAnimTriggerOnMediaBookmark, video, "BM1")` saves the
 * trigger as its own interactive `p:seq` gated on `evt="onMediaBookmark"` with
 * `p:tgtEl/p14:bmkTgt`, inside an `mc:Choice Requires="p14"` copy of
 * `p:timing` whose `mc:Fallback` leaves the bookmark sequences out. A deck
 * saved from here reopens in PowerPoint with `Timing.TriggerType = 5` and the
 * chosen bookmark (verified over COM).
 *
 * Fixture: `media-bookmark-trigger-editable.pptx` (see its generator): the
 * COM-authored deck plus an editor-owned Fade on "Second Shape", so the
 * panel's timing controls are already showing for that shape.
 *
 * Run: bunx playwright test media-bookmark-trigger --workers=1
 */
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

import { BOOKMARK_SECOND_SHAPE_TEXT } from './fixtures/generate-media-bookmark-trigger-editable-fixture';
import { savePptxViaBackstage } from './save-pptx';
import {
	elementWithText,
	fixture,
	inspector,
	loadDeck,
	openRibbonTab,
	selectElement,
} from './support/deck';
import { downloadBytes } from './support/exports';
import { readZipPartText } from './support/pptx-xml';

const DECK = fixture('media-bookmark-trigger-editable.pptx');

/**
 * Commit a value on the panel's select through its own `change` event. The
 * visible-option route (`chooseSelectValue`) is ambiguous here: a binding
 * whose ribbon timeline row also carries a trigger select exposes a second
 * "On bookmark" option on the page.
 */
async function commitSelect(control: Locator, value: string): Promise<void> {
	await control.evaluate((element, next) => {
		(element as HTMLSelectElement).value = next;
		element.dispatchEvent(new Event('change', { bubbles: true }));
	}, value);
}

/** Every occurrence count of `needle` in `haystack`. */
function count(haystack: string, needle: RegExp): number {
	return (haystack.match(needle) ?? []).length;
}

test.describe('media bookmark trigger (animation panel)', () => {
	test('choosing On bookmark + BM2 saves PowerPoint p14 bookmark sequence', async ({ page }) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, BOOKMARK_SECOND_SHAPE_TEXT));
		await openRibbonTab(page, 'Animations');
		if (!(await inspector(page).isVisible())) {
			await page.getByRole('button', { name: 'Animation Panel', exact: true }).click();
			await page.waitForTimeout(150);
		}

		// The trigger select is the one offering the "On bookmark" value; its
		// accessible name differs between bindings ("Trigger" / "Animation trigger").
		const trigger = inspector(page)
			.locator('pptx-ui-select:has(option[value="onMediaBookmark"])')
			.first();
		await expect(trigger).toBeVisible();
		await commitSelect(trigger, 'onMediaBookmark');

		const picker = inspector(page).locator('[data-pptx-animation-bookmark-picker]').first();
		await expect(picker).toBeVisible();
		const labels = await picker.evaluate((element) =>
			[...element.querySelectorAll('option')].map((option) => option.textContent?.trim() ?? ''),
		);
		expect(labels.slice(1)).toStrictEqual(['BM1', 'BM2']);
		const bm2 = await picker.evaluate(
			(element) =>
				[...element.querySelectorAll('option')].find((o) => o.textContent?.trim() === 'BM2')
					?.value ?? '',
		);
		await commitSelect(picker, bm2);

		const bytes = await downloadBytes(await savePptxViaBackstage(page));
		const slideXml = await readZipPartText(bytes, 'ppt/slides/slide1.xml');
		expect(count(slideXml, /<mc:AlternateContent/gu)).toBe(1);
		expect(count(slideXml, /<p:timing>/gu)).toBe(2);
		const choice = slideXml.slice(slideXml.indexOf('<mc:Choice'), slideXml.indexOf('</mc:Choice>'));
		// The deck's own BM1 trigger and the authored BM2 one, start + next condition each.
		expect(count(choice, /<p14:bmkTgt spid="2" bmkName="BM1"/gu)).toBe(2);
		expect(count(choice, /<p14:bmkTgt spid="2" bmkName="BM2"/gu)).toBe(2);
		const fallback = slideXml.slice(
			slideXml.indexOf('<mc:Fallback'),
			slideXml.indexOf('</mc:Fallback>'),
		);
		expect(fallback).not.toContain('onMediaBookmark');
	});
});
