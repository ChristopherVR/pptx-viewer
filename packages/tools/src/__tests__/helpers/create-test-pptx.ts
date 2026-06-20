import { PptxHandler } from 'pptx-viewer-core';
import type { PptxData } from 'pptx-viewer-core';

import type { ToolContext } from '../../types.js';

/**
 * Create a real PPTX as Uint8Array using PptxHandler.createBlank().
 * Useful for integration tests that need actual PPTX bytes.
 */
export async function createTestPptxBytes(slideCount = 2): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Test Presentation',
		creator: 'Test Suite',
		initialSlideCount: 0,
	});

	for (let i = 0; i < slideCount; i++) {
		const slide = createSlide('Blank')
			.addText(`Slide ${i + 1} Title`, {
				x: 100,
				y: 50,
				width: 600,
				height: 40,
				fontSize: 28,
				bold: true,
			})
			.addText(`Body text on slide ${i + 1}`, {
				x: 100,
				y: 120,
				width: 600,
				height: 200,
				fontSize: 14,
			})
			.setNotes(`Speaker notes for slide ${i + 1}`)
			.build();
		data.slides.push(slide);
	}

	return handler.save(data.slides);
}

/**
 * Load a real PPTX into PptxData via PptxHandler.
 */
export async function loadTestPptxData(bytes: Uint8Array): Promise<PptxData> {
	const handler = new PptxHandler();
	return handler.load(bytes.buffer as ArrayBuffer);
}

/**
 * Create a PptxData from real PPTX bytes, ready for tool functions.
 */
export async function createTestPptxData(slideCount = 2): Promise<PptxData> {
	const bytes = await createTestPptxBytes(slideCount);
	return loadTestPptxData(bytes);
}

/**
 * Create a ToolContext from real PPTX data.
 */
export async function createTestToolContext(slideCount = 2): Promise<ToolContext> {
	return { pptxData: await createTestPptxData(slideCount) };
}

/**
 * In-memory PptxData with a table element for table tool tests.
 */
export function makeTablePresentation(): PptxData {
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
						id: 'tbl-0',
						type: 'table' as const,
						x: 50,
						y: 50,
						width: 400,
						height: 200,
						tableData: {
							rows: [
								{
									height: 40,
									cells: [{ text: 'Header A' }, { text: 'Header B' }, { text: 'Header C' }],
								},
								{
									height: 40,
									cells: [{ text: 'R1C1' }, { text: 'R1C2' }, { text: 'R1C3' }],
								},
								{
									height: 40,
									cells: [{ text: 'R2C1' }, { text: 'R2C2' }, { text: 'R2C3' }],
								},
							],
							columnWidths: [0.33, 0.34, 0.33],
						},
					},
					{
						id: 'txt-0',
						type: 'text' as const,
						x: 100,
						y: 300,
						width: 300,
						height: 60,
						text: 'Some text',
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}

/**
 * In-memory PptxData with shape and image elements for style tool tests.
 */
export function makeStylePresentation(): PptxData {
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
						id: 'shape-0',
						type: 'shape' as const,
						x: 100,
						y: 100,
						width: 200,
						height: 100,
						shapeType: 'rect',
						shapeStyle: { fillColor: '#ff0000' },
					},
					{
						id: 'img-0',
						type: 'image' as const,
						x: 400,
						y: 100,
						width: 200,
						height: 150,
						imageData: 'data:image/png;base64,iVBORw0KGgo=',
					},
					{
						id: 'txt-0',
						type: 'text' as const,
						x: 100,
						y: 300,
						width: 300,
						height: 60,
						text: 'Visible text',
						textStyle: { fontSize: 18, color: '#000000' },
					},
				],
				notes: '',
				comments: [],
				backgroundColor: '#ffffff',
			},
			{
				id: 'slide-1',
				rId: 'rId3',
				slideNumber: 2,
				elements: [
					{
						id: 'txt-1',
						type: 'text' as const,
						x: 100,
						y: 100,
						width: 300,
						height: 60,
						text: '',
						textStyle: { fontSize: 8 },
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}
