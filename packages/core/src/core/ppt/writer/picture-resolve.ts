/**
 * Async pre-pass for the `.ppt` writer's pictures: resolves, per element,
 * the picture a synchronous `dataUrlToPicture(...)` of its inline data URL
 * cannot. Covers image/picture elements, a media element's poster frame
 * and an OLE object's preview (`picture-source.ts` names the fields).
 *
 * Cases that need it:
 *
 * - The inline URL is a `blob:` URL (what the loader mints for pictures in
 *   a browser, `PptxHandlerRuntimeMediaData.ts`'s `createImageUrl`) or is
 *   absent (a picture loaded in Node carries only its part path), so the
 *   part is read from the loaded zip; before this pass such a picture was
 *   written as a placeholder.
 * - The inline URL is a render-only conversion of the real part (an EMF/WMF
 *   converted to PNG/SVG, a TIFF decoded to PNG). The `.pptx` save keeps the
 *   original part in that case (see `PptxHandlerRuntimeSaveElementEmbedding.ts`'s
 *   extension-mismatch rule), so the `.ppt` embeds those same bytes: EMF/WMF
 *   natively, as PowerPoint does.
 * - The source is a TIFF, whose decoder (`utif`) loads asynchronously; it is
 *   re-encoded to PNG, matching PowerPoint's own 97-2003 SaveAs.
 * - The picture is an SVG with no raster fallback, rasterised in a browser
 *   (`svg-rasterize.ts`).
 *
 * Every other picture takes the synchronous path, so an edited inline
 * payload of the part's own format still wins, exactly as on `.pptx` save.
 *
 * @module ppt/writer/picture-resolve
 */

import type { PptxElement, PptxSlide } from '../../types';
import { encodePng } from '../../utils/png-encoder';
import { bytesToPicture, sniffImageFormat } from './picture-encode';
import { pictureSourceOf } from './picture-source';
import type { PictureSource } from './picture-source';
import { decodeBase64DataUrl } from './raster-utils';
import { rasterizeSvg } from './svg-rasterize';
import type { WPictureData } from './write-model';

/** Reads a package part's bytes (the loaded `.pptx` zip), or `undefined` when absent. */
export type PartReader = (path: string) => Promise<Uint8Array | undefined>;

/** Pictures resolved ahead of conversion, keyed by the live element. */
export type ResolvedPictures = Map<PptxElement, WPictureData>;

/** Decode a TIFF's first page to PNG through `utif` (DOM-free), or `undefined`. */
async function tiffToPicture(bytes: Uint8Array): Promise<WPictureData | undefined> {
	try {
		const imported = await import('utif');
		const utif = ('default' in imported ? imported.default : imported) as typeof import('utif');
		const buffer = bytes.slice().buffer as ArrayBuffer;
		const page = utif.decode(buffer)[0];
		if (!page) {
			return undefined;
		}
		utif.decodeImage(buffer, page);
		const width = Number(page.width);
		const height = Number(page.height);
		if (!(width > 0 && height > 0)) {
			return undefined;
		}
		return {
			extension: 'png',
			bytes: encodePng(width, height, new Uint8Array(utif.toRGBA8(page))),
		};
	} catch {
		return undefined;
	}
}

/** Fetch a `blob:` URL's bytes, or `undefined` outside a runtime that can. */
async function fetchBlobUrl(url: string | undefined): Promise<Uint8Array | undefined> {
	if (!url?.startsWith('blob:') || typeof fetch === 'undefined') {
		return undefined;
	}
	try {
		return new Uint8Array(await (await fetch(url)).arrayBuffer());
	} catch {
		return undefined;
	}
}

/** Extension of a package path, lower-cased, folded onto `sniffImageFormat`'s names. */
function pathFormat(path: string): string | undefined {
	const ext = /\.([^./\\]+)$/u.exec(path)?.[1]?.toLowerCase();
	return ext === 'jpg' ? 'jpeg' : ext === 'tif' ? 'tiff' : ext;
}

/** Bytes -> picture, including the async TIFF and SVG paths. */
async function toPicture(bytes: Uint8Array, el: PptxElement): Promise<WPictureData | undefined> {
	const format = sniffImageFormat(bytes);
	if (format === 'tiff') {
		return tiffToPicture(bytes);
	}
	if (format === 'svg') {
		return rasterizeSvg(bytes, el.width || 1, el.height || 1);
	}
	return bytesToPicture(bytes);
}

/** Resolve one element's picture, or `undefined` to leave it to the sync path. */
async function resolveOne(
	el: PptxElement,
	source: PictureSource,
	readPart: PartReader,
): Promise<WPictureData | undefined> {
	const inline = decodeBase64DataUrl(source.inline);
	const inlineFormat = inline ? sniffImageFormat(inline) : undefined;
	const partFormat = source.partPath ? pathFormat(source.partPath) : undefined;
	// An inline payload of the part's own format (or with no part) is the edited
	// source of truth, as on `.pptx` save; only TIFF/SVG still need the async path.
	if (inline && (!partFormat || partFormat === inlineFormat)) {
		return inlineFormat === 'tiff' || inlineFormat === 'svg' ? toPicture(inline, el) : undefined;
	}
	const part = source.partPath ? await readPart(source.partPath) : undefined;
	const fromPart = part ? await toPicture(part, el) : undefined;
	if (fromPart) {
		return fromPart;
	}
	if (inline && bytesToPicture(inline)) {
		return undefined; // e.g. an SVG part with a PNG inline fallback: the sync path embeds it
	}
	const fetched = await fetchBlobUrl(source.inline);
	const fromFetch = fetched ? await toPicture(fetched, el) : undefined;
	if (fromFetch || !source.svgPath) {
		return fromFetch;
	}
	// Last resort: an SVG picture with no raster fallback at all.
	const svg = await readPart(source.svgPath);
	return svg ? rasterizeSvg(svg, el.width || 1, el.height || 1) : undefined;
}

/**
 * Resolve every picture-bearing element (groups included) that needs the
 * async path; see the module doc for which ones.
 */
export async function resolvePictureSources(
	slides: PptxSlide[],
	readPart: PartReader,
): Promise<ResolvedPictures> {
	const pending: Array<[PptxElement, PictureSource]> = [];
	const walk = (elements: PptxElement[]): void => {
		for (const el of elements) {
			const source = pictureSourceOf(el);
			if (source) {
				pending.push([el, source]);
			} else if (el.type === 'group') {
				walk(el.children);
			}
		}
	};
	for (const slide of slides) {
		walk(slide.elements);
	}
	const resolved: ResolvedPictures = new Map();
	await Promise.all(
		pending.map(async ([el, source]) => {
			const picture = await resolveOne(el, source, readPart);
			if (picture) {
				resolved.set(el, picture);
			}
		}),
	);
	return resolved;
}
