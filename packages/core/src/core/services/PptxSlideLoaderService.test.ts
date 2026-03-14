import { describe, it, expect, vi } from "vitest";
import type { XmlObject } from "../types";
import { PptxSlideLoaderService } from "./PptxSlideLoaderService";
import type { PptxSlideLoaderParams } from "./slide-loader-types";

/**
 * Create a mock PptxSlideLoaderParams with all required callbacks stubbed.
 * Individual tests override the relevant stubs.
 */
function createMockParams(
	overrides?: Partial<PptxSlideLoaderParams>,
): PptxSlideLoaderParams {
	return {
		presentationData: {},
		parser: {
			parse: vi.fn(() => ({})),
		} as unknown as PptxSlideLoaderParams["parser"],
		zip: {
			file: vi.fn(() => null),
		} as unknown as PptxSlideLoaderParams["zip"],
		slideMap: new Map(),
		sectionBySlideId: new Map(),
		compatibilityService: {
			inspectSlideCompatibility: vi.fn(),
		} as unknown as PptxSlideLoaderParams["compatibilityService"],
		setOrderedSlidePaths: vi.fn(),
		loadSlideRelationships: vi.fn(async () => {}),
		parseSlideClrMapOverride: vi.fn(() => null),
		setCurrentSlideClrMapOverride: vi.fn(),
		findLayoutPathForSlide: vi.fn(() => undefined),
		loadThemeOverride: vi.fn(async () => undefined),
		applyThemeOverrideState: vi.fn(() => () => {}),
		getLayoutElements: vi.fn(async () => []),
		parseSlide: vi.fn(async () => []),
		extractMediaTimingMap: vi.fn(() => new Map()),
		enrichMediaElementsWithTiming: vi.fn(async () => {}),
		extractBackgroundColor: vi.fn(() => undefined),
		getLayoutBackgroundColor: vi.fn(async () => undefined),
		extractBackgroundGradient: vi.fn(() => undefined),
		getLayoutBackgroundGradient: vi.fn(async () => undefined),
		extractBackgroundImage: vi.fn(async () => undefined),
		getLayoutBackgroundImage: vi.fn(async () => undefined),
		extractSlideNotes: vi.fn(async () => ({
			notes: undefined,
			notesSegments: undefined,
		})),
		extractSlideComments: vi.fn(async () => []),
		extractModernSlideComments: vi.fn(async () => []),
		isSlideHidden: vi.fn(() => false),
		extractBackgroundShowAnimation: vi.fn(() => undefined),
		extractShowMasterShapes: vi.fn(() => undefined),
		parseSlideTransition: vi.fn(() => undefined),
		parseEditorAnimations: vi.fn(() => undefined),
		parseNativeAnimations: vi.fn(() => undefined),
		getSmartArtDataForGraphicFrame: vi.fn(async () => undefined),
		parseSlideCustomerData: vi.fn(async () => []),
		parseSlideActiveXControls: vi.fn(() => []),
		...overrides,
	} as PptxSlideLoaderParams;
}

describe("PptxSlideLoaderService", () => {
	const service = new PptxSlideLoaderService();

	// -----------------------------------------------------------------------
	// loadSlides - empty / missing presentations
	// -----------------------------------------------------------------------
	describe("loadSlides - empty presentations", () => {
		it("returns empty array when presentationData is empty", async () => {
			const params = createMockParams();
			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
			expect(params.setOrderedSlidePaths).toHaveBeenCalledWith([]);
		});

		it("returns empty array when p:presentation is undefined", async () => {
			const params = createMockParams({
				presentationData: { other: "data" },
			});
			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
		});

		it("returns empty array when p:sldIdLst is undefined", async () => {
			const params = createMockParams({
				presentationData: {
					"p:presentation": {},
				},
			});
			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
		});

		it("returns empty array when p:sldId list is empty", async () => {
			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {},
					},
				},
			});
			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - slide loading
	// -----------------------------------------------------------------------
	describe("loadSlides - single slide", () => {
		it("loads a single slide from the presentation", async () => {
			const slideXml = '<p:sld></p:sld>';
			const slideXmlParsed: XmlObject = {
				"p:sld": {
					"p:cSld": {},
				},
			};
			const relsXml =
				'<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>';
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "slides/slide1.xml",
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				if (path === "ppt/slides/slide1.xml") {
					return { async: vi.fn(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					if (xml === slideXml) return slideXmlParsed;
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId1",
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
			});

			const result = await service.loadSlides(params);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("ppt/slides/slide1.xml");
			expect(result[0].slideNumber).toBe(1);
			expect(result[0].rId).toBe("rId1");
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - ordered slide paths
	// -----------------------------------------------------------------------
	describe("loadSlides - ordered paths", () => {
		it("sets ordered slide paths matching presentation order", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: [
						{ "@_Id": "rId1", "@_Target": "slides/slide1.xml" },
						{ "@_Id": "rId2", "@_Target": "slides/slide2.xml" },
					],
				},
			};

			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				if (
					path === "ppt/slides/slide1.xml" ||
					path === "ppt/slides/slide2.xml"
				) {
					return {
						async: vi.fn(async () => "<p:sld></p:sld>"),
					};
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					return { "p:sld": {} };
				}),
			};

			const setOrderedSlidePaths = vi.fn();
			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": [
								{ "@_id": "256", "@_r:id": "rId1" },
								{ "@_id": "257", "@_r:id": "rId2" },
							],
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
				setOrderedSlidePaths,
			});

			await service.loadSlides(params);
			expect(setOrderedSlidePaths).toHaveBeenCalledWith([
				"ppt/slides/slide1.xml",
				"ppt/slides/slide2.xml",
			]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - skips slides that can't be resolved
	// -----------------------------------------------------------------------
	describe("loadSlides - missing slides", () => {
		it("skips slides with missing relationship ID", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "slides/slide1.xml",
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn(() => relsParsed),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId999", // not in rels
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
			});

			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
		});

		it("skips slides whose XML cannot be read from zip", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "slides/slide1.xml",
					},
				},
			};

			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				// Return file entry that yields null content
				if (path === "ppt/slides/slide1.xml") {
					return { async: vi.fn(async () => undefined) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId1",
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
			});

			const result = await service.loadSlides(params);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// loadSlides - restores theme override state
	// -----------------------------------------------------------------------
	describe("loadSlides - theme overrides", () => {
		it("restores theme override state after loading a slide", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "slides/slide1.xml",
					},
				},
			};
			const slideXml = "<p:sld></p:sld>";
			const slideXmlParsed: XmlObject = { "p:sld": {} };

			const restoreFn = vi.fn();
			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				if (path === "ppt/slides/slide1.xml") {
					return { async: vi.fn(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					if (xml === slideXml) return slideXmlParsed;
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId1",
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
				findLayoutPathForSlide: vi.fn(() => "ppt/slideLayouts/slideLayout1.xml"),
				loadThemeOverride: vi.fn(async () => ({
					themeColors: {},
				})),
				applyThemeOverrideState: vi.fn(() => restoreFn),
			});

			await service.loadSlides(params);
			expect(restoreFn).toHaveBeenCalled();
		});

		it("resets color map override after loading a slide", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "slides/slide1.xml",
					},
				},
			};
			const slideXml = "<p:sld></p:sld>";
			const slideXmlParsed: XmlObject = { "p:sld": {} };

			const setCurrentSlideClrMapOverride = vi.fn();
			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				if (path === "ppt/slides/slide1.xml") {
					return { async: vi.fn(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					if (xml === slideXml) return slideXmlParsed;
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId1",
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
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
	describe("loadSlides - path resolution", () => {
		it("handles absolute target paths starting with /", async () => {
			const relsXml = "rels";
			const relsParsed: XmlObject = {
				Relationships: {
					Relationship: {
						"@_Id": "rId1",
						"@_Target": "/ppt/slides/slide1.xml",
					},
				},
			};
			const slideXml = "<p:sld></p:sld>";
			const slideXmlParsed: XmlObject = { "p:sld": {} };

			const mockFile = (path: string) => {
				if (path === "ppt/_rels/presentation.xml.rels") {
					return { async: vi.fn(async () => relsXml) };
				}
				if (path === "ppt/slides/slide1.xml") {
					return { async: vi.fn(async () => slideXml) };
				}
				return null;
			};

			const mockParser = {
				parse: vi.fn((xml: string) => {
					if (xml === relsXml) return relsParsed;
					if (xml === slideXml) return slideXmlParsed;
					return {};
				}),
			};

			const params = createMockParams({
				presentationData: {
					"p:presentation": {
						"p:sldIdLst": {
							"p:sldId": {
								"@_id": "256",
								"@_r:id": "rId1",
							},
						},
					},
				},
				zip: {
					file: vi.fn(mockFile),
				} as unknown as PptxSlideLoaderParams["zip"],
				parser: mockParser as unknown as PptxSlideLoaderParams["parser"],
			});

			const result = await service.loadSlides(params);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("ppt/slides/slide1.xml");
		});
	});
});
