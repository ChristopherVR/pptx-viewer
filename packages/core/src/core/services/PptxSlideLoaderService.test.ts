import { describe, it, expect, vi } from 'vitest';

import type { XmlObject } from '../types';
import { PptxSlideLoaderService } from './PptxSlideLoaderService';
import type { PptxSlideLoaderParams } from './slide-loader-types';

/**
 * Create a mock PptxSlideLoaderParams with all required callbacks stubbed.
 * Individual tests override the relevant stubs.
 */
function createMockParams(overrides?: Partial<PptxSlideLoaderParams>): PptxSlideLoaderParams {
	return {
		presentationData: {},
		parser: {
			parse: vi.fn<(...args: any[]) => any>(() => ({})),
		} as unknown as PptxSlideLoaderParams['parser'],
		zip: {
			file: vi.fn<(...args: any[]) => any>(() => null),
		} as unknown as PptxSlideLoaderParams['zip'],
		slideMap: new Map(),
		sectionBySlideId: new Map(),
		compatibilityService: {
			inspectSlideCompatibility: vi.fn<() => void>(),
		} as unknown as PptxSlideLoaderParams['compatibilityService'],
		setOrderedSlidePaths: vi.fn<() => void>(),
		loadSlideRelationships: vi.fn<(...args: any[]) => any>(async () => {}),
		parseSlideClrMapOverride: vi.fn<(...args: any[]) => any>(() => null),
		setCurrentSlideClrMapOverride: vi.fn<() => void>(),
		findLayoutPathForSlide: vi.fn<(...args: any[]) => any>(() => undefined),
		loadThemeOverride: vi.fn<(...args: any[]) => any>(async () => undefined),
		applyThemeOverrideState: vi.fn<(...args: any[]) => any>(() => () => {}),
		getLayoutElements: vi.fn<(...args: any[]) => any>(async () => []),
		parseSlide: vi.fn<(...args: any[]) => any>(async () => []),
		extractMediaTimingMap: vi.fn<(...args: any[]) => any>(() => new Map()),
		enrichMediaElementsWithTiming: vi.fn<(...args: any[]) => any>(async () => {}),
		extractBackgroundColor: vi.fn<(...args: any[]) => any>(() => undefined),
		getLayoutBackgroundColor: vi.fn<(...args: any[]) => any>(async () => undefined),
		extractBackgroundGradient: vi.fn<(...args: any[]) => any>(() => undefined),
		getLayoutBackgroundGradient: vi.fn<(...args: any[]) => any>(async () => undefined),
		extractBackgroundImage: vi.fn<(...args: any[]) => any>(async () => undefined),
		getLayoutBackgroundImage: vi.fn<(...args: any[]) => any>(async () => undefined),
		extractSlideNotes: vi.fn<(...args: any[]) => any>(async () => ({
			notes: undefined,
			notesSegments: undefined,
		})),
		extractSlideComments: vi.fn<(...args: any[]) => any>(async () => []),
		extractModernSlideComments: vi.fn<(...args: any[]) => any>(async () => []),
		isSlideHidden: vi.fn<(...args: any[]) => any>(() => false),
		extractBackgroundPattern: vi.fn<(...args: any[]) => any>(() => undefined),
		extractBackgroundShadeToTitle: vi.fn<(...args: any[]) => any>(() => undefined),
		extractBackgroundShowAnimation: vi.fn<(...args: any[]) => any>(() => undefined),
		extractShowMasterShapes: vi.fn<(...args: any[]) => any>(() => undefined),
		parseSlideTransition: vi.fn<(...args: any[]) => any>(() => undefined),
		parseEditorAnimations: vi.fn<(...args: any[]) => any>(() => undefined),
		parseNativeAnimations: vi.fn<(...args: any[]) => any>(() => undefined),
		getSmartArtDataForGraphicFrame: vi.fn<(...args: any[]) => any>(async () => undefined),
		parseSlideCustomerData: vi.fn<(...args: any[]) => any>(async () => []),
		parseSlideActiveXControls: vi.fn<(...args: any[]) => any>(() => []),
		...overrides,
	} as PptxSlideLoaderParams;
}

describe('pptxSlideLoaderService', () => {
	const service = new PptxSlideLoaderService();

	// -----------------------------------------------------------------------
	// loadSlides - empty / missing presentations
	// -----------------------------------------------------------------------
	describe('loadSlides - empty presentations', () => {
		it('returns empty array when presentationData is empty', async () => {
			const params = createMockParams();
			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
			expect(params.setOrderedSlidePaths).toHaveBeenCalledWith([]);
		});

		it('returns empty array when p:presentation is undefined', async () => {
			const params = createMockParams({
				presentationData: { other: 'data' },
			});
			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
		});

		it('returns empty array when p:sldIdLst is undefined', async () => {
			const params = createMockParams({
				presentationData: {
					'p:presentation': {},
				},
			});
			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
		});

		it('returns empty array when p:sldId list is empty', async () => {
			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {},
					},
				},
			});
			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - slide loading
	// -----------------------------------------------------------------------
	describe('loadSlides - single slide', () => {
		it('loads a single slide from the presentation', async () => {
			const slideXml = '<p:sld></p:sld>';
			const slideXmlParsed: XmlObject = {
				'p:sld': {
					'p:cSld': {},
				},
			};
			const relsXml =
				'<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': 'slides/slide1.xml',
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				if (path === 'ppt/slides/slide1.xml') {
					return { async: vi.fn<(...args: any[]) => any>(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					if (xml === slideXml) {
						return slideXmlParsed;
					}
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId1',
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
			});

			const result = await service.loadSlides(params);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ppt/slides/slide1.xml');
			expect(result[0].slideNumber).toBe(1);
			expect(result[0].rId).toBe('rId1');
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - ordered slide paths
	// -----------------------------------------------------------------------
	describe('loadSlides - ordered paths', () => {
		it('sets ordered slide paths matching presentation order', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: [
						{ '@_Id': 'rId1', '@_Target': 'slides/slide1.xml' },
						{ '@_Id': 'rId2', '@_Target': 'slides/slide2.xml' },
					],
				},
			};

			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				if (path === 'ppt/slides/slide1.xml' || path === 'ppt/slides/slide2.xml') {
					return {
						async: vi.fn<(...args: any[]) => any>(async () => '<p:sld></p:sld>'),
					};
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					return { 'p:sld': {} };
				}),
			};

			const setOrderedSlidePaths = vi.fn<() => void>();
			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': [
								{ '@_id': '256', '@_r:id': 'rId1' },
								{ '@_id': '257', '@_r:id': 'rId2' },
							],
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
				setOrderedSlidePaths,
			});

			await service.loadSlides(params);
			expect(setOrderedSlidePaths).toHaveBeenCalledWith([
				'ppt/slides/slide1.xml',
				'ppt/slides/slide2.xml',
			]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - skips slides that can't be resolved
	// -----------------------------------------------------------------------
	describe('loadSlides - missing slides', () => {
		it('skips slides with missing relationship ID', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': 'slides/slide1.xml',
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>(() => relsParsed),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId999', // not in rels
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
			});

			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
		});

		it('skips slides whose XML cannot be read from zip', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': 'slides/slide1.xml',
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				// Return file entry that yields null content
				if (path === 'ppt/slides/slide1.xml') {
					return { async: vi.fn<(...args: any[]) => any>(async () => undefined) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId1',
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
			});

			const result = await service.loadSlides(params);
			expect(result).toStrictEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - restores theme override state
	// -----------------------------------------------------------------------
	describe('loadSlides - theme overrides', () => {
		it('restores theme override state after loading a slide', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': 'slides/slide1.xml',
					},
				},
			};
			const slideXml = '<p:sld></p:sld>';
			const slideXmlParsed: XmlObject = { 'p:sld': {} };

			const restoreFn = vi.fn<() => void>();
			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				if (path === 'ppt/slides/slide1.xml') {
					return { async: vi.fn<(...args: any[]) => any>(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					if (xml === slideXml) {
						return slideXmlParsed;
					}
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId1',
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
				findLayoutPathForSlide: vi.fn<(...args: any[]) => any>(
					() => 'ppt/slideLayouts/slideLayout1.xml',
				),
				loadThemeOverride: vi.fn<(...args: any[]) => any>(async () => ({
					themeColors: {},
				})),
				applyThemeOverrideState: vi.fn<(...args: any[]) => any>(() => restoreFn),
			});

			await service.loadSlides(params);
			expect(restoreFn).toHaveBeenCalled();
		});

		it('resets color map override after loading a slide', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': 'slides/slide1.xml',
					},
				},
			};
			const slideXml = '<p:sld></p:sld>';
			const slideXmlParsed: XmlObject = { 'p:sld': {} };

			const setCurrentSlideClrMapOverride = vi.fn<() => void>();
			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				if (path === 'ppt/slides/slide1.xml') {
					return { async: vi.fn<(...args: any[]) => any>(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					if (xml === slideXml) {
						return slideXmlParsed;
					}
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId1',
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
				setCurrentSlideClrMapOverride,
			});

			await service.loadSlides(params);
			// Should be called at least twice: once to set, once to clear (null)
			const nullCalls = setCurrentSlideClrMapOverride.mock.calls.filter(
				(call: unknown[]) => call[0] === null,
			);
			expect(nullCalls.length).toBeGreaterThanOrEqual(1);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - absolute target paths
	// -----------------------------------------------------------------------
	describe('loadSlides - path resolution', () => {
		it('handles absolute target paths starting with /', async () => {
			const relsXml = 'rels';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						'@_Id': 'rId1',
						'@_Target': '/ppt/slides/slide1.xml',
					},
				},
			};
			const slideXml = '<p:sld></p:sld>';
			const slideXmlParsed: XmlObject = { 'p:sld': {} };

			const mockFile = (path: string) => {
				if (path === 'ppt/_rels/presentation.xml.rels') {
					return { async: vi.fn<(...args: any[]) => any>(async () => relsXml) };
				}
				if (path === 'ppt/slides/slide1.xml') {
					return { async: vi.fn<(...args: any[]) => any>(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn<(...args: any[]) => any>((xml: string) => {
					if (xml === relsXml) {
						return relsParsed;
					}
					if (xml === slideXml) {
						return slideXmlParsed;
					}
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					'p:presentation': {
						'p:sldIdLst': {
							'p:sldId': {
								'@_id': '256',
								'@_r:id': 'rId1',
							},
						},
					},
				},
				zip: {
					file: vi.fn<(...args: any[]) => any>(mockFile),
				} as unknown as PptxSlideLoaderParams['zip'],
				parser: mockParser as unknown as PptxSlideLoaderParams['parser'],
			});

			const result = await service.loadSlides(params);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ppt/slides/slide1.xml');
		});
	});
});
