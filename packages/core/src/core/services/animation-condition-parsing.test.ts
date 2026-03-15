import { describe, it, expect } from "vitest";
import type { AnimationCondition, XmlObject } from "../types";
import {
	parseCondition,
	parseConditionList,
	serializeCondition,
	serializeConditionList,
} from "./native-animation-helpers";
import { PptxNativeAnimationService } from "./PptxNativeAnimationService";

// ==========================================================================
// parseCondition
// ==========================================================================
describe("parseCondition", () => {
	it("parses onClick event", () => {
		const result = parseCondition({ "@_evt": "onClick", "@_delay": "0" });
		expect(result.event).toBe("onClick");
		expect(result.delay).toBe(0);
	});

	it("parses onBegin event", () => {
		const result = parseCondition({ "@_evt": "onBegin", "@_delay": "0" });
		expect(result.event).toBe("onBegin");
	});

	it("parses onEnd event", () => {
		const result = parseCondition({ "@_evt": "onEnd", "@_delay": "0" });
		expect(result.event).toBe("onEnd");
	});

	it("parses begin event", () => {
		const result = parseCondition({ "@_evt": "begin", "@_delay": "0" });
		expect(result.event).toBe("begin");
	});

	it("parses end event", () => {
		const result = parseCondition({ "@_evt": "end", "@_delay": "0" });
		expect(result.event).toBe("end");
	});

	it("parses onMouseOver event", () => {
		const result = parseCondition({
			"@_evt": "onMouseOver",
			"@_delay": "0",
		});
		expect(result.event).toBe("onMouseOver");
	});

	it("parses onMouseOut event", () => {
		const result = parseCondition({
			"@_evt": "onMouseOut",
			"@_delay": "0",
		});
		expect(result.event).toBe("onMouseOut");
	});

	it("parses onNext event", () => {
		const result = parseCondition({ "@_evt": "onNext", "@_delay": "0" });
		expect(result.event).toBe("onNext");
	});

	it("parses onPrev event", () => {
		const result = parseCondition({ "@_evt": "onPrev", "@_delay": "0" });
		expect(result.event).toBe("onPrev");
	});

	it("parses onStopAudio event", () => {
		const result = parseCondition({
			"@_evt": "onStopAudio",
			"@_delay": "0",
		});
		expect(result.event).toBe("onStopAudio");
	});

	it("ignores invalid event values", () => {
		const result = parseCondition({
			"@_evt": "invalidEvent",
			"@_delay": "0",
		});
		expect(result.event).toBeUndefined();
		expect(result.delay).toBe(0);
	});

	it("parses indefinite delay as -1", () => {
		const result = parseCondition({ "@_delay": "indefinite" });
		expect(result.delay).toBe(-1);
	});

	it("parses numeric delay", () => {
		const result = parseCondition({ "@_delay": "2000" });
		expect(result.delay).toBe(2000);
	});

	it("parses zero delay", () => {
		const result = parseCondition({ "@_delay": "0" });
		expect(result.delay).toBe(0);
	});

	it("parses target time node ID from @_tn", () => {
		const result = parseCondition({ "@_delay": "0", "@_tn": "5" });
		expect(result.targetTimeNodeId).toBe(5);
	});

	it("ignores non-numeric @_tn", () => {
		const result = parseCondition({ "@_delay": "0", "@_tn": "abc" });
		expect(result.targetTimeNodeId).toBeUndefined();
	});

	it("parses target shape ID from p:tgtEl/p:spTgt", () => {
		const result = parseCondition({
			"@_evt": "onClick",
			"@_delay": "0",
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": "shape42",
				},
			},
		});
		expect(result.event).toBe("onClick");
		expect(result.targetShapeId).toBe("shape42");
	});

	it("parses slide target from p:tgtEl/p:sldTgt", () => {
		const result = parseCondition({
			"@_evt": "onNext",
			"@_delay": "0",
			"p:tgtEl": {
				"p:sldTgt": {},
			},
		});
		expect(result.event).toBe("onNext");
		expect(result.targetSlide).toBe(true);
	});

	it("returns empty condition for empty XML object", () => {
		const result = parseCondition({});
		expect(result.event).toBeUndefined();
		expect(result.delay).toBeUndefined();
		expect(result.targetTimeNodeId).toBeUndefined();
		expect(result.targetShapeId).toBeUndefined();
		expect(result.targetSlide).toBeUndefined();
	});

	it("parses condition with all fields", () => {
		const result = parseCondition({
			"@_evt": "onClick",
			"@_delay": "500",
			"@_tn": "3",
			"p:tgtEl": {
				"p:spTgt": {
					"@_spid": "shape10",
				},
			},
		});
		expect(result.event).toBe("onClick");
		expect(result.delay).toBe(500);
		expect(result.targetTimeNodeId).toBe(3);
		expect(result.targetShapeId).toBe("shape10");
	});
});

// ==========================================================================
// parseConditionList
// ==========================================================================
describe("parseConditionList", () => {
	it("returns undefined for undefined input", () => {
		expect(parseConditionList(undefined)).toBeUndefined();
	});

	it("returns undefined for empty object", () => {
		expect(parseConditionList({})).toBeUndefined();
	});

	it("parses a single condition", () => {
		const result = parseConditionList({
			"p:cond": { "@_evt": "onClick", "@_delay": "0" },
		});
		expect(result).toBeDefined();
		expect(result).toHaveLength(1);
		expect(result![0].event).toBe("onClick");
		expect(result![0].delay).toBe(0);
	});

	it("parses multiple conditions", () => {
		const result = parseConditionList({
			"p:cond": [
				{ "@_evt": "onBegin", "@_delay": "0" },
				{ "@_evt": "onClick", "@_delay": "500" },
				{
					"@_evt": "onMouseOver",
					"@_delay": "0",
					"p:tgtEl": {
						"p:spTgt": { "@_spid": "shape1" },
					},
				},
			],
		});
		expect(result).toBeDefined();
		expect(result).toHaveLength(3);
		expect(result![0].event).toBe("onBegin");
		expect(result![1].event).toBe("onClick");
		expect(result![1].delay).toBe(500);
		expect(result![2].event).toBe("onMouseOver");
		expect(result![2].targetShapeId).toBe("shape1");
	});

	it("returns undefined when p:cond has no valid entries", () => {
		expect(parseConditionList({ "p:cond": "invalidString" })).toBeUndefined();
	});
});

// ==========================================================================
// serializeCondition
// ==========================================================================
describe("serializeCondition", () => {
	it("serializes event", () => {
		const result = serializeCondition({ event: "onClick" });
		expect(result["@_evt"]).toBe("onClick");
	});

	it("serializes delay", () => {
		const result = serializeCondition({ delay: 500 });
		expect(result["@_delay"]).toBe("500");
	});

	it("serializes indefinite delay (-1)", () => {
		const result = serializeCondition({ delay: -1 });
		expect(result["@_delay"]).toBe("indefinite");
	});

	it("serializes zero delay", () => {
		const result = serializeCondition({ delay: 0 });
		expect(result["@_delay"]).toBe("0");
	});

	it("serializes target time node ID", () => {
		const result = serializeCondition({ targetTimeNodeId: 5 });
		expect(result["@_tn"]).toBe("5");
	});

	it("serializes target shape ID", () => {
		const result = serializeCondition({
			event: "onClick",
			targetShapeId: "shape42",
		});
		expect(result["@_evt"]).toBe("onClick");
		const tgtEl = result["p:tgtEl"] as XmlObject;
		expect(tgtEl).toBeDefined();
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("shape42");
	});

	it("serializes slide target", () => {
		const result = serializeCondition({
			event: "onNext",
			delay: 0,
			targetSlide: true,
		});
		expect(result["@_evt"]).toBe("onNext");
		const tgtEl = result["p:tgtEl"] as XmlObject;
		expect(tgtEl["p:sldTgt"]).toBeDefined();
	});

	it("does not include p:tgtEl when no target specified", () => {
		const result = serializeCondition({ event: "onBegin", delay: 0 });
		expect(result["p:tgtEl"]).toBeUndefined();
	});

	it("serializes empty condition to empty object", () => {
		const result = serializeCondition({});
		expect(Object.keys(result)).toHaveLength(0);
	});

	it("serializes condition with all fields", () => {
		const result = serializeCondition({
			event: "onClick",
			delay: 500,
			targetTimeNodeId: 3,
			targetShapeId: "shape10",
		});
		expect(result["@_evt"]).toBe("onClick");
		expect(result["@_delay"]).toBe("500");
		expect(result["@_tn"]).toBe("3");
		const tgtEl = result["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("shape10");
	});
});

// ==========================================================================
// serializeConditionList
// ==========================================================================
describe("serializeConditionList", () => {
	it("returns undefined for undefined input", () => {
		expect(serializeConditionList(undefined)).toBeUndefined();
	});

	it("returns undefined for empty array", () => {
		expect(serializeConditionList([])).toBeUndefined();
	});

	it("serializes a single condition as an object (not array)", () => {
		const result = serializeConditionList([
			{ event: "onClick", delay: 0 },
		]);
		expect(result).toBeDefined();
		const cond = result!["p:cond"] as XmlObject;
		expect(Array.isArray(cond)).toBe(false);
		expect(cond["@_evt"]).toBe("onClick");
		expect(cond["@_delay"]).toBe("0");
	});

	it("serializes multiple conditions as an array", () => {
		const result = serializeConditionList([
			{ event: "onBegin", delay: 0 },
			{ event: "onClick", delay: 500 },
		]);
		expect(result).toBeDefined();
		const conds = result!["p:cond"] as XmlObject[];
		expect(Array.isArray(conds)).toBe(true);
		expect(conds).toHaveLength(2);
		expect(conds[0]["@_evt"]).toBe("onBegin");
		expect(conds[1]["@_evt"]).toBe("onClick");
	});
});

// ==========================================================================
// Round-trip: parse → serialize → parse
// ==========================================================================
describe("condition round-trip", () => {
	it("round-trips a simple onClick condition", () => {
		const original: XmlObject = {
			"p:cond": { "@_evt": "onClick", "@_delay": "0" },
		};
		const parsed = parseConditionList(original);
		expect(parsed).toBeDefined();
		const serialized = serializeConditionList(parsed);
		expect(serialized).toBeDefined();
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});

	it("round-trips a condition with target shape", () => {
		const original: XmlObject = {
			"p:cond": {
				"@_evt": "onClick",
				"@_delay": "0",
				"p:tgtEl": {
					"p:spTgt": { "@_spid": "shape5" },
				},
			},
		};
		const parsed = parseConditionList(original);
		const serialized = serializeConditionList(parsed);
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});

	it("round-trips a condition with slide target", () => {
		const original: XmlObject = {
			"p:cond": {
				"@_evt": "onNext",
				"@_delay": "0",
				"p:tgtEl": {
					"p:sldTgt": {},
				},
			},
		};
		const parsed = parseConditionList(original);
		const serialized = serializeConditionList(parsed);
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});

	it("round-trips multiple conditions", () => {
		const original: XmlObject = {
			"p:cond": [
				{ "@_evt": "onBegin", "@_delay": "0" },
				{
					"@_evt": "onClick",
					"@_delay": "500",
					"p:tgtEl": {
						"p:spTgt": { "@_spid": "btn1" },
					},
				},
				{
					"@_evt": "onNext",
					"@_delay": "0",
					"p:tgtEl": {
						"p:sldTgt": {},
					},
				},
			],
		};
		const parsed = parseConditionList(original);
		const serialized = serializeConditionList(parsed);
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});

	it("round-trips indefinite delay", () => {
		const original: XmlObject = {
			"p:cond": { "@_delay": "indefinite" },
		};
		const parsed = parseConditionList(original);
		expect(parsed![0].delay).toBe(-1);
		const serialized = serializeConditionList(parsed);
		expect((serialized!["p:cond"] as XmlObject)["@_delay"]).toBe(
			"indefinite",
		);
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});

	it("round-trips a condition with target time node", () => {
		const original: XmlObject = {
			"p:cond": { "@_delay": "0", "@_tn": "7" },
		};
		const parsed = parseConditionList(original);
		expect(parsed![0].targetTimeNodeId).toBe(7);
		const serialized = serializeConditionList(parsed);
		expect((serialized!["p:cond"] as XmlObject)["@_tn"]).toBe("7");
		const reparsed = parseConditionList(serialized!);
		expect(reparsed).toEqual(parsed);
	});
});

// ==========================================================================
// Integration: PptxNativeAnimationService parses structured conditions
// ==========================================================================
describe("PptxNativeAnimationService structured conditions", () => {
	const service = new PptxNativeAnimationService();

	function buildSlideXmlWithTiming(timingContent: XmlObject): XmlObject {
		return {
			"p:sld": {
				"p:timing": timingContent,
			},
		};
	}

	it("parses startConditions from stCondLst", () => {
		const slideXml = buildSlideXmlWithTiming({
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
									"p:stCondLst": {
										"p:cond": {
											"@_evt": "onMouseOver",
											"@_delay": "200",
										},
									},
									"p:childTnLst": {
										"p:animEffect": {
											"p:cBhvr": {
												"p:tgtEl": {
													"p:spTgt": {
														"@_spid": "shape1",
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
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();
		expect(result![0].startConditions).toBeDefined();
		expect(result![0].startConditions).toHaveLength(1);
		expect(result![0].startConditions![0].event).toBe("onMouseOver");
		expect(result![0].startConditions![0].delay).toBe(200);
	});

	it("parses endConditions from endCondLst", () => {
		const slideXml = buildSlideXmlWithTiming({
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
									"p:endCondLst": {
										"p:cond": {
											"@_evt": "onMouseOut",
											"@_delay": "0",
										},
									},
									"p:childTnLst": {
										"p:animEffect": {
											"p:cBhvr": {
												"p:tgtEl": {
													"p:spTgt": {
														"@_spid": "shape1",
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
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();
		expect(result![0].endConditions).toBeDefined();
		expect(result![0].endConditions).toHaveLength(1);
		expect(result![0].endConditions![0].event).toBe("onMouseOut");
		// rawEndCondLst should still be preserved for backward compatibility
		expect(result![0].rawEndCondLst).toBeDefined();
	});

	it("parses both start and end conditions together", () => {
		const slideXml = buildSlideXmlWithTiming({
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
									"p:stCondLst": {
										"p:cond": [
											{ "@_evt": "onClick", "@_delay": "0" },
											{ "@_delay": "1000" },
										],
									},
									"p:endCondLst": {
										"p:cond": {
											"@_evt": "onEnd",
											"@_delay": "0",
											"@_tn": "3",
										},
									},
									"p:childTnLst": {
										"p:animEffect": {
											"p:cBhvr": {
												"p:tgtEl": {
													"p:spTgt": {
														"@_spid": "shape1",
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
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();

		// Start conditions
		expect(result![0].startConditions).toBeDefined();
		expect(result![0].startConditions).toHaveLength(2);
		expect(result![0].startConditions![0].event).toBe("onClick");
		expect(result![0].startConditions![1].delay).toBe(1000);

		// End conditions
		expect(result![0].endConditions).toBeDefined();
		expect(result![0].endConditions).toHaveLength(1);
		expect(result![0].endConditions![0].event).toBe("onEnd");
		expect(result![0].endConditions![0].targetTimeNodeId).toBe(3);
	});

	it("does not set startConditions/endConditions when absent", () => {
		const slideXml = buildSlideXmlWithTiming({
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
										"p:animEffect": {
											"p:cBhvr": {
												"p:tgtEl": {
													"p:spTgt": {
														"@_spid": "shape1",
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
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();
		expect(result![0].startConditions).toBeUndefined();
		expect(result![0].endConditions).toBeUndefined();
		expect(result![0].rawEndCondLst).toBeUndefined();
	});

	it("parses interactive sequence conditions with shape targets", () => {
		const slideXml = buildSlideXmlWithTiming({
			"p:tnLst": {
				"p:par": {
					"p:cTn": {
						"@_id": "1",
						"@_dur": "indefinite",
						"@_restart": "never",
						"@_nodeType": "tmRoot",
						"p:childTnLst": {
							"p:seq": [
								{
									"p:cTn": {
										"@_id": "2",
										"@_dur": "indefinite",
										"@_nodeType": "mainSeq",
									},
								},
								{
									"p:cTn": {
										"@_id": "10",
										"@_dur": "indefinite",
										"@_nodeType": "interactiveSeq",
										"p:stCondLst": {
											"p:cond": {
												"@_evt": "onClick",
												"@_delay": "0",
												"p:tgtEl": {
													"p:spTgt": {
														"@_spid": "triggerBtn",
													},
												},
											},
										},
										"p:childTnLst": {
											"p:par": {
												"p:cTn": {
													"@_id": "11",
													"@_presetID": "1",
													"@_presetClass": "entr",
													"@_dur": "250",
													"p:stCondLst": {
														"p:cond": {
															"@_evt": "onBegin",
															"@_delay": "0",
														},
													},
													"p:endCondLst": {
														"p:cond": {
															"@_evt": "onClick",
															"@_delay": "0",
															"p:tgtEl": {
																"p:spTgt": {
																	"@_spid": "triggerBtn",
																},
															},
														},
													},
													"p:childTnLst": {
														"p:set": {
															"p:cBhvr": {
																"p:tgtEl": {
																	"p:spTgt": {
																		"@_spid":
																			"hiddenShape",
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
							],
						},
					},
				},
			},
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();

		const interactiveAnim = result!.find(
			(a) => a.trigger === "onShapeClick",
		);
		expect(interactiveAnim).toBeDefined();
		expect(interactiveAnim!.triggerShapeId).toBe("triggerBtn");
		expect(interactiveAnim!.startConditions).toBeDefined();
		expect(interactiveAnim!.startConditions![0].event).toBe("onBegin");
		expect(interactiveAnim!.endConditions).toBeDefined();
		expect(interactiveAnim!.endConditions![0].event).toBe("onClick");
		expect(interactiveAnim!.endConditions![0].targetShapeId).toBe(
			"triggerBtn",
		);
	});
});
