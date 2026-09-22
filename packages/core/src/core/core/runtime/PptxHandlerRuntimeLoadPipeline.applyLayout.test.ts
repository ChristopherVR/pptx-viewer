/**
 * `applyLayoutToSlide` background cascade, driven through the real mixin.
 *
 * The method sits at the top of the runtime chain and needs a loaded archive,
 * so the harness builds a bare prototype instance and supplies only the
 * collaborators the method reaches for (the archive, the XML parser/builder,
 * the rels and layout maps, and the three layout-background getters). The
 * getters are stubbed because their real bodies read the archive; what this
 * pins is how their results are combined onto the slide.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { PptxElement, PptxSlide, XmlObject } from '../../types';
import { rememberSlideBackgroundOrigin, slideBackgroundOrigin } from './authored-slide-background';

type Harness = {
	zip: { file: (path: string) => { async: (kind: string) => Promise<string> } | null };
	parser: { parse: (xml: string) => unknown };
	builder: { build: (xml: unknown) => string };
	slideRelsMap: Map<string, Map<string, string>>;
	layoutXmlMap: Map<string, XmlObject>;
	layoutCache: Map<string, unknown>;
	loadSlideRelationships: (path: string, rels: string) => Promise<void>;
	getLayoutBackgroundColor: (slidePath: string) => Promise<string | undefined>;
	getLayoutBackgroundGradient: (slidePath: string) => Promise<string | undefined>;
	getLayoutBackgroundImage: (slidePath: string) => Promise<string | undefined>;
	remapElementsToNewLayout: (
		elements: PptxElement[],
		layoutXml: XmlObject,
		layoutPath: string,
	) => PptxElement[];
	getElementPlaceholderInfo: (element: PptxElement) => undefined;
	getLayoutElements: (slidePath: string) => Promise<PptxElement[]>;
	applyLayoutToSlide: (
		index: number,
		layoutPath: string,
		slides: PptxSlide[],
	) => Promise<PptxSlide>;
};

const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout2.xml';
const LAYOUT_XML: XmlObject = { 'p:sldLayout': { 'p:cSld': { '@_name': 'Picture Layout' } } };

let makeHarness: (() => Harness) | undefined;

beforeAll(async () => {
	await import('../../../index');
	const { PptxHandlerRuntime } = await import('./PptxHandlerRuntimeLoadPipeline');
	makeHarness = () => {
		const harness = Object.create(PptxHandlerRuntime.prototype) as Harness;
		harness.zip = { file: () => null };
		harness.parser = { parse: () => ({}) };
		harness.builder = { build: () => '' };
		harness.slideRelsMap = new Map();
		harness.layoutXmlMap = new Map([[LAYOUT_PATH, LAYOUT_XML]]);
		harness.layoutCache = new Map();
		vi.spyOn(harness, 'loadSlideRelationships').mockImplementation(async () => undefined);
		vi.spyOn(harness, 'getLayoutBackgroundColor').mockImplementation(async () => '#112233');
		vi.spyOn(harness, 'getLayoutBackgroundGradient').mockImplementation(async () => undefined);
		vi.spyOn(harness, 'getLayoutBackgroundImage').mockImplementation(
			async () => 'data:image/png;base64,NEW',
		);
		harness.remapElementsToNewLayout = (elements) => elements;
		harness.getElementPlaceholderInfo = () => undefined;
		harness.getLayoutElements = async () => [];
		return harness;
	};
}, 120_000);

function slideOf(overrides: Partial<PptxSlide>): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

describe('applyLayoutToSlide background cascade', () => {
	it('replaces every inherited facet with the new layout chain, not only the colour', async () => {
		const harness = makeHarness!();
		const slide = slideOf({
			backgroundColor: '#FFFFFF',
			backgroundGradient: 'linear-gradient(#fff, #000)',
		});
		// Loaded with a purely inherited gradient background from the old layout.
		rememberSlideBackgroundOrigin(harness, slide.id, {
			authored: false,
			color: '#FFFFFF',
			gradient: 'linear-gradient(#fff, #000)',
		});

		const updated = await harness.applyLayoutToSlide(0, LAYOUT_PATH, [slide]);

		expect(updated.backgroundColor).toBe('#112233');
		expect(updated.backgroundGradient).toBeUndefined();
		expect(updated.backgroundImage).toBe('data:image/png;base64,NEW');
		expect(updated.layoutName).toBe('Picture Layout');
		// The baseline follows, so a save still defers to the layout.
		expect(slideBackgroundOrigin(harness, slide.id)).toStrictEqual({
			authored: false,
			color: '#112233',
			gradient: undefined,
			image: 'data:image/png;base64,NEW',
		});
		expect(harness.loadSlideRelationships).toHaveBeenCalledWith(
			LAYOUT_PATH,
			'ppt/slideLayouts/_rels/slideLayout2.xml.rels',
		);
	});

	it('keeps a background the slide authored itself', async () => {
		const harness = makeHarness!();
		const slide = slideOf({ backgroundColor: '#AA0000' });
		rememberSlideBackgroundOrigin(harness, slide.id, { authored: true, color: '#AA0000' });

		const updated = await harness.applyLayoutToSlide(0, LAYOUT_PATH, [slide]);

		expect(updated.backgroundColor).toBe('#AA0000');
		expect(updated.backgroundImage).toBeUndefined();
		expect(harness.getLayoutBackgroundColor).not.toHaveBeenCalled();
	});

	it('keeps a background the user changed since load', async () => {
		const harness = makeHarness!();
		const slide = slideOf({ backgroundColor: '#00AA00' });
		rememberSlideBackgroundOrigin(harness, slide.id, { authored: false, color: '#FFFFFF' });

		const updated = await harness.applyLayoutToSlide(0, LAYOUT_PATH, [slide]);

		expect(updated.backgroundColor).toBe('#00AA00');
		expect(harness.getLayoutBackgroundColor).not.toHaveBeenCalled();
	});

	it('registers the layout for a slide inserted during the session and inherits from it', async () => {
		const harness = makeHarness!();
		const slide = slideOf({ id: 'slide-new-1', backgroundColor: '#FFFFFF' });

		const updated = await harness.applyLayoutToSlide(0, LAYOUT_PATH, [slide]);

		expect(harness.slideRelsMap.get('slide-new-1')?.get('rId1')).toBe(
			'/ppt/slideLayouts/slideLayout2.xml',
		);
		expect(updated.backgroundColor).toBe('#112233');
		expect(updated.backgroundImage).toBe('data:image/png;base64,NEW');
		expect(updated.layoutPath).toBe(LAYOUT_PATH);
	});
});
