/**
 * Regression test for the from-scratch SDK save-corruption bug: a shape
 * created via `ShapeBuilder`/`SlideBuilder.addShape` with a `shapeAdjustments`
 * key that is not one of the resolved preset's real ECMA-376 guide names
 * used to reach the saved file verbatim, producing a `.pptx` PowerPoint COM
 * refuses to open ("The file or directory is corrupted and unreadable",
 * 0x80070570) even though the XML is otherwise schema-valid. Root cause and
 * fix: `applyGeometryUpdate` (PptxHandlerRuntimeSaveElementEmbedding.ts) now
 * filters `shapeAdjustments` through `filterValidShapeAdjustmentEntries`
 * before writing `<a:avLst>`.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from './PresentationBuilder';
import type { ShapeOptions } from './types';

/** Build a one-slide deck with a single preset shape, save it, and return `ppt/slides/slide1.xml`. */
async function saveShapeAndGetSlideXml(shapeType: string, options: ShapeOptions): Promise<string> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank').addShape(shapeType, options).build();
	data.slides.push(slide);
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')?.async('string');
	if (xml === undefined) {
		throw new Error('slide1.xml missing from saved package');
	}
	return xml;
}

describe('shapeAdjustments guide-name validation on save', () => {
	const BASE: Pick<ShapeOptions, 'x' | 'y' | 'width' | 'height'> = {
		x: 0,
		y: 0,
		width: 200,
		height: 100,
	};

	it('writes `<a:gd name="adj" fmla="val 30000">` for homePlate\'s real guide', async () => {
		const xml = await saveShapeAndGetSlideXml('homePlate', {
			...BASE,
			adjustments: { adj: 30000 },
		});
		expect(xml).toContain('<a:prstGeom prst="homePlate">');
		expect(xml).toContain('<a:gd name="adj" fmla="val 30000">');
	});

	it('drops a guide name that is not real for the resolved preset (homePlate has no adj1)', async () => {
		const xml = await saveShapeAndGetSlideXml('homePlate', {
			...BASE,
			adjustments: { adj1: 30000 },
		});
		expect(xml).not.toContain('adj1');
		// homePlate DOES have adjustment guides, so the (now-empty) avLst must
		// still be present, not omitted, for the preset's own default to apply.
		expect(xml).toContain('<a:prstGeom prst="homePlate"><a:avLst></a:avLst></a:prstGeom>');
	});

	it('keeps the valid entry and drops the invalid one from a mixed record', async () => {
		const xml = await saveShapeAndGetSlideXml('homePlate', {
			...BASE,
			adjustments: { adj: 30000, adj1: 30000, adj2: 30000 },
		});
		expect(xml).toContain('<a:gd name="adj" fmla="val 30000">');
		expect(xml).not.toContain('name="adj1"');
		expect(xml).not.toContain('name="adj2"');
	});

	it('drops every entry for a preset with no real adjustment guides (rect)', async () => {
		const xml = await saveShapeAndGetSlideXml('rect', {
			...BASE,
			adjustments: { adj: 30000, adj1: 30000 },
		});
		expect(xml).toContain('<a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom>');
	});
});
