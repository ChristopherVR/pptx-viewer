/**
 * `PptxElement` -> `WAnyShape` conversion for the `.ppt` writer: the
 * dispatcher that turns the editor's own element tree into the model
 * `write-model.ts` types describe.
 *
 * Elements with no binary-`.ppt` equivalent (chart, smartArt, media, ole,
 * ink, model3d, contentPart, zoom, unknown) are written as their rasterised
 * preview picture when one is available (PNG/JPEG only, see
 * `raster-utils.ts`), otherwise as a labelled placeholder rectangle. Either
 * way a `PptxCompatibilityWarning` (`scope: 'element'`) is reported so the
 * degradation is visible to the caller, never silent.
 *
 * @module ppt/writer/element-to-write-model
 */

import type { GroupPptxElement, PptxCustomShow, PptxElement, PptxSlide } from '../../types';
import type { PptxCompatibilityWarning } from '../../types/metadata';
import { elementRectEmu } from './element-rect';
import type { HyperlinkResolveContext } from './hyperlink-model';
import { resolveHyperlink } from './hyperlink-model';
import { convertMedia } from './media-element-convert';
import { convertOle } from './ole-element-convert';
import { dataUrlToPicture } from './raster-utils';
import { resolveFill, resolveLine } from './shape-style-to-fill-line';
import { sptForPreset } from './shape-type-map';
import { tableToShapeGroup } from './table-to-shapes';
import { textSegmentsToParagraphs } from './text-segments-to-paragraphs';
import type {
	WAnyShape,
	WDeck,
	WGroup,
	WPictureData,
	WShape,
	WSlide,
	WTextBody,
} from './write-model';

/** Reports a compatibility warning during conversion. */
export type WarningReporter = (warning: PptxCompatibilityWarning) => void;

/** Shared conversion state, threaded through every `convert*` helper (including `ole-element-convert.ts`'s). */
export interface ConvertContext {
	pictures: WPictureData[];
	slideId: string;
	report: WarningReporter;
	/** Resolves shape/run click actions (`a:hlinkClick`) to a `WHyperlinkKind`. */
	hyperlinkCtx: HyperlinkResolveContext;
	/**
	 * WAV bytes for `media` elements loaded from a real `.pptx` (which carry
	 * only a lazy `mediaPath`, never `mediaData`), keyed by `mediaPath` and
	 * pre-resolved from the live zip by `PptxHandlerRuntimeSaveLegacyPpt.ts`
	 * before conversion so `media-element-convert.ts` can embed real audio
	 * without mutating the live element tree.
	 */
	resolvedMedia?: Map<string, Uint8Array>;
}

const PLACEHOLDER_TYPES = new Set(['title', 'body', 'ctrTitle', 'subTitle']);

function toPlaceholderType(value: string | undefined): WShape['placeholderType'] {
	return value && PLACEHOLDER_TYPES.has(value) ? (value as WShape['placeholderType']) : undefined;
}

/** Build the text body for a text-bearing element, or undefined when empty. */
function buildTextBody(
	element: PptxElement,
	textType: number,
	hyperlinkCtx: HyperlinkResolveContext,
): WTextBody | undefined {
	if (!('textSegments' in element) && !('text' in element)) {
		return undefined;
	}
	const el = element as PptxElement & {
		textSegments?: import('../../types/text').TextSegment[];
		text?: string;
		textStyle?: import('../../types/text').TextStyle;
		paragraphIndents?: Array<{ marginLeft?: number; indent?: number }>;
	};
	const paragraphs = textSegmentsToParagraphs(el.textSegments ?? [], el.paragraphIndents, {
		text: el.text,
		style: el.textStyle,
		hyperlinkCtx,
	});
	return paragraphs.length > 0 ? { textType, paragraphs } : undefined;
}

/** Convert a text/shape/connector element into a `WShape`. */
function convertShapeLike(element: PptxElement, ctx: ConvertContext): WShape {
	const isText = element.type === 'text';
	const el = element as PptxElement & {
		shapeType?: string;
		shapeStyle?: import('../../types/shape-style').ShapeStyle;
	};
	const spt = sptForPreset(el.shapeType, isText);
	const placeholderType = toPlaceholderType(element.placeholderType);
	return {
		kind: 'shape',
		spt,
		isConnector: element.type === 'connector',
		name: element.name,
		anchor: elementRectEmu(element),
		rotationDeg: element.rotation,
		flipH: element.flipHorizontal,
		flipV: element.flipVertical,
		fill: resolveFill(el.shapeStyle),
		line: resolveLine(el.shapeStyle),
		text: buildTextBody(
			element,
			placeholderType === 'title' || placeholderType === 'ctrTitle' ? 0 : 1,
			ctx.hyperlinkCtx,
		),
		placeholderType,
		hyperlink: resolveHyperlink(element.actionClick, ctx.hyperlinkCtx),
	};
}

/** Convert an image/picture element, embedding PNG/JPEG or degrading with a warning. */
function convertPicture(element: PptxElement, ctx: ConvertContext): WAnyShape {
	const el = element as PptxElement & { imageData?: string; altText?: string };
	const picture = dataUrlToPicture(el.imageData);
	if (picture) {
		ctx.pictures.push(picture);
		return {
			kind: 'picture',
			pictureIndex: ctx.pictures.length - 1,
			name: element.name,
			anchor: elementRectEmu(element),
			rotationDeg: element.rotation,
			flipH: element.flipHorizontal,
			flipV: element.flipVertical,
			hyperlink: resolveHyperlink(element.actionClick, ctx.hyperlinkCtx),
		};
	}
	ctx.report({
		code: 'ppt-image-format-unsupported',
		message:
			'Image is not PNG or JPEG; the .ppt writer only embeds those two raster formats, so this image was replaced with a placeholder.',
		severity: 'warning',
		scope: 'element',
		slideId: ctx.slideId,
		elementId: element.id,
	});
	return placeholderShape(element, el.altText ?? element.name ?? '[Image]');
}

/** Build a labelled placeholder rectangle for an element with no binary-`.ppt` form. */
function placeholderShape(element: PptxElement, label: string): WShape {
	return {
		kind: 'shape',
		spt: 1,
		isConnector: false,
		name: element.name,
		anchor: elementRectEmu(element),
		rotationDeg: element.rotation,
		fill: { kind: 'solid', rgb: 'F2F2F2' },
		line: { kind: 'line', rgb: 'BFBFBF', widthEmu: 9525 },
		text: {
			textType: 4,
			paragraphs: [{ indentLevel: 0, align: 'ctr', runs: [{ text: label, sizePt: 12 }] }],
		},
	};
}

/** Convert an element with no binary-`.ppt` equivalent to a preview picture or placeholder. */
export function degradeElement(
	element: PptxElement,
	ctx: ConvertContext,
	label: string,
): WAnyShape {
	const preview =
		(element as { previewImageData?: string; posterImage?: string }).previewImageData ??
		(element as { posterImage?: string }).posterImage;
	const picture = dataUrlToPicture(preview);
	ctx.report({
		code: `ppt-unsupported-${element.type}`,
		message: `"${element.type}" elements have no binary .ppt equivalent; ${
			picture
				? 'a static preview image was embedded instead.'
				: 'a placeholder rectangle was written instead.'
		}`,
		severity: 'warning',
		scope: 'element',
		slideId: ctx.slideId,
		elementId: element.id,
	});
	if (picture) {
		ctx.pictures.push(picture);
		return {
			kind: 'picture',
			pictureIndex: ctx.pictures.length - 1,
			name: element.name,
			anchor: elementRectEmu(element),
			rotationDeg: element.rotation,
		};
	}
	return placeholderShape(element, label);
}

/** Convert a group element (recursively converting its children). */
function convertGroup(element: GroupPptxElement, ctx: ConvertContext): WGroup {
	return {
		kind: 'group',
		name: element.name,
		anchor: elementRectEmu(element),
		rotationDeg: element.rotation,
		flipH: element.flipHorizontal,
		flipV: element.flipVertical,
		children: element.children.map((child) => convertElement(child, ctx)),
		hyperlink: resolveHyperlink(element.actionClick, ctx.hyperlinkCtx),
	};
}

/** Convert one `PptxElement` into its `WAnyShape` representation. */
export function convertElement(element: PptxElement, ctx: ConvertContext): WAnyShape {
	switch (element.type) {
		case 'text':
		case 'shape':
		case 'connector':
			return convertShapeLike(element, ctx);
		case 'image':
		case 'picture':
			return convertPicture(element, ctx);
		case 'table': {
			const rect = elementRectEmu(element);
			return element.tableData
				? tableToShapeGroup(element.tableData, rect)
				: placeholderShape(element, '[Table]');
		}
		case 'group':
			return convertGroup(element, ctx);
		case 'chart':
			return degradeElement(element, ctx, '[Chart]');
		case 'smartArt':
			return degradeElement(element, ctx, '[SmartArt]');
		case 'ole':
			return convertOle(element, ctx);
		case 'media':
			return convertMedia(element, ctx);
		case 'model3d':
			return degradeElement(element, ctx, '[3D Model]');
		case 'ink':
		case 'contentPart':
			return degradeElement(element, ctx, '[Ink]');
		case 'zoom':
			return degradeElement(element, ctx, '[Zoom]');
		default:
			return degradeElement(element, ctx, '[Unsupported]');
	}
}

/** Convert one slide's element tree and background into a `WSlide`. */
function convertSlide(slide: PptxSlide, ctx: ConvertContext): WSlide {
	const notesParagraphs =
		slide.notesSegments && slide.notesSegments.length > 0
			? textSegmentsToParagraphs(slide.notesSegments, undefined, {
					text: slide.notes,
					hyperlinkCtx: ctx.hyperlinkCtx,
				})
			: slide.notes
				? textSegmentsToParagraphs([], undefined, {
						text: slide.notes,
						hyperlinkCtx: ctx.hyperlinkCtx,
					})
				: undefined;
	return {
		backgroundRgb: slide.backgroundColor?.replace(/^#/u, ''),
		shapes: slide.elements.map((el) => convertElement(el, ctx)),
		notesParagraphs,
	};
}

/**
 * Convert the whole deck into the `.ppt` writer's intermediate model.
 *
 * @param slides - The (possibly mutated) live slide array.
 * @param widthEmu - Presentation slide width in EMU.
 * @param heightEmu - Presentation slide height in EMU.
 * @param report - Sink for compatibility warnings raised for degraded elements.
 * @param customShows - The deck's named custom shows (`p:custShowLst`), used
 *   to resolve a `customShow` click-action target. Omit when the caller has
 *   none available; custom-show actions then degrade to no hyperlink.
 * @param resolvedMedia - See `ConvertContext.resolvedMedia`'s doc.
 */
export function convertDeckToWriteModel(
	slides: PptxSlide[],
	widthEmu: number,
	heightEmu: number,
	report: WarningReporter,
	customShows?: PptxCustomShow[],
	resolvedMedia?: Map<string, Uint8Array>,
): WDeck {
	const pictures: WPictureData[] = [];
	const hyperlinkCtx: HyperlinkResolveContext = { slides, customShows };
	const wSlides = slides.map((slide) =>
		convertSlide(slide, { pictures, slideId: slide.id, report, hyperlinkCtx, resolvedMedia }),
	);
	return { widthEmu, heightEmu, slides: wSlides, pictures };
}
