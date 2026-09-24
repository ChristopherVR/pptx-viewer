/**
 * `ppt/commentAuthors.xml` was deleted on EVERY save where no CURRENT
 * comment referenced any author, even when the deck had a real (possibly
 * populated) author registry at load time - e.g. a deck whose comments were
 * all resolved/deleted, or one whose comments simply live on slides not
 * currently being saved. Real PowerPoint keeps the registry so a returning
 * commenter's name/initials/colour survive; this engine erased it.
 * `Mathematical_Equations_11_Slides_46_KB_3c22e70f4d.pptx` (an existing e2e
 * fixture) ships exactly this: a `commentAuthors.xml` part with no comment
 * currently referencing any author.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL(
		'../../../../../e2e/fixtures/Mathematical_Equations_11_Slides_46_KB_3c22e70f4d.pptx',
		import.meta.url,
	),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('ppt/commentAuthors.xml survives a save with no currently-used authors', () => {
	it('keeps the part instead of deleting the whole author registry', async () => {
		const original = await JSZip.loadAsync(readFileSync(FIXTURE));
		expect(original.file('ppt/commentAuthors.xml')).not.toBeNull();

		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		expect(savedZip.file('ppt/commentAuthors.xml')).not.toBeNull();
	});
});
