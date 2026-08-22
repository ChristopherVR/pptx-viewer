/**
 * A node's own quick-style `styleLbl` role (e.g. an org-chart assistant's
 * "asst0") drives its fill colour: live preview + save round-trip.
 *
 * `nodeFill`/`nodeStroke` cycled every rendered node through ONE flat
 * palette by rendered-order index, so a `bg`/`revTx`/`asst` role got a
 * generic cycled colour instead of its OWN role's colour list from
 * `ppt/diagrams/colors*.xml`. This exercises the fix
 * (`smartart-node-style-role.ts` resolving each node's role,
 * `smartart-node-role-colors.ts` overlaying it) end to end, following the
 * same pattern as `smartart-orgchart-hierarchy-roundtrip.test.ts`: once in
 * the live-preview render model, and once baked into the fabricated cached
 * `dsp:` drawing on save.
 *
 * No real fixture in this repo has visibly DIFFERENT role colours (the two
 * real quickStyle/colors fixtures checked - `animation-builds-color.pptx`
 * and `smartart-chart-table-mix.pptx` - happen to assign every role the
 * SAME `accent1` scheme colour), so this uses a hand-built typed
 * `colorTransform.roleColors` map + `node.styleRole`, matching how the
 * OTHER interpreter round-trip tests substitute a typed model for a
 * live-preview-only concept.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSmartArtLayoutDefinition, PptxSmartArtNode } from '../../core/types';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtElementsWithoutCache } from '../../core/utils';

const HIERARCHY_DEFINITION: PptxSmartArtLayoutDefinition = {
	rootNode: { name: 'diagram', algorithm: { type: 'hierChild' } },
};

const ORG_CHART_NODES: PptxSmartArtNode[] = [
	{ id: 'mgr', text: 'Manager' },
	{ id: 'asst', text: 'Assistant', parentId: 'mgr', nodeType: 'asst' },
	{ id: 'r1', text: 'Report One', parentId: 'mgr' },
];

const ROLE_COLORS = {
	node1: { fill: ['#0000ff'], line: [] },
	asst0: { fill: ['#ff00ff'], line: [] },
};

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

describe('smartArt role colours: styleLbl-role fill overrides the generic cycled palette', () => {
	it('gives the assistant a different fill than the manager in the live-preview render model', async () => {
		const initial = await presentationWithOrgChartSmartArt(ORG_CHART_NODES);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		data.layoutDefinition = HIERARCHY_DEFINITION;
		// nodeType round-trips through fabrication (see the assistant-nodeType
		// test); only the ROLE lives purely in-memory here, mirroring how
		// nodeType was substituted in the org-chart hierarchy test.
		data.nodes = ORG_CHART_NODES.map((node) => ({
			...node,
			styleRole: node.nodeType === 'asst' ? 'asst0' : 'node1',
		}));
		data.presLayoutVars = { orgChart: true };
		data.colorTransform = { fillColors: ['#cccccc'], lineColors: [], roleColors: ROLE_COLORS };

		const renderModel = shapes(
			computeSmartArtElementsWithoutCache(data, {
				x: element.x,
				y: element.y,
				width: element.width,
				height: element.height,
			})!,
		);

		const manager = renderModel.find((s) => s.text === 'Manager')!;
		const assistant = renderModel.find((s) => s.text === 'Assistant')!;
		expect(manager.shapeStyle?.fillColor).toBe('#0000ff');
		expect(assistant.shapeStyle?.fillColor).toBe('#ff00ff');
	});

	it('bakes the role colour into the fabricated cached dsp: drawing on save', async () => {
		const initial = await presentationWithOrgChartSmartArt(ORG_CHART_NODES);
		const handler = new PptxHandler();
		const loaded = await handler.load(initial.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		element.smartArtData!.layoutDefinition = HIERARCHY_DEFINITION;
		// Mutate the LOADED node objects in place (rather than replacing the
		// array with fresh objects): `resolveShapeModelId`
		// (`smartart-fabrication-drawing.ts`) matches a decomposed shape back to
		// its presentation-point GUID by node id, and the existing hierBranch
		// round-trip test in this same suite follows the same in-place pattern.
		for (const node of element.smartArtData!.nodes) {
			node.styleRole = node.nodeType === 'asst' ? 'asst0' : 'node1';
		}
		element.smartArtData!.presLayoutVars = { orgChart: true };
		element.smartArtData!.colorTransform = {
			fillColors: ['#cccccc'],
			lineColors: [],
			roleColors: ROLE_COLORS,
		};
		element.smartArtData!.drawingShapes = undefined;
		element.smartArtData!.drawingDirty = true;

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const drawingXml = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');

		expect(drawingXml).toContain('FF00FF');
		expect(drawingXml).toContain('0000FF');
	});
});
