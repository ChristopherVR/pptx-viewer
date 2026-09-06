/**
 * Round-trip tests for the legacy binary `.ppt` writer: build a deck with
 * the SDK builders, save as `.ppt`, and reload the bytes through our own
 * importer (`PptxHandler.load` auto-detects the CFB signature).
 *
 * @module ppt/writer/ppt-writer-roundtrip.test
 */
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement, PptxSlide } from '../../types';
import { IncorrectPasswordError } from '../../utils';

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
	});

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
