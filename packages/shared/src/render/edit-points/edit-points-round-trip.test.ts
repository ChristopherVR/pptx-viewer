/**
 * Save + reload guard: a shape reshaped with Edit Points, and a shape drawn
 * with the Freeform / Curve tools, must leave a real `a:custGeom` in the slide
 * XML (no `a:prstGeom`, no stale preset `a:avLst`) and reload as the same
 * outline.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditPointsSession } from './edit-points-session';
import { buildFreeformToolElement } from './freeform-tool-geometry';

async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const zip = await JSZip.loadAsync(bytes);
	const slideXml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
	const reloaded = new PptxHandler();
	const data = await reloaded.load(bytes.buffer as ArrayBuffer);
	return { data, slideXml };
}

function findShape(elements: PptxElement[], id: string): ShapePptxElement {
	const found = elements.find((element) => element.id === id);
	if (!found || found.type !== 'shape') {
		throw new Error(`shape ${id} not found`);
	}
	return found;
}

describe('edit Points save/reload round trip', () => {
	it('turns an edited preset into a:custGeom that reloads with the same points', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Edit points',
			initialSlideCount: 1,
		});
		const star: ShapePptxElement = {
			id: 'star-under-test',
			type: 'shape',
			x: 120,
			y: 80,
			width: 240,
			height: 200,
			shapeType: 'star5',
			shapeStyle: { fillColor: '#4472c4', strokeColor: '#2f528f', strokeWidth: 1 },
		};
		let edited: ShapePptxElement = star;
		const session = new EditPointsSession(star, {
			onCommit: (patch) => {
				edited = { ...edited, ...patch };
			},
			onExit: () => undefined,
		});
		const tip = session.view().nodes[0];
		session.pointerDown({ x: tip.x, y: tip.y, target: tip.target });
		session.pointerMove({ x: tip.x + 30, y: tip.y - 40 });
		session.pointerUp();
		// Bend one straight edge into a curve as well.
		const seg = session.view().segments[3];
		session.contextMenu({ x: 0, y: 0, target: seg.target, clientX: 0, clientY: 0 });
		session.runCommand('curved-segment');

		const slide: PptxSlide = { ...data.slides[0], elements: [...data.slides[0].elements, edited] };
		const { data: reloaded, slideXml } = await saveAndReload(handler, [slide]);

		expect(slideXml).toContain('<a:custGeom>');
		expect(slideXml).not.toContain('prst="star5"');
		expect(slideXml).toContain('<a:cubicBezTo>');
		const back = reloaded.slides[0].elements.find(
			(element) => element.type === 'shape' && element.shapeType === 'custom',
		) as ShapePptxElement | undefined;
		expect(back).toBeDefined();
		expect(back!.x).toBeCloseTo(edited.x, 0);
		expect(back!.y).toBeCloseTo(edited.y, 0);
		expect(back!.width).toBeCloseTo(edited.width, 0);
		expect(back!.height).toBeCloseTo(edited.height, 0);
		const sent = edited.customGeometryPaths?.[0].segments;
		const got = back!.customGeometryPaths?.[0].segments;
		expect(got).toStrictEqual(sent);
	});

	it('saves a drawn freeform and curve as a:custGeom', async () => {
		const { handler, data } = await PptxHandler.create({ title: 'Freeform', initialSlideCount: 1 });
		const polygon = buildFreeformToolElement(
			'freeformShape',
			[
				{ x: 100, y: 100 },
				{ x: 300, y: 120 },
				{ x: 200, y: 260 },
			],
			true,
			'freeform-under-test',
		)!;
		const curve = buildFreeformToolElement(
			'curve',
			[
				{ x: 400, y: 300 },
				{ x: 500, y: 200 },
				{ x: 600, y: 320 },
			],
			false,
			'curve-under-test',
		)!;
		const slide: PptxSlide = {
			...data.slides[0],
			elements: [...data.slides[0].elements, polygon, curve],
		};
		const { data: reloaded, slideXml } = await saveAndReload(handler, [slide]);
		expect(slideXml.match(/<a:custGeom>/g) ?? []).toHaveLength(2);
		const elements = reloaded.slides[0].elements;
		const shapes = elements.filter(
			(element): element is ShapePptxElement =>
				element.type === 'shape' && element.shapeType === 'custom',
		);
		expect(shapes).toHaveLength(2);
		const [a, b] = shapes;
		expect(a.customGeometryPaths?.[0].segments).toStrictEqual(
			polygon.customGeometryPaths?.[0].segments,
		);
		expect(b.customGeometryPaths?.[0].segments).toStrictEqual(
			curve.customGeometryPaths?.[0].segments,
		);
		expect(findShape([polygon], 'freeform-under-test').pathWidth).toBe(a.pathWidth);
	});
});
