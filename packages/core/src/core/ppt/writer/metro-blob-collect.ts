/**
 * Orchestrates `metroBlob` generation for a `.ppt` save: given the deck's
 * own `.pptx` serialisation (the lossless OOXML save of the same slides),
 * builds one `metroBlob` package per ink, SmartArt, chart and 3D-model
 * element, keyed by element id, for `element-to-write-model.ts` to attach
 * to the shape it writes.
 *
 * @module ppt/writer/metro-blob-collect
 */

import JSZip from 'jszip';

import type { PptxElement, PptxSlide } from '../../types';
import { buildModel3dMetroInput } from './metro-blob-model3d';
import { buildMetroBlobPackage } from './metro-blob-package';
import { collectMetroParts, parseRels, relsPathFor, resolveTarget } from './metro-blob-source';
import { findMetroFragment } from './metro-blob-xml';

/** Element types PowerPoint 2007+ reopens natively from a `metroBlob`. */
const METRO_TYPES: ReadonlySet<PptxElement['type']> = new Set([
	'ink',
	'contentPart',
	'smartArt',
	'chart',
	'model3d',
]);

/** True when `slides` holds at least one element a `metroBlob` can carry. */
export function deckNeedsMetroBlobs(slides: PptxSlide[]): boolean {
	const walk = (elements: PptxElement[]): boolean =>
		elements.some((el) => METRO_TYPES.has(el.type) || (el.type === 'group' && walk(el.children)));
	return slides.some((slide) => walk(slide.elements));
}

/** Slide part paths of a `.pptx` in presentation order. */
async function orderedSlidePaths(zip: JSZip): Promise<string[]> {
	const presXml = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
	const relsXml = (await zip.file(relsPathFor('ppt/presentation.xml'))?.async('string')) ?? '';
	const rels = new Map(parseRels(relsXml).map((r) => [r.id, r]));
	const sldIdLst = /<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/u.exec(presXml)?.[1] ?? '';
	const out: string[] = [];
	for (const m of sldIdLst.matchAll(/<p:sldId\b[^>]*\sr:id="([^"]+)"/gu)) {
		const rel = rels.get(m[1]!);
		if (rel) {
			out.push(resolveTarget('ppt/presentation.xml', rel.target));
		}
	}
	return out;
}

function collectMetroElements(elements: PptxElement[], out: PptxElement[]): void {
	for (const el of elements) {
		if (METRO_TYPES.has(el.type)) {
			out.push(el);
		} else if (el.type === 'group') {
			collectMetroElements(el.children, out);
		}
	}
}

/** Build the `metroBlob` for one element, or `undefined` when it cannot be located. */
async function buildOne(
	zip: JSZip,
	slidePath: string,
	slideXml: string,
	element: PptxElement,
): Promise<Uint8Array | undefined> {
	if (element.type === 'model3d') {
		const glb = element.modelPath
			? await zip.file(element.modelPath)?.async('uint8array')
			: undefined;
		const input = buildModel3dMetroInput(element, glb);
		return input ? buildMetroBlobPackage(input) : undefined;
	}
	const fragment = findMetroFragment(slideXml, {
		shapeId: element.shapeId,
		name: element.shapeId === undefined ? element.name : undefined,
	});
	if (!fragment) {
		return undefined;
	}
	const parts = await collectMetroParts(zip, slidePath, fragment.relIds);
	if (!parts) {
		return undefined;
	}
	return buildMetroBlobPackage({
		kind: fragment.kind,
		rootXml: fragment.xml,
		shapeId: fragment.shapeId,
		parts,
	});
}

/**
 * Build every `metroBlob` for `slides` from `pptxBytes`, the `.pptx` the same
 * handler just serialised from those same slides. Elements that cannot be
 * matched to their saved XML are simply absent from the map (the writer
 * then keeps its plain picture/placeholder for them).
 */
export async function buildMetroBlobs(
	pptxBytes: Uint8Array,
	slides: PptxSlide[],
): Promise<Map<string, Uint8Array>> {
	const zip = await JSZip.loadAsync(pptxBytes);
	const slidePaths = await orderedSlidePaths(zip);
	const out = new Map<string, Uint8Array>();
	for (let i = 0; i < slides.length; i++) {
		const slidePath = slidePaths[i];
		const slideXml = slidePath ? await zip.file(slidePath)?.async('string') : undefined;
		if (!slidePath || slideXml === undefined) {
			continue;
		}
		const elements: PptxElement[] = [];
		collectMetroElements(slides[i]!.elements, elements);
		for (const element of elements) {
			const blob = await buildOne(zip, slidePath, slideXml, element);
			if (blob) {
				out.set(element.id, blob);
			}
		}
	}
	return out;
}
