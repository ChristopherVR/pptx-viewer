import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { cellImageFillCss } from './table-style-image';

describe('cellImageFillCss', () => {
	it('returns null when fillMode is not "image"', () => {
		expect(
			cellImageFillCss({ fillMode: 'solid', backgroundImageFillData: 'data:image/png,x' }),
		).toBeNull();
		expect(cellImageFillCss({})).toBeNull();
	});

	it('returns null when no image reference is present', () => {
		expect(cellImageFillCss({ fillMode: 'image' })).toBeNull();
	});

	it('returns null for a raw archive path (not yet resolved to a displayable URL)', () => {
		expect(
			cellImageFillCss({ fillMode: 'image', backgroundImageFillPath: 'ppt/media/image1.png' }),
		).toBeNull();
	});

	it('resolves a data: URL to CSS background properties', () => {
		const result = cellImageFillCss({
			fillMode: 'image',
			backgroundImageFillData: 'data:image/png;base64,AAAA',
		});
		expect(result).toStrictEqual({
			backgroundImage: 'url("data:image/png;base64,AAAA")',
			backgroundSize: 'cover',
			backgroundPosition: 'center',
			backgroundRepeat: 'no-repeat',
		});
	});

	it('resolves a blob: URL', () => {
		const result = cellImageFillCss({
			fillMode: 'image',
			backgroundImageFillData: 'blob:https://example.test/abc-123',
		});
		expect(result?.backgroundImage).toBe('url("blob:https://example.test/abc-123")');
	});

	it('resolves an already-external http(s) URL from the raw path field', () => {
		const result = cellImageFillCss({
			fillMode: 'image',
			backgroundImageFillPath: 'https://example.test/image.png',
		});
		expect(result?.backgroundImage).toBe('url("https://example.test/image.png")');
	});

	it('prefers backgroundImageFillData over backgroundImageFillPath', () => {
		const style: PptxTableCellStyle = {
			fillMode: 'image',
			backgroundImageFillPath: 'https://example.test/original.png',
			backgroundImageFillData: 'data:image/png;base64,BBBB',
		};
		expect(cellImageFillCss(style)?.backgroundImage).toBe('url("data:image/png;base64,BBBB")');
	});
});
