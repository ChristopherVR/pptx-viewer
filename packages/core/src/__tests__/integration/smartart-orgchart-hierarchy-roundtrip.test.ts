/**
 * `presLayoutVars` org-chart hints (`hierBranch`, `orgChart`, `chMax`,
 * `chPref`): live preview + save round-trip.
 *
 * These were parsed (`smartart-pres-layout-vars.ts`) but never consulted by
 * the hierarchy arranger: every `hierBranch` value rendered identically, and
 * an assistant point (`dgm:pt/@type="asst"`) got no special placement. This
 * test exercises the fix (`smartart-layout-interpreter-hierarchy.ts` +
 * `smartart-hierarchy-standard.ts`/`smartart-hierarchy-hanging.ts`) end to
 * end, following the same pattern as `smartart-layout-rules-roundtrip.test.ts`
 * and `smartart-relative-constraint-roundtrip.test.ts`: once in the
 * live-preview render model, and once baked into the fabricated cached
 * `dsp:` drawing on save.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

/** Any `layoutDefinition` naming a `hierChild` algorithm routes through the
 * hierarchy arranger - the interpreter only needs to recognise the family. */
const HIERARCHY_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: { name: 'diagram', algorithm: { type: 'hierChild' } },
};

/** A manager, one assistant, and two ordinary subordinates. */
const ORG_CHART_NODES: PptxSmartArtNode[] = [
	{ id: 'mgr', text: 'Manager' },
	{ id: 'asst', text: 'Assistant', parentId: 'mgr', nodeType: 'asst' },
	{ id: 'r1', text: 'Report One', parentId: 'mgr' },
	{ id: 'r2', text: 'Report Two', parentId: 'mgr' },
];

/**
 * Builds the presentation with `nodes` set at CREATION time (rather than
 * mutated on the loaded element afterwards): a post-load `nodes` override is
 * picked up by the live-preview render model (it reads the in-memory object
 * directly) but NOT by `handler.save()`, which re-derives the data-model XML
 * from the element as it was loaded.
 */
async function presentationWithOrgChartSmartArt(nodes: PptxSmartArtNode[]): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-orgchart',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 400,
		smartArtData: { layout: 'orgChart', nodes },
	} as SmartArtPptxElement as PptxElement);
	return handler.save(data.slides);
}

function smartArt(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

function shapes(elements: PptxElement[]): Extract<PptxElement, { type: 'shape' }>[] {
	return elements.filter(
		(el): el is Extract<PptxElement, { type: 'shape' }> => el.type === 'shape',
	);
}

const SIX_REPORTS: PptxSmartArtNode[] = [
	{ id: 'mgr', text: 'Manager' },
	...Array.from({ length: 6 }, (_, i) => ({
		id: `r${i + 1}`,
		text: `Report ${i + 1}`,
		parentId: 'mgr',
	})),
];

describe('smartArt org-chart round-trip: presLayoutVars (hierBranch / orgChart / chMax / chPref)', () => {
	it('places the assistant differently from the ordinary reports in the live-preview render model', async () => {
		// The SDK-authoring fabrication path DOES now round-trip `nodeType`
		// ("asst") through a save (see the "assistant nodeType survives a save
		// + reload" test below); this override still stays purely in-memory
		// here (matching how the OTHER interpreter round-trip tests substitute
		// a typed model) because the point under test is what the ARRANGER
		// does with an assistant node, not the SDK data-model writer.
		const initial = await presentationWithOrgChartSmartArt(SIX_REPORTS);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		data.layoutDefinition = HIERARCHY_DEFINITION;
		data.nodes = ORG_CHART_NODES;
		data.presLayoutVars = { orgChart: true };

		const renderModel = shapes(
			computeSmartArtElementsWithoutCache(data, {
				x: element.x,
				y: element.y,
				width: element.width,
				height: element.height,
			})!,
		);
		expect(renderModel).toHaveLength(4);

		const byText = (text: string) => renderModel.find((s) => s.text === text)!;
		const manager = byText('Manager');
		const assistant = byText('Assistant');
		const report = byText('Report One');

		// Different box size than an ordinary report.
		expect(assistant.width).not.toBeCloseTo(report.width, 0);
		// Sits closer (vertically) to the manager than the reports' fan-out row.
		expect(assistant.y - manager.y).toBeLessThan(report.y - manager.y);
	});

	it('assistant nodeType survives a save + reload through the SDK-authoring fabrication path', async () => {
		// `smartart-fabrication-data.ts` builds the data model XML from scratch
		// for an SDK-created SmartArt (no rawXml, no existing diagram parts).
		// Its `contentPointXml` dropped `@_type="asst"`, so an assistant node
		// authored via the SDK reloaded as an ordinary child and lost its
		// org-chart placement on every round-trip.
		const initial = await presentationWithOrgChartSmartArt(ORG_CHART_NODES);
		const reloaded = await new PptxHandler().load(initial.buffer as ArrayBuffer);
		const nodes = smartArt(reloaded.slides).smartArtData!.nodes;

		const assistant = nodes.find((node) => node.text === 'Assistant');
		const manager = nodes.find((node) => node.text === 'Manager');
		const report = nodes.find((node) => node.text === 'Report One');

		expect(assistant?.nodeType).toBe('asst');
		// Ordinary content points must NOT gain a spurious @_type.
		expect(manager?.nodeType).toBeUndefined();
		expect(report?.nodeType).toBeUndefined();
	});

	it('a hierBranch other than "std" changes the saved cached dsp: drawing geometry', async () => {
		async function drawingFor(hierarchyBranch: 'std' | 'r'): Promise<string> {
			const initial = await presentationWithOrgChartSmartArt(SIX_REPORTS);
			const handler = new PptxHandler();
			const loaded = await handler.load(initial.buffer as ArrayBuffer);
			const element = smartArt(loaded.slides);
			element.smartArtData!.layoutDefinition = HIERARCHY_DEFINITION;
			element.smartArtData!.presLayoutVars = { hierarchyBranch };
			element.smartArtData!.drawingShapes = undefined;
			element.smartArtData!.drawingDirty = true;
			// `save()` must run on the SAME handler that `load()`-ed the zip: it
			// carries the rest of the package (presentation.xml, theme, ...)
			// forward, which a fresh handler instance would not have.
			const saved = await handler.save(loaded.slides);
			const savedZip = await JSZip.loadAsync(saved);
			return savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		}

		const stdDrawing = await drawingFor('std');
		const rightHangDrawing = await drawingFor('r');

		expect(stdDrawing).not.toBe(rightHangDrawing);
	});

	it('bakes chMax column-grouping into the fabricated cached dsp: drawing on save', async () => {
		// Genuine PowerPoint output (`smartart-orgchart-many.pptx` in the
		// corpus) groups excess children into `chMax`/`chPref`-sized hanging
		// COLUMNS side by side, not additional fanned rows: see
		// `smartart-orgchart-genuine-fixture.test.ts` and the rewritten
		// `placeWrappedChildren` in `smartart-hierarchy-standard.ts`.
		const initial = await presentationWithOrgChartSmartArt(SIX_REPORTS);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);

		element.smartArtData!.layoutDefinition = HIERARCHY_DEFINITION;
		element.smartArtData!.presLayoutVars = { childMax: 3 };
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cached = smartArt(reloaded.slides).smartArtData!.drawingShapes;
		expect(cached?.length).toBe(7); // manager + 6 reports

		const reports = (cached ?? []).filter((shape) => shape.text?.startsWith('Report'));
		const reportXs = reports.map((shape) => Math.round(shape.x));
		const reportYs = reports.map((shape) => Math.round(shape.y));
		// chMax=3 over 6 reports groups into two side-by-side columns of 3.
		expect(new Set(reportXs).size).toBe(2);
		expect(new Set(reportYs).size).toBe(3);
	});
});
