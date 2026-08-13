/**
 * Regression guard: `<a:grpFill/>` must SURVIVE a round-trip.
 *
 * A shape that inherits its fill from its group is authored as `<a:grpFill/>`.
 * The load pass resolves that link in the model (`applyGroupFillInheritance`),
 * so the child arrives at the save writer carrying a concrete `fillMode`. The
 * writer used to serialise that resolved value, which replaced the marker with
 * `<a:solidFill/>` and destroyed the inheritance: recolour the group afterwards
 * in PowerPoint and the child no longer follows it.
 *
 * Verified against PowerPoint COM on the deck this test builds: after the fix,
 * patching ONLY the outer group's `a:solidFill` from red to blue in the saved
 * package repaints all three inheriting leaves blue in PowerPoint's own PNG
 * export. Before it, the leaves each carried their own baked `FF0000`.
 *
 * The package scaffolding is a real deck (`linked-textbox.pptx`); only
 * `slide1.xml` is authored, because nothing in the fixture corpus carries
 * `a:grpFill` on a nested `p:grpSp`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { GroupPptxElement, PptxElement, PptxSlide, ShapeStyle } from '../../types';
import { fillMatchesInheritedGroupFill, groupChildInheritedFill } from './save-group-fill';

/** One `<p:sp>` whose fill is whatever markup the caller passes. */
function sp(id: number, name: string, x: number, y: number, fill: string): string {
	return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr></p:sp>`;
}

/** A `<p:grpSp>` at a fixed offset carrying `fill` in its `p:grpSpPr`. */
function grpSp(id: number, name: string, x: number, fill: string, body: string): string {
	return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${x}" y="1000000"/><a:ext cx="1500000" cy="1500000"/><a:chOff x="${x}" y="1000000"/><a:chExt cx="1500000" cy="1500000"/></a:xfrm>${fill}</p:grpSpPr>${body}</p:grpSp>`;
}

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="OuterFilled"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5000000" cy="3000000"/><a:chOff x="0" y="0"/><a:chExt cx="5000000" cy="3000000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:grpSpPr>
${sp(11, 'DirectChild', 0, 0, '<a:grpFill/>')}
${grpSp(12, 'InnerNoFill', 1000000, '', sp(13, 'NestedChild', 1000000, 1000000, '<a:grpFill/>'))}
${grpSp(14, 'InnerGrpFill', 3000000, '<a:grpFill/>', sp(15, 'DeepChild', 3000000, 1000000, '<a:grpFill/>'))}
${sp(16, 'OwnFill', 4000000, 0, '<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>')}
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

/** Load the authored deck and hand back the handler plus its slides. */
async function loadDeck(): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, slides: data.slides };
}

/** `slide1.xml` of a saved package, as text. */
async function savedSlideXml(handler: PptxHandler, slides: PptxSlide[]): Promise<string> {
	const saved = await handler.save(slides);
	const zip = await JSZip.loadAsync(saved);
	return zip.file('ppt/slides/slide1.xml')!.async('string');
}

/** Depth-first lookup of an element by its `cNvPr/@name`. */
function findByName(elements: readonly PptxElement[], name: string): PptxElement | undefined {
	for (const element of elements) {
		if (element.name === name) {
			return element;
		}
		if (element.type === 'group') {
			const hit = findByName(element.children, name);
			if (hit) {
				return hit;
			}
		}
	}
	return undefined;
}

/**
 * The fill serialised for the `p:sp` with the given name, as
 * `"<member>"` or `"<member>:<hex>"`. Normalised so the assertions state the
 * chosen `EG_FillProperties` member rather than the writer's tag style.
 */
function fillMarkupOf(xml: string, name: string): string | undefined {
	const start = xml.indexOf(`name="${name}"`);
	if (start < 0) {
		return undefined;
	}
	const window = xml.slice(start, xml.indexOf('<p:txBody', start));
	const match =
		/<a:(grpFill|noFill|solidFill|gradFill|pattFill)[^>]*>(?:<a:srgbClr val="([0-9A-Fa-f]{6})")?/u.exec(
			window,
		);
	if (!match) {
		return undefined;
	}
	return match[2] ? `${match[1]}:${match[2]}` : match[1];
}

describe('save re-emits authored a:grpFill instead of the resolved fill', () => {
	it('keeps grpFill on every inheriting leaf, at every nesting depth', async () => {
		const { handler, slides } = await loadDeck();
		const xml = await savedSlideXml(handler, slides);

		// Direct child of the filled group.
		expect(fillMarkupOf(xml, 'DirectChild')).toBe('grpFill');
		// Under a nested group that declares no fill of its own.
		expect(fillMarkupOf(xml, 'NestedChild')).toBe('grpFill');
		// Under a nested group whose own fill is itself `a:grpFill`.
		expect(fillMarkupOf(xml, 'DeepChild')).toBe('grpFill');

		// The group's own fill is the ONLY place the colour is written, which is
		// what makes recolouring the group reach the children again.
		expect(xml.match(/FF0000/gu)).toHaveLength(1);
	});

	it('leaves a group child that declares its own fill alone', async () => {
		const { handler, slides } = await loadDeck();
		const xml = await savedSlideXml(handler, slides);

		expect(fillMarkupOf(xml, 'OwnFill')).toBe('solidFill:00FF00');
	});

	it('writes the concrete fill when the child has been recoloured', async () => {
		const { handler, slides } = await loadDeck();

		const recoloured = findByName(slides[0].elements, 'DeepChild');
		const cleared = findByName(slides[0].elements, 'DirectChild');
		expect(recoloured && 'shapeStyle' in recoloured).toBeTruthy();
		Object.assign(recoloured as { shapeStyle?: ShapeStyle }, {
			shapeStyle: { fillMode: 'solid', fillColor: '#00FF00' } satisfies ShapeStyle,
		});
		Object.assign(cleared as { shapeStyle?: ShapeStyle }, {
			shapeStyle: { fillMode: 'none' } satisfies ShapeStyle,
		});

		const xml = await savedSlideXml(handler, slides);
		expect(fillMarkupOf(xml, 'DeepChild')).toBe('solidFill:00FF00');
		expect(fillMarkupOf(xml, 'DirectChild')).toBe('noFill');
		// The untouched sibling still inherits.
		expect(fillMarkupOf(xml, 'NestedChild')).toBe('grpFill');
	});
});

describe('groupChildInheritedFill', () => {
	const group = (groupFill?: ShapeStyle): GroupPptxElement => ({
		type: 'group',
		id: 'g',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		children: [],
		groupFill,
	});
	const red: ShapeStyle = { fillMode: 'solid', fillColor: '#FF0000' };
	const blue: ShapeStyle = { fillMode: 'solid', fillColor: '#0000FF' };

	it("answers with the group's own fill when it has one", () => {
		expect(groupChildInheritedFill(group(blue), red)).toBe(blue);
	});

	it('passes the inherited fill through a group with no fill of its own', () => {
		expect(groupChildInheritedFill(group(undefined), red)).toBe(red);
	});

	it('chains past a group whose own fill is itself a:grpFill', () => {
		expect(groupChildInheritedFill(group({ fillMode: 'group' }), red)).toBe(red);
	});
});

describe('fillMatchesInheritedGroupFill', () => {
	const inherited: ShapeStyle = { fillMode: 'solid', fillColor: '#FF0000' };

	it('matches the resolved copy the load pass stamps on the child', () => {
		expect(
			fillMatchesInheritedGroupFill({ fillMode: 'solid', fillColor: '#ff0000' }, inherited),
		).toBeTruthy();
	});

	it('rejects a recoloured child', () => {
		expect(
			fillMatchesInheritedGroupFill({ fillMode: 'solid', fillColor: '#00FF00' }, inherited),
		).toBeFalsy();
	});

	it('rejects a child whose fill was switched off', () => {
		expect(fillMatchesInheritedGroupFill({ fillMode: 'none' }, inherited)).toBeFalsy();
	});

	it('rejects when there is nothing to inherit', () => {
		expect(
			fillMatchesInheritedGroupFill({ fillMode: 'solid', fillColor: '#FF0000' }, undefined),
		).toBeFalsy();
		expect(fillMatchesInheritedGroupFill({ fillMode: 'group' }, { fillMode: 'group' })).toBeFalsy();
	});

	it('compares gradient stops structurally', () => {
		const gradient: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 1 },
			],
		};
		expect(fillMatchesInheritedGroupFill({ ...gradient }, gradient)).toBeTruthy();
		expect(
			fillMatchesInheritedGroupFill(
				{ ...gradient, fillGradientStops: [{ color: '#FF0000', position: 0 }] },
				gradient,
			),
		).toBeFalsy();
	});
});
