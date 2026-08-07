/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does an edit made in the properties inspector become an undo step?
 *
 * A user has exactly one mental model for Undo: whatever I just changed, Ctrl+Z
 * puts back. The route the change took to get there is an implementation
 * detail. So a value typed into the inspector's X field and the same value
 * produced by dragging the shape have to leave the same trace in history.
 *
 * They did not. React recorded canvas gestures and silently dropped every
 * inspector commit: the arrowhead repainted, the geometry moved, and the
 * ribbon's Undo stayed greyed out with an empty stack behind it, so Ctrl+Z was
 * a no-op too and the edit could not be taken back at all. Its history layer
 * watches state rather than being told about edits, and the cheap gate in front
 * of that watcher compared slide and element COUNTS. An inspector edit rewrites
 * a property in place and changes no count, so the gate saw nothing happen. A
 * drag escaped only because it bumped a pointer-commit nonce that the gate also
 * hashed. The other four bindings push history explicitly at each edit choke
 * point and were unaffected, which is exactly why this needs a shared spec: the
 * defect is invisible from inside the binding that has it.
 *
 * The spec drives two different kinds of inspector control on purpose, a
 * numeric text field and a dropdown, because they commit through different
 * event paths and only one of them has to be wired up for a manual check to
 * look fine.
 *
 * Run: bunx playwright test inspector-undo
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { inspector, resetTabSession } from './support/deck';

/**
 * A deck whose first slide is a connector.
 *
 * Chosen because it gives both control kinds on one selected element: the
 * standard position card, and the arrowhead dropdowns that only a connector
 * shows. The fixture's first connector authors no arrowheads, so the "before"
 * value is a known constant rather than whatever the deck happened to carry.
 */
const FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/connector-arrows.pptx', import.meta.url)),
);

/** The X of the fixture's first connector, in the inspector's units. */
const X_BEFORE = '53';
const X_AFTER = '222';

function connectorOnCanvas(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [data-element-id$="-conn-0"]').first();
}

/**
 * The ribbon's Undo control.
 *
 * By accessible name: it is a bare icon button in every binding, so its name is
 * the only thing all five agree on.
 */
function undoButton(page: Page): Locator {
	return page.getByRole('button', { name: /^undo/iu }).first();
}

/** The inspector's X position field, as a screen reader would find it. */
function positionX(page: Page): Locator {
	return inspector(page).getByRole('spinbutton', { name: 'X', exact: true });
}

/** The inspector's end-arrowhead dropdown. */
function endArrow(page: Page): Locator {
	return inspector(page).getByRole('combobox', { name: 'End Arrow', exact: true });
}

async function loadFixture(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1500, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(FIXTURE);
	await connectorOnCanvas(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
}

/**
 * Select the connector by clicking its line.
 *
 * The fixture's first connector spans its box corner to corner, so the box
 * centre is a point on the stroke. Selecting from the canvas rather than the
 * Elements list keeps this a test of the editor a user actually drives.
 *
 * Retried, because this spec re-selects immediately after an undo and an undo
 * MOVES the connector. Reading a box and clicking it are two steps, and a
 * binding that repaints asynchronously can land the second one at coordinates
 * the first step measured before the shape had moved. That misses the stroke
 * and selects nothing, which is a race in the harness rather than anything the
 * viewer did wrong, so re-measure and press again instead of failing.
 */
async function selectConnector(page: Page): Promise<void> {
	const card = endArrow(page);
	for (let attempt = 0; attempt < 4; attempt++) {
		const box = await connectorOnCanvas(page).boundingBox();
		if (!box) {
			throw new Error('the connector has no bounding box');
		}
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		if (await card.isVisible()) {
			return;
		}
	}
	// Out of attempts: report through the normal assertion so the failure names
	// the missing card rather than a bare timeout.
	await expect(card).toBeVisible();
}

/** Commit a value into a numeric inspector field the way a keyboard user does. */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.fill(value);
	await field.press('Enter');
	await field.blur();
}

test.describe('inspector edits are undoable', () => {
	test('the undo button is disabled on a freshly loaded deck', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);

		// Selecting is not editing: nothing has changed yet, so anything other
		// than a disabled button here would make the rest of this spec vacuous.
		await expect(undoButton(page)).toBeDisabled();
	});

	test('a numeric geometry field arms undo', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);

		await expect(positionX(page)).toHaveValue(X_BEFORE);
		await typeInto(positionX(page), X_AFTER);
		await expect(positionX(page)).toHaveValue(X_AFTER);

		await expect(undoButton(page)).toBeEnabled();
	});

	test('undo puts a numeric geometry edit back', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);
		await typeInto(positionX(page), X_AFTER);
		await expect(undoButton(page)).toBeEnabled();

		await undoButton(page).click();

		// Undo clears the selection in some bindings, so re-select before reading
		// the card rather than assuming it survived.
		await selectConnector(page);
		await expect(positionX(page)).toHaveValue(X_BEFORE);
	});

	test('a dropdown field arms undo', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);

		await expect(endArrow(page)).toHaveValue('none');
		await endArrow(page).selectOption('diamond');
		await expect(endArrow(page)).toHaveValue('diamond');

		await expect(undoButton(page)).toBeEnabled();
	});

	test('undo puts a dropdown edit back', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);
		await endArrow(page).selectOption('diamond');
		await expect(undoButton(page)).toBeEnabled();

		await undoButton(page).click();

		await selectConnector(page);
		await expect(endArrow(page)).toHaveValue('none');
	});

	test('the keyboard shortcut reverts an inspector edit too', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);
		await endArrow(page).selectOption('diamond');
		await expect(endArrow(page)).toHaveValue('diamond');

		// The button and Ctrl+Z must not disagree: while the stack was empty the
		// button merely LOOKED broken, and pressing the shortcut proved the edit
		// was genuinely unrecoverable rather than the predicate being wrong.
		await page.keyboard.press('Control+z');

		await selectConnector(page);
		await expect(endArrow(page)).toHaveValue('none');
	});

	test('entering a text box and leaving without typing is not an undo step', async ({ page }) => {
		await loadFixture(page);

		// The mirror image of the reported bug, and the reason it is worth
		// asserting alongside it: a binding can also record TOO MUCH. A no-op
		// commit on blur is not merely untidy, because the ribbon's Undo button
		// takes focus away from whatever is focused when it is pressed, so the
		// press itself manufactures a fresh entry and pops that instead of the
		// edit the user meant. Undo then never advances and the real edits behind
		// it are unreachable.
		const shape = page.locator('[data-pptx-viewport] [data-element-id$="-shape-0"]').first();
		const box = await shape.boundingBox();
		if (!box) {
			throw new Error('the text shape has no bounding box');
		}
		const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await page.mouse.click(centre.x, centre.y);
		await page.mouse.click(centre.x, centre.y);
		await page.mouse.click(box.x + box.width + 80, box.y + 10);

		await expect(undoButton(page)).toBeDisabled();
	});

	test('each inspector edit is its own undo step', async ({ page }) => {
		await loadFixture(page);
		await selectConnector(page);

		await typeInto(positionX(page), X_AFTER);
		await expect(positionX(page)).toHaveValue(X_AFTER);
		await endArrow(page).selectOption('diamond');
		await expect(endArrow(page)).toHaveValue('diamond');

		// One undo rolls back only the dropdown, leaving the earlier geometry
		// edit alone. A binding that coalesced both into a single snapshot, or
		// recorded only the last edit, fails here.
		await undoButton(page).click();
		await selectConnector(page);
		await expect(endArrow(page)).toHaveValue('none');
		await expect(positionX(page)).toHaveValue(X_AFTER);

		await undoButton(page).click();
		await selectConnector(page);
		await expect(positionX(page)).toHaveValue(X_BEFORE);
	});
});
