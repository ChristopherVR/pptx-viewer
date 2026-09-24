/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Paste Special (Ctrl/Cmd+Alt+V) and the post-paste Paste Options toolbar,
 * across all five bindings.
 *
 * The four formats (Keep Source Formatting, Use Destination Theme, Picture,
 * Keep Text Only) come from one shared list (`PASTE_SPECIAL_OPTIONS` in
 * `pptx-viewer-shared`), so a binding that renders a different count, or never
 * opens the dialog at all, has drifted from the others in a way no per-binding
 * unit suite would catch: those suites mock the DOM lookups this feature
 * depends on.
 *
 * Run: bunx playwright test paste-special
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { report } from './support/context-menu';
import {
	elementWithText,
	loadDeckAt,
	SAMPLE_DECK,
	selectElement,
	slideStage,
	stageElements,
} from './support/deck';
import { pressShortcut } from './support/keyboard';
import { byBinding } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };
test.use({ viewport: VIEWPORT });

/** A text-bearing shape on slide 1 of the sample deck. */
const SHAPE_TEXT = 'Product Overview';

async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

/** Select the sample shape and copy it, ready for a Paste Special test. */
async function selectAndCopy(page: Page): Promise<void> {
	await selectElement(page, elementWithText(page, SHAPE_TEXT));
	await pressShortcut(page, 'Control+c');
}

/** The Paste Special dialog, identified by its own translated heading. */
function pasteSpecialDialog(page: Page) {
	return page
		.getByRole('dialog')
		.filter({ hasText: /paste special/iu })
		.first();
}

test.describe('cross-binding Paste Special', () => {
	test('Ctrl+Alt+V opens a dialog offering all four paste formats', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await selectAndCopy(page);
				await pressShortcut(page, 'Control+Alt+v');
				const dialog = pasteSpecialDialog(page);
				const present = await dialog.isVisible().catch(() => false);
				const optionCount = present ? await dialog.getByRole('radio').count() : 0;
				return { present, optionCount };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, ['Ctrl+Alt+V did not open a Paste Special dialog']);
			}
			return value.optionCount === 4
				? []
				: report(name, [`the dialog offered ${value.optionCount} formats, not 4`]);
		});

		expect(problems.join('\n')).toBe('');
	});

	test('does not open with an empty clipboard', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await pressShortcut(page, 'Control+Alt+v');
				return {
					present: await pasteSpecialDialog(page)
						.isVisible()
						.catch(() => false),
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value.present
				? report(name, ['Ctrl+Alt+V opened Paste Special with nothing on the clipboard'])
				: [],
		);

		expect(problems.join('\n')).toBe('');
	});

	test('choosing Keep Text Only inserts exactly one bare text box', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await selectAndCopy(page);
				const before = await stageElements(page).count();
				await pressShortcut(page, 'Control+Alt+v');
				const dialog = pasteSpecialDialog(page);
				await dialog.getByRole('radio', { name: /keep text only/iu }).check();
				await dialog.getByRole('button', { name: /^ok$/iu }).click();
				await page.waitForTimeout(500);
				return { delta: (await stageElements(page).count()) - before };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value.delta === 1
				? []
				: report(name, [`Paste Special changed the element count by ${value.delta}, not 1`]),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('an ordinary paste shows the Paste Options follow-up toolbar', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await selectAndCopy(page);
				await pressShortcut(page, 'Control+v');
				const toolbar = page.locator('[data-pptx-paste-options]').first();
				return { present: await toolbar.isVisible().catch(() => false) };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value.present
				? []
				: report(name, ['an ordinary paste did not show the Paste Options toolbar']),
		);

		expect(problems.join('\n')).toBe('');
	});
});
