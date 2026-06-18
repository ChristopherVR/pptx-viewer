import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

/**
 * PowerPoint's loader enforces a strict `[0-9]+\.[0-9]{4}` pattern on
 * `docProps/app.xml`'s `<AppVersion>` value. If it doesn't match (e.g.
 * `16.0000` gets round-tripped to `16`), the loader rejects the package
 * with HRESULT 0x80070570 (ERROR_FILE_CORRUPT) and shows the repair dialog.
 *
 * The fast-xml-parser default `parseTagValue: true` silently coerced
 * element text like `"16.0000"` to the JS number 16, so save wrote back
 * `<AppVersion>16</AppVersion>`. We now set `parseTagValue: false` so
 * element text round-trips as a literal string.
 */
describe('docProps/app.xml <AppVersion> round-trip preserves literal string', () => {
	const fixturePath = path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx');
	const hasFixture = existsSync(fixturePath);

	it.skipIf(!hasFixture)(
		'appVersion with trailing decimal zeros survives round-trip byte-for-byte',
		async () => {
			const buf = await fs.readFile(fixturePath);
			const handler = new PptxHandler();
			const data = await handler.load(
				buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
			);

			const origZip = await JSZip.loadAsync(buf);
			const origAppXml = await origZip.file('docProps/app.xml')!.async('string');
			const origMatch = origAppXml.match(/<AppVersion>(?<version>[^<]+)<\/AppVersion>/u);
			expect(origMatch, 'fixture is expected to declare <AppVersion>').not.toBeNull();
			const origVersion = origMatch!.groups!.version;

			const saved = await handler.save(data.slides);
			const savedZip = await JSZip.loadAsync(saved);
			const savedAppXml = await savedZip.file('docProps/app.xml')!.async('string');
			const savedMatch = savedAppXml.match(/<AppVersion>(?<version>[^<]+)<\/AppVersion>/u);
			expect(savedMatch, 'saved file must preserve <AppVersion>').not.toBeNull();
			const savedVersion = savedMatch!.groups!.version;

			expect(savedVersion).toBe(origVersion);
			// PowerPoint also enforces the [0-9]+\.[0-9]{4} pattern even
			// when a file didn't originate from Office; fail fast if the
			// pipeline ever produces a non-matching literal.
			expect(savedVersion).toMatch(/^\d+\.\d{4}$/u);
		},
		30000,
	);
});
