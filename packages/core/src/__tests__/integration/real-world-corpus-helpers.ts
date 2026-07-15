import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types/elements';
import type { PptxSlide } from '../../core/types/presentation';

/** Directory holding the real, PowerPoint-COM-authored corpus fixtures. */
export const CORPUS_DIR = path.resolve(__dirname, '../fixtures/corpus');

export const REQUIRED_CORPUS_FIXTURES = [
	'animations-transitions-multislide.pptx',
	'master-layout-inheritance-fills.pptx',
	'ole-embedded-media.pptx',
	'preset-geometry-wordart.pptx',
	'smartart-chart-table-mix.pptx',
] as const;

/** List every `.pptx` fixture under {@link CORPUS_DIR}, or `[]` if absent. */
export function listCorpusFixtures(): string[] {
	if (!existsSync(CORPUS_DIR)) {
		return [];
	}
	return readdirSync(CORPUS_DIR)
		.filter((f) => f.toLowerCase().endsWith('.pptx'))
		.sort();
}

/** Read a corpus fixture into an `ArrayBuffer` suitable for `PptxHandler.load`. */
export function readCorpusFixture(fileName: string): ArrayBuffer {
	const buf = readFileSync(path.join(CORPUS_DIR, fileName));
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Load a corpus fixture, save it straight back out, and reload the saved
 * bytes. Returns both the original and the reloaded slide data so a test can
 * diff them structurally.
 */
export async function loadSaveReload(fileName: string): Promise<{
	original: PptxSlide[];
	reloaded: PptxSlide[];
}> {
	const bytes = readCorpusFixture(fileName);
	const handler1 = new PptxHandler();
	const original = (await handler1.load(bytes)).slides;

	const saved = await handler1.save(original);
	const handler2 = new PptxHandler();
	const reloaded = (await handler2.load(saved.buffer as ArrayBuffer)).slides;

	return { original, reloaded };
}

/** Extract the plain-text content of an element, if it carries any. */
export function elementText(el: PptxElement): string | undefined {
	if ('text' in el && typeof el.text === 'string' && el.text.length > 0) {
		return el.text;
	}
	if ('textSegments' in el && Array.isArray(el.textSegments) && el.textSegments.length > 0) {
		return el.textSegments.map((seg) => seg.text).join('');
	}
	return undefined;
}

/** The `type` discriminant of every element on a slide, in document order. */
export function elementTypes(slide: PptxSlide): PptxElement['type'][] {
	return slide.elements.map((el) => el.type);
}

/** Find the first fixture-supplied slide element whose type matches. */
export function findElement(
	slides: PptxSlide[],
	type: PptxElement['type'],
): PptxElement | undefined {
	for (const slide of slides) {
		const found = slide.elements.find((el) => el.type === type);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/** Find every slide-supplied element across all slides whose type matches. */
export function findAllElements(slides: PptxSlide[], type: PptxElement['type']): PptxElement[] {
	return slides.flatMap((slide) => slide.elements.filter((el) => el.type === type));
}

/** Round-trip position/size tolerance, in px, to absorb EMU<->px rounding. */
export const GEOMETRY_TOLERANCE_PX = 1;

export function expectCloseGeometry(a: number, b: number, label: string): void {
	const delta = Math.abs(a - b);
	if (delta > GEOMETRY_TOLERANCE_PX) {
		throw new Error(`${label}: expected ${a} to be within ${GEOMETRY_TOLERANCE_PX}px of ${b}`);
	}
}
