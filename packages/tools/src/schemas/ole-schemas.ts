import { z } from 'zod';

export const GetOleContentSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID'),
});

export const SetOleSheetCellSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID (Excel payload: .xlsx or .xls)'),
	row: z.number().int().min(0).describe('Zero-based row index on the first worksheet'),
	col: z.number().int().min(0).describe('Zero-based column index on the first worksheet'),
	value: z.string().describe('New cell value'),
});

export const SetOleDocumentParagraphSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID (Word payload: .docx)'),
	paragraphIndex: z.number().int().min(0).describe('Zero-based paragraph index'),
	text: z.string().describe('New paragraph text'),
});

export const SetOleDeckSlideTitleSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID (nested-deck payload: .pptx)'),
	deckSlideIndex: z.number().int().min(0).describe('Zero-based slide index within the nested deck'),
	deckElementId: z
		.string()
		.describe(
			"ID of the text-bearing shape to edit within the nested slide, from ole_get_content's deckSlides[n].elements[i].elementId",
		),
	title: z.string().describe('New text for the chosen shape'),
});

export const ReplaceOleFileSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID'),
	fileData: z
		.string()
		.describe('New payload as a base64 data URL (e.g. "data:application/pdf;base64,...")'),
	fileName: z
		.string()
		.optional()
		.describe('Optional new file name (also updates the resolved MIME type)'),
});

export const SetOleObjectNameSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('OLE element ID'),
	name: z.string().describe('New Object Name (p:oleObj/@name); blank/whitespace clears it'),
});
