import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

/**
 * EMF/WMF embedded images are converted to PNG data URLs at load time so the
 * browser `<img>` tag can render them. Before the fix, the save pipeline
 * would decode the PNG data URL back to bytes and write those PNG bytes
 * into the original `image*.emf` / `image*.wmf` zip entry — PowerPoint's
 * GDI metafile parser then rejected the PNG signature with
 * ERROR_FILE_CORRUPT (0x80070570) and showed the repair dialog on open.
 *
 * The save pipeline must never write bytes of one format into a file whose
 * extension declares a different format. The original metafile bytes are
 * already in the zip from load, so skipping the overwrite preserves them.
 */
describe('eMF/WMF metafile round-trip preserves the original bytes', () => {
	const fixturePath = path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx');
	const hasFixture = existsSync(fixturePath);

	it.skipIf(!hasFixture)(
		'round-tripping a deck with embedded EMF never overwrites the .emf with non-EMF bytes',
		async () => {
			const buf = await fs.readFile(fixturePath);
			const handler = new PptxHandler();
			const data = await handler.load(
				buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
			);
			const saved = await handler.save(data.slides);
			const zip = await JSZip.loadAsync(saved);

			const metafilePaths = Object.keys(zip.files).filter(
				(p) => /\.(?:emf|wmf)$/iu.test(p) && !zip.files[p].dir,
			);
			expect(
				metafilePaths,
				'the fixture is expected to contain at least one EMF/WMF part',
			).not.toHaveLength(0);

			for (const p of metafilePaths) {
				const bytes = await zip.file(p)!.async('uint8array');
				// EMF magic: 01 00 00 00 … " EMF" at offset 0x28 (ENHMETA_SIGNATURE 0x464D4520).
				// WMF magic: D7 CD C6 9A (placeable) or 01 00 09 00 (unplaceable).
				// PNG magic: 89 50 4E 47 — MUST NOT appear at byte 0 in an EMF/WMF part.
				const firstFour = `${bytes[0]?.toString(16).padStart(2, '0')} ${bytes[1]?.toString(16).padStart(2, '0')} ${bytes[2]?.toString(16).padStart(2, '0')} ${bytes[3]?.toString(16).padStart(2, '0')}`;
				expect(
					bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47,
					`${p} starts with PNG signature (${firstFour}) — the metafile was overwritten with image-conversion output`,
				).toBeFalsy();
			}
		},
		30000,
	);
});
