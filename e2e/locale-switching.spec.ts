/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * File > Options > Language: switching the display language actually re-labels
 * the chrome, with the exact strings the shipped dictionaries carry.
 *
 * Every other spec in this suite addresses controls by their ENGLISH
 * accessible names, so before this spec a locale regression was structurally
 * invisible: a binding could stop translating entirely and the suite would go
 * greener, not redder. The expected strings are imported from
 * `pptx-viewer-locales` (de/es/fr) and the shared English dictionary rather
 * than restated here, so the spec cannot drift from what the demos register.
 *
 * The asserted keys are deliberately few and deliberately chosen: the ribbon
 * tab labels come from the shared `TOOLBAR_TABS` contract every binding
 * renders, the status bar's "Slide 1 of 7" is the highest-traffic interpolated
 * string in the chrome, and live probing confirmed all five bindings translate
 * them immediately on switch. Each translated value also differs from its
 * English one in all three locales, so an accidental English fallback fails
 * instead of passing by coincidence. The much broader missing-translation
 * fallout (hundreds of keys in some bindings) is MEASURED and reported via a
 * test annotation, not asserted - see {@link measureEnglishFallout}.
 *
 * Persistence goes through `viewer-prefs-storage`; every binding restores the
 * stored locale at boot (a persisted user choice beats a host default
 * locale), so the reload assertion holds strictly across all five.
 *
 * Run: bunx playwright test locale-switching
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translationsDe, translationsEs, translationsFr } from '../packages/locales/src';
import { LOCALE_CATALOG } from '../packages/shared/src/i18n/locale-catalog';
import { translationsEn } from '../packages/shared/src/i18n/translations-en';
import { loadDeck, resetTabSession } from './support/deck';
import {
	openOptionsDialog,
	optionsCategory,
	pickOptionsEntry,
	readViewerPrefs,
} from './support/settings-dialog';

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 180_000 });

interface LocaleUnderTest {
	code: string;
	dictionary: Record<string, string>;
}

const LOCALES: readonly LocaleUnderTest[] = [
	{ code: 'de', dictionary: translationsDe },
	{ code: 'fr', dictionary: translationsFr },
	{ code: 'es', dictionary: translationsEs },
];

/** Ribbon tabs asserted per locale (shared `TOOLBAR_TABS` label keys). */
const RIBBON_TAB_KEYS = [
	'pptx.ribbon.tab.file',
	'pptx.ribbon.tab.home',
	'pptx.ribbon.tab.design',
	'pptx.ribbon.tab.view',
] as const;

/** Status-bar slide counter, asserted rendered with its interpolations. */
const SLIDE_OF_KEY = 'pptx.statusBar.slideOf';

/** Resolve a dictionary value, failing loudly on a missing key. */
function entry(dictionary: Record<string, string>, key: string): string {
	const value = dictionary[key];
	if (!value) {
		throw new Error(`dictionary is missing "${key}"`);
	}
	return value;
}

/** The dialog's own title translates live, so accept it in every locale. */
const OPTIONS_TITLES = [
	entry(translationsEn, 'pptx.options.title'),
	...LOCALES.map(({ dictionary }) => entry(dictionary, 'pptx.options.title')),
];

/** A locale's own name for itself: the one picker label that never translates. */
function nativeLabel(code: string): string {
	const found = LOCALE_CATALOG.find((candidate) => candidate.code === code);
	if (!found) {
		throw new Error(`LOCALE_CATALOG has no "${code}" entry`);
	}
	return found.nativeLabel;
}

/** "Slide 1 of 7" in the given language (the sample deck has 7 slides). */
function slideCounter(dictionary: Record<string, string>): string {
	return entry(dictionary, SLIDE_OF_KEY).replace('{{current}}', '1').replace('{{total}}', '7');
}

/** Assert the chrome is speaking the given dictionary's language. */
async function expectChromeLanguage(page: Page, dictionary: Record<string, string>): Promise<void> {
	for (const key of RIBBON_TAB_KEYS) {
		await expect(
			page.getByRole('tab', { name: entry(dictionary, key), exact: true }).first(),
			`ribbon tab "${key}" should read "${entry(dictionary, key)}"`,
		).toBeVisible();
	}
	await expect(page.getByText(slideCounter(dictionary)).first()).toBeVisible();
}

/**
 * MEASURE (not assert) how much of the visible chrome is still English after a
 * switch: sample the ribbon tabs, toolbar controls, and dialog nav labels, and
 * count the sampled strings that exactly match an English dictionary value
 * whose translation in the target locale differs. Reported via an annotation
 * so the number lands in the run output without turning known incomplete
 * translations into failures.
 */
async function measureEnglishFallout(
	page: Page,
	dictionary: Record<string, string>,
): Promise<{ sampled: number; english: number; examples: string[] }> {
	const englishValues = new Set<string>();
	for (const [key, value] of Object.entries(translationsEn)) {
		const translated = dictionary[key];
		if (translated !== undefined && translated !== value) {
			englishValues.add(value);
		}
	}
	const visibleStrings = await page.evaluate(() => {
		const strings = new Set<string>();
		for (const tab of document.querySelectorAll('[role="tab"]')) {
			const text = tab.textContent?.trim();
			if (text) {
				strings.add(text);
			}
		}
		const controls = document.querySelectorAll(
			'[role="toolbar"] button, [role="toolbar"] [role="button"], [role="dialog"] nav button',
		);
		for (const control of controls) {
			const name = (
				control.getAttribute('aria-label') ??
				control.getAttribute('title') ??
				control.textContent ??
				''
			).trim();
			if (name) {
				strings.add(name);
			}
		}
		return [...strings];
	});
	const english = visibleStrings.filter((value) => englishValues.has(value));
	return {
		sampled: visibleStrings.length,
		english: english.length,
		examples: english.slice(0, 20),
	};
}

test.describe('File > Options > Language switching', () => {
	test('each shipped locale re-labels the chrome and English restores it', async ({
		page,
	}, testInfo) => {
		await loadDeck(page);
		await expectChromeLanguage(page, translationsEn);

		const dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		await optionsCategory(dialog, entry(translationsEn, 'pptx.settings.language')).click();

		const falloutReport: string[] = [];
		for (const { code, dictionary } of LOCALES) {
			await pickOptionsEntry(dialog, nativeLabel(code));
			await expectChromeLanguage(page, dictionary);
			const fallout = await measureEnglishFallout(page, dictionary);
			const examples =
				fallout.english > 0 ? ` (e.g. ${fallout.examples.slice(0, 5).join(', ')})` : '';
			falloutReport.push(
				`${code}: ${fallout.english}/${fallout.sampled} sampled chrome strings still English${examples}`,
			);
		}

		// Back to English: the originals every other spec depends on must return.
		await pickOptionsEntry(dialog, nativeLabel('en'));
		await expectChromeLanguage(page, translationsEn);

		testInfo.annotations.push({ type: 'i18n-fallout', description: falloutReport.join(' | ') });
	});

	test('the language choice is persisted and reapplied after a reload', async ({ page }) => {
		await loadDeck(page);
		const dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		await optionsCategory(dialog, entry(translationsEn, 'pptx.settings.language')).click();

		const { code, dictionary } = LOCALES[0];
		await pickOptionsEntry(dialog, nativeLabel(code));
		await expectChromeLanguage(page, dictionary);
		await expect.poll(async () => (await readViewerPrefs(page)).localeCode).toBe(code);

		// Reload the app (same origin, same storage) and open the deck again.
		// Drop the tab's session first, or session-restore reopens the deck
		// straight into the viewer and the dropzone's #file-input never mounts.
		await resetTabSession(page);
		await loadDeck(page);

		// The stored preference must survive the reload AND re-label the chrome
		// at boot in every binding (a persisted user choice beats a host default
		// locale).
		expect((await readViewerPrefs(page)).localeCode).toBe(code);
		await expectChromeLanguage(page, dictionary);
	});
});
