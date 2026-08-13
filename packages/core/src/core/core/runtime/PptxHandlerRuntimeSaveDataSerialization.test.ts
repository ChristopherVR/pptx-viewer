import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { PptxChartType } from '../../types';
import type { ChartPptxElement } from '../../types/elements';

/**
 * Save-path regressions for the chart-type-change branch of
 * {@link PptxHandlerRuntime.serializeChartDataToXml}.
 *
 * Renaming `<c:barChart>` to `<c:pieChart>` used to be the whole of it, leaving
 * `c:barDir`, `c:gapWidth`, `c:overlap` and both `c:axId` children (none of
 * which `CT_PieChart` allows) inside the new container, plus two orphaned axis
 * elements under `c:plotArea`. PowerPoint rejects the package outright.
 */

const BAR_CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
	xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<c:chart>
		<c:plotArea>
			<c:layout/>
			<c:barChart>
				<c:barDir val="col"/>
				<c:grouping val="clustered"/>
				<c:varyColors val="0"/>
				<c:ser>
					<c:idx val="0"/>
					<c:order val="0"/>
					<c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Bars</c:v></c:pt></c:strCache></c:strRef></c:tx>
					<c:cat><c:strRef><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
					<c:val><c:numRef><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt></c:numCache></c:numRef></c:val>
				</c:ser>
				<c:gapWidth val="182"/>
				<c:overlap val="-27"/>
				<c:axId val="111111111"/>
				<c:axId val="222222222"/>
			</c:barChart>
			<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>
			<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>
		</c:plotArea>
		<c:plotVisOnly val="1"/>
	</c:chart>
</c:chartSpace>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
			<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
			<p:graphicFrame>
				<p:nvGraphicFramePr><p:cNvPr id="2" name="Bar Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
				<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="3200400"/></p:xfrm>
				<a:graphic>
					<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
						<c:chart r:id="rIdChart"/>
					</a:graphicData>
				</a:graphic>
			</p:graphicFrame>
		</p:spTree>
	</p:cSld>
</p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
	<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

async function buildBarDeck(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	const baseBytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(baseBytes);
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
	zip.file('ppt/charts/chart1.xml', BAR_CHART_XML);
	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer as ArrayBuffer;
}

async function saveWithChartType(chartType: PptxChartType): Promise<string> {
	const handler = new PptxHandler();
	const data = await handler.load(await buildBarDeck());
	const chart = data.slides[0].elements.find((e) => e.type === 'chart') as
		| ChartPptxElement
		| undefined;
	expect(chart, 'chart graphic frame was not parsed').toBeDefined();
	chart!.chartData!.chartType = chartType;
	data.slides[0].isDirty = true;
	const savedBytes = await handler.save(data.slides);
	const savedZip = await JSZip.loadAsync(savedBytes);
	return savedZip.file('ppt/charts/chart1.xml')!.async('string');
}

/** Direct children of the first `c:*Chart` container, as local names in order. */
function containerChildren(xml: string, container: string): string[] {
	const m = new RegExp(`<c:${container}>([\\s\\S]*?)</c:${container}>`, 'u').exec(xml);
	if (!m) {
		return [];
	}
	const out: string[] = [];
	const tagRe = /<(\/?)c:([A-Za-z0-9]+)([^>]*?)(\/?)>/gu;
	let depth = 0;
	let tag: RegExpExecArray | null;
	while ((tag = tagRe.exec(m[1]))) {
		const [, close, name, , selfClose] = tag;
		if (close) {
			depth -= 1;
			continue;
		}
		if (depth === 0) {
			out.push(name);
		}
		if (!selfClose) {
			depth += 1;
		}
	}
	return out;
}

describe('chart-type change save path', () => {
	it('rebuilds the container against CT_PieChart instead of only renaming it', async () => {
		const xml = await saveWithChartType('pie');
		expect(xml).toContain('<c:pieChart>');
		expect(xml).not.toContain('<c:barChart>');

		const children = containerChildren(xml, 'pieChart');
		// CT_PieChart = varyColors?, ser*, dLbls?, firstSliceAng?, extLst?
		expect(children).not.toContain('barDir');
		expect(children).not.toContain('gapWidth');
		expect(children).not.toContain('overlap');
		expect(children).not.toContain('grouping');
		expect(children).not.toContain('axId');
		expect(children).toContain('ser');
	});

	it('removes the plot-area axes a pie chart no longer references', async () => {
		const xml = await saveWithChartType('pie');
		expect(xml).not.toContain('<c:catAx>');
		expect(xml).not.toContain('<c:valAx>');
	});

	it('keeps the chart group ahead of the axis elements in c:plotArea', async () => {
		// CT_PlotArea sequences chart groups BEFORE axes; re-adding the renamed key
		// used to append it after <c:catAx>/<c:valAx>.
		const xml = await saveWithChartType('line');
		const plot = /<c:plotArea>[\s\S]*?<\/c:plotArea>/u.exec(xml)![0];
		expect(plot.indexOf('<c:lineChart>')).toBeGreaterThan(-1);
		expect(plot.indexOf('<c:lineChart>')).toBeLessThan(plot.indexOf('<c:catAx>'));
	});

	it('keeps a legal bar-to-line change schema-clean and axis-bearing', async () => {
		const xml = await saveWithChartType('line');
		const children = containerChildren(xml, 'lineChart');
		expect(children).not.toContain('barDir');
		expect(children).not.toContain('gapWidth');
		expect(children).not.toContain('overlap');
		// CT_LineChart still needs its axes, so they must survive.
		expect(children.filter((c) => c === 'axId')).toHaveLength(2);
		expect(xml).toContain('<c:catAx>');
		expect(xml).toContain('<c:valAx>');
		// c:ser must precede c:axId in the CT_LineChart sequence.
		expect(children.indexOf('ser')).toBeLessThan(children.indexOf('axId'));
		// A bar `clustered` grouping is not a member of ST_Grouping.
		expect(/<c:lineChart>[\s\S]*?clustered/u.test(xml)).toBeFalsy();
	});
});
