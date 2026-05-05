import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { TablePptxElement } from '../../core/types/elements';

/**
 * Regression test for SDK-created tables being silently dropped on save.
 *
 * Before the fix, `SlideBuilder.addTable(...)` produced a `TablePptxElement`
 * with no `rawXml`. The save pipeline's `processSlideElement` only had
 * fallback XML creators for `text`/`shape`/`connector`/`ink` — tables hit
 * the "can't serialize" branch and were skipped entirely with a
 * `SAVE_ELEMENT_SKIPPED` warning. The saved slide had an empty `p:spTree`.
 */
describe('sDK-created table survives save round-trip', () => {
	it('addTable then save → reload preserves rows, columns, and cell text', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{
						rows: [
							{ cells: [{ text: 'Header A' }, { text: 'Header B' }] },
							{ cells: [{ text: 'a1' }, { text: 'b1' }] },
							{ cells: [{ text: 'a2' }, { text: 'b2' }] },
						],
						firstRow: true,
					},
					{ x: 50, y: 80, width: 500, height: 180 },
				)
				.build(),
		);

		const savedBytes = await handler.save(data.slides);

		// 1. The saved slide XML must contain the table graphic frame.
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:graphicFrame');
		expect(slideXml).toContain('<a:tbl');
		expect(slideXml).toContain('Header A');
		expect(slideXml).toContain('b2');

		// 2. Reloading the saved bytes must yield a 3×2 table element with
		//    cell text preserved.
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(savedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);

		const tableEl = reloaded.slides[0].elements.find((e) => e.type === 'table') as
			| TablePptxElement
			| undefined;
		expect(tableEl, 'reloaded slide is missing the table element').toBeDefined();
		expect(tableEl!.tableData?.rows).toHaveLength(3);
		expect(tableEl!.tableData?.rows[0].cells).toHaveLength(2);

		const allText = tableEl!
			.tableData!.rows.flatMap((r) => r.cells.map((c) => c.text ?? ''))
			.join('|');
		expect(allText).toContain('Header A');
		expect(allText).toContain('Header B');
		expect(allText).toContain('a1');
		expect(allText).toContain('b2');
	});

	it('styled cell runs emit <a:rPr> before <a:t> (CT_RegularTextRun schema order)', async () => {
		// OOXML requires `a:rPr?, a:t` sequence. Before the fix,
		// writeCellTextFormatting assigned `a:rPr` onto a run that already
		// had `a:t`, producing `<a:r><a:t>…</a:t><a:rPr…/></a:r>` —
		// schema-invalid.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{
						rows: [
							{
								cells: [
									{ text: 'Bold', style: { bold: true } },
									{ text: 'Red', style: { color: '#FF0000' } },
								],
							},
						],
					},
					{ x: 10, y: 10, width: 400, height: 80 },
				)
				.build(),
		);
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// For every run in the saved slide, if it has both <a:rPr> and <a:t>,
		// <a:rPr> must appear first.
		const runRegex = /<a:r>[\s\S]*?<\/a:r>/g;
		let match: RegExpExecArray | null;
		let runsInspected = 0;
		while ((match = runRegex.exec(slideXml)) !== null) {
			const runContent = match[0];
			const rPrIdx = runContent.indexOf('<a:rPr');
			const tIdx = runContent.indexOf('<a:t');
			if (rPrIdx >= 0 && tIdx >= 0) {
				expect(rPrIdx, `run with <a:t> before <a:rPr>: ${runContent}`).toBeLessThan(tIdx);
				runsInspected++;
			}
		}
		expect(runsInspected).toBeGreaterThan(0);
	});

	it('replicates PowerPoint "Insert Table" defaults on SDK-created tables', async () => {
		// Matches what PowerPoint's UI produces when you click Insert > Table
		// without picking a style:
		//  - <a:tblPr> with only the true flags as attributes (no `="0"` noise)
		//  - <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
		//    (Medium Style 2 - Accent 1) when the caller didn't pick one
		//  - <a:r> with <a:rPr lang="en-US" dirty="0"/> before <a:t>
		//  - <a:endParaRPr lang="en-US" .../> after runs in each paragraph
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{ rows: [{ cells: [{ text: 'hello' }] }] },
					{ x: 10, y: 10, width: 200, height: 60 },
				)
				.build(),
		);
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// Default table style must be applied — otherwise the table renders
		// with no borders or fill in PowerPoint (unstyled-looking).
		expect(slideXml).toContain(
			'<a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>',
		);

		// `<a:tblPr>` shouldn't carry noisy `="0"` defaults — PowerPoint only
		// emits the attribute when the flag is true.
		const tblPrMatch = slideXml.match(/<a:tblPr\b([^>]*)>/);
		expect(tblPrMatch).not.toBeNull();
		expect(tblPrMatch![1]).not.toMatch(/\blastRow="0"/);
		expect(tblPrMatch![1]).not.toMatch(/\bbandCol="0"/);
		expect(tblPrMatch![1]).not.toMatch(/\bfirstCol="0"/);

		// Every run must declare lang + dirty like PowerPoint does.
		expect(slideXml).toContain('<a:rPr lang="en-US" dirty="0">');

		// Each paragraph in a cell must close with <a:endParaRPr> to match
		// PowerPoint's output, including the `dirty="0"` spell-check marker.
		expect(slideXml).toMatch(/<a:endParaRPr\s[^>]*\bdirty="0"/);

		// <a:gridCol> must include an <a:extLst> with the a16:colId
		// tracking extension — PowerPoint emits this on every
		// "Insert Table" column so future edits can identify columns
		// across saves.
		expect(slideXml).toContain('<a:ext uri="{9D8B030D-6E8A-4147-A177-3AD203B41FA5}">');
		// PK-H2: `xmlns:a16` is declared on the slide root, not the leaf
		// `<a16:colId>` element. The leaf carries only the `@val` attribute
		// and the slide root carries `xmlns:a16` plus `mc:Ignorable="…a16…"`.
		expect(slideXml).toMatch(/<a16:colId\s+val="\d+"/);
		expect(slideXml).toContain('xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main"');
		expect(slideXml).toMatch(/mc:Ignorable="[^"]*\ba16\b[^"]*"/);
	});
});
