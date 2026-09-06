/**
 * In-place editing for an embedded nested PowerPoint presentation
 * (`PowerPoint.Show.12` / `.pptx` OLE payload).
 *
 * Full round-trip: the nested deck's bytes are loaded through core's own
 * `PptxHandler` (the same loader every top-level `.pptx` uses), so every
 * text-bearing shape on every slide is a real, addressable edit target, not
 * a fixed "first shape" slot. An edit sets one shape's plain text and
 * re-saves through the SAME `PptxHandler.save`, so the nested deck's own
 * save pipeline (layout, rels, content types) runs exactly as it would for
 * a standalone file. `ole-edit-api.ts` wraps `writeOleNestedDeckElementText`'s
 * output back into the OWNING OLE object's embedding via
 * `replaceOleEmbedding`. Replace File (`replaceOleFile`) remains available
 * for any edit this does not cover (reordering slides, non-text shapes,
 * layout changes).
 *
 * @module ole-nested-deck-editor
 */
import { PptxHandler } from '../PptxHandler';
import type { PptxElement, PptxSlide, ShapePptxElement, TextPptxElement } from '../types';

/** One text-bearing shape on a nested slide, addressable for editing. */
export interface OleNestedDeckTextElement {
	elementId: string;
	text: string;
}

/** One nested slide's full text-element inventory. */
export interface OleNestedDeckSlideDetail {
	index: number;
	elements: OleNestedDeckTextElement[];
}

type TextBearingElement = TextPptxElement | ShapePptxElement;

function isTextBearingElement(el: PptxElement): el is TextBearingElement {
	return el.type === 'text' || el.type === 'shape';
}

/** Every text-bearing shape on a slide, recursing into groups (document order). */
function collectTextBearingElements(elements: PptxElement[]): TextBearingElement[] {
	const result: TextBearingElement[] = [];
	for (const el of elements) {
		if (isTextBearingElement(el)) {
			result.push(el);
		}
		if (el.type === 'group' && el.children) {
			result.push(...collectTextBearingElements(el.children));
		}
	}
	return result;
}

/** Find a text-bearing shape by id, recursing into groups. */
function findTextBearingElementById(
	elements: PptxElement[],
	elementId: string,
): TextBearingElement | undefined {
	for (const el of elements) {
		if (isTextBearingElement(el) && el.id === elementId) {
			return el;
		}
		if (el.type === 'group' && el.children) {
			const found = findTextBearingElementById(el.children, elementId);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

/** Load an embedded nested deck's bytes into a real `PptxHandler` for full editing. */
async function loadNestedDeck(
	pptxBytes: Uint8Array,
): Promise<{ handler: PptxHandler; slides: PptxSlide[] } | undefined> {
	try {
		const handler = new PptxHandler();
		const data = await handler.load(pptxBytes.buffer.slice(0) as ArrayBuffer);
		return { handler, slides: data.slides };
	} catch {
		return undefined;
	}
}

/**
 * Read every slide's full text-element inventory from an embedded nested
 * deck: each slide's index and every text-bearing shape's id + current
 * plain text (in document order, including shapes inside groups). Returns
 * `undefined` when the bytes cannot be loaded as a presentation.
 */
export async function readOleNestedDeckDetail(
	pptxBytes: Uint8Array,
): Promise<OleNestedDeckSlideDetail[] | undefined> {
	const loaded = await loadNestedDeck(pptxBytes);
	if (!loaded) {
		return undefined;
	}
	return loaded.slides.map((slide, index) => ({
		index,
		elements: collectTextBearingElements(slide.elements).map((el) => ({
			elementId: el.id,
			text: el.text ?? '',
		})),
	}));
}

/**
 * The plain text of every text-bearing shape on the nested deck's FIRST
 * slide, in document order. Used to regenerate the OLE object's preview
 * image after an edit (`ole-content-preview-raster.ts`'s
 * `renderOleDeckPreviewPng`) so the thumbnail reflects the actual current
 * content rather than a placeholder.
 */
export async function readOleNestedDeckFirstSlideTextLines(
	pptxBytes: Uint8Array,
): Promise<string[]> {
	const loaded = await loadNestedDeck(pptxBytes);
	const firstSlide = loaded?.slides[0];
	if (!firstSlide) {
		return ['Embedded presentation'];
	}
	const lines = collectTextBearingElements(firstSlide.elements)
		.map((el) => el.text?.trim())
		.filter((text): text is string => Boolean(text));
	return lines.length > 0 ? lines : ['Embedded presentation'];
}

/**
 * Replace ONE text-bearing shape's plain text (found by slide index +
 * element id, recursing into groups) and re-save the nested deck through
 * its own full `PptxHandler.save` pipeline. Clears any rich `textSegments`
 * on that shape so the plain overwrite is not immediately overridden by
 * stale styled runs, the same rule a plain-text edit anywhere else in this
 * codebase follows. Returns the original bytes unchanged when the slide
 * index is out of range or no such element exists on that slide.
 */
export async function writeOleNestedDeckElementText(
	pptxBytes: Uint8Array,
	slideIndex: number,
	elementId: string,
	text: string,
): Promise<Uint8Array> {
	try {
		const loaded = await loadNestedDeck(pptxBytes);
		const slide = loaded?.slides[slideIndex];
		const target = slide ? findTextBearingElementById(slide.elements, elementId) : undefined;
		if (!loaded || !slide || !target) {
			return pptxBytes;
		}
		target.text = text;
		target.textSegments = undefined;
		slide.isDirty = true;
		return await loaded.handler.save(loaded.slides);
	} catch {
		return pptxBytes;
	}
}
