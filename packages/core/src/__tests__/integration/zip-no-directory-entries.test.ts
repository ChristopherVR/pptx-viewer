import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';

/**
 * ISO/IEC 29500-2 §10.1.1 (Open Packaging Convention): every ZIP item in an
 * OPC package must map one-to-one to a part URI — folder entries (zero-length
 * ZIP items whose name ends with `/`) are NOT parts. JSZip auto-creates these
 * when `.file('a/b/c', …)` is called, and PowerPoint's OPC loader rejects
 * them with its file-corruption / repair dialog on open even though schema
 * validators never see them (validators iterate logical parts only).
 *
 * The save pipeline must strip every `dir: true` entry before emitting the
 * final zip bytes.
 */
describe('saved zip contains no OPC-invalid directory entries', () => {
	it('round-trip output has zero ZIP folder entries', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank').addText('hello', { x: 10, y: 10, width: 200, height: 50 }).build(),
		);

		const savedBytes = await handler.save(data.slides);
		const saved = await JSZip.loadAsync(savedBytes);

		const directoryEntries = Object.keys(saved.files).filter((name) => saved.files[name].dir);
		expect(
			directoryEntries,
			`OPC package must not contain folder entries; got: ${directoryEntries.join(', ')}`,
		).toHaveLength(0);
	});
});
