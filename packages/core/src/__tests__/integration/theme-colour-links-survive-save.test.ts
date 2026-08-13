/**
 * A themed chart or diagram colour is a LINK, not a value.
 *
 * `<a:schemeClr val="accent1"><a:lumMod val="60000"/></a:schemeClr>`
 * (ECMA-376 §20.1.2.3.29) binds a series fill or a SmartArt colour list to the
 * theme. The parse resolves it to a hex so the renderer has something to paint
 * with, and the save then wrote that hex back as `<a:srgbClr>` - on every save,
 * for charts and diagrams nobody had touched, because neither writer had a
 * dirty check. One save was enough to cut a themed deck loose from its theme.
 *
 * Both writers mutate the ORIGINAL part in place, so the authored node is
 * still present when the resolved colour is written back: comparing the two is
 * what tells an edit from an inheritance artefact.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import { readCorpusFixture } from './real-world-corpus-helpers';

const FIXTURE = 'smartart-chart-table-mix.pptx';

function countScheme(xml: string): number {
	return xml.split('<a:schemeClr').length - 1;
}

async function partsOf(
	bytes: ArrayBuffer | Uint8Array,
	prefix: string,
): Promise<Map<string, string>> {
	const zip = await JSZip.loadAsync(bytes);
	const out = new Map<string, string>();
	for (const name of Object.keys(zip.files)) {
		if (name.startsWith(prefix) && name.endsWith('.xml')) {
			out.set(name, await zip.files[name].async('string'));
		}
	}
	return out;
}

async function savedFixture(): Promise<Uint8Array> {
	const handler = new PptxHandler();
	const data = await handler.load(readCorpusFixture(FIXTURE));
	for (const slide of data.slides) {
		slide.isDirty = true;
	}
	return await handler.save(data.slides);
}

describe('theme colour links survive a save', () => {
	it('keeps every a:schemeClr in the chart part of an unedited chart', async () => {
		const source = readCorpusFixture(FIXTURE);
		const saved = await savedFixture();
		const before = await partsOf(source, 'ppt/charts/');
		const after = await partsOf(saved, 'ppt/charts/');
		expect(before.size).toBeGreaterThan(0);
		for (const [name, xml] of before) {
			// The part name rides in the compared value: oxlint's vitest rules
			// reject `expect(value, message)`, and a bare number tells you nothing
			// about WHICH part regressed.
			expect(`${name}:${countScheme(after.get(name) ?? '') >= countScheme(xml)}`).toBe(
				`${name}:true`,
			);
		}
	}, 60_000);

	it('keeps every a:schemeClr in the diagram colour parts of an unedited SmartArt', async () => {
		const source = readCorpusFixture(FIXTURE);
		const saved = await savedFixture();
		const before = await partsOf(source, 'ppt/diagrams/');
		const after = await partsOf(saved, 'ppt/diagrams/');
		expect(before.size).toBeGreaterThan(0);
		let checked = 0;
		for (const [name, xml] of before) {
			if (countScheme(xml) === 0) {
				continue;
			}
			checked += 1;
			// The part name rides in the compared value: oxlint's vitest rules
			// reject `expect(value, message)`, and a bare number tells you nothing
			// about WHICH part regressed.
			expect(`${name}:${countScheme(after.get(name) ?? '') >= countScheme(xml)}`).toBe(
				`${name}:true`,
			);
		}
		expect(checked).toBeGreaterThan(0);
	}, 60_000);

	it('still writes a series colour the user changed', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readCorpusFixture(FIXTURE));
		let edited = false;
		for (const slide of data.slides) {
			for (const element of slide.elements) {
				if (element.type !== 'chart' || !element.chartData?.series?.length) {
					continue;
				}
				element.chartData.series[0].color = '#123456';
				slide.isDirty = true;
				edited = true;
				break;
			}
			if (edited) {
				break;
			}
		}
		expect(edited).toBeTruthy();
		const after = await partsOf(await handler.save(data.slides), 'ppt/charts/');
		const joined = [...after.values()].join('');
		expect(joined).toContain('123456');
	}, 60_000);
});
