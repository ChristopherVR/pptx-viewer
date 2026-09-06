import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveOleVerbTarget } from './presentation-ole-verb';

function ole(id: string, extra: Partial<PptxElement> = {}): PptxElement {
	return { id, type: 'ole', x: 0, y: 0, width: 10, height: 10, ...extra } as PptxElement;
}

function slideOf(elements: PptxElement[]): PptxSlide {
	return { id: 'slide-1', elements } as PptxSlide;
}

describe('resolveOleVerbTarget', () => {
	it("opens the clicked OLE element's recovered embedding and classifies the primary verb as 'edit'", () => {
		const slide = slideOf([
			ole('ole1', {
				oleEmbeddedData: 'data:application/octet-stream;base64,AAAA',
				oleEmbeddedFileName: 'budget.xlsx',
			} as Partial<PptxElement>),
		]);
		expect(resolveOleVerbTarget(slide, 'ole1', -1)).toStrictEqual({
			elementId: 'ole1',
			url: 'data:application/octet-stream;base64,AAAA',
			fileName: 'budget.xlsx',
			action: 'edit',
		});
		expect(resolveOleVerbTarget(slide, 'ole1', 0)?.action).toBe('edit');
		expect(resolveOleVerbTarget(slide, 'ole1')?.action).toBe('edit'); // no verb specified
	});

	it("classifies a Show-family verb as 'preview'", () => {
		const slide = slideOf([
			ole('ole1', { oleEmbeddedData: 'data:application/pdf;base64,AAAA' } as Partial<PptxElement>),
		]);
		expect(resolveOleVerbTarget(slide, 'ole1', 1)?.action).toBe('preview');
		expect(resolveOleVerbTarget(slide, 'ole1', -2)?.action).toBe('preview');
	});

	it("always classifies a generic Package object as 'download', whatever the verb", () => {
		const slide = slideOf([
			ole('pkg1', {
				oleObjectType: 'package',
				oleEmbeddedData: 'data:application/octet-stream;base64,AAAA',
			} as Partial<PptxElement>),
		]);
		expect(resolveOleVerbTarget(slide, 'pkg1', -1)?.action).toBe('download');
		expect(resolveOleVerbTarget(slide, 'pkg1', 0)?.action).toBe('download');
		expect(resolveOleVerbTarget(slide, 'pkg1', 1)?.action).toBe('download');
	});

	it('finds an OLE object nested inside a group', () => {
		const inner = ole('ole2', {
			oleEmbeddedData: 'data:application/pdf;base64,BBBB',
		} as Partial<PptxElement>);
		const group = {
			id: 'grp',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [inner],
		} as PptxElement;
		expect(resolveOleVerbTarget(slideOf([group]), 'ole2')?.fileName).toBeUndefined();
		expect(resolveOleVerbTarget(slideOf([group]), 'ole2')?.url).toBe(
			'data:application/pdf;base64,BBBB',
		);
	});

	it('is a no-op without an element, on a non-OLE shape, or when the embedding was not recovered', () => {
		const slide = slideOf([
			{ id: 'shape1', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
			ole('ole3'),
		]);
		expect(resolveOleVerbTarget(slide, undefined)).toBeUndefined();
		expect(resolveOleVerbTarget(undefined, 'ole3')).toBeUndefined();
		expect(resolveOleVerbTarget(slide, 'shape1')).toBeUndefined();
		expect(resolveOleVerbTarget(slide, 'ole3')).toBeUndefined();
		expect(resolveOleVerbTarget(slide, 'missing')).toBeUndefined();
	});
});
