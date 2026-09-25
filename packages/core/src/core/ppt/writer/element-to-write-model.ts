/**
 * `PptxElement` -> `WAnyShape` conversion for the `.ppt` writer: the
 * dispatcher that turns the editor's own element tree into the model
 * `write-model.ts` types describe.
 *
 * `media` and `ole` have real binary equivalents (`media-element-convert.ts`,
 * `ole-element-convert.ts`). Every other element with no plain binary-`.ppt`
 * record form (chart, smartArt, ink, contentPart, model3d, zoom, unknown) goes
 * through `degrade-element.ts`, which also attaches the element's `metroBlob`
 * (ink, SmartArt, charts, 3D models) so PowerPoint 2007+ reopens it natively.
 *
 * @module ppt/writer/element-to-write-model
 */

import type { GroupPptxElement, PptxCustomShow, PptxElement, PptxSlide } from '../../types';
import type { PptxCompatibilityWarning } from '../../types/metadata';
import { degradeElement, placeholderShape } from './degrade-element';
import { elementRectEmu } from './element-rect';
import type { HyperlinkResolveContext } from './hyperlink-model';
import { resolveHyperlink } from './hyperlink-model';
import { convertMedia } from './media-element-convert';
import { convertOle } from './ole-element-convert';
import type { ResolvedPictures } from './picture-resolve';
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
	/**
	 * Per-element `metroBlob` packages (element id -> ZIP bytes) built from
	 * the deck's own `.pptx` serialisation by `metro-blob-collect.ts`, so ink,
	 * SmartArt, charts and 3D models reopen natively in PowerPoint 2007+.
	 */
	metroBlobs?: Map<string, Uint8Array>;
	/** Pictures the async pre-pass resolved (`picture-resolve.ts`), keyed by the live element. */
	resolvedPictures?: ResolvedPictures;
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
	const picture = ctx.resolvedPictures?.get(element) ?? dataUrlToPicture(el.imageData);
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
			'Image could not be embedded in the .ppt (it is not PNG, JPEG, GIF, BMP, TIFF, EMF or WMF, or it is an SVG with no raster fallback), so it was replaced with a placeholder.',
		severity: 'warning',
		scope: 'element',
		slideId: ctx.slideId,
		elementId: element.id,
	});
	return placeholderShape(element, el.altText ?? element.name ?? '[Image]');
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
 * @param metroBlobs - See `ConvertContext.metroBlobs`'s doc.
 * @param resolvedPictures - See `ConvertContext.resolvedPictures`'s doc.
 */
export function convertDeckToWriteModel(
	slides: PptxSlide[],
	widthEmu: number,
	heightEmu: number,
	report: WarningReporter,
	customShows?: PptxCustomShow[],
	resolvedMedia?: Map<string, Uint8Array>,
	metroBlobs?: Map<string, Uint8Array>,
	resolvedPictures?: ResolvedPictures,
): WDeck {
	const pictures: WPictureData[] = [];
	const hyperlinkCtx: HyperlinkResolveContext = { slides, customShows };
	const wSlides = slides.map((slide) =>
		convertSlide(slide, {
			pictures,
			slideId: slide.id,
			report,
			hyperlinkCtx,
			resolvedMedia,
			metroBlobs,
			resolvedPictures,
		}),
	);
	return { widthEmu, heightEmu, slides: wSlides, pictures };
}
