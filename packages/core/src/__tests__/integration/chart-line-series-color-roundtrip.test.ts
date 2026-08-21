/**
 * Regression guard: a plain (non-combo) line-family chart's series colour
 * must survive load AND an inspector-style edit + save + reload.
 *
 * A `c:ser/c:spPr` puts an area-chart-family fill directly (`a:solidFill`),
 * but a line-drawn series family (line/line3D/scatter/radar/stock) authors
 * its colour on the outline instead: `a:spPr/a:ln/a:solidFill`. The parser
 * used to read that `a:ln` fallback ONLY when the series belonged to a combo
 * chart, so a plain line/scatter/radar/stock chart's authored colour was
 * silently dropped on load, and the save path unconditionally wrote an
 * edited colour into a bare `c:spPr/a:solidFill` sibling, which for this
 * family both missed the property PowerPoint actually reads and could
 * insert a fill AFTER an existing `a:ln`, violating `CT_ShapeProperties`'s
 * required element sequence (fill group before `a:ln`).
 *
 * The fixture is `e2e/fixtures/chart-gallery.pptx` (one chart per slide, 20+
 * kinds, including a plain, non-combo "Line (with trendline)" slide),
 * authored by `e2e/fixtures/generate-chart-fixture.ts` /
 * `e2e/fixtures/chart-xml.ts` (`buildLineChartXml`), whose line series are
 * authored as `<c:spPr><a:ln><a:solidFill><a:srgbClr val="…"/></a:solidFill></a:ln></c:spPr>`,
 * i.e. exactly the shape a real PowerPoint-authored line chart uses.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/chart-gallery.pptx', import.meta.url),
);

function findLineChart(slides: Awaited<ReturnType<PptxHandler['load']>>['slides']): {
	element: ChartPptxElement;
	chartPartPath: string;
} {
	for (const slide of slides) {
		for (const element of slide.elements) {
			if (element.type === 'chart' && element.chartData?.chartType === 'line') {
				const chartPartPath = element.chartData.chartPartPath;
				if (!chartPartPath) {
					throw new Error('line chart element has no chartPartPath');
				}
				return { element, chartPartPath };
			}
		}
	}
	throw new Error('no plain (non-combo) line chart found in the fixture');
}

describe('line chart series colour round-trip (a:ln/a:solidFill)', () => {
	it('reads a PLAIN line chart series colour from the authored a:ln/a:solidFill', async () => {
		if (!existsSync(fixture)) {
			return;
		}
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		);

		const { element } = findLineChart(data.slides);
		// Sanity: this is genuinely a plain chart, not a combo one, since that
		// is precisely the case the bug affected (a combo chart's line series
		// already read correctly before this fix).
		expect(element.chartData!.chartType).toBe('line');
		// The fixture authors the first line series with PALETTE[0] = "4472C4".
		expect(element.chartData!.series[0].color).toBe('#4472C4');
	});

	it('writes an edited colour into a:ln/a:solidFill with no stray direct a:solidFill, and re-reads it', async () => {
		if (!existsSync(fixture)) {
			return;
		}
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		);

		const { element, chartPartPath } = findLineChart(data.slides);
		const chartData = element.chartData!;
		const originalName = chartData.series[0].name;
		chartData.series[0].color = '#123456';

		const savedBytes = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const chartFile = savedZip.file(chartPartPath);
		expect(chartFile, `saved chart part missing: ${chartPartPath}`).toBeTruthy();
		const savedXml = await chartFile!.async('string');

		// The new colour lives under a:ln/a:solidFill for this series.
		expect(savedXml).toMatch(
			/<c:lineChart>[\s\S]*?<a:ln>\s*<a:solidFill>\s*<a:srgbClr val="123456"[^>]*>[\s\S]*?<\/a:srgbClr>\s*<\/a:solidFill>\s*<\/a:ln>/u,
		);

		// No duplicate/sibling a:solidFill was inserted directly under this
		// series' c:spPr (i.e. c:spPr's only child is a:ln, not a:ln PLUS a
		// bare a:solidFill, which would both violate CT_ShapeProperties'
		// required order and leave the old colour behind as the "real" fill).
		const serMatch = savedXml.match(/<c:ser>(?:(?!<\/?c:ser>)[\s\S])*?<\/c:ser>/u);
		expect(serMatch, 'could not isolate the first c:ser node').toBeTruthy();
		const firstSer = serMatch![0];
		const spPrMatch = firstSer.match(/<c:spPr>([\s\S]*?)<\/c:spPr>/u);
		expect(spPrMatch, 'first series has no c:spPr').toBeTruthy();
		const spPrInner = spPrMatch![1];
		// Exactly one solidFill in this spPr, and it is nested inside a:ln.
		expect(spPrInner.match(/<a:solidFill>/gu) ?? []).toHaveLength(1);
		expect(spPrInner).toMatch(/^<a:ln>[\s\S]*<\/a:ln>$/u);

		// Re-parsing the saved file picks the edited colour back up.
		const reloaded = await new PptxHandler().load(savedBytes.buffer as ArrayBuffer);
		const { element: reloadedElement } = findLineChart(reloaded.slides);
		expect(reloadedElement.chartData!.series[0].name).toBe(originalName);
		expect(reloadedElement.chartData!.series[0].color).toBe('#123456');
	});
});
