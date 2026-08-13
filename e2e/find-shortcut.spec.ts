/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Ctrl/Cmd+F opens the find bar, in every binding.
 *
 * ## The drift this pins
 *
 * All five bindings have shipped a find bar for a long time, reachable from
 * Home > Editing > Find. Only React and Vue ever wired the KEYBOARD to it, and
 * each did so with its own hand-rolled `event.key === 'f'` test sitting outside
 * the shared editor keymap. On Angular, Svelte and Vanilla the chord therefore
 * fell straight through to the browser's own find bar, which searches the
 * rendered page and cannot see the deck's text model at all: it finds nothing
 * on a slide the viewer would have matched instantly.
 *
 * `find` is now an action in `mapEditorKey` (`render/editor-keymap.ts`), so the
 * chord is decided once and each binding only maps the descriptor onto its own
 * panel. This spec is the framework-neutral proof, because the per-binding unit
 * suites were all green while three of them had no shortcut.
 *
 * Run: node node_modules/@playwright/test/cli.js test find-shortcut
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { loadDeck } from './support/deck';
import { armKeyboard } from './support/keyboard';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Load a deck and put the keyboard where the viewer can hear it.
 *
 * Two bindings attach their editor keydown to the viewer ROOT rather than to
 * `window`, so after an upload through `#file-input` focus is still on the
 * input and no editor shortcut fires. `armKeyboard` is the shared repair the
 * other shortcut specs use; `keyboard-shortcuts.spec.ts` owns the focus defect
 * itself, so pinning it again here would only make this spec fail for a reason
 * that has nothing to do with Ctrl+F.
 */
async function loadDeckAndFocus(page: Page): Promise<void> {
	await loadDeck(page);
	await armKeyboard(page);
}

/**
 * The find query box, identified by the placeholder every binding renders from
 * the same shared dictionary key (`pptx.findReplace.findPlaceholder`). A
 * neutral selector matters here: each binding wraps the box in different
 * chrome, and pinning any one of those shapes would make this a React test.
 */
const findInput = (page: Page): Locator => page.locator('input[placeholder*="Find" i]').first();

test.describe('find shortcut', () => {
	test('Ctrl+F opens the find bar and focuses its query box', async ({ page }) => {
		await loadDeckAndFocus(page);
		await expect(findInput(page)).toBeHidden();

		await page.keyboard.press('Control+f');
		await expect(findInput(page)).toBeVisible();
	});

	test('pressing Ctrl+F again closes it', async ({ page }) => {
		// Every binding wires the action to a TOGGLE, and they arrived at that
		// independently (React flipped a boolean, Angular had two separate panels
		// to reconcile). Pinning it here keeps the chord behaving the same way
		// across bindings rather than opening-only in some of them.
		await loadDeckAndFocus(page);
		await page.keyboard.press('Control+f');
		await expect(findInput(page)).toBeVisible();
		await page.keyboard.press('Control+f');
		await expect(findInput(page)).toBeHidden();
	});

	// That Ctrl+F stays live with the caret inside a text box (it outranks the
	// typing gates, the way PowerPoint's does) is asserted where that decision
	// actually lives, in `packages/shared/src/render/editor-keymap.test.ts`.
	// Reproducing it here would mean clicking a specific shape, and the shapes
	// on the sample deck overlap differently in each binding.

	test('a bare "f" types instead of opening find', async ({ page }) => {
		await loadDeckAndFocus(page);
		await page.keyboard.press('f');
		await expect(findInput(page)).toBeHidden();
	});
});
