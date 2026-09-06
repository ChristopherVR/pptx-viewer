/**
 * Regression guard: `p:grpSpPr/a:effectLst/a:reflection` on a group with NO
 * fill of its own must still reach the model (as `GroupPptxElement.groupEffectStyle`),
 * and must NOT be mistaken for a paintable `a:grpFill` source by the
 * inheritance chain.
 *
 * `groupFill` and `groupEffectStyle` come from the SAME `extractShapeStyle`
 * call on `p:grpSpPr`, but `groupFill` is `undefined` unless the group
 * resolved to a real `fillMode` - `getGroupChildParentFill` /
 * `groupChildInheritedFill` (the `a:grpFill` inheritance chain) rely on that
 * to keep chaining through an ancestor's fill when a group has none of its
 * own. Landing the reflection under the SAME field very nearly broke that
 * chain: a reflection-only group would have reported "I have a fill" (an
 * object with no `fillMode`) and swallowed the ancestor's colour instead of
 * passing it through.
 *
 * The package scaffolding is a real deck (`linked-textbox.pptx`); only
 * `slide1.xml` is authored, mirroring `group-fill-inheritance.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { GroupPptxElement, PptxElement } from '../../types';

const REFLECTION =
	'<a:effectLst><a:reflection blurRad="0" stA="60000" endA="0" endPos="100000" dist="24000" ' +
	'dir="5400000" fadeDir="5400000" rotWithShape="0"/></a:effectLst>';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="ReflectionOnlyGroup"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="2000000" cy="1000000"/></a:xfrm>${REFLECTION}</p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="11" name="Leaf"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>
</p:grpSp>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20" name="OuterFilled"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="1200000"/><a:ext cx="5000000" cy="3000000"/><a:chOff x="0" y="1200000"/><a:chExt cx="5000000" cy="3000000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:grpSpPr>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="21" name="InnerReflectionOnly"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="1200000"/><a:ext cx="1500000" cy="1500000"/><a:chOff x="0" y="1200000"/><a:chExt cx="1500000" cy="1500000"/></a:xfrm>${REFLECTION}</p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="22" name="GrpFillChild"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="1200000"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:grpFill/></p:spPr></p:sp>
</p:grpSp>
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function loadSlideElements(): Promise<PptxElement[]> {
	const zip = await JSZip.loadAsync(readFileSync(fixture));
	zip.file('ppt/slides/slide1.xml', SLIDE_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return [...data.slides[0].elements];
}

/** Depth-first find by `name`, descending into groups. */
function findByName(elements: readonly PptxElement[], name: string): PptxElement | undefined {
	for (const element of elements) {
		if (element.name === name) {
			return element;
		}
		if (element.type === 'group') {
			const found = findByName(element.children, name);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

describe('group-level a:reflection reaches the model without breaking a:grpFill inheritance', () => {
	it('parses a fill-less group’s a:effectLst/a:reflection onto groupEffectStyle, not groupFill', async () => {
		const elements = await loadSlideElements();
		const group = findByName(elements, 'ReflectionOnlyGroup') as GroupPptxElement | undefined;
		expect(group?.type).toBe('group');
		expect(group?.groupFill).toBeUndefined();
		expect(group?.groupEffectStyle?.reflectionDistance).toBeGreaterThan(0);
		expect(group?.groupEffectStyle?.reflectionStartOpacity).toBeCloseTo(0.6);
	});

	it('still lets a:grpFill chain PAST a reflection-only group to the real ancestor fill', async () => {
		// This is the regression this test file exists to pin: an earlier version
		// of this fix stored the reflection on `groupFill` itself, so
		// `InnerReflectionOnly` reported "I have my own fill" (an object with no
		// `fillMode`) and `GrpFillChild` resolved to nothing instead of the
		// OUTER group's red.
		const elements = await loadSlideElements();
		const child = findByName(elements, 'GrpFillChild');
		const style = (child as { shapeStyle?: { fillMode?: string; fillColor?: string } } | undefined)
			?.shapeStyle;
		expect(style?.fillMode).toBe('solid');
		expect(style?.fillColor).toBe('#FF0000');
	});
});
