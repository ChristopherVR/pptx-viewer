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

/** The amber shape-adjustment handles, scoped so ribbon controls cannot shadow them. */
function adjustHandle(page: Page): Locator {
	return viewport(page).getByRole('button', { name: /^adjust shape$/iu });
}

/** One endpoint handle of the selected connector, by the neutral data contract. */
function connectorEndpoint(page: Page, kind: 'start' | 'end'): Locator {
	return viewport(page).locator(`[data-pptx-connector-endpoint="${kind}"]`).first();
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

	// A preset has ONE handle per `a:avLst` guide and most have several, but
	// shared returned a single descriptor for every shape, so every guide after
	// the first was unreachable in all five bindings. "Arrow" is a `rightArrow`:
	// `adj1` is the shaft thickness, `adj2` the head length.
	test('a multi-adjust preset offers one handle per adjustable parameter', async ({ page }) => {
		await openDeck(page);

		await select(page, shape(page, 'Rounded'));
		await expect(adjustHandle(page)).toHaveCount(1);

		await select(page, shape(page, 'Arrow'));
		await expect(adjustHandle(page)).toHaveCount(2);
		// Each drives a DIFFERENT guide; two diamonds writing `adj1` would be a
		// convincing-looking way to ship the same bug twice.
		const keys = await viewport(page)
			.locator('[data-pptx-adjust-key]')
			.evaluateAll((nodes) =>
				nodes.map((node) => (node as HTMLElement).dataset.pptxAdjustKey ?? ''),
			);
		expect([...new Set(keys)].sort()).toStrictEqual(['adj1', 'adj2']);
	});

	test('dragging the second handle of a multi-adjust preset moves it, not the first', async ({
		page,
	}) => {
		await openDeck(page);
		await select(page, shape(page, 'Arrow'));

		const first = adjustHandle(page).nth(0);
		const second = adjustHandle(page).nth(1);
		const firstBefore = (await first.boundingBox())!;
		const secondBefore = (await second.boundingBox())!;

		// The head-length handle travels horizontally; pull it left.
		await drag(
			page,
			secondBefore.x + secondBefore.width / 2,
			secondBefore.y + secondBefore.height / 2,
			secondBefore.x + secondBefore.width / 2 - 50,
			secondBefore.y + secondBefore.height / 2,
		);
		await page.waitForTimeout(400);

		await expect
			.poll(
				async () => {
					const box = await adjustHandle(page).nth(1).boundingBox();
					return box ? Math.abs(box.x - secondBefore.x) : 0;
				},
				{ message: 'the grabbed handle must move with the guide it drives' },
			)
			.toBeGreaterThan(15);
		const firstAfter = (await adjustHandle(page).nth(0).boundingBox())!;
		expect(
			Math.abs(firstAfter.x - firstBefore.x),
			'the untouched handle must not have moved: the drag wrote its own guide only',
		).toBeLessThan(3);
	});
});

test.describe('connector endpoint authoring', () => {
	// Attaching / detaching a connector end existed in NO binding: React shipped
	// a `ConnectorOverlay` for a site-to-site creation gesture, but nothing ever
	// passed the `connectorCreationMode` prop that mounts it, so the path was
	// unreachable; the other four had no overlay at all. The fixture's connector
	// arrives bound at both ends by `p:cNvPr/@id`.
	test('a selected connector exposes both endpoint handles, both bound', async ({ page }) => {
		await openDeck(page);

		// Nothing selected: no endpoint chrome.
		await expect(connectorEndpoint(page, 'start')).toHaveCount(0);

		await select(page, connector(page));
		await expect(connectorEndpoint(page, 'start')).toBeVisible();
		await expect(connectorEndpoint(page, 'end')).toBeVisible();
		await expect(connectorEndpoint(page, 'start')).toHaveAttribute(
			'data-pptx-connector-attached',
			'true',
		);
		await expect(connectorEndpoint(page, 'end')).toHaveAttribute(
			'data-pptx-connector-attached',
			'true',
		);
	});

	test('dragging an end onto empty canvas DETACHES it, and back onto a shape re-attaches', async ({
		page,
	}) => {
		await openDeck(page);
		await select(page, connector(page));

		const endHandle = connectorEndpoint(page, 'end');
		const before = (await endHandle.boundingBox())!;
		const canvas = (await shape(page, 'Box A').boundingBox())!;

		// Drop it in the gap between the boxes, well clear of any site.
		await drag(
			page,
			before.x + before.width / 2,
			before.y + before.height / 2,
			canvas.x + canvas.width + 40,
			canvas.y + canvas.height + 30,
		);
		await page.waitForTimeout(400);

		await expect
			.poll(
				async () => connectorEndpoint(page, 'end').getAttribute('data-pptx-connector-attached'),
				{
					message: 'a drop on empty canvas must remove the a:endCxn, not keep a stale one',
				},
			)
			.toBe('false');
		// The start end kept its own binding: a detach is per-end.
		await expect(connectorEndpoint(page, 'start')).toHaveAttribute(
			'data-pptx-connector-attached',
			'true',
		);
		// Now drop it back on Box B's top-centre connection site.
		const boxB = (await shape(page, 'Box B').boundingBox())!;
		const loose = (await connectorEndpoint(page, 'end').boundingBox())!;
		await drag(
			page,
			loose.x + loose.width / 2,
			loose.y + loose.height / 2,
			boxB.x + boxB.width / 2,
			boxB.y,
		);
		await page.waitForTimeout(400);

		await expect
			.poll(
				async () => connectorEndpoint(page, 'end').getAttribute('data-pptx-connector-attached'),
				{
					message: 'a drop on a connection site must write an a:endCxn',
				},
			)
			.toBe('true');
	});
});
