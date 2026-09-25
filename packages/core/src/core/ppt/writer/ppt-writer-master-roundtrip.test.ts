/**
 * `.ppt` export of the deck's own slide master: its placeholder shapes, its
 * theme (colour scheme, fonts) and PowerPoint 2007+'s round-trip atoms.
 *
 * COM-measured (PowerPoint 16.0): a `.ppt` whose main master carries no
 * placeholder shapes reopens reporting PowerPoint's default theme styles for
 * `SlideMaster.TextStyles`, and without the RoundTripTheme12Atom it
 * synthesises a theme from the binary records. With both written, the
 * exported `header-footer-shows.pptx` reopens with the same five master
 * placeholders, Aptos Display 44 / Aptos 28 styles and theme colours as the
 * source deck.
 *
 * @module ppt/writer/ppt-writer-master-roundtrip.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import { parseOle2 } from '../../utils/ole2-parser';
import { findChild, findChildren, findDescendant, iterateChildren } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { OA, RT } from '../record-types';
import { buildFopt } from './fopt-writer';
import { readMasterRoundTripSource } from './master-roundtrip-source';

const FIXTURE = path.resolve(__dirname, '../../../../../../e2e/fixtures/header-footer-shows.pptx');

async function exportMaster(): Promise<{ view: DataView; doc: Uint8Array; master: PptRecord }> {
	const handler = new PptxHandler();
	const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
	const ppt = await handler.save(data.slides, { outputFormat: 'ppt' });
	const doc = parseOle2(ppt.slice().buffer).getStream('PowerPoint Document')!;
	const view = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);
	let offset = 0;
	while (offset + 8 <= doc.byteLength) {
		const recType = view.getUint16(offset + 2, true);
		const recLen = view.getUint32(offset + 4, true);
		if (recType === RT.MainMaster) {
			const master: PptRecord = {
				recVer: view.getUint16(offset, true) & 0xf,
				recInstance: view.getUint16(offset, true) >> 4,
				recType,
				recLen,
				headerOffset: offset,
				dataOffset: offset + 8,
			};
			return { view, doc, master };
		}
		offset += 8 + recLen;
	}
	throw new Error('no MainMaster in the exported document stream');
}

describe('.ppt export of the slide master', () => {
	it('reads the source master placeholders, theme colours and fonts', async () => {
		const zip = await JSZip.loadAsync(readFileSync(FIXTURE));
		const source = await readMasterRoundTripSource(zip);
		expect(source.placeholders.map((p) => p.kind)).toStrictEqual([
			'title',
			'body',
			'date',
			'footer',
			'slideNumber',
		]);
		expect(source.themeFonts).toStrictEqual({ major: 'Aptos Display', minor: 'Aptos' });
		expect(source.schemeColors).toHaveLength(8);
		expect(source.themeXml).toContain('<a:theme');
		expect(source.txStylesXml).toMatch(/^<p:txStyles xmlns:/);
	});

	it('writes the five master placeholders in PowerPoint position order', async () => {
		const { view, master } = await exportMaster();
		const drawing = findChild(view, master, RT.Drawing)!;
		const spgr = findDescendant(view, drawing, OA.SpgrContainer)!;
		const positions: number[] = [];
		for (const child of iterateChildren(view, spgr)) {
			const clientData = child.recType === OA.SpContainer && findChild(view, child, OA.ClientData);
			const atom = clientData ? findChild(view, clientData, RT.OEPlaceholderAtom) : undefined;
			if (atom) {
				positions.push(view.getInt32(atom.dataOffset, true));
			}
		}
		expect(positions).toStrictEqual([0, 1, 2, 3, 4]);
	});

	it('carries the theme, colour mapping and text-style round-trip atoms', async () => {
		const { view, doc, master } = await exportMaster();
		for (const recType of [
			RT.RoundTripTheme12Atom,
			RT.RoundTripColorMapping12Atom,
			RT.RoundTripOArtTextStyles12Atom,
		]) {
			expect(findChild(view, master, recType)).toBeDefined();
		}
		const theme = findChild(view, master, RT.RoundTripTheme12Atom)!;
		const pkg = await JSZip.loadAsync(doc.slice(theme.dataOffset, theme.dataOffset + theme.recLen));
		await expect(pkg.file('theme/theme/theme1.xml')!.async('string')).resolves.toContain(
			'Aptos Display',
		);
		// Both ColorSchemeAtoms carry the theme's scheme, not PowerPoint's default.
		const schemes = findChildren(view, master, RT.ColorSchemeAtom);
		expect(schemes).toHaveLength(2);
		const accent1 = view.getUint32(schemes[0]!.dataOffset + 16, true);
		expect(accent1.toString(16).padStart(6, '0')).toBe('826015');
	});

	it('reopens without leaking master placeholders onto the slide', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
		const ppt = await handler.save(data.slides, { outputFormat: 'ppt' });
		const back = await new PptxHandler().load(ppt.slice().buffer as ArrayBuffer);
		// The reopened deck's master placeholders are master content only:
		// none of them leaks onto the slide as a stray shape.
		expect(back.slides[0]!.elements.map((e) => e.type)).toStrictEqual(
			data.slides[0]!.elements.map((e) => e.type),
		);
	});
});

describe('buildFopt', () => {
	it('orders complex entries by PID among the simple ones, as PowerPoint writes', () => {
		const fopt = buildFopt(
			[
				{ id: 0x3bf, value: 0x00020000 },
				{ id: 0x04, value: 0 },
			],
			[{ id: 0x380, bytes: new Uint8Array([0x41, 0x00, 0x00, 0x00]) }],
		);
		const view = new DataView(fopt.buffer, fopt.byteOffset, fopt.byteLength);
		const ids = [0, 1, 2].map((i) => view.getUint16(8 + i * 6, true));
		expect(ids).toStrictEqual([0x0004, 0x8380, 0x03bf]);
	});
});
