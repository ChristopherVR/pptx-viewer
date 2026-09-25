/**
 * `.ppt` export of placeholder text and the deck's own master text styles,
 * from a PowerPoint-authored deck (`__tests__/fixtures/master-text-styles.pptx`:
 * master title 54pt bold Georgia red, centred; body level 1 26pt italic
 * Verdana blue, level 2 21pt Verdana; one Title and Content slide).
 *
 * COM ground truth for the same deck through PowerPoint's own 97-2003 SaveAs,
 * matched by this writer's output reopened in PowerPoint 16.0: title run 54pt
 * Georgia bold, body runs 26pt italic / 21pt at indent level 2, and a new
 * slide added in PowerPoint inherits the same master styles.
 *
 * @module ppt/writer/ppt-writer-master-text.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types';
import { convertDeckToWriteModel } from './element-to-write-model';

const FIXTURE = path.resolve(__dirname, '../../../__tests__/fixtures/master-text-styles.pptx');

async function loadFixture(): Promise<{
	handler: PptxHandler;
	slides: Awaited<ReturnType<PptxHandler['load']>>['slides'];
}> {
	const handler = new PptxHandler();
	const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
	return { handler, slides: data.slides };
}

describe('.ppt export of placeholder text', () => {
	it('writes parsed bullets as paragraph metadata, splits paragraphs, and sizes in points', async () => {
		const { slides } = await loadFixture();
		const deck = convertDeckToWriteModel(slides, 12192000, 6858000, () => {});
		const [title, body] = deck.slides[0]!.shapes as Array<{
			text?: {
				textType: number;
				paragraphs: Array<{ indentLevel: number; runs: Array<{ text: string; sizePt?: number }> }>;
			};
		}>;
		expect(title!.text!.textType).toBe(0);
		expect(title!.text!.paragraphs[0]!.runs[0]!.sizePt).toBe(54);
		expect(body!.text!.textType).toBe(1);
		const paras = body!.text!.paragraphs;
		expect(paras.map((p) => p.indentLevel)).toStrictEqual([0, 1]);
		expect(paras.map((p) => p.runs.map((r) => r.text).join(''))).toStrictEqual([
			'Body one',
			'Body two',
		]);
		expect(paras.map((p) => Math.round(p.runs[0]!.sizePt!))).toStrictEqual([26, 21]);
	});

	it('reopens with the placeholders, text and master text styles intact', async () => {
		const { handler, slides } = await loadFixture();
		const ppt = await handler.save(slides, { outputFormat: 'ppt' });
		const back = await new PptxHandler().load(ppt.slice().buffer as ArrayBuffer);
		const elements = back.slides[0]!.elements as PptxElement[];
		expect(elements.map((e) => e.placeholderType)).toStrictEqual(['title', 'body']);
		const texts = elements.map((e) => (e as { text?: string }).text);
		expect(texts[0]).toBe('Master title');
		// One rendered bullet per paragraph (the parser's own marker), not a doubled one.
		expect(texts[1]).toBe('• Body one\n• Body two');

		const styles = back.slideMasters?.[0]?.txStyles;
		const title = styles?.titleStyle?.[0];
		expect(title?.fontSize).toBeCloseTo((54 * 96) / 72);
		expect(title?.bold).toBeTruthy();
		expect(title?.fontFamily).toBe('Georgia');
		const body = styles?.bodyStyle?.[0];
		expect(body?.fontSize).toBeCloseTo((26 * 96) / 72);
		expect(body?.fontFamily).toBe('Verdana');
		expect(styles?.bodyStyle?.[1]?.fontSize).toBeCloseTo((21 * 96) / 72);
	});
});
