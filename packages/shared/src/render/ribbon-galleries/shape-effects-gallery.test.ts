import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';

const colorMap = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function shape(shapeStyle: ShapeStyle = {}): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle,
	} as unknown as PptxElement;
}

function styleOf(itemId: string, element: PptxElement): ShapeStyle {
	const result = applyRibbonGalleryItem('shapeEffects', itemId, {
		element,
		themeColorMap: colorMap,
	});
	if (result?.kind !== 'element') {
		throw new Error(`no patch for ${itemId}`);
	}
	return (result.patch as { shapeStyle: ShapeStyle }).shapeStyle;
}

describe('shape Effects gallery', () => {
	it('offers PowerPoint menu families as SVG tiles', () => {
		const d = buildRibbonGallery('shapeEffects', { element: shape(), themeColorMap: colorMap });
		expect(d.disabled).toBeFalsy();
		expect(d.sections.map((s) => [s.id, s.items.length])).toStrictEqual([
			['shadow', 1],
			['shadow-outer', 9],
			['shadow-inner', 9],
			['shadow-perspective', 5],
			['reflection', 1],
			['reflection-variations', 9],
			['glow', 1],
			['glow-variations', 24],
			['softEdge', 1],
			['softEdge-variations', 6],
			['bevel', 1],
			['bevel-variations', 12],
			['rotation', 1],
			['rotation-parallel', 10],
			['rotation-perspective', 13],
			['rotation-oblique', 4],
		]);
		for (const item of d.sections.flatMap((s) => s.items)) {
			expect(item.previewSvg.startsWith('<svg')).toBeTruthy();
		}
		const noneTiles = d.sections.filter((s) => s.items[0].id.endsWith('-none'));
		expect(noneTiles.every((s) => s.items[0].applied)).toBeTruthy();
	});

	it('is disabled without a shape selection', () => {
		expect(buildRibbonGallery('shapeEffects', { element: null }).disabled).toBeTruthy();
		expect(applyRibbonGalleryItem('shapeEffects', 'glow-5-1', { element: null })).toBeNull();
		expect(applyRibbonGalleryItem('shapeEffects', 'nope', { element: shape() })).toBeNull();
	});

	it('sets only the picked family and keeps the rest', () => {
		const base: ShapeStyle = {
			fillColor: '#FF0000',
			glowColor: '#00FF00',
			glowRadius: 4,
			softEdgeRadius: 3,
		};
		const style = styleOf('shadow-outer-offsetBottomRight', shape(base));
		expect(style.fillColor).toBe('#FF0000');
		expect(style.glowColor).toBe('#00FF00');
		expect(style.softEdgeRadius).toBe(3);
		expect(style.shadowColor).toBe('#000000');
		expect(style.shadowOpacity).toBe(0.4);
		expect(style.shadowBlur).toBeCloseTo(50800 / 9525);
		expect(style.shadowDistance).toBeCloseTo(4);
		expect(style.shadowAngle).toBe(45);
		expect(style.shadowAlignment).toBe('tl');
		expect(style.outerShadowXml).toStrictEqual({
			'a:prstClr': { '@_val': 'black', 'a:alpha': { '@_val': '40000' } },
		});
	});

	it('replaces the family: an inner pick drops the outer shadow and its preserved node', () => {
		const withOuter = styleOf('shadow-outer-offsetBottom', shape());
		const style = styleOf(
			'shadow-inner-insideTop',
			shape({ ...withOuter, effectListXml: { 'a:outerShdw': {}, 'a:glow': { '@_rad': '1' } } }),
		);
		expect(style.shadowColor).toBeUndefined();
		expect(style.outerShadowXml).toBeUndefined();
		expect(style.innerShadowColor).toBe('#000000');
		expect(style.effectListXml).toStrictEqual({ 'a:glow': { '@_rad': '1' } });
	});

	it('writes the glow in theme terms and reports the applied tile', () => {
		const style = styleOf('glow-8-2', shape());
		expect(style.glowColor).toBe('#E97132');
		expect(style.glowRadius).toBeCloseTo(101600 / 9525);
		expect(style.glowXml).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent2', 'a:alpha': { '@_val': '40000' } },
		});
		const d = buildRibbonGallery('shapeEffects', {
			element: shape(style),
			themeColorMap: colorMap,
		});
		const applied = d.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual([
			'shadow-none',
			'reflection-none',
			'glow-8-2',
			'softEdge-none',
			'bevel-none',
			'rotation-none',
		]);
	});

	it('removes a family with its No ... entry', () => {
		const glowing = styleOf('glow-5-1', shape());
		const style = styleOf('glow-none', shape(glowing));
		expect(style.glowColor).toBeUndefined();
		expect(style.glowXml).toBeUndefined();
		expect(style.effectListXml).toStrictEqual({});
	});

	it('adds a bevel with PowerPoint flat scene, and a rotation keeps the bevel', () => {
		const bevel = styleOf('bevel-angle', shape());
		expect(bevel.shape3d).toStrictEqual({ bevelTopType: 'angle' });
		expect(bevel.scene3d).toStrictEqual({
			cameraPreset: 'orthographicFront',
			lightRigType: 'threePt',
			lightRigDirection: 't',
		});
		const rotated = styleOf('rotation-isometricLeftDown', shape(bevel));
		expect(rotated.scene3d?.cameraPreset).toBe('isometricLeftDown');
		expect(rotated.shape3d?.bevelTopType).toBe('angle');
		const flat = styleOf('rotation-none', shape(rotated));
		expect(flat.scene3d?.cameraPreset).toBe('orthographicFront');
		expect(styleOf('bevel-none', shape(bevel)).shape3d).toBeUndefined();
	});
});

/** Collapse fast-xml-parser's `<x></x>` pairs so saved XML compares with PowerPoint's. */
function norm(xml: string): string {
	return xml.replace(/<(a:\w+)([^>]*)><\/\1>/gu, '<$1$2/>');
}

describe('shape Effects round trip', () => {
	it('saves each family as PowerPoint writes it (COM capture)', async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Effects' });
		data.slides = [
			createSlide('Blank').addShape('rect', { x: 50, y: 50, width: 200, height: 100 }).build(),
		];
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(
			(await handler.save(data.slides)).buffer as ArrayBuffer,
		);
		const slide = loaded.slides[0];
		const target = slide.elements.find((el) => el.type === 'shape') as PptxElement;
		let element = target;
		for (const id of [
			'shadow-outer-offsetBottomRight',
			'glow-5-1',
			'softEdge-5',
			'reflection-half4pt',
			'bevel-angle',
		]) {
			const result = applyRibbonGalleryItem('shapeEffects', id, {
				element,
				themeColorMap: loaded.themeColorMap,
			});
			if (result?.kind !== 'element') {
				throw new Error(id);
			}
			element = { ...element, ...result.patch } as PptxElement;
		}
		slide.elements = slide.elements.map((el) => (el.id === target.id ? element : el));
		const zip = await JSZip.loadAsync(await loadedHandler.save(loaded.slides));
		const xml = norm((await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '');
		const effectLst = /<a:effectLst>.*?<\/a:effectLst>/su.exec(xml)?.[0] ?? '';
		// Attribute order is the serializer's; the values are PowerPoint's.
		expect(effectLst).toContain(
			'<a:prstClr val="black"><a:alpha val="40000"/></a:prstClr></a:outerShdw>',
		);
		expect(effectLst).toMatch(/<a:outerShdw[^>]* blurRad="50800"/u);
		expect(effectLst).toMatch(/<a:outerShdw[^>]* dist="38100"/u);
		expect(effectLst).toMatch(/<a:outerShdw[^>]* dir="2700000"/u);
		expect(effectLst).toMatch(/<a:outerShdw[^>]* algn="tl"/u);
		expect(effectLst).toContain(
			'<a:glow rad="63500"><a:schemeClr val="accent1"><a:alpha val="40000"/></a:schemeClr></a:glow>',
		);
		expect(effectLst).toContain('<a:softEdge rad="63500"/>');
		expect(effectLst).toMatch(
			/<a:reflection blurRad="6350" stA="50000" endA="300" endPos="55500" dir="5400000" sy="-100000" dist="50800" algn="bl" rotWithShape="0"\/>/u,
		);
		expect(xml).toContain('<a:bevelT prst="angle"/>');
		expect(xml).toMatch(
			/<a:camera prst="orthographicFront"\/><a:lightRig rig="threePt" dir="t"\/>/u,
		);

		const reloaded = await new PptxHandler().load(
			(await loadedHandler.save(loaded.slides)).buffer as ArrayBuffer,
		);
		const back = reloaded.slides[0].elements.find((el) => el.id === target.id) as PptxElement;
		const d = buildRibbonGallery('shapeEffects', {
			element: back,
			themeColorMap: reloaded.themeColorMap,
		});
		const applied = d.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual([
			'shadow-outer-offsetBottomRight',
			'reflection-half4pt',
			'glow-5-1',
			'softEdge-5',
			'bevel-angle',
			'rotation-none',
		]);
	});
});
