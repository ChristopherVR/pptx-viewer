/**
 * Spec-accurate tests for OOXML animation timing tree parsing.
 *
 * Tests the full timing tree hierarchy: p:tnLst > p:par > p:seq > p:cTn,
 * including node types, duration, fill, restart, and trigger conditions.
 *
 * Uses XML structures matching ECMA-376 §19.5 (PresentationML - Animation).
 */
import { describe, it, expect } from "vitest";
import type { XmlObject, PptxNativeAnimation } from "../types";
import {
	extractAnimationTargetId,
	extractRepeatInfo,
	extractSoundAction,
	extractTriggerShapeId,
	applyBuildList,
	parseBuildType,
	ensureArray,
	isXmlObject,
} from "./native-animation-helpers";

// ---------------------------------------------------------------------------
// Spec-accurate XML tree fixtures
// ---------------------------------------------------------------------------

/**
 * Full timing tree per ECMA-376 §19.5.87 (tnLst):
 *   p:timing > p:tnLst > p:par[tmRoot] > p:seq[mainSeq]
 *     > p:par (click group) > p:par (wrapper) > p:par (effect with presetClass)
 *       > p:set (visibility) + p:animEffect (entrance)
 */
function buildSpecTimingTree(): XmlObject {
	return {
		"p:tnLst": {
			"p:par": {
				"p:cTn": {
					"@_id": "1",
					"@_dur": "indefinite",
					"@_restart": "never",
					"@_nodeType": "tmRoot",
					"p:childTnLst": {
						"p:seq": {
							"@_concurrent": "1",
							"@_nextAc": "seek",
							"p:cTn": {
								"@_id": "2",
								"@_dur": "indefinite",
								"@_nodeType": "mainSeq",
								"p:childTnLst": {
									"p:par": {
										"p:cTn": {
											"@_id": "3",
											"@_fill": "hold",
											"p:stCondLst": {
												"p:cond": { "@_delay": "0" },
											},
											"p:childTnLst": {
												"p:par": {
													"p:cTn": {
														"@_id": "4",
														"@_fill": "hold",
														"p:stCondLst": {
															"p:cond": { "@_delay": "0" },
														},
														"p:childTnLst": {
															"p:set": {
																"p:cBhvr": {
																	"p:cTn": {
																		"@_id": "5",
																		"@_dur": "1",
																		"@_fill": "hold",
																		"p:stCondLst": {
																			"p:cond": { "@_delay": "0" },
																		},
																	},
																	"p:tgtEl": {
																		"p:spTgt": { "@_spid": "3" },
																	},
																	"p:attrNameLst": {
																		"p:attrName": "style.visibility",
																	},
																},
																"p:to": {
																	"p:strVal": { "@_val": "visible" },
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
}

// ---------------------------------------------------------------------------
// Tests: timing tree node parsing
// ---------------------------------------------------------------------------

describe("animation timing tree: extractAnimationTargetId", () => {
	it("should extract target spid from a p:set node inside p:childTnLst", () => {
		const cTn: XmlObject = {
			"@_id": "4",
			"@_fill": "hold",
			"p:childTnLst": {
				"p:set": {
					"p:cBhvr": {
						"p:cTn": { "@_id": "5", "@_dur": "1", "@_fill": "hold" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "3" },
						},
						"p:attrNameLst": {
							"p:attrName": "style.visibility",
						},
					},
					"p:to": { "p:strVal": { "@_val": "visible" } },
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("3");
	});

	it("should extract target from p:animEffect node per spec", () => {
		const cTn: XmlObject = {
			"@_id": "6",
			"@_dur": "500",
			"p:childTnLst": {
				"p:animEffect": {
					"@_transition": "in",
					"@_filter": "fade",
					"p:cBhvr": {
						"p:cTn": { "@_id": "7", "@_dur": "500" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "4" },
						},
					},
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("4");
	});

	it("should extract target from p:animMotion (motion path) per spec", () => {
		const cTn: XmlObject = {
			"@_id": "10",
			"p:childTnLst": {
				"p:animMotion": {
					"@_origin": "layout",
					"@_path": "M 0 0 L 0.5 0.5",
					"@_pathEditMode": "relative",
					"p:cBhvr": {
						"p:cTn": { "@_id": "8", "@_dur": "2000", "@_fill": "hold" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "3" },
						},
					},
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("3");
	});

	it("should extract target from p:animRot (rotation) per spec", () => {
		const cTn: XmlObject = {
			"@_id": "11",
			"p:childTnLst": {
				"p:animRot": {
					"@_by": "21600000",
					"p:cBhvr": {
						"p:cTn": { "@_id": "9", "@_dur": "2000", "@_fill": "hold" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "5" },
						},
					},
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("5");
	});

	it("should extract target from p:animScale per spec", () => {
		const cTn: XmlObject = {
			"@_id": "12",
			"p:childTnLst": {
				"p:animScale": {
					"p:cBhvr": {
						"p:cTn": { "@_id": "10", "@_dur": "2000" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "7" },
						},
					},
					"p:by": { "@_x": "150000", "@_y": "150000" },
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("7");
	});

	it("should extract target from p:anim (property animation) per spec", () => {
		const cTn: XmlObject = {
			"@_id": "13",
			"p:childTnLst": {
				"p:anim": {
					"@_to": "1.5",
					"@_calcmode": "lin",
					"@_valueType": "num",
					"p:cBhvr": {
						"@_override": "childStyle",
						"p:cTn": { "@_id": "6", "@_dur": "2000", "@_fill": "hold" },
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "3" },
						},
						"p:attrNameLst": {
							"p:attrName": "style.fontSize",
						},
					},
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("3");
	});

	it("should return undefined when childTnLst is absent", () => {
		const cTn: XmlObject = { "@_id": "1", "@_dur": "indefinite" };
		expect(extractAnimationTargetId(cTn)).toBeUndefined();
	});

	it("should recursively find target in nested p:par within childTnLst", () => {
		const cTn: XmlObject = {
			"@_id": "2",
			"p:childTnLst": {
				"p:par": {
					"p:cTn": {
						"@_id": "3",
						"p:childTnLst": {
							"p:set": {
								"p:cBhvr": {
									"p:cTn": { "@_id": "4", "@_dur": "1" },
									"p:tgtEl": {
										"p:spTgt": { "@_spid": "99" },
									},
								},
							},
						},
					},
				},
			},
		};

		expect(extractAnimationTargetId(cTn)).toBe("99");
	});
});

describe("animation timing tree: extractRepeatInfo", () => {
	it("should parse finite repeatCount from cTn (1000 = 1x)", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"@_dur": "2000",
			"@_repeatCount": "3000",
		};

		const result = extractRepeatInfo(cTn);
		expect(result.repeatCount).toBe(3);
		expect(result.autoReverse).toBeUndefined();
	});

	it("should parse indefinite repeatCount as Infinity", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"@_dur": "2000",
			"@_repeatCount": "indefinite",
		};

		const result = extractRepeatInfo(cTn);
		expect(result.repeatCount).toBe(Infinity);
	});

	it("should detect autoReverse when @_autoRev is '1'", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"@_dur": "2000",
			"@_autoRev": "1",
		};

		const result = extractRepeatInfo(cTn);
		expect(result.autoReverse).toBe(true);
	});

	it("should detect autoReverse when @_autoRev is boolean true", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"@_dur": "2000",
			"@_autoRev": true,
		};

		const result = extractRepeatInfo(cTn);
		expect(result.autoReverse).toBe(true);
	});

	it("should return no repeat info when attributes are absent", () => {
		const cTn: XmlObject = { "@_id": "5", "@_dur": "2000" };
		const result = extractRepeatInfo(cTn);
		expect(result.repeatCount).toBeUndefined();
		expect(result.autoReverse).toBeUndefined();
	});
});

describe("animation timing tree: extractSoundAction", () => {
	it("should extract soundRId from p:stSnd > p:snd per spec", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"p:stSnd": {
				"p:snd": {
					"@_r:embed": "rId3",
					"@_name": "click.wav",
				},
			},
		};

		const result = extractSoundAction(cTn);
		expect(result.soundRId).toBe("rId3");
		expect(result.stopSound).toBeUndefined();
	});

	it("should detect stop sound from p:endSnd", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"p:endSnd": {},
		};

		const result = extractSoundAction(cTn);
		expect(result.stopSound).toBe(true);
		expect(result.soundRId).toBeUndefined();
	});

	it("should extract soundRId using @_embed fallback attribute", () => {
		const cTn: XmlObject = {
			"@_id": "5",
			"p:stSnd": {
				"p:snd": {
					"@_embed": "rId8",
				},
			},
		};

		const result = extractSoundAction(cTn);
		expect(result.soundRId).toBe("rId8");
	});

	it("should return empty result when no sound action is present", () => {
		const cTn: XmlObject = { "@_id": "5" };
		const result = extractSoundAction(cTn);
		expect(result.soundRId).toBeUndefined();
		expect(result.stopSound).toBeUndefined();
	});
});

describe("animation timing tree: extractTriggerShapeId", () => {
	it("should extract trigger shape ID from onClick condition with spTgt", () => {
		const cTn: XmlObject = {
			"@_id": "2",
			"@_dur": "indefinite",
			"@_nodeType": "interactiveSeq",
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onClick",
					"@_delay": "0",
					"p:tgtEl": {
						"p:spTgt": {
							"@_spid": "42",
						},
					},
				},
			},
		};

		expect(extractTriggerShapeId(cTn)).toBe("42");
	});

	it("should return undefined when evt is not onClick", () => {
		const cTn: XmlObject = {
			"@_id": "2",
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onBegin",
					"@_delay": "0",
					"p:tgtEl": {
						"p:spTgt": { "@_spid": "10" },
					},
				},
			},
		};

		expect(extractTriggerShapeId(cTn)).toBeUndefined();
	});

	it("should return undefined when no stCondLst is present", () => {
		const cTn: XmlObject = { "@_id": "2" };
		expect(extractTriggerShapeId(cTn)).toBeUndefined();
	});

	it("should handle multiple conditions and find onClick one", () => {
		const cTn: XmlObject = {
			"@_id": "2",
			"p:stCondLst": {
				"p:cond": [
					{ "@_delay": "0" },
					{
						"@_evt": "onClick",
						"@_delay": "0",
						"p:tgtEl": {
							"p:spTgt": { "@_spid": "77" },
						},
					},
				],
			},
		};

		expect(extractTriggerShapeId(cTn)).toBe("77");
	});
});

describe("animation timing tree: applyBuildList", () => {
	it("should apply bldP build type to matching animations by spid", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": {
					"@_spid": "3",
					"@_build": "p",
					"@_grpId": "1",
				},
			},
		};

		const animations: PptxNativeAnimation[] = [
			{ targetId: "3", durationMs: 500 },
		];

		applyBuildList(timing, animations);

		expect(animations[0].buildType).toBe("byParagraph");
		expect(animations[0].groupId).toBe("1");
	});

	it("should apply bldLvl from bldP entry", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": {
					"@_spid": "5",
					"@_build": "p",
					"@_bldLvl": "2",
				},
			},
		};

		const animations: PptxNativeAnimation[] = [
			{ targetId: "5", durationMs: 300 },
		];

		applyBuildList(timing, animations);
		expect(animations[0].buildLevel).toBe(2);
	});

	it("should handle multiple bldP entries matching different animations", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": [
					{ "@_spid": "10", "@_build": "p" },
					{ "@_spid": "20", "@_build": "char" },
				],
			},
		};

		const animations: PptxNativeAnimation[] = [
			{ targetId: "10", durationMs: 500 },
			{ targetId: "20", durationMs: 600 },
		];

		applyBuildList(timing, animations);
		expect(animations[0].buildType).toBe("byParagraph");
		expect(animations[1].buildType).toBe("byChar");
	});

	it("should not modify animations when no bldLst is present", () => {
		const timing: XmlObject = {};
		const animations: PptxNativeAnimation[] = [
			{ targetId: "3", durationMs: 500 },
		];

		applyBuildList(timing, animations);
		expect(animations[0].buildType).toBeUndefined();
	});
});

describe("animation timing tree: parseBuildType", () => {
	it("should parse 'p' as byParagraph", () => {
		expect(parseBuildType("p")).toBe("byParagraph");
	});

	it("should parse 'word' as byWord", () => {
		expect(parseBuildType("word")).toBe("byWord");
	});

	it("should parse 'char' as byChar", () => {
		expect(parseBuildType("char")).toBe("byChar");
	});

	it("should default to allAtOnce for unknown values", () => {
		expect(parseBuildType("unknown")).toBe("allAtOnce");
		expect(parseBuildType(undefined)).toBe("allAtOnce");
		expect(parseBuildType("")).toBe("allAtOnce");
	});
});

describe("animation timing tree: ensureArray and isXmlObject", () => {
	it("should wrap a single XmlObject into an array", () => {
		const obj: XmlObject = { "@_id": "1" };
		const result = ensureArray(obj);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(obj);
	});

	it("should return empty array for undefined/null/falsy", () => {
		expect(ensureArray(undefined)).toEqual([]);
		expect(ensureArray(null)).toEqual([]);
		expect(ensureArray("")).toEqual([]);
	});

	it("should filter non-object entries from arrays", () => {
		const valid: XmlObject = { "@_id": "1" };
		const result = ensureArray([valid, "string", 42, null, valid]);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(valid);
		expect(result[1]).toBe(valid);
	});

	it("should correctly identify XmlObjects", () => {
		expect(isXmlObject({ "@_id": "1" })).toBe(true);
		expect(isXmlObject({})).toBe(true);
		expect(isXmlObject(null)).toBe(false);
		expect(isXmlObject([])).toBe(false);
		expect(isXmlObject("string")).toBe(false);
		expect(isXmlObject(42)).toBe(false);
	});
});
