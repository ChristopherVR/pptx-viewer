/**
 * Regression guard: `a:grpFill` must be resolved in the MODEL, not only by the
 * renderer.
 *
 * A shape that declares `<a:grpFill/>` paints with the fill of the nearest
 * ANCESTOR group that has one. The load pass resolves that by pushing a group's
 * fill down its subtree, and it used to stop at any nested group that declared
 * a fill of its own, including one whose own fill is ITSELF `<a:grpFill/>`.
 * A leaf under such a group kept `fillMode: 'group'` with no colour.
 *
 * Render compensated: `getGroupChildParentFill` in `pptx-viewer-shared` chains
 * past a group-mode fill to the ancestor (COM-verified against a red fill), so
 * the pixels were right. Everything that reads the MODEL instead of the DOM
 * (the MCP tools, the exporters, the Markdown converter) still saw an
 * unresolved fill, and the two disagreed about the same shape. This test states
 * the rule once, in the same terms as the render side.
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
import type { PptxElement } from '../../types';

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
</p:grpSp>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20" name="OuterUnfilled"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="3200000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="3200000"/><a:chExt cx="2000000" cy="1000000"/></a:xfrm></p:grpSpPr>
${sp(21, 'OrphanChild', 0, 3200000, '<a:grpFill/>')}
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

/** Every non-group element on the slide, keyed by its `cNvPr/@name`. */
async function loadLeavesByName(): Promise<Map<string, PptxElement>> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);

	const leaves = new Map<string, PptxElement>();
	const walk = (elements: readonly PptxElement[]): void => {
		for (const element of elements) {
			if (element.type === 'group') {
				walk(element.children);
				continue;
			}
			if (element.name) {
				leaves.set(element.name, element);
			}
		}
	};
	walk(data.slides[0].elements);
	return leaves;
}

function fillOf(element: PptxElement | undefined): { mode?: string; color?: string } {
	const style = (element as { shapeStyle?: { fillMode?: string; fillColor?: string } } | undefined)
		?.shapeStyle;
	return { mode: style?.fillMode, color: style?.fillColor };
}

describe('a:grpFill inheritance is resolved in the loaded model', () => {
	it('resolves a grpFill leaf at every depth, including under a grpFill group', async () => {
		const leaves = await loadLeavesByName();

		// Direct child of the filled group: the case that always worked.
		expect(fillOf(leaves.get('DirectChild'))).toStrictEqual({ mode: 'solid', color: '#FF0000' });
		// Under a nested group that declares NO fill: descends, also worked.
		expect(fillOf(leaves.get('NestedChild'))).toStrictEqual({ mode: 'solid', color: '#FF0000' });
		// Under a nested group whose own fill is itself `a:grpFill`: the walk used
		// to stop here and leave the leaf on an unresolved `fillMode: 'group'`.
		expect(fillOf(leaves.get('DeepChild'))).toStrictEqual({ mode: 'solid', color: '#FF0000' });
	});

	it('leaves a grpFill leaf unresolved when no ancestor group has a fill', async () => {
		const leaves = await loadLeavesByName();

		// The other direction: nothing to inherit must stay `group`, not pick up
		// some other group's paint.
		expect(fillOf(leaves.get('OrphanChild'))).toStrictEqual({ mode: 'group', color: undefined });
	});
});
