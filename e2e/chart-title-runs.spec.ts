/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Chart title rich text (`c:title/c:tx/c:rich` with several `c:r` runs), run
 * identically against every framework demo.
 *
 * The fixture (`chart-title-runs.pptx`, `e2e/fixtures/generate-chart-title-
 * runs-fixture.ts`) is a pie chart whose title carries two runs: "Sales "
 * (bold) then "Overview" (italic, red). The shared `resolveChartTitleRunSpans`
 * (`packages/shared/src/render/chart-title-runs.ts`) resolves those into
 * per-run `<tspan>` descriptors every binding's chart SVG paints, instead of
 * collapsing the title to one flat string in a single style.
 *
 * The chart is deliberately a PIE (see the fixture generator's doc): a pie
 * has no axes, so `ChartAxisOptions` / `ChartAxisStyleOptions` render nothing
 * and the inspector's chart-data "Title" field is the only field labelled
 * "Title" on the panel (the axis-title field shares that exact string).
 *
 * `collapseChartTitleRunsForEdit` is the write-side companion: editing the
 * flat title through the inspector must collapse the multi-run body to ONE
 * run in the dominant style, not leave a second, stale run trailing the new
 * text.
 *
 * Run: bunx playwright test chart-title-runs
 */
import { readFile } from 'node:fs/promises';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

import {
	CHART_TITLE_RUN_1,
	CHART_TITLE_RUN_2,
	EDITED_TITLE,
} from './fixtures/generate-chart-title-runs-fixture';
import { savePptxViaBackstage } from './save-pptx';
import {
	fixture,
	inspector,
	loadDeck,
	resetTabSession,
	selectElement,
	slideStage,
	thumbnail,
} from './support/deck';

const CHART_FIXTURE = fixture('chart-title-runs.pptx');
const ENTERED_TITLE = 'Committed with Enter';
const CANCELLED_TITLE = 'Must not commit';
const BLURRED_TITLE = 'Committed on blur';
const CHART_GALLERY_FIXTURE = fixture('chart-gallery.pptx');
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

interface DeckPayload {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

interface TitleTspan {
	text: string;
	fontWeight: string;
	fontStyle: string;
	fill: string;
}

/** Every `<tspan>` inside the chart's title `<text>` node (`data-chart-part="title"`). */
async function titleTspans(page: Page): Promise<TitleTspan[]> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const titleText = stage?.querySelector('svg [data-chart-part="title"]');
		if (!titleText) {
			return [];
		}
		return [...titleText.querySelectorAll('tspan')].map((node) => {
			const style = getComputedStyle(node);
			return {
				text: (node.textContent ?? '').trim(),
				fontWeight: style.fontWeight,
				fontStyle: style.fontStyle,
				fill: style.fill,
			};
		});
	});
}

async function openChart(page: Page): Promise<void> {
	await loadDeck(page, CHART_FIXTURE);
	await page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first()
		.waitFor();
	await page.waitForTimeout(300);
}

function chartLocator(page: Page): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
}

async function openTitleEditor(target: Locator): Promise<Locator> {
	const title = target.locator('[data-chart-part="title"]');
	const box = await title.boundingBox();
	if (!box) {
		throw new Error('chart title has no browser hit target');
	}
	await title.dblclick({
		position: { x: Math.max(1, box.width / 8), y: box.height / 2 },
	});
	const input = target.locator('input:visible').first();
	await expect(input).toBeVisible();
	return input;
}

async function normalizedTitleText(target: Locator): Promise<string> {
	return ((await target.locator('[data-chart-part="title"]').textContent()) ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

function collectRuntimeErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error' && /NotFoundError|closeTitleEditor/.test(message.text())) {
			errors.push(message.text());
		}
	});
	return errors;
}

const classicAxisTitle =
	'<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t xml:space="preserve">Quarter Axis</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
const chartExAxisTitle =
	'<cx:title><cx:tx><cx:rich><a:bodyPr/><a:p><a:r><a:t xml:space="preserve">Histogram Axis</a:t></a:r></a:p></cx:rich></cx:tx></cx:title>';

/** Add schema-valid attributed classic and ChartEx axis titles to the public gallery in memory. */
async function attributedAxisDeck(): Promise<DeckPayload> {
	const zip = await JSZip.loadAsync(await readFile(CHART_GALLERY_FIXTURE));
	const classicPart = zip.file('ppt/charts/chart1.xml');
	const chartExPart = zip.file('ppt/charts/chart13.xml');
	if (!classicPart || !chartExPart) {
		throw new Error('the chart gallery is missing its classic or ChartEx part');
	}

	const classicXml = await classicPart.async('string');
	const classicAnchor = '<c:axPos val="b"/>';
	if (!classicXml.includes(classicAnchor)) {
		throw new Error('the classic category-axis insertion point is missing');
	}
	zip.file(
		'ppt/charts/chart1.xml',
		classicXml.replace(classicAnchor, `${classicAnchor}${classicAxisTitle}`),
	);

	const chartExXml = await chartExPart.async('string');
	const dataId = '<cx:dataId val="0"/>';
	const plotRegionEnd = '</cx:plotAreaRegion>';
	if (!chartExXml.includes(dataId) || !chartExXml.includes(plotRegionEnd)) {
		throw new Error('the ChartEx axis insertion points are missing');
	}
	const withAxisReferences = chartExXml.replace(
		dataId,
		`${dataId}<cx:axisId>71001</cx:axisId><cx:axisId>71002</cx:axisId>`,
	);
	const axes = `<cx:axis id="71001"><cx:catScaling/>${chartExAxisTitle}<cx:tickLabels/></cx:axis><cx:axis id="71002"><cx:valScaling/><cx:tickLabels/></cx:axis>`;
	zip.file(
		'ppt/charts/chart13.xml',
		withAxisReferences.replace(plotRegionEnd, `${plotRegionEnd}${axes}`),
	);

	return {
		name: 'chart-attributed-axis-titles.pptx',
		mimeType: PPTX_MIME,
		buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
	};
}

async function loadAxisDeck(page: Page, deck: DeckPayload | string): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await slideStage(page).waitFor();
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor();
}

async function axisChart(page: Page, slideNumber: number): Promise<Locator> {
	await thumbnail(page, slideNumber).click();
	const chart = slideStage(page).locator('[aria-roledescription="chart"]').first();
	await chart.waitFor();
	await selectElement(page, chart);
	await expect(inspector(page)).toBeVisible();
	return chart;
}

async function visibleInputValues(page: Page): Promise<string[]> {
	return inspector(page)
		.locator('input:visible')
		.evaluateAll((inputs) => inputs.map((input) => input.value));
}

async function visibleInputWithValue(page: Page, value: string): Promise<Locator> {
	const inputs = inspector(page).locator('input:visible');
	for (let index = 0; index < (await inputs.count()); index += 1) {
		const input = inputs.nth(index);
		if ((await input.inputValue()) === value) {
			return input;
		}
	}
	throw new Error(`no visible input has value ${JSON.stringify(value)}`);
}

async function svgTextCount(chart: Locator, value: string): Promise<number> {
	const texts = await chart.locator('svg text').allTextContents();
	return texts.filter((text) => text.trim() === value).length;
}

async function savedChartXml(path: string, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(await readFile(path));
	return (await zip.file(part)?.async('string')) ?? '';
}

test.describe('chart title rich text (multi-run titles)', () => {
	test('renders one tspan per authored run, with its own bold/italic/colour', async ({ page }) => {
		await openChart(page);

		const tspans = await titleTspans(page);
		expect(tspans.length, `expected 2 title tspans, got ${JSON.stringify(tspans)}`).toBe(2);

		const [first, second] = tspans;
		expect(first.text).toBe(CHART_TITLE_RUN_1.trim());
		expect(Number(first.fontWeight)).toBeGreaterThanOrEqual(700);

		expect(second.text).toBe(CHART_TITLE_RUN_2);
		expect(second.fontStyle).toBe('italic');
		expect(second.fill).toBe('rgb(255, 0, 0)');
	});

	test('editing the flat title through the inspector collapses to one run', async ({ page }) => {
		await openChart(page);

		// Selected via the shared accessibility contract, not `data-pptx-element`:
		// two bindings do not tag a chart's graphic frame as an element (see
		// `support/svg-fingerprint.ts`'s `taggedAsElement`), so an element-marker
		// locator would silently find no chart in those two.
		const chart = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('[aria-roledescription="chart"]')
			.first();
		await selectElement(page, chart);
		await expect(inspector(page)).toBeVisible();

		// `visible=true`: the vanilla inspector keeps every section in the DOM and
		// toggles `hidden` (its Accessibility section also owns a "Title" field), so
		// a bare `.first()` would land on that hidden input in DOM order.
		const titleInput = inspector(page)
			.getByLabel('Title', { exact: true })
			.locator('visible=true')
			.first();
		await expect(titleInput).toBeVisible();
		await titleInput.fill(EDITED_TITLE);
		await titleInput.press('Tab');
		await page.waitForTimeout(400);

		await expect
			.poll(async () => {
				const tspans = await titleTspans(page);
				return tspans.map((t) => t.text).join('|');
			})
			.toBe(EDITED_TITLE);

		const tspans = await titleTspans(page);
		expect(tspans.length, 'a collapsed multi-run title must render as a single run').toBe(1);
	});

	test('commits an on-canvas title edit once on Enter and can reopen it', async ({ page }) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await openChart(page);
		const target = chartLocator(page);
		await selectElement(page, target);

		const input = await openTitleEditor(target);
		await input.fill(ENTERED_TITLE);
		await input.press('Enter');
		await expect(target.locator('input:visible')).toHaveCount(0);
		await expect.poll(() => normalizedTitleText(target)).toBe(ENTERED_TITLE);

		const reopened = await openTitleEditor(target);
		await expect(reopened).toHaveValue(ENTERED_TITLE);
		await reopened.press('Escape');
		await expect(target.locator('input:visible')).toHaveCount(0);

		const undo = page.getByRole('button', { name: 'Undo' });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect
			.poll(() => normalizedTitleText(target))
			.toBe(`${CHART_TITLE_RUN_1}${CHART_TITLE_RUN_2}`);
		expect(runtimeErrors).toStrictEqual([]);
	});

	test('cancels an on-canvas title edit on Escape and can reopen it', async ({ page }) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await openChart(page);
		const target = chartLocator(page);
		await selectElement(page, target);

		const input = await openTitleEditor(target);
		await input.fill(CANCELLED_TITLE);
		await input.press('Escape');
		await expect(target.locator('input:visible')).toHaveCount(0);
		await expect
			.poll(() => normalizedTitleText(target))
			.toBe(`${CHART_TITLE_RUN_1}${CHART_TITLE_RUN_2}`);

		const reopened = await openTitleEditor(target);
		await expect(reopened).toHaveValue(CHART_TITLE_RUN_1);
		await reopened.press('Escape');
		await expect(target.locator('input:visible')).toHaveCount(0);
		expect(runtimeErrors).toStrictEqual([]);
	});

	test('commits an on-canvas title edit once on blur and can reopen it', async ({ page }) => {
		const runtimeErrors = collectRuntimeErrors(page);
		await openChart(page);
		const target = chartLocator(page);
		await selectElement(page, target);

		const input = await openTitleEditor(target);
		await input.fill(BLURRED_TITLE);
		await page
			.getByRole('toolbar', { name: 'Presentation toolbar' })
			.getByRole('tab', { name: 'Home', exact: true })
			.click();
		await expect(target.locator('input:visible')).toHaveCount(0);
		await expect.poll(() => normalizedTitleText(target)).toBe(BLURRED_TITLE);

		const reopened = await openTitleEditor(target);
		await expect(reopened).toHaveValue(BLURRED_TITLE);
		await reopened.press('Escape');
		await expect(target.locator('input:visible')).toHaveCount(0);

		const undo = page.getByRole('button', { name: 'Undo' });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect
			.poll(() => normalizedTitleText(target))
			.toBe(`${CHART_TITLE_RUN_1}${CHART_TITLE_RUN_2}`);
		expect(runtimeErrors).toStrictEqual([]);
	});
});

test.describe('attributed chart-axis titles', () => {
	test('renders, inspects, and safely saves attributed axis text', async ({ page }) => {
		const deck = await attributedAxisDeck();
		await loadAxisDeck(page, deck);

		let classicChart = await axisChart(page, 1);
		await expect.poll(() => svgTextCount(classicChart, 'Quarter Axis')).toBe(1);
		await expect.poll(() => visibleInputValues(page)).toContain('Quarter Axis');

		// ChartEx histogram currently exposes axis titles in the inspector but does
		// not paint them on the chart surface, so the inspector is the UI contract.
		await axisChart(page, 13);
		await expect.poll(() => visibleInputValues(page)).toContain('Histogram Axis');

		const noOpDownload = await savePptxViaBackstage(page);
		const noOpPath = await noOpDownload.path();
		expect(noOpPath, 'the browser should retain the no-op PPTX').not.toBeNull();
		const noOpClassicXml = await savedChartXml(noOpPath!, 'ppt/charts/chart1.xml');
		const noOpChartExXml = await savedChartXml(noOpPath!, 'ppt/charts/chart13.xml');
		expect(noOpClassicXml).toContain('<a:t xml:space="preserve">Quarter Axis</a:t>');
		expect(noOpChartExXml).toContain('<a:t xml:space="preserve">Histogram Axis</a:t>');
		expect(noOpClassicXml).not.toContain('[object Object]');
		expect(noOpChartExXml).not.toContain('[object Object]');

		await loadAxisDeck(page, noOpPath!);
		classicChart = await axisChart(page, 1);
		await expect.poll(() => svgTextCount(classicChart, 'Quarter Axis')).toBe(1);
		await expect.poll(() => visibleInputValues(page)).toContain('Quarter Axis');
		await axisChart(page, 13);
		await expect.poll(() => visibleInputValues(page)).toContain('Histogram Axis');

		// Exercise the classic axis title's real edit and history path before
		// saving the dirty chart and reloading the result.
		classicChart = await axisChart(page, 1);
		const axisTitle = await visibleInputWithValue(page, 'Quarter Axis');
		await axisTitle.fill('Edited Axis');
		await axisTitle.press('Tab');
		await expect.poll(() => svgTextCount(classicChart, 'Edited Axis')).toBe(1);
		const undo = page.getByRole('button', { name: 'Undo' });
		const redo = page.getByRole('button', { name: 'Redo' });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect.poll(() => svgTextCount(classicChart, 'Quarter Axis')).toBe(1);
		await expect(redo).toBeEnabled();
		await redo.click();
		await expect.poll(() => svgTextCount(classicChart, 'Edited Axis')).toBe(1);

		const dirtyDownload = await savePptxViaBackstage(page);
		const dirtyPath = await dirtyDownload.path();
		expect(dirtyPath, 'the browser should retain the dirty PPTX').not.toBeNull();
		const dirtyClassicXml = await savedChartXml(dirtyPath!, 'ppt/charts/chart1.xml');
		expect(dirtyClassicXml).toContain('>Edited Axis</a:t>');
		expect(dirtyClassicXml).not.toContain('[object Object]');

		await loadAxisDeck(page, dirtyPath!);
		classicChart = await axisChart(page, 1);
		await expect.poll(() => svgTextCount(classicChart, 'Edited Axis')).toBe(1);
		await expect.poll(() => visibleInputValues(page)).toContain('Edited Axis');
	});
});
