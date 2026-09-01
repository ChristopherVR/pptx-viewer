/**
 * Two slide-scoped inputs the loader used to ignore:
 *
 * - a slide's OWN `themeOverride` relationship (only the layout's was ever
 *   loaded), which must apply on top of the layout's and be reverted after
 *   the slide;
 * - `p:cSld/@name`, which `PptxSlide.name` never received.
 */
import { describe, it, expect, vi } from 'vitest';

import type { XmlObject } from '../types';
import { PptxSlideLoaderService } from './PptxSlideLoaderService';
import type { PptxSlideLoaderParams } from './slide-loader-types';

const SLIDE = 'ppt/slides/slide1.xml';
const LAYOUT = 'ppt/slideLayouts/slideLayout1.xml';
const RELS_XML = 'rels';

function loaderParams(
	slideXml: XmlObject,
	overrides: Partial<PptxSlideLoaderParams>,
): PptxSlideLoaderParams {
	const noop = vi.fn<() => void>();
	return {
		presentationData: {
			'p:presentation': { 'p:sldIdLst': { 'p:sldId': { '@_id': '256', '@_r:id': 'rId1' } } },
		},
		parser: {
			parse: vi.fn((xml: string) =>
				xml === RELS_XML
					? { Relationships: { Relationship: { '@_Id': 'rId1', '@_Target': 'slides/slide1.xml' } } }
					: slideXml,
			),
		} as unknown as PptxSlideLoaderParams['parser'],
		zip: {
			file: vi.fn((path: string) =>
				path === 'ppt/_rels/presentation.xml.rels'
					? { async: async () => RELS_XML }
					: path === SLIDE
						? { async: async () => 'slide' }
						: null,
			),
		} as unknown as PptxSlideLoaderParams['zip'],
		slideMap: new Map(),
		sectionBySlideId: new Map(),
		compatibilityService: {
			inspectSlideCompatibility: noop,
			inspectSlideSynchronizationCompatibility: noop,
		} as unknown as PptxSlideLoaderParams['compatibilityService'],
		setOrderedSlidePaths: noop,
		loadSlideRelationships: vi.fn(async () => {}),
		parseSlideClrMapOverride: vi.fn(() => null),
		setCurrentSlideClrMapOverride: noop,
		findLayoutPathForSlide: vi.fn(() => LAYOUT),
		loadThemeOverride: vi.fn(async () => null),
		applyThemeOverrideState: vi.fn(() => () => {}),
		getLayoutElements: vi.fn(async () => []),
		parseSlide: vi.fn(async () => []),
		extractMediaTimingMap: vi.fn(() => new Map()),
		enrichMediaElementsWithTiming: vi.fn(async () => {}),
		enrichOleElementsWithEmbeddedData: vi.fn(async () => {}),
		extractBackgroundColor: vi.fn(() => undefined),
		getLayoutBackgroundColor: vi.fn(async () => undefined),
		extractBackgroundGradient: vi.fn(() => undefined),
		getLayoutBackgroundGradient: vi.fn(async () => undefined),
		extractBackgroundImage: vi.fn(async () => undefined),
		extractBackgroundImageProperties: vi.fn(() => undefined),
		getLayoutBackgroundImage: vi.fn(async () => undefined),
		getLayoutBackgroundImageProperties: vi.fn(async () => undefined),
		rememberSlideBackgroundOrigin: noop,
		extractSlideNotes: vi.fn(async () => ({ notes: undefined, notesSegments: undefined })),
		extractSlideComments: vi.fn(async () => []),
		extractModernSlideComments: vi.fn(async () => []),
		isSlideHidden: vi.fn(() => false),
		extractBackgroundPattern: vi.fn(() => undefined),
		extractBackgroundShadeToTitle: vi.fn(() => undefined),
		extractBackgroundShowAnimation: vi.fn(() => undefined),
		extractShowMasterShapes: vi.fn(() => undefined),
		extractShowMasterPhAnim: vi.fn(() => undefined),
		parseSlideTransition: vi.fn(() => undefined),
		parseEditorAnimations: vi.fn(() => undefined),
		parseNativeAnimations: vi.fn(() => undefined),
		getSmartArtDataForGraphicFrame: vi.fn(async () => undefined),
		parseSlideCustomerData: vi.fn(async () => []),
		parseSlideActiveXControls: vi.fn(() => []),
		...overrides,
	} as PptxSlideLoaderParams;
}

describe('slide-level a:themeOverride', () => {
	it('applies the slide override after the layout override and reverts both in reverse', async () => {
		const events: string[] = [];
		const layoutOverride = { colorOverrides: { accent1: '#111111' } };
		const slideOverride = { colorOverrides: { accent1: '#222222' } };
		const params = loaderParams(
			{ 'p:sld': { 'p:cSld': {} } },
			{
				loadThemeOverride: vi.fn(async (partPath: string) =>
					partPath === LAYOUT ? layoutOverride : partPath === SLIDE ? slideOverride : null,
				),
				applyThemeOverrideState: vi.fn((override) => {
					const label = override === slideOverride ? 'slide' : 'layout';
					events.push(`apply:${label}`);
					return () => events.push(`restore:${label}`);
				}),
				parseSlide: vi.fn(async () => {
					events.push('parse');
					return [];
				}),
			},
		);

		await new PptxSlideLoaderService().loadSlides(params);

		expect(params.loadThemeOverride).toHaveBeenCalledWith(LAYOUT);
		expect(params.loadThemeOverride).toHaveBeenCalledWith(SLIDE);
		expect(events).toStrictEqual([
			'apply:layout',
			'apply:slide',
			'parse',
			'restore:slide',
			'restore:layout',
		]);
	});

	it('applies a slide override even when the layout has none', async () => {
		const slideOverride = { colorOverrides: { accent1: '#222222' } };
		const params = loaderParams(
			{ 'p:sld': { 'p:cSld': {} } },
			{
				loadThemeOverride: vi.fn(async (partPath: string) =>
					partPath === SLIDE ? slideOverride : null,
				),
			},
		);
		await new PptxSlideLoaderService().loadSlides(params);
		expect(params.applyThemeOverrideState).toHaveBeenCalledExactlyOnceWith(slideOverride);
	});

	it('still reverts the overrides when slide parsing throws', async () => {
		const restore = vi.fn<() => void>();
		const params = loaderParams(
			{ 'p:sld': { 'p:cSld': {} } },
			{
				loadThemeOverride: vi.fn(async (partPath: string) =>
					partPath === SLIDE ? { colorOverrides: {} } : null,
				),
				applyThemeOverrideState: vi.fn(() => restore),
				parseSlide: vi.fn(async () => {
					throw new Error('boom');
				}),
			},
		);
		await expect(new PptxSlideLoaderService().loadSlides(params)).rejects.toThrow('boom');
		expect(restore).toHaveBeenCalledOnce();
	});
});

describe('p:cSld/@name', () => {
	it('loads the slide name onto PptxSlide.name', async () => {
		const params = loaderParams({ 'p:sld': { 'p:cSld': { '@_name': ' Agenda ' } } }, {});
		const [slide] = await new PptxSlideLoaderService().loadSlides(params);
		expect(slide.name).toBe('Agenda');
	});

	it('leaves name undefined for an unnamed or blank-named slide', async () => {
		const unnamed = await new PptxSlideLoaderService().loadSlides(
			loaderParams({ 'p:sld': { 'p:cSld': {} } }, {}),
		);
		expect(unnamed[0].name).toBeUndefined();
		const blank = await new PptxSlideLoaderService().loadSlides(
			loaderParams({ 'p:sld': { 'p:cSld': { '@_name': '   ' } } }, {}),
		);
		expect(blank[0].name).toBeUndefined();
	});
});
