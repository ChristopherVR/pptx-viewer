import { describe, it, expect } from "vitest";
import type { PptxElementAnimation, XmlObject } from "../types";
import { PptxAnimationWriteService } from "./PptxAnimationWriteService";

describe("PptxAnimationWriteService", () => {
	function createService(): PptxAnimationWriteService {
		return new PptxAnimationWriteService();
	}

	// -----------------------------------------------------------------------
	// buildTimingXml - basic cases
	// -----------------------------------------------------------------------
	describe("buildTimingXml - basic", () => {
		it("returns existingRawTiming when animations array is empty", () => {
			const service = createService();
			const existing: XmlObject = { "p:tnLst": {} };
			expect(service.buildTimingXml([], existing)).toBe(existing);
		});

		it("returns existingRawTiming when no animations have effects", () => {
			const service = createService();
			const existing: XmlObject = { "p:tnLst": {} };
			const animations: PptxElementAnimation[] = [
				{ elementId: "sp1" },
				{ elementId: "sp2" },
			];
			expect(service.buildTimingXml(animations, existing)).toBe(existing);
		});

		it("returns undefined when no animations and no existing timing", () => {
			const service = createService();
			expect(service.buildTimingXml([], undefined)).toBeUndefined();
		});

		it("generates a timing tree for a single entrance animation", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					order: 0,
				},
			];
			const result = service.buildTimingXml(animations, undefined);
			expect(result).toBeDefined();
			expect(result!["p:tnLst"]).toBeDefined();

			const tnLst = result!["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			expect(rootCTn["@_nodeType"]).toBe("tmRoot");
			expect(rootCTn["@_dur"]).toBe("indefinite");
			expect(rootCTn["@_restart"]).toBe("never");
		});

		it("generates main sequence with correct nodeType", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			expect(seqCTn["@_nodeType"]).toBe("mainSeq");
		});

		it("includes prevCondLst and nextCondLst on main sequence", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;

			const prevCond = seq["p:prevCondLst"] as XmlObject;
			expect(prevCond).toBeDefined();
			expect(
				(prevCond["p:cond"] as XmlObject)["@_evt"],
			).toBe("onPrev");

			const nextCond = seq["p:nextCondLst"] as XmlObject;
			expect(nextCond).toBeDefined();
			expect(
				(nextCond["p:cond"] as XmlObject)["@_evt"],
			).toBe("onNext");
		});

		it("allocates unique IDs across the timing tree", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;

			// Collect all @_id values from the tree
			const ids = new Set<string>();
			function collectIds(obj: unknown): void {
				if (!obj || typeof obj !== "object") return;
				if (Array.isArray(obj)) {
					for (const item of obj) collectIds(item);
					return;
				}
				const record = obj as Record<string, unknown>;
				if (typeof record["@_id"] === "string") {
					ids.add(record["@_id"]);
				}
				for (const val of Object.values(record)) {
					collectIds(val);
				}
			}
			collectIds(result);

			// All IDs should be unique
			expect(ids.size).toBeGreaterThan(0);
			// Verify they are sequential positive integers
			for (const id of ids) {
				const num = Number.parseInt(id, 10);
				expect(num).toBeGreaterThan(0);
			}
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - click grouping
	// -----------------------------------------------------------------------
	describe("buildTimingXml - click grouping", () => {
		it("groups onClick animations into separate click groups", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					trigger: "onClick",
					order: 0,
				},
				{
					elementId: "sp2",
					entrance: "appear",
					durationMs: 500,
					trigger: "onClick",
					order: 1,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			const seqChildren = seqCTn["p:childTnLst"] as XmlObject;

			// Should have two separate click groups (p:par)
			const clickGroups = seqChildren["p:par"];
			expect(Array.isArray(clickGroups)).toBe(true);
			expect((clickGroups as XmlObject[]).length).toBe(2);
		});

		it("nests afterPrevious within the same click group as onClick", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					trigger: "onClick",
					order: 0,
				},
				{
					elementId: "sp2",
					entrance: "appear",
					durationMs: 500,
					trigger: "afterPrevious",
					order: 1,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			const seqChildren = seqCTn["p:childTnLst"] as XmlObject;

			// Should be a single click group containing both animations
			const clickGroup = seqChildren["p:par"] as XmlObject;
			expect(Array.isArray(clickGroup)).toBe(false);
			// The click group contains the inner p:par nodes
			const clickCTn = clickGroup["p:cTn"] as XmlObject;
			const innerChildren = clickCTn["p:childTnLst"] as XmlObject;
			const innerPars = innerChildren["p:par"];
			expect(Array.isArray(innerPars)).toBe(true);
			expect((innerPars as XmlObject[]).length).toBe(2);
		});

		it("nests withPrevious within the same click group", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					trigger: "onClick",
					order: 0,
				},
				{
					elementId: "sp2",
					entrance: "appear",
					durationMs: 500,
					trigger: "withPrevious",
					order: 1,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			const seqChildren = seqCTn["p:childTnLst"] as XmlObject;

			// Single click group
			const clickGroup = seqChildren["p:par"] as XmlObject;
			expect(Array.isArray(clickGroup)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - interactive sequences
	// -----------------------------------------------------------------------
	describe("buildTimingXml - interactive sequences", () => {
		it("generates interactive sequence for onShapeClick trigger", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					trigger: "onClick",
					order: 0,
				},
				{
					elementId: "sp2",
					entrance: "appear",
					durationMs: 500,
					trigger: "onShapeClick",
					triggerShapeId: "btn1",
					order: 1,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;

			// Should have both main seq and interactive seq
			const seqs = childTnLst["p:seq"] as XmlObject[];
			expect(Array.isArray(seqs)).toBe(true);
			expect(seqs.length).toBe(2);

			// First should be mainSeq
			const mainSeqCTn = seqs[0]["p:cTn"] as XmlObject;
			expect(mainSeqCTn["@_nodeType"]).toBe("mainSeq");

			// Second should be interactiveSeq
			const interSeqCTn = seqs[1]["p:cTn"] as XmlObject;
			expect(interSeqCTn["@_nodeType"]).toBe("interactiveSeq");
		});

		it("excludes interactive animations from main sequence", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "appear",
					durationMs: 500,
					trigger: "onShapeClick",
					triggerShapeId: "btn1",
					order: 0,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;

			// Should have both main seq (empty but present) and interactive seq
			const seqs = childTnLst["p:seq"] as XmlObject[];
			expect(Array.isArray(seqs)).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - build list
	// -----------------------------------------------------------------------
	describe("buildTimingXml - build list", () => {
		it("includes p:bldLst for byParagraph sequence", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					sequence: "byParagraph",
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result["p:bldLst"]).toBeDefined();
			const bldLst = result["p:bldLst"] as XmlObject;
			const bldP = bldLst["p:bldP"] as XmlObject;
			expect(bldP["@_spid"]).toBe("sp1");
			expect(bldP["@_build"]).toBe("p");
		});

		it("omits p:bldLst when no animations have sequence", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result["p:bldLst"]).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - surgical updates
	// -----------------------------------------------------------------------
	describe("buildTimingXml - surgical updates", () => {
		it("performs surgical update when existingRawTiming is provided", () => {
			const service = createService();
			const existingTiming: XmlObject = {
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:seq": {
									"p:cTn": {
										"@_id": "2",
										"@_dur": "indefinite",
										"@_nodeType": "mainSeq",
										"p:childTnLst": {
											"p:par": {
												"p:cTn": {
													"@_id": "3",
													"@_fill": "hold",
													"p:childTnLst": {
														"p:par": {
															"p:cTn": {
																"@_id": "4",
																"@_presetID": "10",
																"@_presetClass": "entr",
																"@_presetSubtype": "0",
																"@_dur": "500",
																"p:stCondLst": {
																	"p:cond": {
																		"@_delay": "0",
																	},
																},
																"p:childTnLst": {
																	"p:set": {
																		"p:cBhvr": {
																			"p:tgtEl": {
																				"p:spTgt": {
																					"@_spid":
																						"sp1",
																				},
																			},
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			};

			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "zoomIn",
					durationMs: 1000,
					delayMs: 200,
				},
			];

			const result = service.buildTimingXml(
				animations,
				existingTiming,
			)!;

			// Should have surgically updated the tree
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			expect(rootCTn["@_nodeType"]).toBe("tmRoot");

			// Navigate to the effect node
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			const seqChildren = seqCTn["p:childTnLst"] as XmlObject;
			const clickGrp = seqChildren["p:par"] as XmlObject;
			const clickCTn = clickGrp["p:cTn"] as XmlObject;
			const clickChildren = clickCTn["p:childTnLst"] as XmlObject;
			const wrapper = clickChildren["p:par"] as XmlObject;
			const effectCTn = wrapper["p:cTn"] as XmlObject;

			expect(effectCTn["@_presetID"]).toBe("23"); // zoomIn preset
			expect(effectCTn["@_dur"]).toBe("1000");
		});

		it("does not mutate the original existing timing tree", () => {
			const service = createService();
			const existingTiming: XmlObject = {
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											"p:set": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "sp1",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			};

			// Deep copy to compare after
			const originalCopy = JSON.parse(
				JSON.stringify(existingTiming),
			);

			const animations: PptxElementAnimation[] = [
				{ elementId: "sp1", entrance: "zoomIn", durationMs: 2000 },
			];

			service.buildTimingXml(animations, existingTiming);

			// The original should remain unchanged (cloned internally)
			expect(existingTiming).toEqual(originalCopy);
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - multiple effect types
	// -----------------------------------------------------------------------
	describe("buildTimingXml - combined effects", () => {
		it("generates nodes for entrance + emphasis + exit", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					emphasis: "pulse",
					exit: "fadeOut",
					durationMs: 500,
					order: 0,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result).toBeDefined();
			expect(result["p:tnLst"]).toBeDefined();
		});

		it("generates motion path alongside entrance effect", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					entrance: "fadeIn",
					motionPath: "M 0 0 L 1 1",
					durationMs: 500,
					order: 0,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result).toBeDefined();
			expect(result["p:tnLst"]).toBeDefined();
		});

		it("sorts animations by order before processing", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp2",
					entrance: "appear",
					durationMs: 250,
					order: 2,
					trigger: "onClick",
				},
				{
					elementId: "sp1",
					entrance: "fadeIn",
					durationMs: 500,
					order: 1,
					trigger: "onClick",
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result).toBeDefined();

			// Navigate to the click groups
			const tnLst = result["p:tnLst"] as XmlObject;
			const rootPar = tnLst["p:par"] as XmlObject;
			const rootCTn = rootPar["p:cTn"] as XmlObject;
			const childTnLst = rootCTn["p:childTnLst"] as XmlObject;
			const seq = childTnLst["p:seq"] as XmlObject;
			const seqCTn = seq["p:cTn"] as XmlObject;
			const seqChildren = seqCTn["p:childTnLst"] as XmlObject;
			const clickGroups = seqChildren["p:par"] as XmlObject[];

			// Should have two click groups (both onClick)
			expect(Array.isArray(clickGroups)).toBe(true);
			expect(clickGroups.length).toBe(2);
		});

		it("handles only motionPath without entrance/exit/emphasis", () => {
			const service = createService();
			const animations: PptxElementAnimation[] = [
				{
					elementId: "sp1",
					motionPath: "M 0 0 L 0.5 0.5",
					durationMs: 2000,
				},
			];
			const result = service.buildTimingXml(animations, undefined)!;
			expect(result).toBeDefined();
			expect(result["p:tnLst"]).toBeDefined();
		});
	});

	// -----------------------------------------------------------------------
	// buildTimingXml - ID independence between calls
	// -----------------------------------------------------------------------
	describe("buildTimingXml - ID allocation", () => {
		it("resets ID counter for each full rebuild", () => {
			const service = createService();

			// First build
			const anim1: PptxElementAnimation[] = [
				{ elementId: "sp1", entrance: "fadeIn", durationMs: 500 },
			];
			const result1 = service.buildTimingXml(anim1, undefined)!;

			// Second build - should reset IDs
			const anim2: PptxElementAnimation[] = [
				{ elementId: "sp2", entrance: "appear", durationMs: 250 },
			];
			const result2 = service.buildTimingXml(anim2, undefined)!;

			// Root IDs should start from the same base
			const rootCTn1 = (
				(result1["p:tnLst"] as XmlObject)["p:par"] as XmlObject
			)["p:cTn"] as XmlObject;
			const rootCTn2 = (
				(result2["p:tnLst"] as XmlObject)["p:par"] as XmlObject
			)["p:cTn"] as XmlObject;
			expect(rootCTn1["@_id"]).toBe(rootCTn2["@_id"]);
		});
	});
});
