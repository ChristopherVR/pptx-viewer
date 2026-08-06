/**
 * File > Options: opening the dialog and driving its Appearance and Language
 * pickers, plus the chrome-token probe the theming spec asserts on.
 *
 * The Options dialog takes its accessible name from the ACTIVE display
 * language ("Options" / "Optionen" / "Opciones"), and switching the language
 * re-labels the open dialog live in all five bindings. A locator captured
 * under the English title would therefore stop resolving the moment the spec
 * switches away from English, so lookups here accept the full set of
 * per-locale titles, which the specs derive from the shipped dictionaries.
 *
 * @module e2e/support/settings-dialog
 */
import type { Locator, Page } from '@playwright/test';

import { ribbon } from './deck';

function escapeForRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** The File > Options dialog, addressed by any of the given localized titles. */
export function optionsDialog(page: Page, titles: readonly string[]): Locator {
	const alternatives = [...new Set(titles)].map(escapeForRegExp).join('|');
	return page.getByRole('dialog', { name: new RegExp(`^(?:${alternatives})$`, 'u') }).first();
}

/**
 * Open File > Options through the backstage.
 *
 * The Options entry is clicked positionally (the last button of the backstage
 * nav rail) rather than by its label: `file-backstage-open.spec.ts` already
 * pins that every binding bottom-pins Account/Options with Options last, and
 * this helper is only ever invoked from an English chrome, so the ribbon and
 * backstage lookups can use the English accessible names like the rest of the
 * support layer does.
 */
export async function openOptionsDialog(page: Page, titles: readonly string[]): Promise<Locator> {
	await ribbon(page).getByRole('tab', { name: 'File', exact: true }).click();
	const backstage = page.locator('[role="dialog"][aria-label="File"]');
	await backstage.waitFor();
	await backstage.locator('aside nav button').last().click();
	const dialog = optionsDialog(page, titles);
	await dialog.waitFor();
	return dialog;
}

/** A category button in the dialog's left-hand nav rail, by visible label. */
export function optionsCategory(dialog: Locator, label: string): Locator {
	return dialog.locator('nav button').filter({ hasText: label }).first();
}

/**
 * Click a picker entry (a theme swatch or a language choice) by its exact
 * visible text. The bindings render these controls as plain buttons, as
 * radio-role buttons, and as labelled radio inputs, so the only hook all five
 * agree on is the text itself; the click lands on the text node and bubbles to
 * whichever control wraps it.
 */
export async function pickOptionsEntry(dialog: Locator, label: string): Promise<void> {
	await dialog.getByText(label, { exact: true }).first().click();
}

/** The chrome theme tokens every binding paints from (set via `themeToCssVars`). */
export interface ChromeThemeTokens {
	background: string;
	primary: string;
	border: string;
}

/**
 * Read the resolved `--pptx-*` chrome tokens from inside the viewer.
 *
 * Custom properties inherit, so reading them on the slide viewport (a hook all
 * five bindings emit) observes whatever the viewer root declared, or, when the
 * viewer declares nothing (the "Default" catalog entry), whatever the host
 * page's own stylesheet put on an ancestor.
 */
export async function readChromeThemeTokens(page: Page): Promise<ChromeThemeTokens> {
	return page
		.locator('[data-pptx-viewport]')
		.first()
		.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				background: style.getPropertyValue('--pptx-background').trim().toLowerCase(),
				primary: style.getPropertyValue('--pptx-primary').trim().toLowerCase(),
				border: style.getPropertyValue('--pptx-border').trim().toLowerCase(),
			};
		});
}

/** Shape of the `pptx-viewer-prefs` localStorage record the specs read. */
export interface StoredPrefsSnapshot {
	themeKey?: string;
	localeCode?: string;
}

/**
 * The persisted viewer preferences, or `{}` when unset/corrupt. This is the
 * `viewer-prefs-storage` contract every binding falls back to when the host
 * wires no `onThemeChange` / `onLocaleChange` callback, which is how all five
 * demo apps run.
 */
export async function readViewerPrefs(page: Page): Promise<StoredPrefsSnapshot> {
	return page.evaluate(() => {
		try {
			const raw = localStorage.getItem('pptx-viewer-prefs');
			if (!raw) {
				return {};
			}
			const parsed: unknown = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as StoredPrefsSnapshot) : {};
		} catch {
			return {};
		}
	});
}
