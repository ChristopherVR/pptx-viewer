/**
 * Every chart on a slide got its underlying `ppt/charts/chartN.xml` part
 * completely rebuilt from the parsed+resolved `PptxChartData` model on ANY
 * slide rewrite (e.g. `slide.isDirty = true`), regardless of whether the
 * chart itself was ever touched. Rebuilding materializes load-time
 * resolved/inherited values as literals: a title run inheriting its font
 * from the chart style gets a literal `<a:latin typeface="Aptos"/>` instead
 * of the authored `+mn-lt` theme token, a data-label visibility flag flips,
 * and a `chartex` part's dimension gains a `formatCode` the source never
 * declared. `chart-data-fidelity.pptx` (an existing e2e fixture) reproduces
 * this on an untouched deck round-trip with no edits at all.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/chart-data-fidelity.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('untouched chart parts pass through unchanged', () => {
	it('re-emits every ppt/charts/chartN.xml byte-for-byte on an untouched slide round-trip', async () => {
		const original = await JSZip.loadAsync(readFileSync(FIXTURE));
		const chartParts = Object.keys(original.files).filter((name) =>
			/^ppt\/charts\/chart\d+\.xml$/.test(name),
		);
		expect(chartParts.length).toBeGreaterThan(0);
		const originalContents = new Map<string, string>();
		for (const part of chartParts) {
			originalContents.set(part, await original.file(part)!.async('string'));
		}

		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		// Simulate an editor round-trip that touches the slide (e.g. moving an
		// unrelated element) without editing any chart.
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		const saved = await handler.save(data.slides);

		const savedZip = await JSZip.loadAsync(saved);
		for (const part of chartParts) {
			const savedXml = await savedZip.file(part)!.async('string');
			expect(savedXml).toBe(originalContents.get(part));
		}
	});
});
