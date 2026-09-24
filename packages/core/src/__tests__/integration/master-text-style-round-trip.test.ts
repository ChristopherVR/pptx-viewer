/**
 * Core round-trip audit, item 3: `applyMasterTextStyles`
 * (utils/master-text-style-writer.ts / placeholder-level-style-serializer.ts)
 * flattens resolved-for-display values back onto the master the moment
 * `opts.slideMasters` is threaded through `handler.save`, which
 * `buildDeckSaveOptions` (packages/shared/src/render/deck-save-options.ts)
 * does on EVERY binding's main download/getContent path, not just a
 * dedicated "edit the master" flow.
 *
 * `master-layout-inheritance-fills.pptx` (corpus fixture)'s slide master has:
 *   - `p:titleStyle/a:lvl1pPr`: `<a:spcBef><a:spcPct val="0"/></a:spcBef>`
 *     and `<a:latin typeface="+mj-lt"/>`.
 *   - `p:bodyStyle/a:lvl1pPr`: `<a:spcBef><a:spcPts val="1000"/></a:spcBef>`,
 *     `<a:latin typeface="+mn-lt"/>`, and
 *     `<a:buFont typeface="Arial" panose="020B0604020202020204"
 *     pitchFamily="34" charset="0"/>`.
 *
 * Before the fix, re-saving with the loaded (untouched) typed master model
 * threaded through `opts.slideMasters` turned `+mj-lt`/`+mn-lt` into the
 * literal resolved face name, turned the percentage `a:spcPct` into a fixed
 * `a:spcPts`, and replaced `a:buFont` with a bare `@typeface`, dropping
 * `panose`/`pitchFamily`/`charset`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../fixtures/corpus/master-layout-inheritance-fills.pptx', import.meta.url),
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return toArrayBuffer(new Uint8Array(buf));
}

describe('applyMasterTextStyles does not flatten untouched master text styles', () => {
	it('preserves +mj-lt/+mn-lt aliases, a:spcPct, and buFont fallback attributes', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());

		// This is exactly what `buildDeckSaveOptions` (every binding's main
		// save path) does: thread the loaded, UNEDITED master array through.
		const saved = await handler.save(data.slides, {
			slideMasters: [...data.slideMasters],
		});

		const savedZip = await JSZip.loadAsync(saved);
		const masterXml = await savedZip.file('ppt/slideMasters/slideMaster1.xml')!.async('string');

		// Theme font aliases survive instead of being resolved to a literal name.
		expect(masterXml).toContain('typeface="+mj-lt"');
		expect(masterXml).toContain('typeface="+mn-lt"');

		// Percentage spacing survives instead of being frozen to a:spcPts.
		expect(masterXml).toContain('<a:spcBef><a:spcPct val="0"');
		// The bodyStyle level already used an absolute a:spcPts and must stay
		// that way (the fix must not turn every spacing into a percentage).
		expect(masterXml).toContain('<a:spcBef><a:spcPts val="1000"');

		// The bullet font's fallback-face hints survive.
		expect(masterXml).toContain('panose="020B0604020202020204"');
		expect(masterXml).toContain('pitchFamily="34"');
		expect(masterXml).toContain('charset="0"');
	});
});
