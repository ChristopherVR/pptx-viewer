import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import { computeSmartArtLayout, decomposeSmartArt, parseLayoutDefinition } from '../../core/utils';

async function presentationWithRules(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').build());
	data.slides[0].elements.push({
		id: 'smartart-rules',
		type: 'smartArt',
		x: 20,
		y: 30,
		width: 600,
		height: 300,
		smartArtData: {
			layout: 'basicBlockList',
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
				{ id: 'n3', text: 'Three' },
			],
		},
	} as SmartArtPptxElement as PptxElement);
	const initial = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(initial);
	const layoutPath = 'ppt/diagrams/layout1.xml';
	const layout = await zip.file(layoutPath)!.async('string');
	const dataXml = await zip.file('ppt/diagrams/data1.xml')!.async('string');
	const twoPoint = [...dataXml.matchAll(/<dgm:pt\b[^>]*>[\s\S]*?<\/dgm:pt>/gu)].find((match) =>
		match[0].includes('<a:t>Two</a:t>'),
	)?.[0];
	const twoId = /\bmodelId="([^"]+)"/u.exec(twoPoint ?? '')?.[1];
	expect(twoId).toBeDefined();
	const rules =
		'<dgm:ruleLst>' +
		'<dgm:rule type="h" val="0.3"/><dgm:rule type="sp" val="0.08"/>' +
		'<dgm:rule type="begPad" val="0.05"/><dgm:rule type="endPad" val="0.1"/>' +
		'<dgm:rule type="primFontSz" val="16" ptType="node"/>' +
		`<dgm:rule type="w" forName="${twoId}" val="0.4" fact="1.5" max="0.35"/>` +
		`<dgm:rule type="primFontSz" forName="${twoId}" val="28"/>` +
		'<dgm:rule type="dir" val="1"/><dgm:rule type="futureSizing" val="777"/>' +
		'</dgm:ruleLst>';
	const patched = layout.replace('<dgm:ruleLst/>', rules);
	expect(patched).not.toBe(layout);
	zip.file(layoutPath, patched);
	return zip.generateAsync({ type: 'uint8array' });
}

function smartArt(slides: { elements: PptxElement[] }[]): SmartArtPptxElement {
	return slides[0].elements.find(
		(element): element is SmartArtPptxElement => element.type === 'smartArt',
	)!;
}

describe('smartArt layout rule round-trip', () => {
	it('applies parsed rule geometry/font overrides and preserves unknown rules', async () => {
		const input = await presentationWithRules();
		const handler = new PptxHandler();
		const loaded = await handler.load(input.buffer as ArrayBuffer);
		const element = smartArt(loaded.slides);
		const data = element.smartArtData!;
		const parsed = parseLayoutDefinition(data.layoutDefinition?.rawXml as Record<string, unknown>)!;
		const oneId = data.nodes.find((node) => node.text === 'One')!.id;
		const twoId = data.nodes.find((node) => node.text === 'Two')!.id;
		const threeId = data.nodes.find((node) => node.text === 'Three')!.id;

		expect(parsed.rules.find((rule) => rule.type === 'futureSizing')).toStrictEqual({
			type: 'futureSizing',
			val: 777,
		});
		const engine = computeSmartArtLayout(data, { x: 0, y: 0, width: 600, height: 300 }, parsed)!;
		expect(engine.find((shape) => shape.nodeId === twoId)).toMatchObject({
			width: 210,
			height: 90,
			fontSize: 28,
		});
		expect(engine.find((shape) => shape.nodeId === oneId)).toMatchObject({
			height: 90,
			fontSize: 16,
		});
		expect(engine.find((shape) => shape.nodeId === oneId)!.x).toBeGreaterThan(
			engine.find((shape) => shape.nodeId === threeId)!.x,
		);

		data.drawingShapes = undefined;
		data.drawingDirty = true;
		const renderModel = decomposeSmartArt(data, {
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		})!;
		const two = renderModel.find(
			(candidate) => candidate.type === 'shape' && candidate.text === 'Two',
		);
		expect(two?.textStyle?.fontSize).toBe(28);
		expect(two?.textSegments?.[0].style.fontSize).toBeCloseTo(28 * (96 / 72));

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedLayout = await savedZip.file('ppt/diagrams/layout1.xml')!.async('string');
		const drawing = await savedZip.file('ppt/diagrams/drawing1.xml')!.async('string');
		expect(savedLayout).toContain('type="futureSizing" val="777"');
		expect(drawing).toContain('sz="2800"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const cachedTwo = smartArt(reloaded.slides).smartArtData!.drawingShapes?.find(
			(shape) => shape.text === 'Two',
		);
		expect(cachedTwo).toMatchObject({
			width: two?.width,
			height: two?.height,
			fontSize: 28,
		});
		expect(cachedTwo?.textSegments?.[0].style.fontSize).toBeCloseTo(28 * (96 / 72));
	});
});
