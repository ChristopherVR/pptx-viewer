import { describe, expect, it } from 'vitest';

import {
	renderOleDeckPreviewPng,
	renderOleDocumentPreviewPng,
	renderOleSheetPreviewPng,
} from './ole-content-preview-raster';
import type { OleSheetGrid } from './ole-sheet-xlsx-editor';
import { decodePngDimensions } from './png-encoder';

describe('ole-content-preview-raster', () => {
	it('renders a sheet grid preview at the fixed preview size', () => {
		const grid: OleSheetGrid = {
			sheetName: 'Sheet1',
			rows: [
				{
					cells: [
						{ value: 'Revenue', isNumeric: false },
						{ value: '42', isNumeric: true },
					],
				},
			],
		};
		const png = renderOleSheetPreviewPng(grid);
		expect(decodePngDimensions(png)).toStrictEqual({ width: 320, height: 200 });
	});

	it('renders a document preview from paragraph text, wrapping long paragraphs', () => {
		const png = renderOleDocumentPreviewPng([
			'Short line.',
			'A much longer paragraph that should wrap across more than one rendered line in the preview image.',
		]);
		expect(decodePngDimensions(png)).toStrictEqual({ width: 320, height: 200 });
	});

	it('renders a deck preview from text lines', () => {
		const png = renderOleDeckPreviewPng(['Title Slide', 'Subtitle text']);
		expect(decodePngDimensions(png)).toStrictEqual({ width: 320, height: 200 });
	});

	it('renders an empty grid without throwing', () => {
		const png = renderOleSheetPreviewPng({ sheetName: 'Sheet1', rows: [] });
		expect(decodePngDimensions(png)).toBeDefined();
	});
});
