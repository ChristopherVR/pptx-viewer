import type { PptxData } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import { convertToMarkdown } from '../../tools/conversion-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(): PptxData {
	return {
		width: 960,
		height: 540,
		slides: [
			{
				id: 'slide-0',
				rId: 'rId2',
				slideNumber: 1,
				elements: [
					{
						id: 'el-0',
						type: 'text' as const,
						x: 100,
						y: 50,
						width: 600,
						height: 40,
						text: 'Presentation Title',
						textStyle: { fontSize: 28, bold: true },
					},
					{
						id: 'el-1',
						type: 'text' as const,
						x: 100,
						y: 120,
						width: 600,
						height: 200,
						text: 'Body content on the first slide.',
					},
				],
				notes: 'These are speaker notes for slide 1.',
				comments: [],
			},
			{
				id: 'slide-1',
				rId: 'rId3',
				slideNumber: 2,
				elements: [
					{
						id: 'el-10',
						type: 'text' as const,
						x: 100,
						y: 50,
						width: 600,
						height: 40,
						text: 'Second Slide',
					},
					{
						id: 'tbl-0',
						type: 'table' as const,
						x: 50,
						y: 100,
						width: 400,
						height: 120,
						tableData: {
							rows: [
								{ cells: [{ text: 'Col A' }, { text: 'Col B' }] },
								{ cells: [{ text: 'Data 1' }, { text: 'Data 2' }] },
							],
							columnWidths: [0.5, 0.5],
						},
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}

function ctx(): ToolContext {
	return { pptxData: makeTestPresentation() };
}

describe('convertToMarkdown', () => {
	it('converts presentation to markdown', async () => {
		const result = await convertToMarkdown(ctx(), {});
		expect(result.dirty).toBe(false);
		expect(result.result.markdown).toBe(true);
		expectTypeOf(result.result.markdown).toBeString();
		expect(result.result.totalSlides).toBe(2);
		expect(result.result.slidesConverted).toBe(2);
	});

	it('includes slide text in output', async () => {
		const result = await convertToMarkdown(ctx(), {});
		expect(result.result.markdown).toContain('Presentation Title');
		expect(result.result.markdown).toContain('Body content');
	});

	it('includes speaker notes by default', async () => {
		const result = await convertToMarkdown(ctx(), {});
		expect(result.result.markdown).toContain('speaker notes');
	});

	it('excludes speaker notes when includeSpeakerNotes=false', async () => {
		const result = await convertToMarkdown(ctx(), { includeSpeakerNotes: false });
		expect(result.result.markdown).not.toContain('speaker notes for slide 1');
	});

	it('respects slideRange option', async () => {
		const result = await convertToMarkdown(ctx(), { slideRange: { start: 0, end: 0 } });
		expect(result.result.slidesConverted).toBe(1);
		expect(result.result.totalSlides).toBe(2);
		expect(result.result.markdown).toContain('Presentation Title');
		expect(result.result.markdown).not.toContain('Second Slide');
	});

	it('passes through sourceName option', async () => {
		const result = await convertToMarkdown(ctx(), { sourceName: 'my-deck.pptx' });
		expect(result.result.markdown).toBe(true);
	});

	it('does not mutate pptxData', async () => {
		const c = ctx();
		const slideCountBefore = c.pptxData.slides.length;
		await convertToMarkdown(c, {});
		expect(c.pptxData.slides).toHaveLength(slideCountBefore);
	});
});
