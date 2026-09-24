/**
 * `cp:lastModifiedBy` is a real author identity, not a value this engine has
 * any basis to invent. `PptxDocumentPropertiesUpdater` fabricated the
 * literal string `"pptx"` into `docProps/core.xml` on EVERY save whenever
 * the source omitted the field, materializing fake authorship into a file
 * that never claimed it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

async function fixtureWithoutLastModifiedBy(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
	const xml = await zip.file('docProps/core.xml')!.async('string');
	expect(xml).toContain('<cp:lastModifiedBy>');
	const stripped = xml.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '');
	expect(stripped).not.toContain('lastModifiedBy');
	zip.file('docProps/core.xml', stripped);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('docProps/core.xml cp:lastModifiedBy', () => {
	it('is not fabricated when the source never authored it', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithoutLastModifiedBy());
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('docProps/core.xml')!.async('string');
		expect(savedXml).not.toContain('lastModifiedBy');
	});
});
