/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Template / master (slide layout & master) element editing e2e coverage.
 *
 * Background: the core slide loader merges the decorative shapes a slide
 * inherits from its layout and master into `slide.elements`, giving each a
 * `layout-` / `master-` prefixed id. Every binding partitions those out at
 * load time into a separate render layer (`templateElementsBySlideId`) that
 * is interaction-locked UNLESS `editTemplateMode` is on, toggled via the
 * "Templates On" / "Templates Off" pill in the View ribbon tab
 * (`ViewSection.tsx` / `ViewSection.vue` / `ribbon-view-section.component.ts`).
 * Edits made in that mode are merged back into the owning layout/master XML
 * parts on save (`buildSaveSlides`), so they persist across reloads.
 *
 * Despite being a real, working, previously-audited feature (core + React +
 * Vue + Angular), it had zero e2e coverage. This spec exercises the full
 * lifecycle across all three frameworks:
 *   1. Toggling editTemplateMode via the View tab's pill.
 *   2. Template elements are inert (not interactive/selectable/editable) with
 *      the mode off, and become interactive only with it on -- while a normal
 *      slide-authored shape stays interactive regardless of the mode.
 *   3. An edit made to a template element (move + retext) survives toggling
 *      the mode off and back on, AND survives a real Save .pptx -> reload.
 *   4. Normal (non-template) slide editing keeps working while the mode is off.
 *
 * Fixture: `fixtures/template-editing.pptx` (see
 * `fixtures/generate-template-editing-fixture.ts`), a single slide with:
 *   - a normal slide-authored rect, text "SLIDE-SHAPE" (~x:380-580,y:200-340px)
 *   - a decorative shape injected into the slide's layout, text
 *     "TPL-LAYOUT-ORIG" (~x:10-212,y:624-672px)
 *   - a decorative shape injected into the slide's master, text
 *     "TPL-MASTER-ORIG" (~x:10-212,y:10-58px)
 * positioned in non-overlapping bands (on a 1280x720px canvas) so drag/click
 * assertions are unambiguous.
 *
 * Run: bunx playwright test template-editing --project=react
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	LAYOUT_SHAPE_TEXT,
	MASTER_SHAPE_TEXT,
	SLIDE_SHAPE_TEXT,
} from './fixtures/generate-template-editing-fixture';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/template-editing.pptx', import.meta.url)),
);
const outputDir = fileURLToPath(new URL('../test-results/template-editing/', import.meta.url));

/**
 * Locate a canvas element by its visible text using the `[data-element-id]`
 * attribute rather than the interaction-gated `[data-pptx-element="true"]`.
 * `data-element-id` is rendered unconditionally by all three bindings, while
 * `data-pptx-element` is only added by Vue/Angular while a layer is
 * interactive (React always renders it but disables pointer events instead),
 * so this is the one locator that finds a template element in BOTH modes.
 *
 * Scoped to the main editable stage (`[aria-roledescription="slide"]`,
 * emitted by all three bindings' `SlideCanvas` root only): thumbnails, the
 * slide sorter, and the export stage also render the same `data-element-id`
 * without that ancestor, so an unscoped `page.locator('[data-element-id]')`
 * can match the wrong (non-interactive) copy of the element.
 */
function elementByText(page: Page, text: string): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[data-element-id]')
		.filter({ hasText: text })
		.first();
}

/** Load the fixture deck and wait for all three shapes to render. */
async function openFixture(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-roledescription="slide"]').first().waitFor();
	await elementByText(page, SLIDE_SHAPE_TEXT).waitFor();
	await elementByText(page, LAYOUT_SHAPE_TEXT).waitFor();
	await elementByText(page, MASTER_SHAPE_TEXT).waitFor();
}

/** Switch to the View ribbon tab, where the template-mode toggle lives. */
async function switchToViewTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await toolbar.getByRole('button', { name: 'View', exact: true }).click();
	await expect(templateModeToggle(page)).toBeVisible();
}

/** The "Templates On" / "Templates Off" pill toggle in the View tab. */
function templateModeToggle(page: Page): Locator {
	return page.getByRole('button', { name: /^Templates (On|Off)$/u });
}

/**
 * Whether a canvas element currently participates in the interactive/
 * selectable contract: `data-pptx-element="true"` is present (Vue/Angular
 * only render that attribute while the template layer is interactive) AND
 * the node isn't `pointer-events: none` (React always renders the attribute
 * but disables pointer events while inert). Either check alone is
 * framework-specific; the conjunction is the true cross-framework "can this
 * be clicked right now" signal.
 */
async function isInteractive(locator: Locator): Promise<boolean> {
	return locator.evaluate((el) => {
		const hasHook = el.getAttribute('data-pptx-element') === 'true';
		const pe = getComputedStyle(el).pointerEvents;
		return hasHook && pe !== 'none';
	});
}

/** Layout geometry in the stage's unscaled slide-coordinate space. */
function geomOf(locator: Locator): Promise<{ left: number; top: number }> {
	return locator.evaluate((el) => {
		const e = el as HTMLElement;
		return { left: e.offsetLeft, top: e.offsetTop };
	});
}

/** A drag from (x1,y1) to (x2,y2) through the shared pointer-move pipeline. */
async function drag(
	page: Page,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	steps = 10,
): Promise<void> {
	await page.mouse.move(x1, y1);
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(
			Math.round(x1 + ((x2 - x1) * i) / steps),
			Math.round(y1 + ((y2 - y1) * i) / steps),
		);
	}
	await page.mouse.up();
}

/** Drag a locator's body by the given on-screen pixel delta. */
async function dragElementBy(page: Page, locator: Locator, dx: number, dy: number): Promise<void> {
	const box = (await locator.boundingBox())!;
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await drag(page, cx, cy, cx + dx, cy + dy);
}

/**
 * Double-click a locator to enter inline text editing, type `text`, then
 * commit by clicking an empty part of the canvas (Escape cancels instead).
 * The inline editors across all three bindings put the caret at the END of
 * the existing text rather than selecting it (see Angular's
 * `slide-canvas.component.ts` constructor comment: "do NOT select-all:
 * typing appends to the existing text"), so `text` is APPENDED, not a full
 * replacement. Callers therefore assert on a distinctive appended suffix via
 * substring matching, not exact equality.
 */
async function retextInline(
	page: Page,
	locator: Locator,
	text: string,
	force = false,
): Promise<void> {
	await locator.dblclick({ force });
	const editor = page.locator('[data-inline-editor]');
	await editor.waitFor();
	await page.keyboard.type(text);
	const stage = page.locator('[aria-roledescription="slide"]').first();
	const stageBox = (await stage.boundingBox())!;
	await page.mouse.click(stageBox.x + stageBox.width * 0.05, stageBox.y + stageBox.height * 0.95);
	await expect(editor).toBeHidden();
}

test.describe('template / master element editing', () => {
	test('template elements are inert with editTemplateMode off; a normal shape stays interactive', async ({
		page,
	}) => {
		await openFixture(page);

		const slideShape = elementByText(page, SLIDE_SHAPE_TEXT);
		const layoutShape = elementByText(page, LAYOUT_SHAPE_TEXT);
		const masterShape = elementByText(page, MASTER_SHAPE_TEXT);

		await switchToViewTab(page);
		await expect(templateModeToggle(page)).toHaveText('Templates Off');

		await expect
			.poll(() => isInteractive(layoutShape), { message: 'layout shape must be inert' })
			.toBe(false);
		await expect
			.poll(() => isInteractive(masterShape), { message: 'master shape must be inert' })
			.toBe(false);
		await expect
			.poll(() => isInteractive(slideShape), {
				message: 'normal slide shape must stay interactive',
			})
			.toBe(true);

		// Behavioural confirmation: dragging over the master shape's position
		// does not move it.
		const before = await geomOf(masterShape);
		await dragElementBy(page, masterShape, 80, 40);
		await page.waitForTimeout(200);
		expect(await geomOf(masterShape)).toEqual(before);

		// Double-clicking it does not open the inline text editor (force: true
		// since React leaves `pointer-events: none` on the inert node).
		await masterShape.dblclick({ force: true });
		await page.waitForTimeout(200);
		await expect(page.locator('[data-inline-editor]')).toHaveCount(0);
	});

	test('editTemplateMode on makes template elements interactive/editable; edits survive toggling off and back on', async ({
		page,
	}) => {
		await openFixture(page);
		await switchToViewTab(page);

		const layoutShape = elementByText(page, LAYOUT_SHAPE_TEXT);
		const masterShape = elementByText(page, MASTER_SHAPE_TEXT);

		await templateModeToggle(page).click();
		await expect(templateModeToggle(page)).toHaveText('Templates On');

		await expect
			.poll(() => isInteractive(layoutShape), { message: 'layout shape must become interactive' })
			.toBe(true);
		await expect
			.poll(() => isInteractive(masterShape), { message: 'master shape must become interactive' })
			.toBe(true);

		// Move the layout shape.
		await layoutShape.click();
		await page.waitForTimeout(150);
		const before = await geomOf(layoutShape);
		await dragElementBy(page, layoutShape, 90, 50);
		await page.waitForTimeout(250);
		const afterMove = await geomOf(layoutShape);
		expect(afterMove.left, 'x moved').not.toBe(before.left);
		expect(afterMove.top, 'y moved').not.toBe(before.top);

		// Retext the master shape via inline edit.
		await retextInline(page, masterShape, 'TPL-MASTER-EDITED');
		await expect(elementByText(page, 'TPL-MASTER-EDITED')).toBeVisible();

		// Toggle the mode off, then back on: both edits must persist.
		await templateModeToggle(page).click();
		await expect(templateModeToggle(page)).toHaveText('Templates Off');
		await templateModeToggle(page).click();
		await expect(templateModeToggle(page)).toHaveText('Templates On');

		await expect(elementByText(page, 'TPL-MASTER-EDITED')).toBeVisible();
		const afterToggle = await geomOf(elementByText(page, LAYOUT_SHAPE_TEXT));
		expect(afterToggle).toEqual(afterMove);
	});

	test('a template edit survives Save .pptx -> reload', async ({ page }, testInfo) => {
		await openFixture(page);
		await switchToViewTab(page);
		await templateModeToggle(page).click();
		await expect(templateModeToggle(page)).toHaveText('Templates On');

		const layoutShape = elementByText(page, LAYOUT_SHAPE_TEXT);
		await layoutShape.click();
		await page.waitForTimeout(150);
		const before = await geomOf(layoutShape);
		await dragElementBy(page, layoutShape, 100, 0);
		await page.waitForTimeout(250);
		const afterMove = await geomOf(layoutShape);
		expect(afterMove.left, 'x moved before save').not.toBe(before.left);

		const masterShape = elementByText(page, MASTER_SHAPE_TEXT);
		await retextInline(page, masterShape, 'TPL-MASTER-SAVED');
		await expect(elementByText(page, 'TPL-MASTER-SAVED')).toBeVisible();

		// Save via the File tab.
		const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
		await toolbar.getByRole('button', { name: 'File', exact: true }).click();
		await page.waitForTimeout(200);

		const downloadPromise = page.waitForEvent('download');
		// The Save button's accessible name is "Save .pptx" in React/Vue but
		// just "Save" in Angular (`pptx.toolbar.save`); match either. Scoped to
		// the ribbon toolbar: Angular also has a quick-access "Save" icon button
		// in its title bar (outside the ribbon, same handler) that would
		// otherwise be an equally-valid but ambiguous second match.
		await toolbar
			.getByRole('button', { name: /^Save(\s\.pptx)?$/u })
			.first()
			.click();
		const download = await downloadPromise;
		const savedPath = resolve(
			outputDir,
			`${testInfo.project.name}-${download.suggestedFilename() || 'template-editing-saved.pptx'}`,
		);
		await download.saveAs(savedPath);

		// Reload the saved file into a fresh viewer instance.
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(savedPath);
		await page.locator('[aria-roledescription="slide"]').first().waitFor();
		await switchToViewTab(page);
		await templateModeToggle(page).click();
		await expect(templateModeToggle(page)).toHaveText('Templates On');

		// The retext survived the round-trip.
		await expect(elementByText(page, 'TPL-MASTER-SAVED')).toBeVisible();
		// The move survived: the reloaded layout shape sits at the moved
		// position, not the fixture's original one.
		const reloadedGeom = await geomOf(elementByText(page, LAYOUT_SHAPE_TEXT));
		expect(reloadedGeom.left, 'moved x persisted through save/reload').not.toBe(before.left);
	});

	test('normal (non-template) slide editing keeps working with editTemplateMode off', async ({
		page,
	}) => {
		await openFixture(page);

		const slideShape = elementByText(page, SLIDE_SHAPE_TEXT);
		await slideShape.click();
		await page.waitForTimeout(150);
		const before = await geomOf(slideShape);
		await dragElementBy(page, slideShape, 60, 30);
		await page.waitForTimeout(250);
		const after = await geomOf(slideShape);
		expect(after.left, 'x moved').not.toBe(before.left);
		expect(after.top, 'y moved').not.toBe(before.top);

		await retextInline(page, slideShape, 'SLIDE-EDITED');
		await expect(elementByText(page, 'SLIDE-EDITED')).toBeVisible();
	});
});
