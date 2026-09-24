/**
 * Core round-trip audit, item 5: notes/handout masters are rewritten on
 * the binding save path (`buildDeckSaveOptions` threads the loaded
 * `notesMaster`/`handoutMaster` through `handler.save` on every save,
 * exactly like `slideMasters`), and their shape tree is rebuilt via
 * `applyAuxiliaryMasterElementChanges`, which routes every element through
 * the SAME `processSlideElement` / `applyTextBodyContent` pipeline a slide
 * uses. That is also where item 1 fixed a text-less shape's own `a:bodyPr`
 * anchor being deleted outright (`element.textStyle` was dropped entirely
 * for a shape with no runs, regardless of what its own bodyPr declared).
 *
 * `solution-explorer.pptx`'s notes master Footer placeholder is exactly
 * that shape: `<a:bodyPr ... anchor="b"/>` with only an empty
 * `<a:endParaRPr/>`, no runs. This test proves the notes-master save path
 * benefits from the same fix, using its own real `p:notesMaster` structural
 * rewrite (`applyNotesMasterStructuralChanges` /
 * `applyAuxiliaryMasterElementChanges`), not just the slide path item 1's
 * own regression test already covers.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/solution-explorer.pptx', import.meta.url),
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return toArrayBuffer(new Uint8Array(buf));
}

describe('notes master save path keeps a text-less placeholder anchor', () => {
	it('preserves anchor="b" on the Footer placeholder through a structural rewrite', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		expect(data.notesMaster).toBeDefined();

		// Force the structural-rewrite path (`applyNotesMasterStructuralChanges`
		// only rewrites the shape tree when clrMap/headerFooter/elements is
		// defined) by threading the notes master's own clrMap back through,
		// exactly as `buildDeckSaveOptions` does on every binding save. The
		// elements themselves are untouched.
		const notesMaster = {
			...data.notesMaster!,
			clrMap: data.notesMaster!.clrMap ?? {},
		};
		const saved = await handler.save(data.slides, { notesMaster });

		const savedZip = await JSZip.loadAsync(saved);
		const notesMasterXml = await savedZip
			.file('ppt/notesMasters/notesMaster1.xml')!
			.async('string');

		const ftrIdx = notesMasterXml.indexOf('type="ftr"');
		expect(ftrIdx).toBeGreaterThan(-1);
		const bodyPrStart = notesMasterXml.indexOf('<a:bodyPr', ftrIdx);
		const bodyPrEnd = notesMasterXml.indexOf('>', bodyPrStart);
		const bodyPrTag = notesMasterXml.slice(bodyPrStart, bodyPrEnd + 1);
		expect(bodyPrTag).toContain('anchor="b"');
	});
});
