/**
 * A member moved through the drill-in path survives save: the move is made in
 * slide space (what the selection chrome drags), `updateElement` writes it back
 * into the group's space, and after save + reload the member is still inside
 * its group, at the dropped position, with its sibling untouched.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { updateElement } from './editor-mutations';
import { findElementPath, slideSpaceElement } from './group-drill';

const sp = (id: number, name: string, x: number, text: string) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="1905000"/><a:ext cx="1905000" cy="952500"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;

// A group at (1 in, 2 in) whose child space equals its own, holding two cards.
const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="Visual: Cards"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="952500" y="1905000"/><a:ext cx="4000500" cy="952500"/><a:chOff x="952500" y="1905000"/><a:chExt cx="4000500" cy="952500"/></a:xfrm></p:grpSpPr>
${sp(11, 'Card A', 952500, 'Migration')}
${sp(12, 'Card B', 3048000, 'Scale')}
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const fixture = fileURLToPath(
	new URL('../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function load(bytes: Uint8Array): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, slides: data.slides };
}

function byName(elements: readonly PptxElement[], name: string): PptxElement | undefined {
	for (const el of elements) {
		if (el.name === name) {
			return el;
		}
		if (el.type === 'group') {
			const hit = byName(el.children, name);
			if (hit) {
				return hit;
			}
		}
	}
	return undefined;
}

describe('group drill-in round trip', () => {
	it('keeps a member moved in slide space inside its group, where it was dropped', async () => {
		const zip = await JSZip.loadAsync(readFileSync(fixture));
		zip.file('ppt/slides/slide1.xml', SLIDE_XML);
		const { handler, slides } = await load(await zip.generateAsync({ type: 'uint8array' }));

		const cardB = byName(slides[0].elements, 'Card B')!;
		const before = slideSpaceElement(slides[0].elements, cardB.id)!;
		const moved = updateElement(slides, 0, cardB.id, {
			x: before.x + 40,
			y: before.y + 30,
		} as Partial<PptxElement>);

		const reloaded = await load(new Uint8Array(await handler.save(moved)));
		const elements = reloaded.slides[0].elements;
		const again = byName(elements, 'Card B')!;
		const path = findElementPath(elements, again.id)!;
		expect(path.map((e) => e.name)).toStrictEqual(['Visual: Cards', 'Card B']);
		const after = slideSpaceElement(elements, again.id)!;
		expect(after.x).toBeCloseTo(before.x + 40, 0);
		expect(after.y).toBeCloseTo(before.y + 30, 0);
		const cardA = slideSpaceElement(elements, byName(elements, 'Card A')!.id)!;
		const cardABefore = slideSpaceElement(
			slides[0].elements,
			byName(slides[0].elements, 'Card A')!.id,
		)!;
		expect([cardA.x, cardA.y]).toStrictEqual([cardABefore.x, cardABefore.y]);
	});
});
