/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Equation editor E2E tests.
 *
 * Exercises the LaTeX-based equation editor (`EquationEditorDialog` in every
 * binding) functionally, not just "does a dialog open":
 *
 *   1. Insert a new equation via the Insert ▸ Equation ribbon button, type
 *      LaTeX, and confirm the *rendered MathML* (not just the dialog closing)
 *      reflects it.
 *   2. Re-open an *existing* equation for editing (double-click, the shared
 *      click-to-edit-equation contract) and change it, confirming the change
 *      persists in place - no duplicate element, no reversion to the stale
 *      value, no collapse to the literal "[Equation]" placeholder text. This
 *      is exactly the bug class fixed 2026-07-04 (see
 *      `project_react_equation_inline_edit_bug`): clicking an
 *      already-selected equation used to fall into plain-text inline editing,
 *      which destroyed the OMML on blur.
 *   3. Round-trip an equation through Save ▸ .pptx and reload it via the
 *      app's own file input, confirming the equation survives serialization
 *      (not just in-memory state).
 *
 * Equations are not a distinct element type: they are ordinary text-bearing
 * elements (`shape`/`text`) carrying one `textSegments[].equationXml` (OMML)
 * entry, rendered as inline MathML (a native `<math>` element) by every
 * binding's `EquationRenderer`. `[data-element-id]` (not
 * `[data-pptx-element="true"]`) is the portable per-element hook here: Vue's
 * `EquationRenderer.vue` renders as its own branch in `ElementRenderer.vue`
 * and does not forward `data-pptx-element` (mirrors the same gap noted for
 * Vue's chart renderer in chart-rendering.spec.ts), while React/Angular do
 * carry it because their equations live inside the ordinary shape wrapper.
 * `[data-element-id]:has(math)` finds the rendered equation identically
 * across all three.
 *
 * Known cross-framework gap exercised (and asserted, not silently skipped)
 * below: Vue has no click/dblclick route back into the equation editor for
 * an *existing* equation - `useInlineEditing`'s `enterInlineEdit` guards
 * equation elements from destructive plain-text editing but never opens
 * `EquationEditorDialog` in edit mode, and `PowerPointViewer.vue` wires the
 * dialog for insert only (no `existing-omml` prop, no `@apply` handler). So
 * re-editing an existing equation is currently a React/Angular-only
 * capability; the Vue branch of test 2 instead asserts the historical
 * data-loss bug stays fixed (the equation is not corrupted by the click
 * sequence), which is what Vue's guard actually guarantees today.
 *
 * Run: bunx playwright test equation-editing --project=react
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));
const outputDir = resolve(
	fileURLToPath(new URL('../test-results/equation-editing/', import.meta.url)),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Switch to the Insert ribbon tab. Ribbon tabs are plain buttons inside the
 * `role="toolbar"` labelled "Presentation toolbar" (matches
 * ribbon-tab-parity.spec.ts, which measures every tab this way); they carry
 * no `role="tab"`, so `getByRole('tab', ...)` (as smartart-insert-edit.spec.ts
 * uses) does not match anything in the current markup.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('button', { name: 'Insert', exact: true })
		.click();
	await page.waitForTimeout(200);
}

/** Click the "Equation" button in the Insert section to open the editor for a fresh insert. */
async function openInsertEquationDialog(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Equation' }).click();
	await page.waitForTimeout(200);
}

/** The equation editor dialog in "insert" mode (fresh equation, no existing OMML). */
function insertDialog(page: Page): Locator {
	return page.getByRole('dialog', { name: /^Insert Equation$/iu });
}

/** The equation editor dialog in "edit" mode (re-editing an existing equation). */
function editDialog(page: Page): Locator {
	return page.getByRole('dialog', { name: /^Edit Equation$/iu });
}

/** The LaTeX textarea within an equation dialog (the dialog has exactly one). */
function latexTextarea(dialog: Locator): Locator {
	return dialog.locator('textarea');
}

/** The dialog's primary submit button ("Insert" when creating, "Update" when editing). */
function submitButton(dialog: Locator, label: 'Insert' | 'Update'): Locator {
	return dialog.getByRole('button', { name: new RegExp(`^${label}$`, 'iu') });
}

/**
 * Every element on the active slide carrying a rendered equation. Equations
 * render as a native `<math>` element (MathML), so `[data-element-id]:has(math)`
 * is the portable cross-framework hook - see the file header for why
 * `[data-pptx-element="true"]` is not (Vue's equation renderer omits it).
 *
 * Scoped to `[aria-roledescription="slide"]` (the one interactive main-canvas
 * region every binding marks this way - `SlideCanvas.tsx`/`.vue`/
 * `slide-canvas.component.ts`), because `data-element-id` is NOT unique to the
 * main canvas: every binding also renders the same element (same
 * `data-element-id`, non-interactive) in the slide-thumbnail rail, so an
 * unscoped page-wide query over-counts by 2-3x.
 */
function equationElements(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"] [data-element-id]:has(math)');
}

/** Fill the LaTeX textarea and wait for the live MathML preview to pick it up. */
async function typeLatex(dialog: Locator, latex: string, expectedText: string): Promise<void> {
	await latexTextarea(dialog).fill(latex);
	await expect(
		dialog.locator('math').first(),
		'live preview reflects the typed LaTeX',
	).toContainText(expectedText);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('equation editing', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('inserts a new equation via the ribbon dialog and renders it on the slide', async ({
		page,
	}) => {
		await loadDeck(page);
		const before = await equationElements(page).count();

		await switchToInsertTab(page);
		await openInsertEquationDialog(page);

		const dialog = insertDialog(page);
		await expect(dialog).toBeVisible();

		await typeLatex(dialog, 'x=42', '42');

		const insertBtn = submitButton(dialog, 'Insert');
		await expect(insertBtn).toBeEnabled();
		await insertBtn.click();
		await expect(dialog).toBeHidden();

		// The rendered MathML on the slide - not just the dialog closing - is
		// the assertion: a real `<math>` element carrying the typed content.
		const onSlide = equationElements(page);
		await expect(onSlide).toHaveCount(before + 1);
		await expect(onSlide.last().locator('math')).toContainText('42');
	});

	test('re-opens an existing equation for editing without duplicating or reverting it', async ({
		page,
	}, testInfo) => {
		const framework = testInfo.project.name;
		await loadDeck(page);
		const before = await equationElements(page).count();

		await switchToInsertTab(page);
		await openInsertEquationDialog(page);
		const insertDlg = insertDialog(page);
		await typeLatex(insertDlg, 'x=42', '42');
		await submitButton(insertDlg, 'Insert').click();
		await expect(insertDlg).toBeHidden();

		const equation = equationElements(page).last();
		await expect(equation).toBeVisible();
		await expect(equation.locator('math')).toContainText('42');

		// Deselect, then repeat the click / click-again sequence that used to
		// collapse an equation to the literal "[Equation]" placeholder text via
		// plain inline editing (the fixed bug). On React, clicking an
		// already-selected equation a second time itself routes to the editor
		// (mirrors the exact bug trigger); Angular instead requires an explicit
		// double-click. Try the cheaper single-click-again path first and only
		// fall back to a double-click if no dialog appeared, so the same
		// sequence works for both without double-clicking into an already-open
		// dialog (which would fail: the modal backdrop intercepts the click).
		await page.keyboard.press('Escape');
		await equation.click();
		await equation.click();
		if (
			!(await page
				.getByRole('dialog')
				.isVisible()
				.catch(() => false))
		) {
			await equation.dblclick();
		}

		if (framework === 'vue') {
			// KNOWN GAP: Vue has no click/dblclick route back into the equation
			// editor for an existing equation (`enterInlineEdit` only guards
			// against destructive plain-text editing; `PowerPointViewer.vue`
			// never opens `EquationEditorDialog` with `existing-omml` set, nor
			// handles its `@apply` event). So there is nothing to re-edit yet -
			// what the fix *does* guarantee, and what we assert here, is that
			// the click sequence leaves the equation exactly as it was:
			// rendered MathML with its original content, never the destructive
			// "[Equation]" fallback text.
			await expect(page.getByRole('dialog')).toHaveCount(0);
			await expect(equationElements(page)).toHaveCount(before + 1);
			await expect(equation.locator('math')).toContainText('42');
			await expect(equation).not.toHaveText('[Equation]');
			return;
		}

		const editDlg = editDialog(page);
		await expect(
			editDlg,
			`${framework}: double-click on an equation opens the edit dialog`,
		).toBeVisible();

		// The textarea must be seeded from the existing OMML, not blank.
		await expect(latexTextarea(editDlg)).toHaveValue(/42/);

		await typeLatex(editDlg, 'y=99', '99');
		await submitButton(editDlg, 'Update').click();
		await expect(editDlg).toBeHidden();

		// Exactly one equation remains on the slide: edited in place, not
		// duplicated into a second element.
		const onSlide = equationElements(page);
		await expect(onSlide).toHaveCount(before + 1);
		const updated = onSlide.last();
		await expect(updated.locator('math')).toContainText('99');
		await expect(updated.locator('math')).not.toContainText('42');
		await expect(updated).not.toHaveText('[Equation]');
	});

	test('equation content survives a Save .pptx / reload round-trip', async ({ page }) => {
		mkdirSync(outputDir, { recursive: true });
		await loadDeck(page);
		const before = await equationElements(page).count();

		await switchToInsertTab(page);
		await openInsertEquationDialog(page);
		const dialog = insertDialog(page);
		await typeLatex(dialog, 'x=42', '42');
		await submitButton(dialog, 'Insert').click();
		await expect(dialog).toBeHidden();

		const equation = equationElements(page).last();
		await expect(equation.locator('math')).toContainText('42');

		// Deselect the freshly-inserted equation first.
		await page.keyboard.press('Escape');

		// Save via File ▸ Save .pptx. Scoped to the ribbon toolbar (matches
		// `switchToInsertTab`) rather than an unscoped `page.locator('button')`
		// text filter (the pattern save-corruption-repro.spec.ts uses, but that
		// spec's own docstring notes it was only ever run `--project=react` -
		// it does not reliably resolve on Angular).
		const fileTab = page
			.getByRole('toolbar', { name: 'Presentation toolbar' })
			.getByRole('button', { name: 'File', exact: true });
		await fileTab.click();
		await page.waitForTimeout(300);

		// React/Vue label this button "Save .pptx"; Angular's File tab only
		// offers a single generic "Save" button (always .pptx format, per its
		// "Save as Presentation (.pptx)" tooltip) rather than React/Vue's
		// separate .pptx/.ppsx/.pptm buttons - a real feature gap, not a test
		// bug. `.last()` picks the File-tab-scoped button over the persistent
		// quick-save icon some bindings also render earlier in the DOM.
		const downloadPromise = page.waitForEvent('download');
		const saveBtn = page.getByRole('button', { name: /^Save(\s\.pptx)?$/iu }).last();
		await saveBtn.click();

		const download = await downloadPromise;
		const savePath = resolve(outputDir, download.suggestedFilename() || 'equation-roundtrip.pptx');
		await download.saveAs(savePath);

		// Reload the just-saved file through the app's own file input. None of
		// the three demos expose an "Open another file" affordance while a deck
		// is already loaded (`#file-input` only exists in the empty/dropzone
		// state - e.g. demo-react's `main.tsx` unmounts it once `content` is
		// set), so a fresh navigation back to the dropzone is what a real
		// close-and-reopen round-trip looks like.
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(savePath);
		await page.locator('[data-pptx-element="true"]').first().waitFor();
		await page.waitForTimeout(500);

		const reloaded = equationElements(page);
		await expect(reloaded).toHaveCount(before + 1);
		await expect(reloaded.last().locator('math')).toContainText('42');
	});
});
