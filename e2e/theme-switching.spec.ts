/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * File > Options > Appearance: the built-in theme catalog actually recolors
 * the viewer chrome, with the exact token values the shared catalog ships.
 *
 * Nothing covered chrome theming end-to-end before this spec, so a preset
 * whose swatch clicked fine but painted nothing (or painted its own idea of
 * "light") would have shipped silently. The expected colours are imported from
 * `pptx-viewer-shared`'s `THEME_CATALOG` rather than restated here, so the
 * spec cannot drift from the module the bindings resolve their presets from,
 * and the assertion is on the resolved `--pptx-*` custom properties inside the
 * viewer: the same tokens `themeToCssVars` emits and every binding's chrome
 * paints from.
 *
 * Persistence goes through `viewer-prefs-storage` (`pptx-viewer-prefs` in
 * localStorage): every demo runs the standalone fallback path (no host
 * `onThemeChange`), so a picked theme must survive a reload AND repaint at
 * boot. A persisted catalog choice beats a host default `theme` in every
 * binding (the host theme still applies while the resolved key is 'default'),
 * so the reload assertion holds strictly across all five.
 *
 * Run: bunx playwright test theme-switching
 */
import { expect, test } from '@playwright/test';

import { translationsEn } from '../packages/shared/src/i18n/translations-en';
import { THEME_CATALOG } from '../packages/shared/src/theme/theme-catalog';
import type { ThemeCatalogEntry } from '../packages/shared/src/theme/theme-catalog';
import { loadDeck } from './support/deck';
import {
	openOptionsDialog,
	pickOptionsEntry,
	readChromeThemeTokens,
	readViewerPrefs,
} from './support/settings-dialog';
import type { ChromeThemeTokens } from './support/settings-dialog';

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

/** Resolve a dictionary label, failing loudly on a missing key. */
function label(key: string): string {
	const value = translationsEn[key];
	if (!value) {
		throw new Error(`translations-en is missing "${key}"`);
	}
	return value;
}

const OPTIONS_TITLES = [label('pptx.options.title')];

/**
 * The catalog entries that carry a concrete theme. The `default` entry maps to
 * `undefined` (reset to whatever the host page declares) and is exercised
 * separately, because what it resolves to is host chrome, not catalog data.
 */
const PRESET_ENTRIES = THEME_CATALOG.filter((entry) => entry.theme?.colors !== undefined);

/** The catalog tokens a preset must paint, in the probe's normalized shape. */
function tokensOf(entry: ThemeCatalogEntry): ChromeThemeTokens {
	const colors = entry.theme?.colors;
	if (!colors?.background || !colors.primary || !colors.border) {
		throw new Error(`catalog entry "${entry.key}" has no complete color set`);
	}
	return {
		background: colors.background.toLowerCase(),
		primary: colors.primary.toLowerCase(),
		border: colors.border.toLowerCase(),
	};
}

test.describe('File > Options > Appearance theme switching', () => {
	test('each catalog preset recolors the chrome with its own tokens', async ({ page }) => {
		await loadDeck(page);
		const baseline = await readChromeThemeTokens(page);
		const dialog = await openOptionsDialog(page, OPTIONS_TITLES);

		expect(PRESET_ENTRIES.length).toBeGreaterThan(0);
		for (const entry of PRESET_ENTRIES) {
			await pickOptionsEntry(dialog, label(entry.labelKey));
			await expect.poll(() => readChromeThemeTokens(page)).toEqual(tokensOf(entry));
		}

		// The chrome demonstrably CHANGED, not merely "already happened to match":
		// none of the demos boots with the light preset's tokens, and the loop
		// above just proved the chrome now paints exactly those.
		const light = PRESET_ENTRIES[0];
		await pickOptionsEntry(dialog, label(light.labelKey));
		await expect.poll(() => readChromeThemeTokens(page)).toEqual(tokensOf(light));
		expect(tokensOf(light)).not.toEqual(baseline);

		// "Default" resets: the viewer stops declaring tokens of its own, so the
		// chrome falls back to the host page's declarations. What those are is the
		// demo shell's business; that the light preset's paint is GONE is ours.
		await pickOptionsEntry(dialog, label('pptx.settings.theme.default'));
		await expect
			.poll(async () => (await readChromeThemeTokens(page)).background)
			.not.toBe(tokensOf(light).background);
	});

	test('the chosen theme is persisted and reapplied after a reload', async ({ page }) => {
		await loadDeck(page);
		const dialog = await openOptionsDialog(page, OPTIONS_TITLES);
		const light = PRESET_ENTRIES[0];
		await pickOptionsEntry(dialog, label(light.labelKey));
		await expect.poll(() => readChromeThemeTokens(page)).toEqual(tokensOf(light));
		await expect.poll(async () => (await readViewerPrefs(page)).themeKey).toBe(light.key);

		// Reload the app (same origin, same storage) and open the deck again.
		await loadDeck(page);

		// The stored preference must survive the reload AND repaint the chrome
		// at boot in every binding (a persisted user choice beats a host default
		// theme).
		expect((await readViewerPrefs(page)).themeKey).toBe(light.key);
		await expect.poll(() => readChromeThemeTokens(page)).toEqual(tokensOf(light));
	});
});
