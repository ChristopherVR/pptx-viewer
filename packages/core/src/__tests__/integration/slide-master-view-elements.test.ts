import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxData, PptxElement } from '../../index';

/**
 * View > Slide Master renders `PptxSlideMaster.elements` /
 * `PptxSlideLayout.elements` in all five bindings. Both fields were declared
 * and consumed but never populated by the loader, so the Slides tab was a bare
 * background on every real deck, and any edit made there had nowhere to go on
 * save.
 *
 * The fixture is `e2e/fixtures/template-editing.pptx`: a one-slide deck with a
 * decorative shape injected into its layout and into its master.
 */
const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/template-editing.pptx', import.meta.url),
);
const MASTER_SHAPE_TEXT = 'TPL-MASTER-ORIG';
const LAYOUT_SHAPE_TEXT = 'TPL-LAYOUT-ORIG';
const MASTER_PART = 'ppt/slideMasters/slideMaster1.xml';

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function loadFixture(): Promise<{ handler: PptxHandler; data: PptxData }> {
	const handler = new PptxHandler();
	return { handler, data: await handler.load(fixtureBytes()) };
}

function textOf(element: PptxElement | undefined): string {
	return element && 'text' in element && typeof element.text === 'string' ? element.text : '';
}

/** The `<p:spTree>` fragment of one part, so formatting churn elsewhere is ignored. */
async function spTree(source: ArrayBuffer | Uint8Array, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(source);
	const xml = (await zip.file(part)?.async('string')) ?? '';
	const start = xml.indexOf('<p:spTree>');
	return start === -1
		? ''
		: xml.slice(start, xml.lastIndexOf('</p:spTree>') + '</p:spTree>'.length);
}

/** A slide-level "Hide background graphics" variant of the fixture. */
async function fixtureWithHiddenBackgroundGraphics(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p))!;
	const xml = await zip.file(slidePath)!.async('string');
	expect(xml).not.toContain('showMasterSp');
	zip.file(slidePath, xml.replace('<p:sld ', '<p:sld showMasterSp="0" '));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('layout p:clrMapOvr round-trip', () => {
	/**
	 * `parseSlideLayoutAttributes` hand-rolled its own `a:overrideClrMapping`
	 * parse and lower-cased every value. `ST_ColorSchemeIndex` has one
	 * camel-cased token, so a layout override came back as
	 * `folHlink="folhlink"` - not in the enumeration, which makes PowerPoint
	 * refuse the package (0x80070570). Latent while untouched layouts passed
	 * through verbatim; live as soon as a layout is edited and re-emitted.
	 */
	const LAYOUT_PART = 'ppt/slideLayouts/slideLayout1.xml';
	const OVERRIDE =
		'<p:clrMapOvr><a:overrideClrMapping bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" ' +
		'accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" ' +
		'accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink">' +
		'</a:overrideClrMapping></p:clrMapOvr>';

	async function fixtureWithLayoutOverride(): Promise<ArrayBuffer> {
		const zip = await JSZip.loadAsync(fixtureBytes());
		const xml = await zip.file(LAYOUT_PART)!.async('string');
		expect(xml).toContain('<p:clrMapOvr>');
		zip.file(LAYOUT_PART, xml.replace(/<p:clrMapOvr>.*?<\/p:clrMapOvr>/su, OVERRIDE));
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
	}

	it('keeps the spec casing of every ST_ColorSchemeIndex token', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithLayoutOverride());
		const layout = data.slideMasters?.[0]?.layouts?.find((entry) => entry.path === LAYOUT_PART);
		expect(layout?.clrMapOverride?.folHlink).toBe('folHlink');

		const saved = await handler.save(data.slides, { slideLayouts: [layout!] });
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file(LAYOUT_PART)!.async('string');
		expect(savedXml).toContain('folHlink="folHlink"');
		expect(savedXml).not.toContain('"folhlink"');
	});
});

describe('slide master / layout shape trees (F1)', () => {
	it("populates the master's own elements, placeholders included", async () => {
		const { data } = await loadFixture();
		const master = data.slideMasters?.[0];
		expect(master).toBeDefined();
		expect(master?.elements).toBeDefined();
		expect(master?.elements?.map(textOf)).toContain(MASTER_SHAPE_TEXT);
	});

	it("populates each layout's own elements", async () => {
		const { data } = await loadFixture();
		const layouts = data.slideMasters?.[0]?.layouts ?? [];
		expect(layouts.length).toBeGreaterThan(0);
		for (const layout of layouts) {
			expect(layout.elements).toBeDefined();
		}
		expect(layouts.flatMap((layout) => layout.elements ?? []).map(textOf)).toContain(
			LAYOUT_SHAPE_TEXT,
		);
	});

	it('keeps master-view ids out of the slide-facing template namespace', async () => {
		const { data } = await loadFixture();
		const masterElements = data.slideMasters?.[0]?.elements ?? [];
		const layoutElements = data.slideMasters?.[0]?.layouts?.[0]?.elements ?? [];
		expect(masterElements.length).toBeGreaterThan(0);
		expect(layoutElements.length).toBeGreaterThan(0);
		// `master-` / `layout-` ids mean "inherited onto a slide" and every
		// binding gates them behind editTemplateMode; a part's own tree must
		// not answer to them.
		for (const element of masterElements) {
			expect(element.id.startsWith('master-')).toBeFalsy();
			expect(element.id).toMatch(/^slide-master-slideMaster1-/u);
		}
		for (const element of layoutElements) {
			expect(element.id.startsWith('layout-')).toBeFalsy();
			expect(element.id).toMatch(/^slide-layout-slideLayout1-/u);
		}
	});
});

describe('slide master / layout element write-back (F2)', () => {
	it('persists a moved and retitled master shape', async () => {
		const { handler, data } = await loadFixture();
		const masters = structuredClone(data.slideMasters!);
		const target = masters[0].elements!.find((el) => textOf(el) === MASTER_SHAPE_TEXT)!;
		target.x = 321;
		target.y = 123;
		(target as { text?: string }).text = 'TPL-MASTER-EDITED';

		const saved = await handler.save(data.slides, { slideMasters: masters });
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const roundTripped = reloaded.slideMasters?.[0]?.elements?.find(
			(el) => textOf(el) === 'TPL-MASTER-EDITED',
		);
		expect(roundTripped).toBeDefined();
		expect(roundTripped?.x).toBe(321);
		expect(roundTripped?.y).toBe(123);
	});

	it('persists a moved layout shape reached through the master', async () => {
		const { handler, data } = await loadFixture();
		const masters = structuredClone(data.slideMasters!);
		const layout = masters[0].layouts!.find((entry) =>
			(entry.elements ?? []).some((el) => textOf(el) === LAYOUT_SHAPE_TEXT),
		)!;
		layout.elements!.find((el) => textOf(el) === LAYOUT_SHAPE_TEXT)!.x = 55;

		const saved = await handler.save(data.slides, { slideMasters: masters });
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const roundTripped = reloaded.slideMasters?.[0]?.layouts
			?.flatMap((entry) => entry.elements ?? [])
			.find((el) => textOf(el) === LAYOUT_SHAPE_TEXT);
		expect(roundTripped?.x).toBe(55);
	});

	it('adds nothing to the master when the caller passed it through unedited', async () => {
		// Every binding hands the whole `slideMasters` array to save() on every
		// save, so an unedited pass-through must be indistinguishable from not
		// supplying `slideMasters` at all: rebuilding an untouched shape tree
		// from the typed model would trade fidelity for nothing.
		const withMasters = await loadFixture();
		const savedWith = await withMasters.handler.save(withMasters.data.slides, {
			slideMasters: structuredClone(withMasters.data.slideMasters!),
		});
		const without = await loadFixture();
		const savedWithout = await without.handler.save(without.data.slides);
		await expect(spTree(savedWith, MASTER_PART)).resolves.toBe(
			await spTree(savedWithout, MASTER_PART),
		);
	});
});

describe('inherited layout artwork does not leak into slides on save', () => {
	/**
	 * `e2e/fixtures/absolute-path-rels.pptx` is the only deck in the corpus
	 * whose LAYOUTS carry a `p:grpSp`. The save writer's group branch returned
	 * before the template-element check ever ran, so each layout group was
	 * collected into every slide's own shape tree (PowerPoint reported the deck
	 * growing from 82 to 106 shapes) and its children were re-attached at the
	 * layout's top level with duplicate `p:cNvPr/@id`, which breaks animation
	 * `p:spTgt/@spid` targeting.
	 */
	const LEAK_FIXTURE = fileURLToPath(
		new URL('../../../../../e2e/fixtures/absolute-path-rels.pptx', import.meta.url),
	);

	interface PartShape {
		groups: number;
		shapes: number;
		duplicateIds: number;
	}

	async function shapeTreeStats(source: ArrayBuffer | Uint8Array): Promise<Map<string, PartShape>> {
		const zip = await JSZip.loadAsync(source);
		const stats = new Map<string, PartShape>();
		for (const path of Object.keys(zip.files)) {
			if (!/^ppt\/(slides|slideLayouts)\/[^/]+\.xml$/u.test(path)) {
				continue;
			}
			const xml = await zip.file(path)!.async('string');
			const start = xml.indexOf('<p:spTree>');
			const tree = start === -1 ? '' : xml.slice(start, xml.lastIndexOf('</p:spTree>'));
			const ids = [...tree.matchAll(/<p:cNvPr[^>]*\bid="(\d+)"/gu)].map((match) => match[1]);
			stats.set(path, {
				groups: (tree.match(/<p:grpSp>/gu) ?? []).length,
				shapes: (tree.match(/<p:sp>/gu) ?? []).length,
				duplicateIds: ids.length - new Set(ids).size,
			});
		}
		return stats;
	}

	it('keeps every slide and layout shape tree intact on a no-edit round trip', async () => {
		const buf = readFileSync(LEAK_FIXTURE);
		const source = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
		const handler = new PptxHandler();
		const data = await handler.load(source);
		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });

		const before = await shapeTreeStats(source);
		const after = await shapeTreeStats(saved);
		expect(before.size).toBeGreaterThan(0);
		for (const [path, expected] of before) {
			expect({ path, ...after.get(path) }).toStrictEqual({ path, ...expected });
		}
	}, 60_000);
});

describe('slide-level p:sld/@showMasterSp (F5)', () => {
	it('merges inherited layout and master artwork by default', async () => {
		const { data } = await loadFixture();
		const ids = data.slides[0]?.elements.map((el) => el.id) ?? [];
		expect(ids.some((id) => id.startsWith('master-'))).toBeTruthy();
		expect(ids.some((id) => id.startsWith('layout-'))).toBeTruthy();
	});

	it('hides inherited artwork when the slide says so', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithHiddenBackgroundGraphics());
		const slide = data.slides[0]!;
		expect(slide.showMasterShapes).toBeFalsy();
		expect(slide.elements.some((el) => el.id.startsWith('master-'))).toBeFalsy();
		expect(slide.elements.some((el) => el.id.startsWith('layout-'))).toBeFalsy();
		// The slide's own content is untouched.
		expect(slide.elements.length).toBeGreaterThan(0);
		// And there is nothing for template mode to offer either.
		await expect(handler.getTemplateElementsForSlide(slide.id)).resolves.toStrictEqual([]);
	});
});
