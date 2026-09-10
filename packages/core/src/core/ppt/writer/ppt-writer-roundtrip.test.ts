/**
 * Round-trip tests for the legacy binary `.ppt` writer: build a deck with
 * the SDK builders, save as `.ppt`, and reload the bytes through our own
 * importer (`PptxHandler.load` auto-detects the CFB signature).
 *
 * @module ppt/writer/ppt-writer-roundtrip.test
 */
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { OlePptxElement, PptxElement, PptxSlide } from '../../types';
import { IncorrectPasswordError } from '../../utils';
import { parseDataUrlToBytes } from '../../utils/data-url-utils';

const PNG_1X1 =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** Collect every rendered text string in a slide's shape tree, sorted. */
function collectTexts(elements: PptxElement[]): string[] {
	const out: string[] = [];
	for (const el of elements) {
		if ('text' in el && typeof el.text === 'string' && el.text.trim()) {
			out.push(el.text.trim());
		}
		if (el.type === 'group') {
			out.push(...collectTexts(el.children));
		}
	}
	return out.sort();
}

async function buildTestDeck(): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'PPT Writer Test',
	});
	const slide = createSlide('Blank')
		.addText('Title Text', { fontSize: 32, bold: true, x: 50, y: 30, width: 800, height: 60 })
		.addShape('roundRect', {
			x: 50,
			y: 120,
			width: 300,
			height: 150,
			fill: { type: 'solid', color: '#4472C4' },
			stroke: { color: '#203864', width: 2 },
			text: 'Rounded Shape',
		})
		.addImage(PNG_1X1, { x: 400, y: 120, width: 100, height: 100 })
		.addTable(
			{
				rows: [
					{ cells: [{ text: 'Name' }, { text: 'Score' }] },
					{ cells: [{ text: 'Alice' }, { text: '95' }] },
				],
			},
			{ x: 50, y: 320, width: 400, height: 120 },
		)
		.addGroup(
			[
				{
					type: 'shape',
					id: 'g1',
					x: 500,
					y: 320,
					width: 100,
					height: 60,
					shapeType: 'ellipse',
					shapeStyle: { fillColor: '#FF0000' },
					text: 'Grouped',
				} as PptxElement,
			],
			{ x: 500, y: 320, width: 100, height: 60 },
		)
		.build();
	data.slides = [slide];
	return { handler, slides: data.slides };
}

describe('legacy .ppt writer round-trip', () => {
	it('produces an OLE2 (CFB) file signature', async () => {
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });
		expect(Array.from(bytes.subarray(0, 8))).toStrictEqual([
			0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
		]);
	});

	it('reloads through our own importer with slide/shape/text fidelity', async () => {
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);

		expect(reloaded.slides).toHaveLength(1);
		const texts = collectTexts(reloaded.slides[0]!.elements);
		expect(texts).toContain('Title Text');
		expect(texts).toContain('Rounded Shape');
		expect(texts).toContain('Grouped');
		// The table degrades to a group of bordered rectangles (PowerPoint
		// 2003's own table model); its cell text must still round-trip.
		expect(texts).toContain('Name');
		expect(texts).toContain('Alice');

		// At least one picture element made it through the Pictures stream / BStore.
		const hasPicture = reloaded.slides[0]!.elements.some((el) => el.type === 'picture');
		expect(hasPicture).toBeTruthy();
	});

	it('round-trips an RC4 CryptoAPI encrypted .ppt with the correct password', async () => {
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt', pptPassword: 'secret123' });
		expect(Array.from(bytes.subarray(0, 8))).toStrictEqual([
			0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
		]);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer, {
			password: 'secret123',
		});
		expect(reloaded.slides).toHaveLength(1);
		expect(collectTexts(reloaded.slides[0]!.elements)).toContain('Title Text');
	});

	it('rejects an encrypted .ppt with the wrong password', async () => {
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt', pptPassword: 'secret123' });

		const reloadHandler = new PptxHandler();
		await expect(
			reloadHandler.load(bytes.buffer as ArrayBuffer, { password: 'wrong-password' }),
		).rejects.toThrow(IncorrectPasswordError);
	}, 120_000); // PBKDF2 verifier: load-sensitive, see modify-password-check.test.ts

	it('writes an unencrypted .ppt when no password is given, even if requested', async () => {
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });
		const reloadHandler = new PptxHandler();
		// Loads without a password: proves the CurrentUserAtom's headerToken
		// was written as HEADER_TOKEN_PLAIN, matching PowerPoint's own
		// behaviour when Encrypt with Password is cleared.
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
	});

	it('degrades an element with no binary equivalent to a placeholder and reports a compatibility warning', async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Degrade Test' });
		const slide = createSlide('Blank').build();
		const chartElement: PptxElement = {
			type: 'chart',
			id: 'chart1',
			x: 50,
			y: 50,
			width: 400,
			height: 300,
		};
		slide.elements = [chartElement];
		data.slides = [slide];

		const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
		const warnings = handler.getCompatibilityWarnings();
		expect(
			warnings.some((w) => w.scope === 'element' && w.code === 'ppt-unsupported-chart'),
		).toBeTruthy();

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		// Degraded to a placeholder shape (no rasterised preview was available).
		expect(reloaded.slides[0]!.elements.length).toBeGreaterThan(0);
	});

	it("null-terminates a named shape's wzName complex property", async () => {
		// Regression test for a bug that made real PowerPoint reject any
		// `.ppt` this writer produced for a shape with a `name` set (see
		// `fopt-writer.test.ts`'s `encodeComplexString` unit test for the
		// COM-verified root cause): assert at the BYTE level, not just via
		// this project's own (already terminator-tolerant) reader, since the
		// reader alone cannot catch a missing terminator.
		const { handler, data, createSlide } = await PptxHandler.createBlank({
			title: 'Named Shape Test',
		});
		const slide = createSlide('Blank').build();
		const named: PptxElement = {
			type: 'shape',
			id: 'nt1',
			name: 'MyNamedRect',
			x: 100,
			y: 150,
			width: 300,
			height: 120,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#4472C4' },
		} as PptxElement;
		slide.elements = [named];
		data.slides = [slide];

		const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
		// "M" (0x4D, 0x00) ... "t" (0x74, 0x00) then a null terminator: search
		// for the UTF-16LE encoding of the name immediately followed by 00 00.
		const nameUtf16 = Buffer.from('MyNamedRect', 'utf16le');
		const needle = Buffer.concat([nameUtf16, Buffer.from([0, 0])]);
		const haystack = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		// Not `toContain`: that checks array MEMBERSHIP (a single element),
		// not the byte-subsequence search `Buffer#includes` performs, which is
		// what this assertion actually needs.
		// oxlint-disable-next-line vitest/prefer-to-contain
		expect(haystack.includes(needle)).toBeTruthy();
	});

	it('writes the PowerPoint 97-2003 storage CLSID on the OLE2 root entry', async () => {
		// A zero CLSID (buildOle2's previous default) made real PowerPoint
		// refuse to open the file outright ("This version of PowerPoint can't
		// open ..."), before any record content was even inspected. Verified
		// against sample-deck.ppt (a COM-generated fixture), whose root entry
		// carries this exact CLSID.
		const { handler, slides } = await buildTestDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });
		const sectorSize = 1 << new DataView(bytes.buffer).getUint16(30, true);
		const firstDirSector = new DataView(bytes.buffer).getUint32(48, true);
		const dirOffset = (firstDirSector + 1) * sectorSize;
		const clsid = bytes.subarray(dirOffset + 80, dirOffset + 96);
		expect(Buffer.from(clsid).toString('hex')).toBe('108d81649b4fcf1186ea00aa00b929e8');
	});
});

describe('legacy .ppt writer: hyperlinks and click actions', () => {
	/**
	 * Every shape/run action kind tested here was independently verified
	 * against real PowerPoint over COM (`ActionSettings(ppMouseClick)`):
	 * `Action`/`Hyperlink.Address`/`Hyperlink.SubAddress` all matched, see
	 * `scripts/com-acceptance-ppt.mjs`'s `hyperlinks-and-actions` case. This
	 * suite instead proves the OTHER direction: round-tripping the written
	 * bytes back through this project's OWN importer reconstructs the same
	 * `actionClick` / run-level hyperlink the SDK was given.
	 */
	async function buildActionDeck(): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
		const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
		const slideBuilder = createSlide('Blank');
		const addRect = (y: number, text: string): void => {
			slideBuilder.addShape('rect', {
				x: 20,
				y,
				width: 200,
				height: 40,
				fill: { type: 'solid', color: '#4472C4' },
				text,
			});
		};
		addRect(10, 'url-link');
		addRect(60, 'slide-link');
		addRect(110, 'next-link');
		addRect(160, 'prev-link');
		addRect(210, 'first-link');
		addRect(260, 'last-link');
		addRect(310, 'end-link');
		addRect(360, 'mailto-link');
		addRect(410, 'customshow-link');
		addRect(460, 'this has a linked word inside');

		const slide1 = slideBuilder.build();
		data.slides.push(slide1);
		data.slides.push(createSlide('Blank').build());
		data.slides.push(createSlide('Blank').build());

		const [urlSh, slideSh, nextSh, prevSh, firstSh, lastSh, endSh, mailtoSh, showSh, runSh] =
			slide1.elements as PptxElement[];
		(urlSh as { actionClick?: unknown }).actionClick = { url: 'https://example.com/path?q=1' };
		(slideSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 2,
		};
		(nextSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinkshowjump?jump=nextslide',
		};
		(prevSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinkshowjump?jump=previousslide',
		};
		(firstSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinkshowjump?jump=firstslide',
		};
		(lastSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinkshowjump?jump=lastslide',
		};
		(endSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://hlinkshowjump?jump=endshow',
		};
		(mailtoSh as { actionClick?: unknown }).actionClick = { url: 'mailto:test@example.com' };
		(showSh as { actionClick?: unknown }).actionClick = {
			action: 'ppaction://customshow?id=0&return=true',
		};
		const runShapeWithText = runSh as PptxElement & {
			textSegments?: Array<{ text: string; style?: { hyperlink?: string } }>;
		};
		for (const seg of runShapeWithText.textSegments ?? []) {
			if (seg.text.includes('linked')) {
				seg.style = { ...seg.style, hyperlink: 'https://run-level.example.com/' };
			}
		}

		return { handler, slides: data.slides };
	}

	it('round-trips every shape-level action kind through our own importer', async () => {
		const { handler, slides } = await buildActionDeck();
		const bytes = await handler.save(slides, {
			outputFormat: 'ppt',
			customShows: [{ name: 'MyShow', id: '0', slideRIds: [slides[0]!.rId] }],
		});

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		const elements = reloaded.slides[0]!.elements as Array<
			PptxElement & { actionClick?: { url?: string; action?: string; targetSlideIndex?: number } }
		>;
		const byText = (text: string): (typeof elements)[number] | undefined =>
			elements.find((el) => 'textSegments' in el && el.textSegments?.some((s) => s.text === text));

		expect(byText('url-link')?.actionClick?.url).toBe('https://example.com/path?q=1');

		const slideLink = byText('slide-link')?.actionClick;
		expect(slideLink?.action).toContain('hlinksldjump');
		expect(slideLink?.targetSlideIndex).toBe(2);

		expect(byText('next-link')?.actionClick?.action).toContain('jump=nextslide');
		expect(byText('prev-link')?.actionClick?.action).toContain('jump=previousslide');
		expect(byText('first-link')?.actionClick?.action).toContain('jump=firstslide');
		expect(byText('last-link')?.actionClick?.action).toContain('jump=lastslide');
		expect(byText('end-link')?.actionClick?.action).toContain('jump=endshow');
		expect(byText('mailto-link')?.actionClick?.url).toBe('mailto:test@example.com');
		expect(byText('customshow-link')?.actionClick?.action).toContain('customshow');
	});

	it('round-trips a run-level (text-selection) hyperlink through our own importer', async () => {
		const { handler, slides } = await buildActionDeck();
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		const runShape = reloaded.slides[0]!.elements.find(
			(el) => 'textSegments' in el && el.textSegments?.some((s) => s.text.includes('linked')),
		) as
			| (PptxElement & { textSegments?: Array<{ text: string; style?: { hyperlink?: string } }> })
			| undefined;

		expect(runShape).toBeDefined();
		const linkedSegment = runShape?.textSegments?.find((s) => s.text.includes('linked'));
		expect(linkedSegment?.style?.hyperlink).toBe('https://run-level.example.com/');
	});
});

describe('legacy .ppt writer: OLE embeds', () => {
	/**
	 * Verified against real PowerPoint over COM (`scripts/com-acceptance-ppt.mjs`'s
	 * `runOleCase`): the saved shape is `msoEmbeddedOLEObject` with
	 * `OLEFormat.ProgID === "Package"`. This project's own `.ppt` IMPORTER does
	 * not parse `ExOleEmbedContainer`/`ExOleObjStg` back into an `OlePptxElement`
	 * yet (`document-parser.ts` never looks for `RT.ExternalOleEmbed`), matching
	 * `notes-writer.ts`'s own documented gap for `RT.Notes`: this suite instead
	 * proves the WRITE side embeds real payload bytes with no compatibility
	 * warning, and that round-tripping through our own reader still produces a
	 * renderable picture shape (the read side degrades an OLE embed to its
	 * plain picture-frame preview, never to a placeholder or a crash).
	 */
	it('embeds a real OLE payload with no compatibility warning', async () => {
		const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
		const slide = createSlide('Blank').build();
		const textBytes = new TextEncoder().encode('Hello embedded object');
		const oleDataUrl = `data:text/plain;base64,${Buffer.from(textBytes).toString('base64')}`;
		const oleElement: PptxElement = {
			type: 'ole',
			id: 'ole1',
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			fileName: 'notes.txt',
			oleEmbeddedFileName: 'notes.txt',
			oleEmbeddedData: oleDataUrl,
			previewImageData: PNG_1X1,
		} as PptxElement;
		slide.elements = [oleElement];
		data.slides = [slide];

		const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
		expect(handler.getCompatibilityWarnings()).toHaveLength(0);

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);
		expect(reloaded.slides[0]!.elements.length).toBeGreaterThan(0);

		// The .ppt reader now parses ExOleEmbedContainer/ExOleObjStg back into
		// an editable 'ole' element (not just its picture-frame preview): the
		// recovered embedded payload round-trips byte-identical to the
		// original text.
		const reloadedOle = reloaded.slides[0]!.elements.find(
			(el): el is OlePptxElement => el.type === 'ole',
		);
		expect(reloadedOle).toBeDefined();
		expect(reloadedOle?.oleEmbeddedData).toBeTruthy();
		const recovered = parseDataUrlToBytes(reloadedOle!.oleEmbeddedData!);
		expect(new TextDecoder().decode(recovered.bytes)).toBe('Hello embedded object');
	});

	it('degrades to a placeholder with a warning when no embedded payload is available', async () => {
		const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
		const slide = createSlide('Blank').build();
		const oleElement: PptxElement = {
			type: 'ole',
			id: 'ole1',
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			fileName: 'notes.txt',
		} as PptxElement;
		slide.elements = [oleElement];
		data.slides = [slide];

		await handler.save(data.slides, { outputFormat: 'ppt' });
		const warnings = handler.getCompatibilityWarnings();
		expect(
			warnings.some((w) => w.scope === 'element' && w.code === 'ppt-unsupported-ole'),
		).toBeTruthy();
	});
});
