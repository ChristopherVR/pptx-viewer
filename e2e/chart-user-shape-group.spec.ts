/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A chart overlay shape grouped inside a `cdr:grpSp` (`c:userShapes`), run
 * identically against every framework demo.
 *
 * W2-F closed the "grouped shapes have no inspector UI" gap: a `grpSp`
 * anchor used to show up in the chart inspector as one row with no editing
 * of its own (only reachable through the SDK's path-based operations). The
 * shared `listChartUserShapeRows` (`packages/shared/src/render/chart-user-
 * shape-tree.ts`) now flattens a group's children into their own indented,
 * editable rows, addressed by path (`[topIndex, childIndex, ...]`) and
 * surfaced via `data-chart-user-shape-path` on each row.
 *
 * A follow-up wave closed the three remaining gaps in that same limitations
 * row: (1) a group row (top-level OR nested) now exposes its own container
 * transform as editable position/size (a top-level row edits the anchor's
 * own `from`/`to`, moving/resizing the whole group with children following;
 * a nested row edits its own `off`/`ext`); (2) an "Add shape here" action on
 * any group row inserts a new default shape INTO that group's children
 * instead of always appending top-level; (3) a nested (grouped) row now
 * presents its position/size as a chart-relative `from`/`to` fraction pair
 * (`chart-user-shape-row-frame.ts`), matching how a top-level `relSizeAnchor`
 * row already edits, instead of raw child-space EMU.
 *
 * The fixture (`chart-user-shape-group.pptx`, `e2e/fixtures/generate-chart-
 * user-shape-group-fixture.ts`) is a bar chart whose drawing overlay is one
 * `relSizeAnchor` (from (0.1, 0.6) to (0.9, 0.95)) wrapping a `grpSp` of two
 * text-box children, "Alpha" (left half) and "Beta" (right half); the
 * group's own `chOff`/`chExt` equal its `off`/`ext` (an identity transform),
 * so Alpha's chart-relative box is exactly (0.1, 0.6)-(0.5, 0.95) and Beta's
 * is exactly (0.5, 0.6)-(0.9, 0.95).
 *
 * Run: bunx playwright test chart-user-shape-group
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, inspector, loadDeck, selectElement } from './support/deck';

const CHART_FIXTURE = fixture('chart-user-shape-group.pptx');

/** Every rendered SVG `<text>` node's trimmed content inside the chart. */
async function overlayTexts(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
		if (!svg) {
			return [];
		}
		return [...svg.querySelectorAll('text')]
			.map((node) => (node.textContent ?? '').trim())
			.filter((t) => t.length > 0);
	});
}

/** The client-rect x of the first rendered SVG `<text>` node with this exact content. */
async function overlayTextX(page: Page, text: string): Promise<number | undefined> {
	return page.evaluate((needle) => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
		const node = svg
			? [...svg.querySelectorAll('text')].find((n) => (n.textContent ?? '').trim() === needle)
			: undefined;
		return node?.getBoundingClientRect().x;
	}, text);
}

/** The chart overlay SVG's markup, for asserting a transform landed anywhere inside it. */
async function overlaySvgHtml(page: Page): Promise<string> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
		return svg?.innerHTML ?? '';
	});
}

/** Every visible `input[type="number"]` inside a row, in DOM order, parsed as numbers. */
async function numberValues(row: Locator): Promise<number[]> {
	const inputs = row.locator('input[type="number"]:visible');
	const count = await inputs.count();
	const values: number[] = [];
	for (let i = 0; i < count; i++) {
		values.push(Number(await inputs.nth(i).inputValue()));
	}
	return values;
}

/** Fill the nth visible `input[type="number"]` inside a row and commit the change. */
async function setNumberValue(row: Locator, index: number, value: number): Promise<void> {
	const input = row.locator('input[type="number"]:visible').nth(index);
	await input.fill(String(value));
	await input.press('Tab');
}

async function openChartInspector(page: Page): Promise<import('@playwright/test').Locator> {
	await loadDeck(page, CHART_FIXTURE);
	const chart = page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
	await chart.waitFor();
	await page.waitForTimeout(300);
	// Selected via the shared accessibility contract, not `data-pptx-element`:
	// two bindings do not tag a chart's graphic frame as an element, matching
	// `chart-title-runs.spec.ts`'s same reasoning.
	await selectElement(page, chart);
	await expect(inspector(page)).toBeVisible();
	return chart;
}

test.describe('chart overlay grouped shapes (grpSp)', () => {
	test('renders both grouped children as their own overlay text', async ({ page }) => {
		await openChartInspector(page);

		await expect
			.poll(async () => overlayTexts(page))
			.toEqual(expect.arrayContaining(['Alpha', 'Beta']));
	});

	test('the inspector lists the group and each child as separate, indented rows', async ({
		page,
	}) => {
		await openChartInspector(page);

		const groupRow = inspector(page).locator('[data-chart-user-shape-path="0"]');
		const firstChildRow = inspector(page).locator('[data-chart-user-shape-path="0,0"]');
		const secondChildRow = inspector(page).locator('[data-chart-user-shape-path="0,1"]');
		await expect(groupRow).toBeVisible();
		await expect(firstChildRow).toBeVisible();
		await expect(secondChildRow).toBeVisible();
		await expect(firstChildRow).toContainText('Alpha');
		await expect(secondChildRow).toContainText('Beta');
	});

	test("editing a grouped child's text updates only that child, on canvas and in the model", async ({
		page,
	}) => {
		await openChartInspector(page);

		const firstChildRow = inspector(page).locator('[data-chart-user-shape-path="0,0"]');
		await expect(firstChildRow).toBeVisible();
		const textInput = firstChildRow
			.getByLabel('Text', { exact: true })
			.locator('visible=true')
			.first();
		await expect(textInput).toBeVisible();
		await textInput.fill('Alpha Edited');
		await textInput.press('Tab');

		await expect
			.poll(async () => overlayTexts(page))
			.toEqual(expect.arrayContaining(['Alpha Edited', 'Beta']));

		// The sibling child's own row is untouched.
		const secondChildRow = inspector(page).locator('[data-chart-user-shape-path="0,1"]');
		await expect(secondChildRow).toContainText('Beta');
	});

	test("editing the top-level group row's own drawing anchor moves the whole group, both children following", async ({
		page,
	}) => {
		await openChartInspector(page);

		const alphaXBefore = await overlayTextX(page, 'Alpha');
		const betaXBefore = await overlayTextX(page, 'Beta');
		expect(alphaXBefore).toBeDefined();
		expect(betaXBefore).toBeDefined();

		// Shift the anchor's `from.x` right: [from.x, from.y, to.x, to.y].
		const groupRow = inspector(page).locator('[data-chart-user-shape-path="0"]');
		await expect(groupRow).toBeVisible();
		await setNumberValue(groupRow, 0, 0.3);

		await expect.poll(async () => overlayTextX(page, 'Alpha')).toBeGreaterThan(alphaXBefore!);
		await expect.poll(async () => overlayTextX(page, 'Beta')).toBeGreaterThan(betaXBefore!);
	});

	test('a nested (grouped) row presents its position as a chart-relative from/to fraction, not raw EMU', async ({
		page,
	}) => {
		await openChartInspector(page);

		const firstChildRow = inspector(page).locator('[data-chart-user-shape-path="0,0"]');
		const secondChildRow = inspector(page).locator('[data-chart-user-shape-path="0,1"]');
		await expect(firstChildRow).toBeVisible();

		const alpha = await numberValues(firstChildRow);
		const beta = await numberValues(secondChildRow);
		// Alpha spans the left half, Beta the right half, of the (0.1,0.6)-(0.9,0.95) anchor.
		expect(alpha[0]).toBeCloseTo(0.1, 3);
		expect(alpha[1]).toBeCloseTo(0.6, 3);
		expect(alpha[2]).toBeCloseTo(0.5, 3);
		expect(alpha[3]).toBeCloseTo(0.95, 3);
		expect(beta[0]).toBeCloseTo(0.5, 3);
		expect(beta[2]).toBeCloseTo(0.9, 3);
	});

	test("editing a grouped child's fraction position moves only that child, its sibling staying put", async ({
		page,
	}) => {
		await openChartInspector(page);

		const betaXBefore = await overlayTextX(page, 'Beta');
		expect(betaXBefore).toBeDefined();

		const firstChildRow = inspector(page).locator('[data-chart-user-shape-path="0,0"]');
		await expect(firstChildRow).toBeVisible();
		// Shrink Alpha's box: set its `to.x` (index 2) from 0.5 down to 0.3.
		await setNumberValue(firstChildRow, 2, 0.3);

		await expect
			.poll(
				async () =>
					(await numberValues(inspector(page).locator('[data-chart-user-shape-path="0,0"]')))[2],
			)
			.toBeCloseTo(0.3, 3);
		const alphaAfter = await numberValues(
			inspector(page).locator('[data-chart-user-shape-path="0,0"]'),
		);
		expect(alphaAfter[0]).toBeCloseTo(0.1, 3);
		expect(alphaAfter[1]).toBeCloseTo(0.6, 3);
		// Beta (untouched) keeps its own position.
		expect(await overlayTextX(page, 'Beta')).toBeCloseTo(betaXBefore!, 0);
	});

	test('"Add shape here" on a group row inserts a new shape into that group, not top-level', async ({
		page,
	}) => {
		await openChartInspector(page);

		// Baseline top-level row count before the click (3: the Alpha/Beta
		// group, the standalone rotated "Gamma" leaf, and the rotated "Delta"
		// group), so the assertion below is not brittle to how many other
		// top-level anchors this fixture happens to carry.
		const topLevelRowCount = async (): Promise<number> =>
			inspector(page)
				.locator('[data-chart-user-shape-path]')
				.evaluateAll(
					(els) =>
						els.filter((el) => !el.getAttribute('data-chart-user-shape-path')?.includes(','))
							.length,
				);
		const before = await topLevelRowCount();

		const groupRow = inspector(page).locator('[data-chart-user-shape-path="0"]');
		await expect(groupRow).toBeVisible();
		const addIntoGroupButton = groupRow.getByRole('button', { name: 'Add shape here' });
		await expect(addIntoGroupButton).toBeVisible();
		await addIntoGroupButton.click();

		// The new shape lands as the group's third child, not a new top-level row.
		const newChildRow = inspector(page).locator('[data-chart-user-shape-path="0,2"]');
		await expect(newChildRow).toBeVisible();
		await expect.poll(topLevelRowCount).toBe(before);

		await expect.poll(async () => overlayTexts(page)).toEqual(expect.arrayContaining(['Text']));
	});
});

test.describe('chart overlay rotation/flip (W5-Y)', () => {
	test('a standalone rotated leaf ("Gamma") renders with an SVG rotate transform', async ({
		page,
	}) => {
		await openChartInspector(page);

		await expect.poll(async () => overlayTexts(page)).toEqual(expect.arrayContaining(['Gamma']));
		const transform = await page.evaluate(() => {
			const stage = document.querySelector('[aria-roledescription="slide"]');
			const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
			const text = svg
				? [...svg.querySelectorAll('text')].find((n) => (n.textContent ?? '').trim() === 'Gamma')
				: undefined;
			return text?.getAttribute('transform') ?? undefined;
		});
		expect(transform).toContain('rotate(30');
	});

	test('the inspector exposes a numeric rotation field for the rotated leaf, matching its own rotation', async ({
		page,
	}) => {
		await openChartInspector(page);

		const gammaRow = inspector(page).locator('[data-chart-user-shape-path="1"]');
		await expect(gammaRow).toContainText('Gamma');
		const rotationInput = gammaRow.locator('input[type="number"]:visible').last();
		await expect(rotationInput).toHaveValue('30');
	});

	test('a group\'s own rotation composes onto its fully-occupying child ("Delta"), inspector and render agreeing', async ({
		page,
	}) => {
		await openChartInspector(page);

		// The group row's OWN rotation (its `transform.rotation`, 15deg).
		const groupRow = inspector(page).locator('[data-chart-user-shape-path="2"]');
		await expect(groupRow).toBeVisible();
		const groupRotationInput = groupRow.locator('input[type="number"]:visible').last();
		await expect(groupRotationInput).toHaveValue('15');

		// Delta itself carries no OWN rotation of its own in the model...
		const deltaRow = inspector(page).locator('[data-chart-user-shape-path="2,0"]');
		await expect(deltaRow).toContainText('Delta');
		const deltaRotationInput = deltaRow.locator('input[type="number"]:visible').last();
		await expect(deltaRotationInput).toHaveValue('0');

		// ...but the RENDERED text is rotated by the group's composed 15deg.
		await expect.poll(async () => overlayTexts(page)).toEqual(expect.arrayContaining(['Delta']));
		const transform = await page.evaluate(() => {
			const stage = document.querySelector('[aria-roledescription="slide"]');
			const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
			const text = svg
				? [...svg.querySelectorAll('text')].find((n) => (n.textContent ?? '').trim() === 'Delta')
				: undefined;
			return text?.getAttribute('transform') ?? undefined;
		});
		expect(transform).toContain('rotate(15');
	});

	test('editing the rotation field updates the rendered overlay', async ({ page }) => {
		await openChartInspector(page);

		const gammaRow = inspector(page).locator('[data-chart-user-shape-path="1"]');
		await expect(gammaRow).toContainText('Gamma');
		const rotationInput = gammaRow.locator('input[type="number"]:visible').last();
		await rotationInput.fill('60');
		await rotationInput.press('Tab');

		await expect
			.poll(async () => {
				const stage = page.locator('[aria-roledescription="slide"]').first();
				const svg = stage.locator('[aria-roledescription="chart"] svg').first();
				const text = svg.locator('text', { hasText: 'Gamma' }).first();
				return text.getAttribute('transform');
			})
			.toContain('rotate(60');
	});

	test('checking a leaf row\'s "Flip horizontally" box flips the rendered overlay', async ({
		page,
	}) => {
		await openChartInspector(page);

		// Gamma has its own solid fill, so it renders a `<polygon>` primitive
		// (unlike a shape's `<text>`, which never carries a flip: see
		// `chart-user-shape-overlay.ts`'s `textPrimitives` doc).
		expect(await overlaySvgHtml(page)).not.toContain('scale(-1 1)');

		const gammaRow = inspector(page).locator('[data-chart-user-shape-path="1"]');
		await expect(gammaRow).toContainText('Gamma');
		const flipHInput = gammaRow
			.getByLabel('Flip horizontally', { exact: true })
			.locator('visible=true')
			.first();
		await flipHInput.click();

		await expect.poll(async () => overlaySvgHtml(page)).toContain('scale(-1 1)');
	});

	test('checking a group row\'s "Flip vertically" box composes onto its fully-occupying child ("Delta")', async ({
		page,
	}) => {
		await openChartInspector(page);

		expect(await overlaySvgHtml(page)).not.toContain('scale(1 -1)');

		const groupRow = inspector(page).locator('[data-chart-user-shape-path="2"]');
		await expect(groupRow).toBeVisible();
		const flipVInput = groupRow
			.getByLabel('Flip vertically', { exact: true })
			.locator('visible=true')
			.first();
		await flipVInput.click();

		// Delta's own solid fill renders a `<polygon>` carrying the group's
		// composed flip; the rendered `<text>` (checked separately) never does.
		await expect.poll(async () => overlaySvgHtml(page)).toContain('scale(1 -1)');
		await expect.poll(async () => overlayTexts(page)).toEqual(expect.arrayContaining(['Delta']));
	});
});
