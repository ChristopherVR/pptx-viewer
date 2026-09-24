/**
 * `parseShape` unconditionally initialized its `text` local to `''` and only
 * ever reassigned it when a `p:txBody` (own or inherited) was actually
 * found, so a bare shape with NO `p:txBody` at all (a decorative rectangle,
 * say) still reported `text: ''` on its parsed element - indistinguishable
 * from an authored-but-empty text box. The save writer's
 * `typeof el.text === 'string'` check then created a brand-new, empty
 * `<p:txBody/>` on that shape's `rawXml` the moment it was rewritten, which
 * happens for a master/layout element whenever ANY edit on that part
 * triggers its write-back (`shouldWriteBack`/`isOwnTemplateElement`). Real
 * PowerPoint never authors a `p:txBody` on a shape with no text capability.
 *
 * Reproduced by injecting a bare (no `p:txBody`) decorative rectangle into
 * `template-editing.pptx`'s slide master, then editing that SAME shape (so
 * its own write-back fires) and checking the saved master XML for a
 * spuriously-added `p:txBody`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/template-editing.pptx', import.meta.url),
);
const MASTER_PART = 'ppt/slideMasters/slideMaster1.xml';
const BARE_SHAPE_NAME = 'BareDecorativeRect';

async function fixtureWithBareShape(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
	const xml = await zip.file(MASTER_PART)!.async('string');
	const bareShape =
		`<p:sp><p:nvSpPr><p:cNvPr id="92" name="${BARE_SHAPE_NAME}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="200000" cy="200000"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`;
	expect(xml).toContain('</p:spTree>');
	const withShape = xml.replace('</p:spTree>', `${bareShape}</p:spTree>`);
	zip.file(MASTER_PART, withShape);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('master bare shape does not gain an empty p:txBody', () => {
	it('parses a bare shape with text: undefined, not an empty string', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithBareShape());
		const master = data.slideMasters!.find((m) =>
			m.elements!.some((el) => 'name' in el && el.name === BARE_SHAPE_NAME),
		)!;
		const bareShape = master.elements!.find((el) => 'name' in el && el.name === BARE_SHAPE_NAME)!;
		expect((bareShape as { text?: string }).text).toBeUndefined();
	});

	it('re-emits no p:txBody for the bare shape when its own edit triggers write-back', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithBareShape());
		const masters = structuredClone(data.slideMasters!);
		const master = masters.find((m) =>
			m.elements!.some((el) => 'name' in el && el.name === BARE_SHAPE_NAME),
		)!;
		const bareShape = master.elements!.find((el) => 'name' in el && el.name === BARE_SHAPE_NAME)!;
		(bareShape as { x: number }).x += 10;

		const saved = await handler.save(data.slides, { slideMasters: masters });
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file(MASTER_PART)!.async('string');
		const shapeStart = savedXml.indexOf(BARE_SHAPE_NAME);
		expect(shapeStart).toBeGreaterThan(-1);
		const shapeEnd = savedXml.indexOf('</p:sp>', shapeStart) + '</p:sp>'.length;
		const shapeXml = savedXml.slice(savedXml.lastIndexOf('<p:sp>', shapeStart), shapeEnd);
		expect(shapeXml).not.toContain('p:txBody');
	});
});
