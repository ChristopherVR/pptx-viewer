/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	HANDOUT_MASTER_BACKGROUND,
	HANDOUT_MASTER_TEXT,
	NOTES_MASTER_BACKGROUND,
	NOTES_MASTER_TEXT,
} from './fixtures/generate-master-views-fixture';
import { LAYOUT_SHAPE_TEXT, MASTER_SHAPE_TEXT } from './fixtures/generate-template-editing-fixture';
import { GROUP_CHILD_NAMES } from './fixtures/generate-template-group-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/master-views.pptx', import.meta.url)),
);
/**
 * A deck whose slide master and slide layout each carry a real decorative
 * shape. `master-views.pptx` is built by `PptxHandler.createBlank`, whose
 * generated master and layouts have empty shape trees, so it cannot show
 * whether the Slides tab paints anything.
 */
const templateFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/template-editing.pptx', import.meta.url)),
);
/**
 * A deck whose layout carries a real `<p:grpSp>`, with children that interleave
 * `p:sp` and `p:cxnSp`. Editing a group inside a master or layout used to be a
 * silent no-op in every binding, because the save writer returned from its
 * group branch before the branch that writes a template element back to the
 * part it came from could run.
 */
const templateGroupFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/template-group.pptx', import.meta.url)),
);
/** The layout that carries the group, as the master-view rail names it. */
const GROUP_LAYOUT_NAME = 'Title Slide';
/** Arrow-key nudges applied to the inherited group; one press is one model px. */
const GROUP_NUDGE_STEPS = 20;
/**
 * The one shape `template-group.pptx` puts on the slide itself, used as the
 * fixed point the group's position is measured against.
 */
const SLIDE_ANCHOR_TEXT = 'SLIDE-SHAPE';

/** The layout's group as the SLIDE inherits it (`layout-` prefixed id). */
function templateGroup(page: Page): Locator {
	return page.locator('[data-element-id^="layout-layout-group-"]');
}

/** The layout's group in the master view, painted from the part's own tree. */
function masterLayoutGroup(page: Page): Locator {
	return page.locator('[data-element-id^="slide-layout-"][data-element-id$="-group-0"]');
}

/** Unlock the inherited layout/master shapes on the ordinary slide canvas. */
async function enterTemplateEditing(page: Page): Promise<void> {
	await ribbonTab(page, 'View').click();
	await toolbar(page).getByRole('button', { name: 'Templates Off', exact: true }).click();
}

/** Select the inherited group and walk it right with the arrow-key nudge. */
async function nudgeTemplateGroup(page: Page): Promise<void> {
	await (await canvasCopyOf(templateGroup(page))).click();
	for (let press = 0; press < GROUP_NUDGE_STEPS; press++) {
		await page.keyboard.press('ArrowRight');
	}
}

/**
 * How far the inherited group sits to the right of the slide's own shape, in
 * multiples of that shape's width.
 *
 * Measured as a RATIO because the two sessions this is compared across do not
 * share a stage scale: the pixel box of the same unmoved group differs between
 * the first load and the reload of the saved copy, so a raw `boundingBox().x`
 * comparison measures the zoom, not the edit. The anchor is a slide-owned
 * shape that no part of these tests touches.
 */
async function templateGroupOffset(page: Page): Promise<number> {
	const group = await (await canvasCopyOf(templateGroup(page))).boundingBox();
	const anchor = await (
		await canvasCopyOf(page.locator('[data-element-id]').filter({ hasText: SLIDE_ANCHOR_TEXT }))
	).boundingBox();
	if (!group || !anchor) {
		throw new Error('template group or its anchor shape is not on screen');
	}
	return (group.x - anchor.x) / anchor.width;
}

const outputDir = fileURLToPath(new URL('../test-results/master-views/', import.meta.url));
const UPDATED_NOTES_BACKGROUND = '#1a73e8';

/**
 * A shape painted from a slide master's or layout's OWN shape tree.
 *
 * The id namespace is the cross-binding contract here, and it is what makes
 * this assertion meaningful: the same artwork also reaches the ordinary slide
 * canvas as an inherited copy under `master-` / `layout-` ids, so matching on
 * the visible text alone would pass against the deck behind the master view.
 * `slide-master-` / `slide-layout-` ids exist only on a part's own tree.
 */
function masterPartShape(page: Page, prefix: 'slide-master-' | 'slide-layout-'): Locator {
	return page.locator(`[data-element-id^="${prefix}"]`);
}

/**
 * The copy of a master-part shape that is on the canvas rather than in the
 * navigation rail.
 *
 * The rail previews every master and layout with the same renderer, so the
 * same `data-element-id` appears once per preview plus once on the canvas
 * (thirteen copies on this fixture in one binding). `.first()` reliably picks
 * a preview, which is inert: gestures land on nothing. The canvas copy is
 * always the largest, and that is framework-neutral in a way that the
 * per-binding rail markup is not.
 */
async function canvasCopyOf(shapes: Locator): Promise<Locator> {
	const areas = await shapes.evaluateAll((nodes) =>
		nodes.map((node) => {
			const rect = node.getBoundingClientRect();
			return rect.width * rect.height;
		}),
	);
	return shapes.nth(areas.indexOf(Math.max(...areas)));
}

/** The text a Slide Master shape is retitled to by the editing spec. */
const RETITLED_MASTER_TEXT = 'MASTER-RETITLED';
/** The colour picked for the master background, to check it survives a save. */
const UPDATED_MASTER_BACKGROUND = '#2f6f4f';

/** The master background swatch on the Slides tab. */
function slidesBackgroundInput(page: Page): Locator {
	return masterTabs(page).locator('..').getByLabel('Master background color');
}

function toolbar(page: Page): Locator {
	return page.getByRole('toolbar', { name: 'Presentation toolbar' });
}

function ribbonTab(page: Page, name: string): Locator {
	return toolbar(page).getByRole('tab', { name, exact: true });
}

function masterTabs(page: Page): Locator {
	return page
		.getByRole('tablist')
		.filter({ has: page.getByRole('tab', { name: 'Handout', exact: true }) })
		.first();
}

async function openFixture(page: Page, path = fixturePath): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(path);
	await page.locator('[aria-roledescription="slide"]').first().waitFor();
}

async function enterMasterView(page: Page): Promise<void> {
	await ribbonTab(page, 'View').click();
	await toolbar(page).getByRole('button', { name: 'Slide Master', exact: true }).click();
	await expect(masterTabs(page)).toBeVisible();
	await expect(masterTabs(page).getByRole('tab', { name: 'Slides', exact: true })).toHaveAttribute(
		'aria-selected',
		'true',
	);
}

/**
 * Point the Slides tab at one of the active master's layouts.
 *
 * The rail entry is a button named after the layout. Matched loosely because
 * some bindings render the layout's preview inside the button, so its
 * accessible name is the preview text followed by the layout name. Scoped to
 * the sidebar that owns the master tablist: the ribbon's own layout gallery
 * offers buttons with the very same names.
 */
async function selectMasterLayout(page: Page, name: string): Promise<void> {
	await masterTabs(page).locator('..').getByRole('button', { name }).first().click();
}

async function selectMasterTab(page: Page, name: 'Slides' | 'Notes' | 'Handout'): Promise<void> {
	await masterTabs(page).getByRole('tab', { name, exact: true }).click();
	await expect(masterTabs(page).getByRole('tab', { name, exact: true })).toHaveAttribute(
		'aria-selected',
		'true',
	);
}

async function closeMasterView(page: Page): Promise<void> {
	const sidebar = masterTabs(page).locator('..');
	await sidebar.getByRole('button').first().click();
	await expect(masterTabs(page)).toHaveCount(0);
}

async function saveDeck(page: Page, projectName: string): Promise<string> {
	await ribbonTab(page, 'File').click();
	const downloadPromise = page.waitForEvent('download');
	await toolbar(page)
		.getByRole('button', {
			name: /^Save(?: as)?(?: Presentation)?(?: \(\.pptx\)| \.pptx)?$/u,
		})
		.first()
		.click();
	const download = await downloadPromise;
	const savedPath = resolve(outputDir, `${projectName}-master-views-saved.pptx`);
	await download.saveAs(savedPath);
	return savedPath;
}

test.describe('slide master tab parity', () => {
	/**
	 * View > Slide Master was a blank page on every real deck in all five
	 * bindings: `PptxSlideMaster.elements` / `PptxSlideLayout.elements` were
	 * declared, read by all five master views, and never populated by the
	 * loader. This spec missed it for the same reason it survived so long -
	 * every content assertion was on the Notes and Handout tabs, which are the
	 * two parts that did get their shape trees parsed.
	 */
	test('paints the slide master and layout shape trees', async ({ page }, testInfo) => {
		await openFixture(page, templateFixturePath);
		await enterMasterView(page);

		// The Slides tab opens on the master itself, so its own artwork paints.
		await expect(masterPartShape(page, 'slide-master-').first()).toBeVisible();
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }).first(),
		).toBeVisible();

		// Every layout's tree is parsed too. Selecting one paints its own
		// artwork ON TOP OF its master's, which is what PowerPoint shows and
		// what the master's `p:spTree` is for.
		//
		// This used to assert the layout shape was already on screen with the
		// MASTER selected, on the assumption that the navigation rail previews
		// each layout with its element markers intact. No binding does that:
		// the previews are static stages, and the two that emit markers at all
		// have them stripped precisely so element queries hit the real canvas.
		// The assertion could only ever have passed by matching a preview, so
		// it proved nothing about the layout being paintable.
		await selectMasterLayout(page, 'Title Slide');
		await expect(
			masterPartShape(page, 'slide-layout-').filter({ hasText: LAYOUT_SHAPE_TEXT }).first(),
		).toBeVisible();
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }).first(),
		).toBeVisible();

		// And it survives a real save -> reload, so the shape tree is not being
		// rebuilt into something the loader can no longer see.
		await closeMasterView(page);
		const savedPath = await saveDeck(page, `${testInfo.project.name}-slides-tab`);
		await openFixture(page, savedPath);
		await enterMasterView(page);
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }).first(),
		).toBeVisible();
	});

	/**
	 * The Slides tab is an editing surface, and only two of five bindings
	 * treated it as one: svelte and vanilla render the master into their
	 * ordinary editable stage and got text and Delete for free, while React
	 * resolved master ids against a lookup built from `slides` (so every
	 * handler bailed on its first line) and gated the editor keymap on
	 * `mode === 'edit'`, Angular had no delete affordance at all, and Vue had
	 * neither. All five write through the same shared routing rule now.
	 */
	test('edits a master shape inline and deletes it', async ({ page }) => {
		await openFixture(page, templateFixturePath);
		await enterMasterView(page);

		const shape = await canvasCopyOf(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }),
		);
		await expect(shape).toBeVisible();

		// Inline text editing. `[data-inline-editor]` is the cross-binding marker
		// for the editing surface (see `INLINE_EDITOR_SELECTOR` in shared); a bare
		// `[contenteditable]` also matches the hidden speaker-notes box.
		// The editors put the caret at the END of the existing text rather than
		// selecting it, so the marker is APPENDED and matched as a substring.
		await shape.dblclick();
		const editor = page.locator('[data-inline-editor]');
		await editor.waitFor();
		await page.keyboard.type(RETITLED_MASTER_TEXT);
		// Commit by blurring; Escape cancels. Re-clicking the already-selected
		// Slides tab is the one neutral blur target every binding renders.
		await masterTabs(page).getByRole('tab', { name: 'Slides', exact: true }).click();
		await expect(editor).toHaveCount(0);
		const edited = masterPartShape(page, 'slide-master-').filter({
			hasText: MASTER_SHAPE_TEXT + RETITLED_MASTER_TEXT,
		});
		// Count, not visibility: one binding's rail preview renders the same id
		// off-screen, so the first match can exist without being visible.
		await expect.poll(() => edited.count()).toBeGreaterThan(0);
		await expect(await canvasCopyOf(edited)).toBeVisible();

		// Delete: select the shape, press Delete, and it leaves the shape tree.
		//
		// Escape first, so the click that follows is a SELECTION click in every
		// binding. The shape is still selected from the edit above, and React
		// (like PowerPoint) treats a click on an already-selected text shape as
		// "put the caret in the text": that reopens the inline editor, and the
		// keymap's typing gate then swallows Delete, so the shape survived a
		// gesture that deleted it in the other four. Escape leaves the text
		// context without deselecting anything else.
		await page.keyboard.press('Escape');
		const retitled = await canvasCopyOf(edited);
		await retitled.click();
		await page.keyboard.press('Delete');
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: RETITLED_MASTER_TEXT }),
		).toHaveCount(0);
	});

	test('deletes a master shape and keeps it deleted through a save', async ({ page }, testInfo) => {
		await openFixture(page, templateFixturePath);
		await enterMasterView(page);

		const shape = await canvasCopyOf(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }),
		);
		await shape.click();
		await page.keyboard.press('Delete');
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }),
		).toHaveCount(0);

		await closeMasterView(page);
		const savedPath = await saveDeck(page, `${testInfo.project.name}-master-delete`);
		await openFixture(page, savedPath);
		await enterMasterView(page);
		await expect(
			masterPartShape(page, 'slide-master-').filter({ hasText: MASTER_SHAPE_TEXT }),
		).toHaveCount(0);
	});

	/**
	 * Editing a GROUP in a layout was a no-op in all five bindings: the save
	 * writer's `el.type === 'group'` branch returned before the template branch
	 * further down, so the layout came back byte-identical however the group was
	 * moved, retyped or deleted. Three save-side defects had to be fixed
	 * together for the write-back to work - the bucket key for a group said
	 * `p:sp` instead of `p:grpSp`, `getCnvPrNode` could not find a group's
	 * `p:cNvPr`, and `serializeShapeLocks` had no `a:grpSpLocks` branch.
	 */
	test('moves an inherited layout group on the canvas', async ({ page }) => {
		await openFixture(page, templateGroupFixturePath);

		const before = await templateGroupOffset(page);
		await enterTemplateEditing(page);
		await nudgeTemplateGroup(page);

		expect(await templateGroupOffset(page), 'the nudge moved the group on screen').toBeGreaterThan(
			before + 0.05,
		);
	});

	/**
	 * The save half of the same edit.
	 *
	 * Angular and Vanilla used to drop EVERY inherited-template edit here, and
	 * the reason was neither the group nor their save wiring: both warm the
	 * layout gallery while building their ribbon, and `getLayoutPreview` dropped
	 * the layout ELEMENT cache and re-parsed the part, so `layoutXmlMap` ended up
	 * holding a second tree while the elements on screen still pointed at the
	 * first. The save writer patches an inherited element's `rawXml` node IN
	 * PLACE and then looks for it in that map, found the twin from the second
	 * parse, matched it on `p:cNvPr` identity, and threw the patched one away.
	 * React only fetches previews when the gallery opens, which is the only
	 * reason it looked fine. Core parses each layout once per handler now.
	 */
	test('keeps an inherited layout group move through a save', async ({ page }, testInfo) => {
		await openFixture(page, templateGroupFixturePath);
		await enterTemplateEditing(page);
		await nudgeTemplateGroup(page);
		const nudged = await templateGroupOffset(page);

		const savedPath = await saveDeck(page, `${testInfo.project.name}-layout-group-move`);
		await openFixture(page, savedPath);
		expect(await templateGroupOffset(page), 'the move survived the save').toBeCloseTo(nudged, 2);

		// The group is still a group: all four children came back with it, and
		// none of them was promoted into the layout's own shape tree. A group
		// child's id derives from the group's own `layout-` prefixed base id, so
		// an id-only template test lifts every child out of the `<p:grpSp>` and
		// appends it to the layout as a top-level sibling.
		// Counted with `toBeGreaterThan`, not an exact total: some bindings render
		// the slide rail preview with element markers intact, so every id on the
		// canvas has a second copy off it.
		for (const slot of ['shape-0', 'conn-0', 'shape-1', 'conn-1']) {
			await expect
				.poll(() => page.locator(`[data-element-id$="-group-slideLayout1-0-${slot}"]`).count())
				.toBeGreaterThan(0);
		}

		// And in their authored order. Ids are assigned by document position, so
		// a group re-emitted with its children bucketed by tag (all `p:sp`, then
		// all `p:cxnSp`) comes back with `GroupBox2` in slot 0. The group is
		// rebuilt on this path while the layout around it is passthrough, and the
		// two carry document order differently.
		await expect(
			page.locator('[data-element-id$="-group-slideLayout1-0-shape-0"]').first(),
		).toHaveText(GROUP_CHILD_NAMES[0]);
		await expect(
			page.locator('[data-element-id$="-group-slideLayout1-0-shape-1"]').first(),
		).toHaveText(GROUP_CHILD_NAMES[2]);
	});

	/**
	 * The Slide Master view paints a layout's own `<p:grpSp>`, deletes it, and
	 * keeps it deleted through a save.
	 *
	 * Vue used to fail the delete half while the other four passed, and for a
	 * reason nothing about groups: its overlay resolved a click to the nearest
	 * `[data-element-id]`, which inside a group is a CHILD, and no master-view
	 * write matches a child id. It routes hits through the shared
	 * `masterViewOwnerElementId` rule now.
	 */
	test('deletes a layout group in the master view', async ({ page }, testInfo) => {
		await openFixture(page, templateGroupFixturePath);
		await enterMasterView(page);
		await selectMasterLayout(page, GROUP_LAYOUT_NAME);

		await expect(masterLayoutGroup(page)).not.toHaveCount(0);
		const group = masterPartShape(page, 'slide-layout-').filter({ hasText: GROUP_CHILD_NAMES[0] });
		await (await canvasCopyOf(group)).click();
		await page.keyboard.press('Delete');
		await expect(masterLayoutGroup(page)).toHaveCount(0);

		// And it stays deleted: the layout part is rewritten from the master
		// view's element list, so the group has to be gone from the saved
		// `p:sldLayout` as well as from the screen. React reached neither half of
		// this until it started passing `slideMasters` to `save()` at all.
		await closeMasterView(page);
		const savedPath = await saveDeck(page, `${testInfo.project.name}-layout-group-delete`);
		await openFixture(page, savedPath);
		await enterMasterView(page);
		await selectMasterLayout(page, GROUP_LAYOUT_NAME);
		await expect(masterLayoutGroup(page)).toHaveCount(0);
	});

	/**
	 * A master or layout background is either a literal `p:bgPr` fill or a
	 * themed `p:bgRef` into the theme's `a:bgFillStyleLst`. Picking a colour
	 * replaces the reference, which is what PowerPoint itself writes (COM
	 * verified); leaving it alone must preserve the reference verbatim. The
	 * writer used to flatten every master's `bgRef` on the first save of any
	 * deck, and a layout-level colour reached no writer at all because nothing
	 * ever passed the separate `slideLayouts` save option.
	 */
	test('persists a master background through save and reload', async ({ page }, testInfo) => {
		await openFixture(page, templateFixturePath);
		await enterMasterView(page);

		const swatch = slidesBackgroundInput(page);
		await expect(swatch).toBeVisible();
		await swatch.fill(UPDATED_MASTER_BACKGROUND);
		await expect(swatch).toHaveValue(UPDATED_MASTER_BACKGROUND);

		await closeMasterView(page);
		const savedPath = await saveDeck(page, `${testInfo.project.name}-master-background`);

		await openFixture(page, savedPath);
		await enterMasterView(page);
		await expect(slidesBackgroundInput(page)).toHaveValue(UPDATED_MASTER_BACKGROUND);
	});
});

test.describe('notes and handout master parity', () => {
	test('navigates, edits, saves, and reloads master properties', async ({ page }, testInfo) => {
		await openFixture(page);
		await enterMasterView(page);

		await selectMasterTab(page, 'Notes');
		await expect(page.getByText(NOTES_MASTER_TEXT, { exact: true })).toBeVisible();
		const notesBackground = page.getByLabel('Master background color');
		await expect(notesBackground).toHaveValue(NOTES_MASTER_BACKGROUND.toLowerCase());
		await notesBackground.fill(UPDATED_NOTES_BACKGROUND);
		await expect(notesBackground).toHaveValue(UPDATED_NOTES_BACKGROUND);

		await selectMasterTab(page, 'Handout');
		await expect(page.getByText(HANDOUT_MASTER_TEXT, { exact: true })).toBeVisible();
		const handoutBackground = page.getByLabel('Master background color');
		await expect(handoutBackground).toHaveValue(HANDOUT_MASTER_BACKGROUND.toLowerCase());
		const ninePerPage = masterTabs(page)
			.locator('..')
			.getByRole('button', { name: '9', exact: true });
		await ninePerPage.click();
		await expect(ninePerPage).toHaveAttribute('aria-pressed', 'true');

		await closeMasterView(page);
		const savedPath = await saveDeck(page, testInfo.project.name);

		await openFixture(page, savedPath);
		await enterMasterView(page);
		await selectMasterTab(page, 'Notes');
		await expect(page.getByLabel('Master background color')).toHaveValue(UPDATED_NOTES_BACKGROUND);
		await expect(page.getByText(NOTES_MASTER_TEXT, { exact: true })).toBeVisible();
		await selectMasterTab(page, 'Handout');
		await expect(page.getByText(HANDOUT_MASTER_TEXT, { exact: true })).toBeVisible();
		await expect(
			masterTabs(page).locator('..').getByRole('button', { name: '9', exact: true }),
		).toHaveAttribute('aria-pressed', 'true');
	});
});
