/**
 * Round-trip guard for editing a GROUP that lives in a layout or slide master.
 *
 * `PptxHandlerRuntimeSaveElementWriter.processSlideElement` returned from its
 * `el.type === 'group'` branch before the template branch further down could
 * run, so every edit to an inherited `<p:grpSp>` was silently discarded: the
 * viewer moved the group, renamed it, retyped the text inside it, and the saved
 * layout came back byte-identical. Returning was the right INTERIM call (the
 * branch used to copy the layout's group into every slide's own `p:spTree`,
 * growing a deck from 82 to 106 shapes on a no-edit round-trip), but it left
 * the feature dead.
 *
 * Three separate defects had to be fixed together for the join to work, and
 * this file pins all three:
 *
 *   1. `getTreeBucketKeyForElementType('group')` reported `'p:sp'`, so the
 *      template writer looked for the group in the wrong `p:spTree` bucket and
 *      would have appended a `<p:grpSp>` as a sibling `<p:sp>`.
 *   2. `getCnvPrNode` had no `p:grpSp` branch, so the group's `p:cNvPr` (and
 *      hence its identity) could not be found.
 *   3. `serializeShapeLocks` had no `a:grpSpLocks` branch. `CT_GroupLocking`
 *      (S20.1.2.2.21) is not `CT_ShapeLocking`: it adds `@noUngrp` and has no
 *      `@noTextEdit` / `@noEditPoints` / `@noAdjustHandles`.
 */
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { GroupPptxElement, PptxElement, XmlObject } from '../../core/types';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	preserveOrder: false,
	parseAttributeValue: false,
	parseTagValue: false,
	allowBooleanAttributes: true,
	trimValues: true,
});

const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout7.xml';
const SLIDE_PATH = 'ppt/slides/slide1.xml';

/**
 * A `<p:grpSp>` with four children whose tags ALTERNATE (`sp, cxnSp, sp,
 * cxnSp`). The alternation is the point: a group written back to a template
 * part is re-interleaved at flush time from the part's original XML by
 * matching each child on its index within its own tag, so a rebuilt group that
 * keeps `#pptx-order-N` marker keys comes back restacked.
 */
function layoutGroupXml(locks: string): string {
	const box = (id: number, name: string, x: number) =>
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${name}</a:t></a:r></a:p></p:txBody></p:sp>`;
	const line = (id: number, name: string, x: number) =>
		`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="line"><a:avLst/></a:prstGeom></p:spPr></p:cxnSp>`;
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="200" name="LayoutGroup"/>` +
		`<p:cNvGrpSpPr>${locks}</p:cNvGrpSpPr><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="457200" y="5029200"/><a:ext cx="1828800" cy="457200"/>` +
		`<a:chOff x="0" y="0"/><a:chExt cx="1828800" cy="457200"/></a:xfrm></p:grpSpPr>${box(
			201,
			'GroupBox1',
			0,
		)}${line(202, 'GroupLine1', 457200)}${box(203, 'GroupBox2', 914400)}${line(
			204,
			'GroupLine2',
			1371600,
		)}</p:grpSp>`
	);
}

/** Seed a deck and inject the group above into the layout its slide uses. */
async function buildDeckWithLayoutGroup(locks = ''): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);
	const layoutXml = await zip.file(LAYOUT_PATH)!.async('string');
	zip.file(LAYOUT_PATH, layoutXml.replace('</p:spTree>', `${layoutGroupXml(locks)}</p:spTree>`));
	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function savedPart(bytes: Uint8Array, partPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	return zip.file(partPath)!.async('string');
}

function layoutSpTree(xml: string): XmlObject {
	const root = parser.parse(xml)['p:sldLayout'] as XmlObject;
	return (root['p:cSld'] as XmlObject)['p:spTree'] as XmlObject;
}

function asArray(value: unknown): XmlObject[] {
	return Array.isArray(value) ? (value as XmlObject[]) : value ? [value as XmlObject] : [];
}

/** Every `p:cNvPr/@name` inside the layout's group, in document order. */
function groupChildNames(xml: string): string[] {
	return [...xml.matchAll(/<p:cNvPr[^>]*name="([^"]*)"/gu)]
		.map((match) => match[1]!)
		.filter((name) => name.startsWith('Group'));
}

function groupNode(spTree: XmlObject): XmlObject | undefined {
	return asArray(spTree['p:grpSp'])[0];
}

function groupLocksNode(spTree: XmlObject): XmlObject | undefined {
	const nv = groupNode(spTree)?.['p:nvGrpSpPr'] as XmlObject | undefined;
	const cNv = nv?.['p:cNvGrpSpPr'] as XmlObject | undefined;
	return cNv?.['a:grpSpLocks'] as XmlObject | undefined;
}

function groupOffset(spTree: XmlObject): { x?: string; y?: string } {
	const props = groupNode(spTree)?.['p:grpSpPr'] as XmlObject | undefined;
	const xfrm = props?.['a:xfrm'] as XmlObject | undefined;
	const off = xfrm?.['a:off'] as XmlObject | undefined;
	return { x: off?.['@_x'] as string | undefined, y: off?.['@_y'] as string | undefined };
}

function slideGroup(slide: { elements: PptxElement[] }): GroupPptxElement {
	const group = slide.elements.find(
		(element): element is GroupPptxElement =>
			element.type === 'group' && element.id.startsWith('layout-'),
	);
	expect(group, 'the layout group is merged onto the slide').toBeTruthy();
	return group!;
}

describe('template group editing round-trip', () => {
	it('writes a moved + retyped layout group back into the layout part', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithLayoutGroup());
		const group = slideGroup(data.slides[0]!);

		const originalX = group.x;
		group.x += 100;
		group.y += 50;
		const child = group.children.find((element) => element.id.endsWith('shape-0'))!;
		expect('text' in child ? child.text : undefined).toBe('GroupBox1');
		if ('text' in child) {
			child.text = 'GROUP-EDITED';
		}

		const saved = await handler.save(data.slides);
		const layoutXml = await savedPart(saved, LAYOUT_PATH);

		// The edit landed in the LAYOUT, not in the slide.
		expect(layoutXml).toContain('GROUP-EDITED');
		await expect(savedPart(saved, SLIDE_PATH)).resolves.not.toContain('<p:grpSp>');

		const tree = layoutSpTree(layoutXml);
		expect(asArray(tree['p:grpSp'])).toHaveLength(1);
		expect(groupOffset(tree).x).toBe(String((originalX + 100) * 9525));

		// Reload: the model sees the move and the text.
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedGroup = slideGroup(reloaded.slides[0]!);
		expect(reloadedGroup.x).toBe(originalX + 100);
		const reloadedChild = reloadedGroup.children.find((element) => element.id.endsWith('shape-0'))!;
		expect('text' in reloadedChild ? reloadedChild.text : undefined).toBe('GROUP-EDITED');
	});

	it('keeps the group children in document order across the write-back', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithLayoutGroup());
		const group = slideGroup(data.slides[0]!);
		group.x += 10;

		const layoutXml = await savedPart(await handler.save(data.slides), LAYOUT_PATH);
		expect(groupChildNames(layoutXml)).toStrictEqual([
			'GroupBox1',
			'GroupLine1',
			'GroupBox2',
			'GroupLine2',
		]);
	});

	it('does not lift the group children out into the layout shape tree', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithLayoutGroup());
		const group = slideGroup(data.slides[0]!);
		group.x += 10;

		const tree = layoutSpTree(await savedPart(await handler.save(data.slides), LAYOUT_PATH));
		// A group child's id derives from the group's own `layout-` prefixed base
		// id, so an id-only template test promotes all four children to top-level
		// siblings of the layout's shape tree.
		expect(asArray(tree['p:cxnSp'])).toHaveLength(0);
		const names = asArray(tree['p:sp']).map((shape) => {
			const nv = shape['p:nvSpPr'] as XmlObject | undefined;
			return (nv?.['p:cNvPr'] as XmlObject | undefined)?.['@_name'];
		});
		expect(names).not.toContain('GroupBox1');
	});

	it('round-trips a:grpSpLocks and keeps @noUngrp, which the model does not carry', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(
			await buildDeckWithLayoutGroup('<a:grpSpLocks noUngrp="1" noMove="1"/>'),
		);
		const group = slideGroup(data.slides[0]!);
		// `a:grpSpLocks` hangs off `p:cNvGrpSpPr`; without parsing it the writer
		// would read `locks === undefined` and delete the node on the first save.
		expect(group.locks?.noMove).toBeTruthy();

		group.locks = { ...group.locks, noMove: false, noSelect: true };
		const tree = layoutSpTree(await savedPart(await handler.save(data.slides), LAYOUT_PATH));
		expect(groupLocksNode(tree)).toStrictEqual({
			'@_noUngrp': '1',
			'@_noMove': '0',
			'@_noSelect': '1',
		});
	});

	it('preserves a:grpSpLocks on an untouched group', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(
			await buildDeckWithLayoutGroup('<a:grpSpLocks noUngrp="1" noMove="1"/>'),
		);
		const tree = layoutSpTree(await savedPart(await handler.save(data.slides), LAYOUT_PATH));
		expect(groupLocksNode(tree)).toStrictEqual({ '@_noUngrp': '1', '@_noMove': '1' });
	});

	it('deletes a group from a layout edited through the Slide Master view', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildDeckWithLayoutGroup());
		const layout = data.slideMasters![0]!.layouts!.find((entry) => entry.path === LAYOUT_PATH)!;
		expect(layout.elements?.some((element) => element.type === 'group')).toBeTruthy();

		layout.elements = (layout.elements ?? []).filter((element) => element.type !== 'group');
		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		expect(asArray(layoutSpTree(await savedPart(saved, LAYOUT_PATH))['p:grpSp'])).toHaveLength(0);

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedLayout = reloaded.slideMasters![0]!.layouts!.find(
			(entry) => entry.path === LAYOUT_PATH,
		)!;
		expect(reloadedLayout.elements?.some((element) => element.type === 'group')).toBeFalsy();
	});
});
