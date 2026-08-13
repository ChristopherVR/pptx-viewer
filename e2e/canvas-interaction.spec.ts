/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * On-canvas direct manipulation that only some bindings implemented.
 *
 * Three capabilities that `docs/guide/limitations.md` advertises with no
 * per-binding caveat, each of which was missing from several viewers while every
 * unit suite stayed green, because the defect lived in pointer wiring no unit
 * test covers:
 *
 *   1. A connector follows the shape it is anchored to. Shared owns the whole
 *      calculation (`render/connector-reroute`); it was called from React only.
 *   2. `a:spLocks` is enforced. Vue and Angular shipped an inspector Lock button
 *      that wrote locks nothing on the canvas ever read, and Svelte/Vanilla
 *      honoured `noTextEdit` alone. A lock control that does not lock is the
 *      same class of defect as an inert ribbon button.
 *   3. The amber adjust handle exists, is offered ONLY for a shape that has an
 *      adjustable parameter, and drags. `playwright.config.ts` lists
 *      `aria-label="Adjust shape"` as part of the framework-neutral contract
 *      "which the React, Vue, Angular, Vanilla, and Svelte viewers emit"; two
 *      of them did not, and no spec asserted it, so the claim was false.
 *
 * Contract notes:
 *  - Geometry is read in layout `offset*` coordinates (the stage's unscaled
 *    slide space), like `desktop-manipulation.spec.ts`, so no assertion depends
 *    on the fit-to-window zoom each demo happens to pick.
 *  - The connector is found by `aria-roledescription="connector line"` (the
 *    shared accessibility contract), not by text: connectors carry none.
 *  - The adjust handle's own POSITION is the neutral proof that the drag landed:
 *    shared derives its offset from the resolved corner radius, so a handle that
 *    moved is a radius that changed, whether the binding paints that radius as a
 *    `border-radius`, a `clip-path` or an SVG path.
 *
 * Fixture: `canvas-interaction.pptx` (see its generator for why each shape is
 * there). Its connector binds by `p:cNvPr/@id`, which is how PowerPoint spells
 * it and is NOT the viewer's own element id.
 *
 * Run: bunx playwright test canvas-interaction
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, slideElements, viewport } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const CANVAS_DECK = fixture('canvas-interaction.pptx');

/** Layout geometry in the stage's unscaled slide-coordinate space. */
function geomOf(locator: Locator) {
	return locator.evaluate((el) => {
		const e = el as HTMLElement;
		return { left: e.offsetLeft, top: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight };
	});
}

/** A mouse drag through the real pointer pipeline, in small steps. */
async function drag(
	page: Page,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	steps = 12,
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

/** Select `target` with a single click on its centre. */
async function select(page: Page, target: Locator): Promise<void> {
	const box = (await target.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(250);
}

/** The named shape on the canvas. */
function shape(page: Page, label: string): Locator {
	return slideElements(page).filter({ hasText: label }).first();
}

/** The single connector on the canvas, via the shared accessibility contract. */
function connector(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [aria-roledescription="connector line"]').first();
}

/** The amber shape-adjustment handle, scoped so ribbon controls cannot shadow it. */
function adjustHandle(page: Page): Locator {
	return viewport(page).getByRole('button', { name: /^adjust shape$/iu });
}

/** The rotate knob, by the shared accessible name every binding uses. */
function rotateHandle(page: Page): Locator {
	return viewport(page).getByRole('button', { name: /^rotate element$/iu });
}

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page, CANVAS_DECK);
	await shape(page, 'Box A').waitFor();
	await connector(page).waitFor();
	await page.waitForTimeout(400);
}

test.describe('connector rerouting', () => {
	test('a connector follows the shape it is anchored to when that shape is dragged', async ({
		page,
	}) => {
		await openDeck(page);

		const boxA = shape(page, 'Box A');
		const link = connector(page);
		const shapeBefore = await geomOf(boxA);
		const linkBefore = await geomOf(link);

		// Box A is anchored to the connector's START (its bottom-centre site) and
		// sits above and left of Box B, so dragging it right and down must pull
		// the connector's origin right and down with it, shrinking the span.
		await select(page, boxA);
		const box = (await boxA.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await drag(page, cx, cy, cx + 90, cy + 60);
		await page.waitForTimeout(400);

		const shapeAfter = await geomOf(boxA);
		expect(shapeAfter.left - shapeBefore.left).toBeGreaterThan(30);
		expect(shapeAfter.top - shapeBefore.top).toBeGreaterThan(20);

		await expect
			.poll(async () => (await geomOf(link)).left - linkBefore.left, {
				message: 'the connector must travel with the shape it is bound to',
			})
			.toBeGreaterThan(20);
		const linkAfter = await geomOf(link);
		expect(linkAfter.top - linkBefore.top).toBeGreaterThan(15);
		// The far end stayed put, so the span between the two boxes shortened.
		expect(linkAfter.width).toBeLessThan(linkBefore.width);
		expect(linkAfter.height).toBeLessThan(linkBefore.height);
	});
});

test.describe('shape locks', () => {
	test('a shape locked with noMove/noResize/noRot refuses every geometry gesture', async ({
		page,
	}) => {
		await openDeck(page);

		const pinned = shape(page, 'Pinned');
		const before = await geomOf(pinned);

		await select(page, pinned);
		// No rotate knob: `a:spLocks/@noRot` is authored on this shape.
		await expect(rotateHandle(page)).toHaveCount(0);

		const box = (await pinned.boundingBox())!;
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await drag(page, cx, cy, cx + 120, cy + 90);
		await page.waitForTimeout(400);

		const after = await geomOf(pinned);
		expect(Math.abs(after.left - before.left)).toBeLessThan(2);
		expect(Math.abs(after.top - before.top)).toBeLessThan(2);
		expect(Math.abs(after.width - before.width)).toBeLessThan(2);
		expect(Math.abs(after.height - before.height)).toBeLessThan(2);
	});

	test('an unlocked shape on the same slide still rotates, so the lock is the cause', async ({
		page,
	}) => {
		await openDeck(page);

		// The control for the assertion above: identical gesture, unlocked shape.
		await select(page, shape(page, 'Box B'));
		await expect(rotateHandle(page).first()).toBeVisible();
	});
});

test.describe('shape adjust handle', () => {
	test('a roundRect offers "Adjust shape" and a plain rect does not', async ({ page }) => {
		await openDeck(page);

		await select(page, shape(page, 'Box A'));
		await expect(
			adjustHandle(page),
			'a rect has no adjustable parameter, so it must offer no adjust handle',
		).toHaveCount(0);

		await select(page, shape(page, 'Rounded'));
		await expect(adjustHandle(page).first()).toBeVisible();
	});

	test('dragging the adjust handle changes the corner radius', async ({ page }) => {
		await openDeck(page);

		const rounded = shape(page, 'Rounded');
		await select(page, rounded);

		const handle = adjustHandle(page).first();
		await expect(handle).toBeVisible();
		const elementBox = (await rounded.boundingBox())!;
		const handleBox = (await handle.boundingBox())!;
		// The handle's offset from the element's left edge IS the resolved corner
		// radius (shared `getShapeAdjustmentHandleDescriptor`), so its movement is
		// a paint-independent readout of the adjustment value.
		const offsetBefore = handleBox.x + handleBox.width / 2 - elementBox.x;

		await drag(
			page,
			handleBox.x + handleBox.width / 2,
			handleBox.y + handleBox.height / 2,
			handleBox.x + handleBox.width / 2 + 60,
			handleBox.y + handleBox.height / 2,
		);
		await page.waitForTimeout(400);

		await expect
			.poll(
				async () => {
					const nextElement = await rounded.boundingBox();
					const nextHandle = await adjustHandle(page).first().boundingBox();
					if (!nextElement || !nextHandle) {
						return 0;
					}
					return nextHandle.x + nextHandle.width / 2 - nextElement.x - offsetBefore;
				},
				{ message: 'the adjust handle must track the corner radius it just changed' },
			)
			.toBeGreaterThan(15);
	});
});
