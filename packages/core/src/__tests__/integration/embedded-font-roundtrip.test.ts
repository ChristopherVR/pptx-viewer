import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';

/**
 * Regression test for the embedded-font round-trip.
 *
 * The fixture contains 3 fonts at `ppt/fonts/font{1..3}.fntdata` (non-GUID
 * names) with no `fontKey` attribute on their `p:embeddedFont` variants.
 *
 * Before the fix, the save pipeline always generated a brand-new `{GUID}.fntdata`
 * file for every variant that had `rawFontData`, leaving the 3 originals as
 * orphans and adding 3 extra rels — producing a 6-fntdata / 6-rel zip that
 * PowerPoint flagged as corrupt.
 *
 * This test asserts: round-trip yields exactly 3 fntdata parts, 3 font-type
 * relationships, and no relationship whose `Target` points at a missing zip
 * entry.
 */
describe('embedded font round-trip (synthetic fixture)', () => {
	const fixturePath = path.resolve(__dirname, '../fixtures/embedded-assets-sample.pptx');
	const hasFixture = existsSync(fixturePath);

	it.skipIf(!hasFixture)(
		'load → save preserves exactly the original fntdata parts (no orphans, no duplicates)',
		async () => {
			const buf = await fs.readFile(fixturePath);

			const handler = new PptxHandler();
			const data = await handler.load(
				buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
			);

			const saved = await handler.save(data.slides);
			const savedZip = await JSZip.loadAsync(saved);

			// ── 1. Count fntdata parts ──────────────────────────────────────
			const fntdataPaths = Object.keys(savedZip.files).filter(
				(p) => p.endsWith('.fntdata') && !savedZip.files[p].dir,
			);
			expect(fntdataPaths).toHaveLength(3);

			// ── 2. Count font relationships in presentation.xml.rels ────────
			// Match both `<Relationship .../>` (self-closing) and
			// `<Relationship ...></Relationship>` (the fast-xml-parser style).
			const relsXml = await savedZip.file('ppt/_rels/presentation.xml.rels')!.async('string');
			const allRels = [...relsXml.matchAll(/<Relationship\b(?<attrs>[^>]*)>/gu)].map(
				(m) => m.groups!.attrs,
			);
			const fontRels = allRels.filter((attrs) => /\/font(?=["\s/])/u.test(attrs));
			expect(fontRels).toHaveLength(3);

			// ── 3. No orphan rels (every Target resolves to an existing zip entry) ─
			const allRelTargets = fontRels
				.map((attrs) => attrs.match(/Target="(?<target>[^"]+)"/u)?.groups?.target)
				.filter((t): t is string => Boolean(t));

			const existing = new Set(Object.keys(savedZip.files));
			for (const target of allRelTargets) {
				const resolved = target.startsWith('/') ? target.substring(1) : `ppt/${target}`;
				expect(existing.has(resolved), `orphan rel target: ${target} -> ${resolved}`).toBeTruthy();
			}

			// ── 4. Every fntdata file has exactly one rel pointing at it ───
			for (const fntPath of fntdataPaths) {
				const relativeTarget = fntPath.startsWith('ppt/') ? fntPath.substring(4) : fntPath;
				const hits = allRelTargets.filter((t) => t === relativeTarget || t === `/${fntPath}`);
				expect(hits, `expected exactly one rel for ${fntPath}, got ${hits.length}`).toHaveLength(1);
			}
		},
		30000,
	);
});
