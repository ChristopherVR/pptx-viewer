import { describe, it, expect } from "vitest";
import type { PptxElementAnimation, XmlObject } from "../types";
import { PptxEditorAnimationService } from "./PptxEditorAnimationService";
import { PptxXmlLookupService } from "./PptxXmlLookupService";

const EDITOR_META_URI = "http://example.com/editorMeta";
const EDITOR_META_NS = "http://example.com/ns/pptx";

function createService(): PptxEditorAnimationService {
	return new PptxEditorAnimationService({
		xmlLookupService: new PptxXmlLookupService(),
		editorMetaExtensionUri: EDITOR_META_URI,
		editorMetaNamespaceUri: EDITOR_META_NS,
	});
}

/**
 * Build a slide XML object containing editor animation metadata.
 */
function buildSlideXmlWithAnimations(
	animationNodes: XmlObject[],
): XmlObject {
	return {
		"p:sld": {
			"p:extLst": {
				"p:ext": {
					"@_uri": EDITOR_META_URI,
					"pptx:editorMeta": {
						"pptx:animations": {
							"pptx:animation":
								animationNodes.length === 1
									? animationNodes[0]
									: animationNodes,
						},
					},
				},
			},
		},
	};
}

describe("PptxEditorAnimationService", () => {
	const service = createService();

	// -----------------------------------------------------------------------
	// parseEditorAnimations
	// -----------------------------------------------------------------------
	describe("parseEditorAnimations", () => {
		it("returns undefined when slideXml is undefined", () => {
			expect(service.parseEditorAnimations(undefined)).toBeUndefined();
		});

		it("returns undefined when slideXml has no p:sld", () => {
			expect(service.parseEditorAnimations({})).toBeUndefined();
		});

		it("returns undefined when no extLst exists", () => {
			expect(
				service.parseEditorAnimations({ "p:sld": {} }),
			).toBeUndefined();
		});

		it("returns undefined when editor extension is missing", () => {
			expect(
				service.parseEditorAnimations({
					"p:sld": {
						"p:extLst": {
							"p:ext": {
								"@_uri": "http://other/uri",
							},
						},
					},
				}),
			).toBeUndefined();
		});

		it("returns empty array when extension exists but has no animations", () => {
			const slideXml: XmlObject = {
				"p:sld": {
					"p:extLst": {
						"p:ext": {
							"@_uri": EDITOR_META_URI,
							"pptx:editorMeta": {
								"pptx:animations": {},
							},
						},
					},
				},
			};
			expect(service.parseEditorAnimations(slideXml)).toEqual([]);
		});

		it("parses a single animation with entrance preset", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_durationMs": "500",
					"@_order": "0",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].elementId).toBe("el1");
			expect(result![0].entrance).toBe("fadeIn");
			expect(result![0].durationMs).toBe(500);
			expect(result![0].order).toBe(0);
		});

		it("parses exit and emphasis presets", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_exit": "fadeOut",
					"@_emphasis": "pulse",
					"@_durationMs": "750",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].exit).toBe("fadeOut");
			expect(result![0].emphasis).toBe("pulse");
		});

		it("sets entrance/exit/emphasis to undefined when value is 'none'", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "none",
					"@_exit": "none",
					"@_emphasis": "none",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			// "none" presets are normalized to undefined
			expect(result![0].entrance).toBeUndefined();
			expect(result![0].exit).toBeUndefined();
			expect(result![0].emphasis).toBeUndefined();
		});

		it("skips animation nodes without elementId", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_entrance": "fadeIn",
					"@_durationMs": "500",
				},
				{
					"@_elementId": "el2",
					"@_entrance": "appear",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].elementId).toBe("el2");
		});

		it("skips animation nodes with empty elementId", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "  ",
					"@_entrance": "fadeIn",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(0);
		});

		it("parses trigger attribute", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_trigger": "afterPrevious",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].trigger).toBe("afterPrevious");
		});

		it("parses timing curve attribute", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_timingCurve": "ease-in",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].timingCurve).toBe("ease-in");
		});

		it("parses repeat count and mode", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_repeatCount": "3",
					"@_repeatMode": "untilNextClick",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].repeatCount).toBe(3);
			expect(result![0].repeatMode).toBe("untilNextClick");
		});

		it("parses direction attribute", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "flyIn",
					"@_direction": "fromLeft",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].direction).toBe("fromLeft");
		});

		it("parses sequence attribute", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_sequence": "byParagraph",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].sequence).toBe("byParagraph");
		});

		it("parses afterAnimation and afterAnimationColor", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_afterAnimation": "dimToColor",
					"@_afterAnimationColor": "#808080",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].afterAnimation).toBe("dimToColor");
			expect(result![0].afterAnimationColor).toBe("#808080");
		});

		it("parses motionPath attribute", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_motionPath": "M 0 0 L 1 1",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].motionPath).toBe("M 0 0 L 1 1");
		});

		it("handles invalid numeric values gracefully", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_durationMs": "notANumber",
					"@_delayMs": "invalid",
					"@_order": "abc",
					"@_repeatCount": "xyz",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].durationMs).toBeUndefined();
			expect(result![0].delayMs).toBeUndefined();
			expect(result![0].order).toBeUndefined();
			expect(result![0].repeatCount).toBeUndefined();
		});

		it("rejects negative durationMs", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_durationMs": "-100",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].durationMs).toBeUndefined();
		});

		it("allows delayMs of zero", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el1",
					"@_entrance": "fadeIn",
					"@_delayMs": "0",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result![0].delayMs).toBe(0);
		});

		it("sorts animations by order", () => {
			const slideXml = buildSlideXmlWithAnimations([
				{
					"@_elementId": "el3",
					"@_entrance": "fadeIn",
					"@_order": "3",
				},
				{
					"@_elementId": "el1",
					"@_entrance": "appear",
					"@_order": "1",
				},
				{
					"@_elementId": "el2",
					"@_entrance": "zoomIn",
					"@_order": "2",
				},
			]);
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(3);
			expect(result![0].elementId).toBe("el1");
			expect(result![1].elementId).toBe("el2");
			expect(result![2].elementId).toBe("el3");
		});

		it("handles multiple ext entries and finds the correct one", () => {
			const slideXml: XmlObject = {
				"p:sld": {
					"p:extLst": {
						"p:ext": [
							{
								"@_uri": "http://other/uri",
								"other:data": {},
							},
							{
								"@_uri": EDITOR_META_URI,
								"pptx:editorMeta": {
									"pptx:animations": {
										"pptx:animation": {
											"@_elementId": "found",
											"@_entrance": "fadeIn",
										},
									},
								},
							},
						],
					},
				},
			};
			const result = service.parseEditorAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].elementId).toBe("found");
		});
	});

	// -----------------------------------------------------------------------
	// applyEditorAnimations
	// -----------------------------------------------------------------------

	/**
	 * Helper to navigate the written extension structure and extract
	 * the first animation node from the output.
	 */
	function getWrittenAnimationNode(
		slideNode: XmlObject,
	): XmlObject | undefined {
		const extLst = slideNode["p:extLst"] as XmlObject | undefined;
		if (!extLst) return undefined;
		const exts = extLst["p:ext"] as XmlObject[];
		const editorExt = exts.find(
			(e) => e["@_uri"] === EDITOR_META_URI,
		);
		if (!editorExt) return undefined;
		const meta = editorExt["pptx:editorMeta"] as XmlObject;
		const anims = meta["pptx:animations"] as XmlObject;
		const animData = anims["pptx:animation"];
		if (Array.isArray(animData)) return animData[0] as XmlObject;
		return animData as XmlObject;
	}

	function getWrittenAnimationNodes(
		slideNode: XmlObject,
	): XmlObject[] {
		const extLst = slideNode["p:extLst"] as XmlObject | undefined;
		if (!extLst) return [];
		const exts = extLst["p:ext"] as XmlObject[];
		const editorExt = exts.find(
			(e) => e["@_uri"] === EDITOR_META_URI,
		);
		if (!editorExt) return [];
		const meta = editorExt["pptx:editorMeta"] as XmlObject;
		const anims = meta["pptx:animations"] as XmlObject;
		const animData = anims["pptx:animation"];
		if (Array.isArray(animData)) return animData as XmlObject[];
		return [animData as XmlObject];
	}

	describe("applyEditorAnimations", () => {
		it("creates extension list with animations", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "fadeIn",
					durationMs: 500,
					order: 0,
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			expect(slideNode["p:extLst"]).toBeDefined();
			const extLst = slideNode["p:extLst"] as XmlObject;
			const exts = extLst["p:ext"] as XmlObject[];
			expect(Array.isArray(exts)).toBe(true);
			const editorExt = exts.find(
				(e) => e["@_uri"] === EDITOR_META_URI,
			);
			expect(editorExt).toBeDefined();
		});

		it("sets namespace attribute on slide node", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "fadeIn",
				},
			];
			service.applyEditorAnimations(slideNode, animations);
			expect(slideNode["@_xmlns:pptx"]).toBe(EDITOR_META_NS);
		});

		it("serializes animation attributes correctly", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "fadeIn",
					exit: "fadeOut",
					emphasis: "pulse",
					durationMs: 750,
					delayMs: 200,
					order: 1,
					trigger: "afterPrevious",
					timingCurve: "ease-in",
					repeatCount: 3,
					repeatMode: "untilNextClick",
					direction: "fromLeft",
					sequence: "byParagraph",
					afterAnimation: "dimToColor",
					afterAnimationColor: "#808080",
					motionPath: "M 0 0 L 1 1",
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_elementId"]).toBe("el1");
			expect(animNode["@_entrance"]).toBe("fadeIn");
			expect(animNode["@_exit"]).toBe("fadeOut");
			expect(animNode["@_emphasis"]).toBe("pulse");
			expect(animNode["@_durationMs"]).toBe("750");
			expect(animNode["@_delayMs"]).toBe("200");
			expect(animNode["@_order"]).toBe("1");
			expect(animNode["@_trigger"]).toBe("afterPrevious");
			expect(animNode["@_timingCurve"]).toBe("ease-in");
			expect(animNode["@_repeatCount"]).toBe("3");
			expect(animNode["@_repeatMode"]).toBe("untilNextClick");
			expect(animNode["@_direction"]).toBe("fromLeft");
			expect(animNode["@_sequence"]).toBe("byParagraph");
			expect(animNode["@_afterAnimation"]).toBe("dimToColor");
			expect(animNode["@_afterAnimationColor"]).toBe("#808080");
			expect(animNode["@_motionPath"]).toBe("M 0 0 L 1 1");
		});

		it("removes extension list when no valid animations remain", () => {
			const slideNode: XmlObject = {
				"p:extLst": {
					"p:ext": {
						"@_uri": EDITOR_META_URI,
						"pptx:editorMeta": {},
					},
				},
			};
			// No entrance, exit, emphasis, or motionPath => invalid
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
				},
			];
			service.applyEditorAnimations(slideNode, animations);
			expect(slideNode["p:extLst"]).toBeUndefined();
		});

		it("retains other extensions when removing editor meta", () => {
			const slideNode: XmlObject = {
				"p:extLst": {
					"p:ext": [
						{
							"@_uri": "http://other/uri",
							"other:data": { foo: "bar" },
						},
						{
							"@_uri": EDITOR_META_URI,
							"pptx:editorMeta": {},
						},
					],
				},
			};
			service.applyEditorAnimations(slideNode, []);
			expect(slideNode["p:extLst"]).toBeDefined();
			const extLst = slideNode["p:extLst"] as XmlObject;
			const exts = extLst["p:ext"] as XmlObject[];
			expect(exts).toHaveLength(1);
			expect(exts[0]["@_uri"]).toBe("http://other/uri");
		});

		it("skips animations with empty elementId", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "",
					entrance: "fadeIn",
				},
				{
					elementId: "el2",
					entrance: "appear",
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_elementId"]).toBe("el2");
		});

		it("skips animations without any effect or motionPath", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					// No entrance, exit, emphasis, or motionPath
					durationMs: 500,
				},
			];
			service.applyEditorAnimations(slideNode, animations);
			// No valid animations => no extension
			expect(slideNode["p:extLst"]).toBeUndefined();
		});

		it("omits 'none' presets from serialized output", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "none",
					exit: "fadeOut",
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_entrance"]).toBeUndefined();
			expect(animNode["@_exit"]).toBe("fadeOut");
		});

		it("sorts output animations by order", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{ elementId: "el3", entrance: "fadeIn", order: 3 },
				{ elementId: "el1", entrance: "fadeIn", order: 1 },
				{ elementId: "el2", entrance: "fadeIn", order: 2 },
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNodes = getWrittenAnimationNodes(slideNode);
			expect(animNodes).toHaveLength(3);
			expect(animNodes[0]["@_elementId"]).toBe("el1");
			expect(animNodes[1]["@_elementId"]).toBe("el2");
			expect(animNodes[2]["@_elementId"]).toBe("el3");
		});

		it("replaces existing editor meta extension with new data", () => {
			const slideNode: XmlObject = {
				"p:extLst": {
					"p:ext": {
						"@_uri": EDITOR_META_URI,
						"pptx:editorMeta": {
							"pptx:animations": {
								"pptx:animation": {
									"@_elementId": "old",
									"@_entrance": "appear",
								},
							},
						},
					},
				},
			};
			const animations: PptxElementAnimation[] = [
				{ elementId: "new", entrance: "fadeIn" },
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_elementId"]).toBe("new");
		});

		it("rounds duration and delay to integers", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "fadeIn",
					durationMs: 500.7,
					delayMs: 100.3,
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_durationMs"]).toBe("501");
			expect(animNode["@_delayMs"]).toBe("100");
		});

		it("omits undefined optional attributes", () => {
			const slideNode: XmlObject = {};
			const animations: PptxElementAnimation[] = [
				{
					elementId: "el1",
					entrance: "fadeIn",
					// All optional attributes undefined
				},
			];
			service.applyEditorAnimations(slideNode, animations);

			const animNode = getWrittenAnimationNode(slideNode)!;
			expect(animNode).toBeDefined();
			expect(animNode["@_durationMs"]).toBeUndefined();
			expect(animNode["@_delayMs"]).toBeUndefined();
			expect(animNode["@_order"]).toBeUndefined();
			expect(animNode["@_trigger"]).toBeUndefined();
			expect(animNode["@_timingCurve"]).toBeUndefined();
			expect(animNode["@_repeatCount"]).toBeUndefined();
			expect(animNode["@_repeatMode"]).toBeUndefined();
			expect(animNode["@_direction"]).toBeUndefined();
			expect(animNode["@_sequence"]).toBeUndefined();
			expect(animNode["@_afterAnimation"]).toBeUndefined();
			expect(animNode["@_afterAnimationColor"]).toBeUndefined();
			expect(animNode["@_motionPath"]).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Round-trip: parse -> apply -> parse
	// -----------------------------------------------------------------------
	describe("round-trip", () => {
		it("round-trips a full animation through parse and apply", () => {
			const original: PptxElementAnimation = {
				elementId: "el1",
				entrance: "fadeIn",
				exit: "fadeOut",
				emphasis: "pulse",
				durationMs: 750,
				delayMs: 200,
				order: 1,
				trigger: "afterPrevious",
				timingCurve: "ease",
				direction: "fromBottom",
				sequence: "byParagraph",
				afterAnimation: "hideOnNextClick",
				motionPath: "M 0 0 L 1 1",
			};

			// Apply to XML
			const slideNode: XmlObject = {};
			service.applyEditorAnimations(slideNode, [original]);

			// Parse back from the XML
			const parsed = service.parseEditorAnimations({
				"p:sld": slideNode,
			});
			expect(parsed).toBeDefined();
			expect(parsed).toHaveLength(1);

			const result = parsed![0];
			expect(result.elementId).toBe(original.elementId);
			expect(result.entrance).toBe(original.entrance);
			expect(result.exit).toBe(original.exit);
			expect(result.emphasis).toBe(original.emphasis);
			expect(result.durationMs).toBe(original.durationMs);
			expect(result.delayMs).toBe(original.delayMs);
			expect(result.order).toBe(original.order);
			expect(result.trigger).toBe(original.trigger);
			expect(result.timingCurve).toBe(original.timingCurve);
			expect(result.direction).toBe(original.direction);
			expect(result.sequence).toBe(original.sequence);
			expect(result.afterAnimation).toBe(original.afterAnimation);
			expect(result.motionPath).toBe(original.motionPath);
		});
	});
});
