/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the shared theme-colour picker (`packages/shared/src/render/
 * theme-color-swatches.ts`, wired into every binding's `ThemeColorSwatchGrid`
 * per W3-G2) actually resolve and save a theme swatch the same way in all
 * five, rather than each binding painting its own guess at the Office
 * palette?
 *
 * Every `ThemeColorSwatchGrid` (react/vue/angular/svelte/vanilla) titles and
 * labels each swatch with `describeThemeColorSwatch`'s exact English string
 * ("Accent 1, Lighter 80%"), so this spec locates the swatch the same way in
 * every binding: by that title, inside the inspector's Fill row. Picking it
 * must (a) repaint the shape with the resolved hex, computed here from the
 * fixture's OWN theme colour map via the same shared `buildThemeColorSwatchGrid`
 * the picker itself calls, and (b) save `<a:schemeClr val="accent1">` with
 * `lumMod`/`lumOff`, not a flattened `<a:srgbClr>` - the whole point of a
 * theme ref is that it keeps following the theme. Picking a plain hex
 * afterwards must go back to `<a:srgbClr>`.
 *
 * Run: bunx playwright test theme-color-picker
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	THEME_COLOR_MAP,
	THEME_SHAPE_CUSTOM_HEX,
	THEME_SHAPE_INITIAL_FILL,
} from './fixtures/generate-theme-color-picker-fixture';
import { savePptxViaBackstage } from './save-pptx';
import { fixture, inspector, loadDeckAt, selectElement, slideElements } from './support/deck';
import { downloadBytes } from './support/exports';
import { acrossFrameworks } from './support/parity';
import { extractElementBlock, readZipPartText } from './support/pptx-xml';

test.use({ viewport: { width: 1600, height: 950 } });
test.describe.configure({ timeout: 120_000 });

const FIXTURE = fixture('theme-color-picker.pptx');
const SWATCH_LABEL = 'Accent 1, Lighter 80%';

// `pptx-viewer-shared` is a private, unpublished workspace package (see
// CLAUDE.md's "Angular port + shared inlining" note): it is not hoisted to the
// repo root, so it cannot be imported from e2e's own package.json scope. It IS
// a real dependency of every binding package, so resolve it through one of
// theirs, the same trick `support/pptx-integrity.ts` uses for `jszip` via
// `pptx-viewer-core`.
const sharedRequire = createRequire(
	resolve(fileURLToPath(new URL('../packages/react/package.json', import.meta.url))),
);
interface ThemeSwatch {
	label: string;
	hex: string;
}
interface ThemeColumn {
	scheme: string;
	variants: readonly ThemeSwatch[];
}
const { buildThemeColorSwatchGrid } = sharedRequire('pptx-viewer-shared') as {
	buildThemeColorSwatchGrid: (map: Readonly<Record<string, string>>) => readonly ThemeColumn[];
};

const accent1Column = buildThemeColorSwatchGrid(THEME_COLOR_MAP).find(
	(column) => column.scheme === 'accent1',
);
if (!accent1Column) {
	throw new Error('fixture theme has no resolvable accent1 column');
}
const expectedSwatch = accent1Column.variants.find((variant) => variant.label === SWATCH_LABEL);
if (!expectedSwatch) {
	throw new Error(`fixture theme's accent1 column has no "${SWATCH_LABEL}" variant`);
}
/** The exact hex `describeThemeColorSwatch`'s "Accent 1, Lighter 80%" resolves to for this theme. */
const EXPECTED_HEX = expectedSwatch.hex;

function hexToRgb(hex: string): string {
	const clean = hex.replace('#', '');
	const r = Number.parseInt(clean.slice(0, 2), 16);
	const g = Number.parseInt(clean.slice(2, 4), 16);
	const b = Number.parseInt(clean.slice(4, 6), 16);
	return `rgb(${r}, ${g}, ${b})`;
}

interface ThemePickResult {
	/** Computed `background-color` right after the theme swatch is picked. */
	afterSwatchBg: string;
	/** Whether the saved XML's shape carries the theme ref, not a flat hex. */
	savedSchemeClr: boolean;
	/** Whether a LATER custom hex pick saves `<a:srgbClr>` instead. */
	savedSrgbClr: boolean;
}

async function runScenario(page: Page, origin: string): Promise<ThemePickResult> {
	await loadDeckAt(page, origin, FIXTURE);

	const shape = slideElements(page).first();
	await selectElement(page, shape);
	await expect(inspector(page)).toBeVisible();

	// Every `ColorPickerRow` (react/vue/angular/svelte/vanilla) renders its
	// `<input type="color">` and its `ThemeColorSwatchGrid` as part of the same
	// row/label, so the FILL row's own colour input is a reliable, framework-
	// neutral anchor for finding ITS swatch grid specifically - as opposed to
	// the Stroke row's identical grid, which titles its swatches the same way.
	// Locating this way, and clicking/editing via a real DOM event dispatched
	// from within the page, also sidesteps Playwright's own visibility
	// actionability check, which (independently of any binding) does not
	// account for a swatch sitting inside a large, legitimately scrollable
	// inspector panel below the fold.
	//
	// The input is re-queried by its CURRENT value each time it is used, rather
	// than reusing one cached handle across both interactions below: a binding
	// whose change detection replaces the input node on a style update (e.g.
	// Angular's OnPush + control-flow re-render) would otherwise leave the
	// second interaction operating on an ElementHandle detached from the live
	// DOM, silently doing nothing.
	async function fillInputWithValue(hex: string) {
		const handle = await page.evaluateHandle(
			(wanted: string) =>
				[...document.querySelectorAll<HTMLInputElement>('input[type="color"]')].find(
					(input) => input.value.toLowerCase() === wanted.toLowerCase(),
				) ?? null,
			hex,
		);
		const found = await handle.evaluate((el) => el !== null);
		if (!found) {
			throw new Error(`no colour input found with value ${hex}`);
		}
		return handle;
	}

	const initialFillInput = await fillInputWithValue(`#${THEME_SHAPE_INITIAL_FILL}`);
	await initialFillInput.evaluate((input: HTMLInputElement, label: string) => {
		let scope: HTMLElement | null = input.parentElement;
		let button: HTMLButtonElement | null = null;
		while (scope && !button) {
			button =
				[...scope.querySelectorAll<HTMLButtonElement>(`button[title="${label}"]`)].find(
					(candidate) => !candidate.disabled,
				) ?? null;
			scope = scope.parentElement;
		}
		if (!button) {
			throw new Error(`no enabled "${label}" swatch found near the fill colour input`);
		}
		button.click();
	}, SWATCH_LABEL);

	// Wait for the repaint to actually land before reading it back: the click
	// above is a raw DOM event, not a Playwright action, so nothing here already
	// waits for the framework's own state update / re-render tick.
	await expect(shape).toHaveCSS('background-color', hexToRgb(EXPECTED_HEX));
	const afterSwatchBg = await shape.evaluate((el) => getComputedStyle(el).backgroundColor);

	const firstDownload = await savePptxViaBackstage(page);
	const firstBytes = await downloadBytes(firstDownload);
	const firstSlideXml = await readZipPartText(firstBytes, 'ppt/slides/slide1.xml');
	const firstShapeXml = extractElementBlock(firstSlideXml, 'p:sp', 'ThemeShape');
	// A part written by JSZip's XML serialiser closes an empty element as
	// `<a:lumMod val="20000"></a:lumMod>` rather than self-closing it, so match
	// either form rather than assuming `/>`.
	const savedSchemeClr =
		/<a:schemeClr val="accent1">\s*<a:lumMod val="20000"\s*(?:\/>|>\s*<\/a:lumMod>)\s*<a:lumOff val="80000"\s*(?:\/>|>\s*<\/a:lumOff>)\s*<\/a:schemeClr>/u.test(
			firstShapeXml,
		);

	// Now pick a plain hex through the SAME row's colour input (re-queried by
	// its current value, per the note above): this must clear the theme ref and
	// save a flat `<a:srgbClr>` again. React installs a property descriptor
	// over `HTMLInputElement.prototype.value` on a controlled input so it can
	// detect script-driven changes; setting `.value` directly (as any
	// binding-neutral helper has to) goes through THAT descriptor and reads
	// back as a no-op change, so the native setter has to be invoked explicitly
	// before dispatching the event, or only bindings that do not shadow `value`
	// (vue/angular/svelte/vanilla) would ever see it.
	const resolvedFillInput = await fillInputWithValue(EXPECTED_HEX);
	await resolvedFillInput.evaluate((el: HTMLInputElement, hex: string) => {
		const nativeSetter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			'value',
		)?.set;
		if (nativeSetter) {
			nativeSetter.call(el, hex);
		} else {
			el.value = hex;
		}
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}, THEME_SHAPE_CUSTOM_HEX);
	await expect(shape).toHaveCSS('background-color', hexToRgb(THEME_SHAPE_CUSTOM_HEX));

	const secondDownload = await savePptxViaBackstage(page);
	const secondBytes = await downloadBytes(secondDownload);
	const secondSlideXml = await readZipPartText(secondBytes, 'ppt/slides/slide1.xml');
	const secondShapeXml = extractElementBlock(secondSlideXml, 'p:sp', 'ThemeShape');
	const customHex = THEME_SHAPE_CUSTOM_HEX.replace('#', '');
	const savedSrgbClr = new RegExp(`<a:srgbClr val="${customHex}"`, 'iu').test(secondShapeXml);

	return { afterSwatchBg, savedSchemeClr, savedSrgbClr };
}

test.describe('theme colour picker', () => {
	test('picking a theme swatch repaints and saves a schemeClr ref in every binding', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, runScenario, {
			concurrency: 'sequential',
		});

		const expectedRgb = hexToRgb(EXPECTED_HEX);
		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.afterSwatchBg !== expectedRgb) {
				problems.push(
					`repaints the shape ${value.afterSwatchBg}, expected the resolved theme colour ${expectedRgb} (${EXPECTED_HEX})`,
				);
			}
			if (!value.savedSchemeClr) {
				problems.push(
					'saved XML does not carry <a:schemeClr val="accent1"><a:lumMod val="20000"/>' +
						'<a:lumOff val="80000"/></a:schemeClr> for the shape\'s solidFill',
				);
			}
			if (!value.savedSrgbClr) {
				problems.push(
					`picking a custom hex afterwards did not save <a:srgbClr val="${THEME_SHAPE_CUSTOM_HEX.replace('#', '')}">`,
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
