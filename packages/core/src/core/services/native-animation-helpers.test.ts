import { describe, it, expect } from "vitest";
import type { PptxNativeAnimation, XmlObject } from "../types";
import {
	extractSoundAction,
	extractChildMotionValues,
	extractRepeatInfo,
	extractAnimationTargetId,
	applyBuildList,
	parseBuildType,
	extractTriggerShapeId,
	ensureArray,
	isXmlObject,
} from "./native-animation-helpers";

describe("isXmlObject", () => {
	it("returns true for a plain object", () => {
		expect(isXmlObject({})).toBe(true);
	});

	it("returns true for an object with properties", () => {
		expect(isXmlObject({ foo: "bar" })).toBe(true);
	});

	it("returns false for null", () => {
		expect(isXmlObject(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isXmlObject(undefined)).toBe(false);
	});

	it("returns false for arrays", () => {
		expect(isXmlObject([])).toBe(false);
		expect(isXmlObject([1, 2])).toBe(false);
	});

	it("returns false for primitives", () => {
		expect(isXmlObject("string")).toBe(false);
		expect(isXmlObject(42)).toBe(false);
		expect(isXmlObject(true)).toBe(false);
	});
});

describe("ensureArray", () => {
	it("returns empty array for undefined", () => {
		expect(ensureArray(undefined)).toEqual([]);
	});

	it("returns empty array for null", () => {
		expect(ensureArray(null)).toEqual([]);
	});

	it("returns empty array for empty string", () => {
		expect(ensureArray("")).toEqual([]);
	});

	it("wraps a single object in an array", () => {
		const obj = { foo: "bar" };
		expect(ensureArray(obj)).toEqual([obj]);
	});

	it("returns the same array if given an array of objects", () => {
		const arr = [{ a: 1 }, { b: 2 }];
		expect(ensureArray(arr)).toEqual(arr);
	});

	it("filters out non-object entries from an array", () => {
		const arr = [{ a: 1 }, "string", 42, null, { b: 2 }];
		const result = ensureArray(arr);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ a: 1 });
		expect(result[1]).toEqual({ b: 2 });
	});

	it("returns empty array for a primitive value", () => {
		expect(ensureArray(42)).toEqual([]);
		expect(ensureArray(true)).toEqual([]);
	});
});

describe("extractSoundAction", () => {
	it("returns empty object when no sound elements", () => {
		expect(extractSoundAction({})).toEqual({});
	});

	it("extracts soundRId from p:stSnd with @_r:embed", () => {
		const cTn: XmlObject = {
			"p:stSnd": {
				"p:snd": {
					"@_r:embed": "rId5",
				},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({ soundRId: "rId5" });
	});

	it("extracts soundRId from p:stSnd with @_embed", () => {
		const cTn: XmlObject = {
			"p:stSnd": {
				"p:snd": {
					"@_embed": "rId7",
				},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({ soundRId: "rId7" });
	});

	it("detects stop sound from p:endSnd", () => {
		const cTn: XmlObject = {
			"p:endSnd": {},
		};
		expect(extractSoundAction(cTn)).toEqual({ stopSound: true });
	});

	it("extracts soundRId from childTnLst p:stSnd", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:stSnd": {
					"p:snd": {
						"@_r:embed": "rId3",
					},
				},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({ soundRId: "rId3" });
	});

	it("detects stop sound from childTnLst p:endSnd", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:endSnd": {},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({ stopSound: true });
	});

	it("returns empty when stSnd has no snd child", () => {
		const cTn: XmlObject = {
			"p:stSnd": {},
		};
		expect(extractSoundAction(cTn)).toEqual({});
	});

	it("returns empty when snd has no embed attribute", () => {
		const cTn: XmlObject = {
			"p:stSnd": {
				"p:snd": {},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({});
	});

	it("prefers direct p:stSnd over childTnLst p:stSnd", () => {
		const cTn: XmlObject = {
			"p:stSnd": {
				"p:snd": {
					"@_r:embed": "rId1",
				},
			},
			"p:childTnLst": {
				"p:stSnd": {
					"p:snd": {
						"@_r:embed": "rId2",
					},
				},
			},
		};
		expect(extractSoundAction(cTn)).toEqual({ soundRId: "rId1" });
	});
});

describe("extractChildMotionValues", () => {
	it("returns all undefined for undefined input", () => {
		const result = extractChildMotionValues(undefined);
		expect(result.motionPath).toBeUndefined();
		expect(result.motionOrigin).toBeUndefined();
		expect(result.rotationBy).toBeUndefined();
		expect(result.scaleByX).toBeUndefined();
		expect(result.scaleByY).toBeUndefined();
	});

	it("returns all undefined for empty object", () => {
		const result = extractChildMotionValues({});
		expect(result.motionPath).toBeUndefined();
		expect(result.rotationBy).toBeUndefined();
	});

	it("extracts motion path and origin from p:animMotion", () => {
		const childTnList: XmlObject = {
			"p:animMotion": {
				"@_path": "M 0 0 L 1 1",
				"@_origin": "layout",
			},
		};
		const result = extractChildMotionValues(childTnList);
		expect(result.motionPath).toBe("M 0 0 L 1 1");
		expect(result.motionOrigin).toBe("layout");
	});

	it("extracts rotation from p:animRot", () => {
		const childTnList: XmlObject = {
			"p:animRot": {
				"@_by": "21600000", // 360 degrees
			},
		};
		const result = extractChildMotionValues(childTnList);
		expect(result.rotationBy).toBe(360);
	});

	it("extracts scale values from p:animScale", () => {
		const childTnList: XmlObject = {
			"p:animScale": {
				"p:by": {
					"@_x": "125000",
					"@_y": "150000",
				},
			},
		};
		const result = extractChildMotionValues(childTnList);
		expect(result.scaleByX).toBe(1.25);
		expect(result.scaleByY).toBe(1.5);
	});

	it("handles motion path without origin", () => {
		const childTnList: XmlObject = {
			"p:animMotion": {
				"@_path": "M 0 0 L 0.5 0.5",
			},
		};
		const result = extractChildMotionValues(childTnList);
		expect(result.motionPath).toBe("M 0 0 L 0.5 0.5");
		expect(result.motionOrigin).toBeUndefined();
	});

	it("handles p:animScale without p:by child", () => {
		const childTnList: XmlObject = {
			"p:animScale": {},
		};
		const result = extractChildMotionValues(childTnList);
		expect(result.scaleByX).toBeUndefined();
		expect(result.scaleByY).toBeUndefined();
	});
});

describe("extractRepeatInfo", () => {
	it("returns empty object when no repeat attributes", () => {
		const result = extractRepeatInfo({});
		expect(result.repeatCount).toBeUndefined();
		expect(result.autoReverse).toBeUndefined();
	});

	it("parses numeric repeat count (milliseconds/1000)", () => {
		const result = extractRepeatInfo({ "@_repeatCount": "3000" });
		expect(result.repeatCount).toBe(3);
	});

	it("parses indefinite repeat count as Infinity", () => {
		const result = extractRepeatInfo({ "@_repeatCount": "indefinite" });
		expect(result.repeatCount).toBe(Infinity);
	});

	it("detects autoReverse when @_autoRev is '1'", () => {
		const result = extractRepeatInfo({ "@_autoRev": "1" });
		expect(result.autoReverse).toBe(true);
	});

	it("detects autoReverse when @_autoRev is boolean true", () => {
		const result = extractRepeatInfo({ "@_autoRev": true });
		expect(result.autoReverse).toBe(true);
	});

	it("does not set autoReverse when @_autoRev is '0'", () => {
		const result = extractRepeatInfo({ "@_autoRev": "0" });
		expect(result.autoReverse).toBeUndefined();
	});

	it("returns both repeat count and autoReverse together", () => {
		const result = extractRepeatInfo({
			"@_repeatCount": "5000",
			"@_autoRev": "1",
		});
		expect(result.repeatCount).toBe(5);
		expect(result.autoReverse).toBe(true);
	});

	it("returns single repeat count for 1000", () => {
		const result = extractRepeatInfo({ "@_repeatCount": "1000" });
		expect(result.repeatCount).toBe(1);
	});
});

describe("extractAnimationTargetId", () => {
	it("returns undefined for empty cTn", () => {
		expect(extractAnimationTargetId({})).toBeUndefined();
	});

	it("returns undefined when childTnLst is missing", () => {
		expect(
			extractAnimationTargetId({ "@_id": "1" }),
		).toBeUndefined();
	});

	it("extracts target from p:animEffect behavior", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:animEffect": {
					"p:cBhvr": {
						"p:tgtEl": {
							"p:spTgt": {
								"@_spid": "shape10",
							},
						},
					},
				},
			},
		};
		expect(extractAnimationTargetId(cTn)).toBe("shape10");
	});

	it("extracts target from p:set behavior", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:set": {
					"p:cBhvr": {
						"p:tgtEl": {
							"p:spTgt": {
								"@_spid": "shape5",
							},
						},
					},
				},
			},
		};
		expect(extractAnimationTargetId(cTn)).toBe("shape5");
	});

	it("extracts target from nested p:par nodes (recursive)", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:par": {
					"p:cTn": {
						"p:childTnLst": {
							"p:animEffect": {
								"p:cBhvr": {
									"p:tgtEl": {
										"p:spTgt": {
											"@_spid": "nestedShape",
										},
									},
								},
							},
						},
					},
				},
			},
		};
		expect(extractAnimationTargetId(cTn)).toBe("nestedShape");
	});

	it("returns undefined when no targets exist anywhere", () => {
		const cTn: XmlObject = {
			"p:childTnLst": {
				"p:par": {
					"p:cTn": {
						"p:childTnLst": {},
					},
				},
			},
		};
		expect(extractAnimationTargetId(cTn)).toBeUndefined();
	});
});

describe("parseBuildType", () => {
	it("returns 'allAtOnce' for falsy values", () => {
		expect(parseBuildType(undefined)).toBe("allAtOnce");
		expect(parseBuildType(null)).toBe("allAtOnce");
		expect(parseBuildType("")).toBe("allAtOnce");
		expect(parseBuildType(0)).toBe("allAtOnce");
	});

	it("returns 'byParagraph' for 'p'", () => {
		expect(parseBuildType("p")).toBe("byParagraph");
	});

	it("returns 'byParagraph' for 'byParagraph'", () => {
		expect(parseBuildType("byParagraph")).toBe("byParagraph");
	});

	it("returns 'byWord' for 'word'", () => {
		expect(parseBuildType("word")).toBe("byWord");
	});

	it("returns 'byWord' for 'byWord'", () => {
		expect(parseBuildType("byWord")).toBe("byWord");
	});

	it("returns 'byChar' for 'char'", () => {
		expect(parseBuildType("char")).toBe("byChar");
	});

	it("returns 'byChar' for 'byChar'", () => {
		expect(parseBuildType("byChar")).toBe("byChar");
	});

	it("returns 'allAtOnce' for unrecognized strings", () => {
		expect(parseBuildType("unknown")).toBe("allAtOnce");
		expect(parseBuildType("sentence")).toBe("allAtOnce");
	});
});

describe("applyBuildList", () => {
	it("does nothing when timing has no p:bldLst", () => {
		const animations: PptxNativeAnimation[] = [
			{ targetId: "sp1" } as PptxNativeAnimation,
		];
		applyBuildList({}, animations);
		expect(animations[0].buildType).toBeUndefined();
	});

	it("applies build type to matching animations", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": {
					"@_spid": "sp1",
					"@_build": "p",
					"@_grpId": "0",
				},
			},
		};
		const animations: PptxNativeAnimation[] = [
			{ targetId: "sp1" } as PptxNativeAnimation,
		];
		applyBuildList(timing, animations);
		expect(animations[0].buildType).toBe("byParagraph");
		expect(animations[0].groupId).toBe("0");
	});

	it("applies build level when bldLvl is specified", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": {
					"@_spid": "sp1",
					"@_build": "p",
					"@_grpId": "1",
					"@_bldLvl": "2",
				},
			},
		};
		const animations: PptxNativeAnimation[] = [
			{ targetId: "sp1" } as PptxNativeAnimation,
		];
		applyBuildList(timing, animations);
		expect(animations[0].buildLevel).toBe(2);
	});

	it("does not modify animations that do not match by targetId", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": {
					"@_spid": "sp1",
					"@_build": "p",
				},
			},
		};
		const animations: PptxNativeAnimation[] = [
			{ targetId: "sp2" } as PptxNativeAnimation,
		];
		applyBuildList(timing, animations);
		expect(animations[0].buildType).toBeUndefined();
	});

	it("handles multiple bldP entries", () => {
		const timing: XmlObject = {
			"p:bldLst": {
				"p:bldP": [
					{ "@_spid": "sp1", "@_build": "p", "@_grpId": "0" },
					{ "@_spid": "sp2", "@_build": "word", "@_grpId": "1" },
				],
			},
		};
		const animations: PptxNativeAnimation[] = [
			{ targetId: "sp1" } as PptxNativeAnimation,
			{ targetId: "sp2" } as PptxNativeAnimation,
		];
		applyBuildList(timing, animations);
		expect(animations[0].buildType).toBe("byParagraph");
		expect(animations[1].buildType).toBe("byWord");
	});
});

describe("extractTriggerShapeId", () => {
	it("returns undefined when no stCondLst", () => {
		expect(extractTriggerShapeId({})).toBeUndefined();
	});

	it("returns undefined when conditions have no onClick event", () => {
		const cTn: XmlObject = {
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onBegin",
					"@_delay": "0",
				},
			},
		};
		expect(extractTriggerShapeId(cTn)).toBeUndefined();
	});

	it("extracts trigger shape ID from onClick condition", () => {
		const cTn: XmlObject = {
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onClick",
					"@_delay": "0",
					"p:tgtEl": {
						"p:spTgt": {
							"@_spid": "triggerShape42",
						},
					},
				},
			},
		};
		expect(extractTriggerShapeId(cTn)).toBe("triggerShape42");
	});

	it("returns undefined when onClick condition has no tgtEl", () => {
		const cTn: XmlObject = {
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onClick",
					"@_delay": "0",
				},
			},
		};
		expect(extractTriggerShapeId(cTn)).toBeUndefined();
	});

	it("handles array of conditions", () => {
		const cTn: XmlObject = {
			"p:stCondLst": {
				"p:cond": [
					{ "@_evt": "onBegin", "@_delay": "0" },
					{
						"@_evt": "onClick",
						"@_delay": "0",
						"p:tgtEl": {
							"p:spTgt": {
								"@_spid": "trigger99",
							},
						},
					},
				],
			},
		};
		expect(extractTriggerShapeId(cTn)).toBe("trigger99");
	});

	it("returns undefined when onClick has no spTgt", () => {
		const cTn: XmlObject = {
			"p:stCondLst": {
				"p:cond": {
					"@_evt": "onClick",
					"@_delay": "0",
					"p:tgtEl": {},
				},
			},
		};
		expect(extractTriggerShapeId(cTn)).toBeUndefined();
	});
});
