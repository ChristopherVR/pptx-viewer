import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	parseDataUrlToBytes,
	replaceOleFile,
	resolveOleEditorKindFromPayload,
	setOleObjectName,
} from 'pptx-viewer-core';
import type {
	OleNestedDeckSlideDetail,
	OlePayloadEditorKind,
	OlePptxElement,
	OleSheetGrid,
	PptxSlide,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

/**
 * Locate an OLE element on a slide by id, or throw a descriptive error.
 * Mirrors {@link findTableElement} in `table-style-tools.ts`: validate the
 * slide index, find the element, and narrow to the expected `type`.
 */
function resolveOleElement(
	ctx: ToolContext,
	slideIndex: number,
	elementId: string,
): { slide: PptxSlide; element: OlePptxElement; index: number } {
	const err = validateSlideIndex(slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}
	const slide = ctx.pptxData.slides[slideIndex];
	const index = slide.elements.findIndex((e) => e.id === elementId);
	if (index === -1) {
		throw new Error(`Element '${elementId}' not found on slide ${slideIndex}.`);
	}
	const element = slide.elements[index];
	if (element.type !== 'ole') {
		throw new Error(`Element '${elementId}' is not an OLE object.`);
	}
	return { slide, element, index };
}

/** Replace the resolved OLE element in-place and mark the slide dirty. */
function commitOleElement(slide: PptxSlide, index: number, updated: OlePptxElement): void {
	slide.elements.splice(index, 1, updated);
	slide.isDirty = true;
}

// ── getOleContent ────────────────────────────────────────────────────────────

export interface GetOleContentParams {
	slideIndex: number;
	elementId: string;
}

export interface GetOleContentResult {
	elementId: string;
	/** Which in-place editor applies to the object's current payload. */
	kind: OlePayloadEditorKind;
	/** Whether `ole_set_*` can act on this object; `false` steers to `ole_replace_file`. */
	editable: boolean;
	/** Human-readable note, set when `editable` is `false`. */
	message?: string;
	/** Present when `kind` is `sheet-xlsx` or `sheet-xls`. */
	sheet?: OleSheetGrid;
	/** Present when `kind` is `document-docx` or `document-doc`. */
	paragraphs?: string[];
	/** Present when `kind` is `deck-pptx`: every slide's text-element inventory. */
	deckSlides?: OleNestedDeckSlideDetail[];
}

/**
 * Describe an OLE object's editable content: the resolved payload kind, plus
 * whichever of the sheet grid / paragraph list / nested-deck slide summaries
 * applies. `file` (anything unsupported, or a missing/unreadable payload, or
 * a `document-doc` this editor declined to touch, see `getOleDocumentParagraphs`
 * in `pptx-viewer-core`) comes back as not editable in place; the caller
 * should use {@link replaceOleFileT} instead.
 */
export async function getOleContent(
	ctx: ToolContext,
	params: GetOleContentParams,
): Promise<ToolResult<GetOleContentResult>> {
	const { element } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const kind = await resolveOleEditorKindFromPayload(element);
	const base = { pptxData: ctx.pptxData, dirty: false as const };

	switch (kind) {
		case 'sheet-xlsx':
		case 'sheet-xls': {
			const sheet = await getOleSheetGrid(element);
			return { ...base, result: { elementId: element.id, kind, editable: true, sheet } };
		}
		case 'document-docx':
		case 'document-doc': {
			const paragraphs = await getOleDocumentParagraphs(element);
			return { ...base, result: { elementId: element.id, kind, editable: true, paragraphs } };
		}
		case 'deck-pptx': {
			const deckSlides = await getOleNestedDeckDetail(element);
			return { ...base, result: { elementId: element.id, kind, editable: true, deckSlides } };
		}
		default:
			return {
				...base,
				result: {
					elementId: element.id,
					kind,
					editable: false,
					message: `This OLE object's content (${kind}) is not directly editable; use ole_replace_file to replace it wholesale.`,
				},
			};
	}
}

// ── setOleSheetCell / setOleDocumentParagraph / setOleDeckSlideTitle ────────

export interface SetOleContentResult {
	elementId: string;
	/** `false` when the edit was a no-op (e.g. value unchanged, or wrong payload kind). */
	changed: boolean;
}

export interface SetOleSheetCellParams {
	slideIndex: number;
	elementId: string;
	row: number;
	col: number;
	value: string;
}

/** Edit one cell of an Excel-payload (`.xlsx`/`.xls`) OLE object's first worksheet. */
export async function setOleSheetCell(
	ctx: ToolContext,
	params: SetOleSheetCellParams,
): Promise<ToolResult<SetOleContentResult>> {
	const { slide, element, index } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const updated = await applyOleSheetCellEdit(element, {
		row: params.row,
		col: params.col,
		value: params.value,
	});
	const changed = updated !== element;
	if (changed) {
		commitOleElement(slide, index, updated);
	}
	return {
		pptxData: ctx.pptxData,
		dirty: changed,
		result: { elementId: params.elementId, changed },
	};
}

export interface SetOleDocumentParagraphParams {
	slideIndex: number;
	elementId: string;
	paragraphIndex: number;
	text: string;
}

/** Replace one paragraph's text in a Word-payload (`.docx` or legacy binary `.doc`) OLE object. */
export async function setOleDocumentParagraph(
	ctx: ToolContext,
	params: SetOleDocumentParagraphParams,
): Promise<ToolResult<SetOleContentResult>> {
	const { slide, element, index } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const updated = await applyOleDocumentParagraphEdit(element, params.paragraphIndex, params.text);
	const changed = updated !== element;
	if (changed) {
		commitOleElement(slide, index, updated);
	}
	return {
		pptxData: ctx.pptxData,
		dirty: changed,
		result: { elementId: params.elementId, changed },
	};
}

export interface SetOleDeckSlideTitleParams {
	slideIndex: number;
	elementId: string;
	deckSlideIndex: number;
	/** The id of the text-bearing shape to edit, from `ole_get_content`'s `deckSlides[n].elements[i].elementId`. */
	deckElementId: string;
	title: string;
}

/**
 * Replace one specific text-bearing shape's text on one slide of a
 * nested-deck (embedded PowerPoint) OLE object: a full round-trip through
 * the nested deck's own `PptxHandler` load/save, so any text-bearing shape
 * on any slide is a real edit target, not only a fixed "title" slot. Call
 * `ole_get_content` first to discover each slide's `elementId`s.
 */
export async function setOleDeckSlideTitle(
	ctx: ToolContext,
	params: SetOleDeckSlideTitleParams,
): Promise<ToolResult<SetOleContentResult>> {
	const { slide, element, index } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const updated = await applyOleNestedDeckElementTextEdit(
		element,
		params.deckSlideIndex,
		params.deckElementId,
		params.title,
	);
	const changed = updated !== element;
	if (changed) {
		commitOleElement(slide, index, updated);
	}
	return {
		pptxData: ctx.pptxData,
		dirty: changed,
		result: { elementId: params.elementId, changed },
	};
}

export interface SetOleObjectNameParams {
	slideIndex: number;
	elementId: string;
	/** New Object Name (`p:oleObj/@name`); blank/whitespace clears it. */
	name: string;
}

/**
 * Rename an OLE object's Object Name (`p:oleObj/@name`). When the object is
 * displayed `showAsIcon`, this also regenerates the baked-in icon caption
 * (see `setOleObjectName` in `pptx-viewer-core`) so the new name is visible
 * once the deck is reopened in real PowerPoint.
 */
export async function setOleObjectNameT(
	ctx: ToolContext,
	params: SetOleObjectNameParams,
): Promise<ToolResult<SetOleContentResult>> {
	const { slide, element, index } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const updated = await setOleObjectName(element, params.name);
	commitOleElement(slide, index, updated);
	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, changed: true },
	};
}

// ── replaceOleFileT ──────────────────────────────────────────────────────────

export interface ReplaceOleFileParams {
	slideIndex: number;
	elementId: string;
	/** New payload as a base64 data URL, e.g. `data:application/pdf;base64,...`. */
	fileData: string;
	/** Optional new file name; also updates the resolved MIME type. */
	fileName?: string;
}

/**
 * Replace an OLE object's payload wholesale with an arbitrary file. Always
 * available regardless of the object's current kind, and the only edit
 * available for a generic "Package" object or an unsupported format.
 */
export async function replaceOleFileT(
	ctx: ToolContext,
	params: ReplaceOleFileParams,
): Promise<ToolResult<SetOleContentResult>> {
	const { slide, element, index } = resolveOleElement(ctx, params.slideIndex, params.elementId);
	const parsed = parseDataUrlToBytes(params.fileData);
	if (!parsed) {
		throw new Error('fileData must be a base64 data URL, e.g. "data:<mime-type>;base64,<...>".');
	}
	const updated = await replaceOleFile(element, parsed.bytes, params.fileName);
	commitOleElement(slide, index, updated);
	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, changed: true },
	};
}
