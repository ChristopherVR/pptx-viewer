/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * PowerPoint's built-in stock sound gallery, picked live in each demo, driven
 * identically across all five bindings.
 *
 * COM-verified against PowerPoint 2016 (2026-09-06,
 * `scripts/make-effect-sound-fixture.ps1`): a stock EFFECT sound is written
 * as `p:audio/p:cMediaNode/p:tgtEl/p:sndTgt` inside the effect's own
 * `p:subTnLst` (never the legacy `p:stSnd`, which PowerPoint itself no longer
 * recognises back), and a stock TRANSITION sound as
 * `p:transition/p:sndAc/p:stSnd/p:snd`. Both carry `@_name="CHIMES.WAV"` /
 * `@_name="APPLAUSE.WAV"` with no separate "built-in" flag anywhere - that
 * name string is what PowerPoint itself matches a stock sound by.
 *
 * Fixture: `effect-sound-gallery.pptx` (see its generator), a single slide
 * with one shape already carrying a real `p:timing` entrance animation and
 * the slide's own `p:transition` - exactly the precondition the effect-sound
 * row needs (it only renders once an effect exists on the selected element)
 * and lets both edits happen without any slide navigation.
 *
 * Run: bunx playwright test effect-sound-gallery --workers=1
 */
import { expect, test } from '@playwright/test';

import { EFFECT_SOUND_SHAPE_TEXT } from './fixtures/generate-effect-sound-gallery-fixture';
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
import { readZipPartBytes, readZipPartText } from './support/pptx-xml';

const DECK = fixture('effect-sound-gallery.pptx');

/** True when `bytes` starts with a RIFF/WAVE header. */
function isValidWav(bytes: Uint8Array): boolean {
	const ascii = (start: number, end: number): string =>
		String.fromCharCode(...bytes.slice(start, end));
	return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
}

/** The relationship id and media file name a `r:embed="rIdN" .../>` attribute (inside `tag`) resolves to. */
async function resolveEmbeddedMedia(
	bytes: Uint8Array,
	slideXml: string,
	tag: RegExp,
	relsPart: string,
): Promise<Uint8Array> {
	const embedMatch = slideXml.match(tag);
	expect(embedMatch, `expected a ${tag} match with an r:embed id`).toBeTruthy();
	const rId = embedMatch![1];
	const relsXml = await readZipPartText(bytes, relsPart);
	const targetMatch = relsXml.match(
		new RegExp(`Id="${rId}"[^>]*Target="\\.\\./media/([^"]+)"`, 'u'),
	);
	expect(targetMatch, `expected relationship ${rId} to target a media part`).toBeTruthy();
	return readZipPartBytes(bytes, `ppt/media/${targetMatch![1]}`);
}

test.describe('effect sound gallery (animation panel)', () => {
	test('picking "Chime" writes the modern p:sndTgt sound node with a valid embedded WAV', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, EFFECT_SOUND_SHAPE_TEXT));
		await openRibbonTab(page, 'Animations');
		// "Animation Panel" TOGGLES the inspector: a binding that opens it by
		// default on selection would have this click CLOSE it again, so only
		// click when it is not already open.
		if (!(await inspector(page).isVisible())) {
			await page.getByRole('button', { name: 'Animation Panel', exact: true }).click();
			await page.waitForTimeout(150);
		}

		const soundSelect = inspector(page).getByRole('combobox', { name: 'Sound', exact: true });
		await expect(soundSelect).toBeVisible();
		await soundSelect.selectOption('chime');

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);

		const slideXml = await readZipPartText(bytes, 'ppt/slides/slide1.xml');
		expect(slideXml).not.toContain('<p:stSnd>');
		expect(slideXml).toContain('<p:sndTgt');
		expect(slideXml).toMatch(/<p:sndTgt[^>]*name="CHIMES\.WAV"/u);

		const mediaBytes = await resolveEmbeddedMedia(
			bytes,
			slideXml,
			/<p:sndTgt[^>]*r:embed="(rId\d+)"/u,
			'ppt/slides/_rels/slide1.xml.rels',
		);
		expect(isValidWav(mediaBytes)).toBe(true);
	});
});

test.describe('transition sound gallery (ribbon)', () => {
	test('picking "Applause" writes p:stSnd with the stock name and a valid embedded WAV', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await openRibbonTab(page, 'Transitions');

		const soundSelect = page.getByRole('combobox', { name: 'Sound:', exact: true });
		await expect(soundSelect).toBeVisible();
		await soundSelect.selectOption('applause');

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);

		const slideXml = await readZipPartText(bytes, 'ppt/slides/slide1.xml');
		expect(slideXml).toContain('<p:stSnd>');
		expect(slideXml).toMatch(/<p:snd[^>]*name="APPLAUSE\.WAV"/u);

		const relsXml = await readZipPartText(bytes, 'ppt/slides/_rels/slide1.xml.rels');
		expect(relsXml).toContain(
			'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio"',
		);
		const mediaBytes = await resolveEmbeddedMedia(
			bytes,
			slideXml,
			/<p:snd[^>]*r:embed="(rId\d+)"/u,
			'ppt/slides/_rels/slide1.xml.rels',
		);
		expect(isValidWav(mediaBytes)).toBe(true);
	});
});
