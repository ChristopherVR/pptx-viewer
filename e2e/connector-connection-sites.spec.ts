/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do connectors reroute onto the shape's REAL connection sites, not a generic
 * bounding-box fallback that happens to look plausible?
 *
 * `packages/shared/src/render/connector-sites.ts`'s `getShapeConnectionSites`
 * resolves `a:stCxn/@idx` against the target's ECMA-376 `cxnLst` (falling back
 * to the four cardinal edge midpoints when a preset has none). Rerouting only
 * runs when the anchor shape actually moves (`connector-reroute.ts`), so this
 * spec drags each anchor to force it, rather than trusting the deck's authored
 * `a:xfrm` (which a passive load never recomputes).
 *
 *  - A `triangle` (default, isosceles `adj`): site index 0 is the ECMA apex at
 *    `x = left + width/2`. The historical bug used HALF that offset, so this
 *    is a real regression guard.
 *  - A `chartPlus` mark, whose preset carries NO `cxnLst` at all: site index 1
 *    must fall back to the plain 4-cardinal box (left-centre), landing at
 *    `x = left, y = top + height/2`, rather than erroring or collapsing.
 *
 * Contract notes:
 *  - Geometry is read in layout `offset*` coordinates (the stage's unscaled
 *    slide space), like `desktop-manipulation.spec.ts` and
 *    `canvas-interaction.spec.ts`, so no assertion depends on the fit-to-window
 *    zoom each demo happens to pick.
 *  - Each connector's far end is UNBOUND, so after a reroute the connector's
 *    on-screen top-left corner IS the resolved site (see
 *    `computeConnectorGeometry`): `min(sx,ex) = sx` when the fixed far corner
 *    stays to the lower-right of the anchor, which the fixture's coordinates
 *    guarantee.
 *
 * Fixture: `connection-sites.pptx` (see its generator for exact coordinates).
 *
 * Run: bunx playwright test connector-connection-sites
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('connection-sites.pptx');

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
	await page.waitForTimeout(200);
}

/** The named shape, or the connector attached to it, by their fixture labels. */
function shape(page: Page, label: string): Locator {
	return slideElements(page).filter({ hasText: label }).first();
}

/**
 * A connector line by its DOM position among all connectors, via the shared
 * accessibility contract. The fixture authors "Tri Link" before
 * "ChartPlus Link", so index 0 is the triangle's connector and index 1 is
 * chartPlus's, in every binding's render order.
 */
function connectorAt(page: Page, index: number): Locator {
	return page.locator('[data-pptx-viewport] [aria-roledescription="connector line"]').nth(index);
}

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page, FIXTURE);
	await shape(page, 'Triangle Anchor').waitFor();
	await shape(page, 'ChartPlus Anchor').waitFor();
	await page.waitForTimeout(400);
}

/**
 * Drag `anchor` down-and-right by a modest, fixed screen distance, forcing a
 * connector reroute, then return the anchor's post-drag geometry.
 *
 * The click point is the anchor's own bounding-box CENTRE: for an isosceles
 * triangle this is always inside the filled polygon (the shape is widest,
 * horizontally, at its vertical midpoint), and a `chartPlus` cross-mark's
 * centre sits exactly on the intersection of its two bars.
 */
async function dragAnchorDownRight(page: Page, anchor: Locator) {
	await select(page, anchor);
	const box = (await anchor.boundingBox())!;
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	await drag(page, cx, cy, cx + 60, cy + 45);
	await page.waitForTimeout(400);
	return geomOf(anchor);
}

test.describe('connector connection sites', () => {
	test('a connector bound to a triangle (idx 0) ends at the apex after the shape moves', async ({
		page,
	}) => {
		await openDeck(page);

		const triangle = shape(page, 'Triangle Anchor');
		const line = connectorAt(page, 0);

		const triangleAfter = await dragAnchorDownRight(page, triangle);
		const linkAfter = await geomOf(line);

		// Apex at default adj: x = left + width/2, y = top (the box's top edge).
		const expectedX = triangleAfter.left + triangleAfter.width / 2;
		const expectedY = triangleAfter.top;

		expect(
			Math.abs(linkAfter.left - expectedX),
			`connector left ${linkAfter.left} should equal the triangle's apex x ${expectedX}`,
		).toBeLessThan(6);
		expect(
			Math.abs(linkAfter.top - expectedY),
			`connector top ${linkAfter.top} should equal the triangle's apex y ${expectedY}`,
		).toBeLessThan(6);
	});

	test('a connector bound to chartPlus (idx 1) falls back to the left-centre cardinal site', async ({
		page,
	}) => {
		await openDeck(page);

		const chartPlus = shape(page, 'ChartPlus Anchor');
		const line = connectorAt(page, 1);

		const anchorAfter = await dragAnchorDownRight(page, chartPlus);
		const lineAfter = await geomOf(line);

		// 4-cardinal fallback, index 1 = left-centre: x = left, y = top + height/2.
		const expectedX = anchorAfter.left;
		const expectedY = anchorAfter.top + anchorAfter.height / 2;

		expect(
			Math.abs(lineAfter.left - expectedX),
			`connector left ${lineAfter.left} should equal chartPlus's left edge ${expectedX}`,
		).toBeLessThan(6);
		expect(
			Math.abs(lineAfter.top - expectedY),
			`connector top ${lineAfter.top} should equal chartPlus's vertical centre ${expectedY}`,
		).toBeLessThan(6);
	});
});
