import type { PptxData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { exportToJson, importFromJson } from '../../tools/json-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(): PptxData {
	return {
		slides: [
			{
				id: 'ppt/slides/slide1.xml',
				slideNumber: 1,
				elements: [
					{
						type: 'text',
						id: 'el-1',
						x: 10,
						y: 10,
						width: 400,
						height: 60,
						text: 'JSON tools test',
					},
				],
			},
			{ id: 'ppt/slides/slide2.xml', slideNumber: 2, elements: [] },
		],
		width: 960,
		height: 540,
		coreProperties: { title: 'JSON deck' },
	} as unknown as PptxData;
}

function ctx(): ToolContext {
	return { pptxData: makeTestPresentation() };
}

describe('exportToJson', () => {
	it('exports a valid pptx-viewer-json document without mutating the deck', () => {
		const c = ctx();
		const result = exportToJson(c, {});
		expect(result.dirty).toBeFalsy();
		expect(result.result.slideCount).toBe(2);
		expect(result.result.byteSize).toBeGreaterThan(0);

		const parsed = JSON.parse(result.result.json) as Record<string, unknown>;
		expect(parsed.format).toBe('pptx-viewer-json');
		expect(parsed.version).toBe(1);
		expect(parsed.slideCount).toBe(2);
		expect(c.pptxData.slides).toHaveLength(2);
	});

	it('honors pretty: false', () => {
		const compact = exportToJson(ctx(), { pretty: false }).result.json;
		expect(compact).not.toContain('\n');
	});
});

describe('importFromJson', () => {
	it('replaces the deck content in place and flags dirty', () => {
		const source = exportToJson(ctx(), {}).result.json;

		const target: ToolContext = {
			pptxData: {
				slides: [{ id: 'other', elements: [] }],
				width: 800,
				height: 600,
			} as unknown as PptxData,
		};
		const before = target.pptxData;
		const result = importFromJson(target, { json: source });

		expect(result.dirty).toBeTruthy();
		expect(result.pptxData).toBe(before);
		expect(result.result.slideCount).toBe(2);
		expect(result.result.width).toBe(960);
		expect(target.pptxData.slides[0].elements[0]).toMatchObject({ text: 'JSON tools test' });
	});

	it('rejects invalid documents', () => {
		expect(() => importFromJson(ctx(), { json: '{"format":"other"}' })).toThrow(/format marker/);
		expect(() => importFromJson(ctx(), { json: 'not json' })).toThrow();
	});
});
