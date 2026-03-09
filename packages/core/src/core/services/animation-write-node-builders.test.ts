import { describe, it, expect } from "vitest";
import type { PptxElementAnimation, XmlObject } from "../types";
import {
	buildSingleEffectNode,
	buildVisibilitySet,
	buildAnimEffectNode,
	buildMotionPathNode,
} from "./animation-write-node-builders";

/** Simple incrementing ID allocator for tests. */
function createIdAllocator(start = 100): () => number {
	let id = start;
	return () => id++;
}

describe("buildVisibilitySet", () => {
	it("creates a set node with visible value when makeVisible is true", () => {
		const node = buildVisibilitySet("sp1", 500, true, createIdAllocator());
		expect(node["_type"]).toBe("set");
		const to = node["p:to"] as XmlObject;
		const strVal = to["p:strVal"] as XmlObject;
		expect(strVal["@_val"]).toBe("visible");
	});

	it("creates a set node with hidden value when makeVisible is false", () => {
		const node = buildVisibilitySet("sp1", 500, false, createIdAllocator());
		const to = node["p:to"] as XmlObject;
		const strVal = to["p:strVal"] as XmlObject;
		expect(strVal["@_val"]).toBe("hidden");
	});

	it("sets delay to 0 for visible (entrance) sets", () => {
		const node = buildVisibilitySet("sp1", 800, true, createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		const stCondLst = cTn["p:stCondLst"] as XmlObject;
		const cond = stCondLst["p:cond"] as XmlObject;
		expect(cond["@_delay"]).toBe("0");
	});

	it("sets delay to duration for hidden (exit) sets", () => {
		const node = buildVisibilitySet("sp1", 750, false, createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		const stCondLst = cTn["p:stCondLst"] as XmlObject;
		const cond = stCondLst["p:cond"] as XmlObject;
		expect(cond["@_delay"]).toBe("750");
	});

	it("targets the correct shape ID", () => {
		const node = buildVisibilitySet("shape42", 500, true, createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const tgtEl = cBhvr["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("shape42");
	});

	it("uses the allocated ID for the cTn node", () => {
		const allocator = createIdAllocator(55);
		const node = buildVisibilitySet("sp1", 500, true, allocator);
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		expect(cTn["@_id"]).toBe("55");
	});

	it("sets duration to 1 and fill to hold", () => {
		const node = buildVisibilitySet("sp1", 999, true, createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		expect(cTn["@_dur"]).toBe("1");
		expect(cTn["@_fill"]).toBe("hold");
	});

	it("includes style.visibility as the attribute name", () => {
		const node = buildVisibilitySet("sp1", 500, true, createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const attrNameLst = cBhvr["p:attrNameLst"] as XmlObject;
		expect(attrNameLst["p:attrName"]).toBe("style.visibility");
	});
});

describe("buildAnimEffectNode", () => {
	it("creates an animEffect node with transition 'in'", () => {
		const node = buildAnimEffectNode("sp1", 500, "in", createIdAllocator());
		expect(node["_type"]).toBe("animEffect");
		expect(node["@_transition"]).toBe("in");
	});

	it("creates an animEffect node with transition 'out'", () => {
		const node = buildAnimEffectNode("sp1", 500, "out", createIdAllocator());
		expect(node["@_transition"]).toBe("out");
	});

	it("sets filter to fade", () => {
		const node = buildAnimEffectNode("sp1", 500, "in", createIdAllocator());
		expect(node["@_filter"]).toBe("fade");
	});

	it("uses the correct duration in the cTn node", () => {
		const node = buildAnimEffectNode("sp1", 1200, "in", createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		expect(cTn["@_dur"]).toBe("1200");
	});

	it("targets the correct shape ID", () => {
		const node = buildAnimEffectNode("shape99", 500, "in", createIdAllocator());
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const tgtEl = cBhvr["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("shape99");
	});

	it("assigns an allocated id to the inner cTn", () => {
		const allocator = createIdAllocator(200);
		const node = buildAnimEffectNode("sp1", 500, "in", allocator);
		const cBhvr = node["p:cBhvr"] as XmlObject;
		const cTn = cBhvr["p:cTn"] as XmlObject;
		expect(cTn["@_id"]).toBe("200");
	});
});

describe("buildSingleEffectNode", () => {
	it("returns undefined for an unknown preset", () => {
		const anim: PptxElementAnimation = { elementId: "sp1" };
		const result = buildSingleEffectNode(
			anim,
			"nonexistentPreset" as any,
			"entr",
			createIdAllocator(),
		);
		expect(result).toBeUndefined();
	});

	it("creates an entrance node with visibility set and animEffect", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 600,
			entrance: "fadeIn",
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		);
		expect(node).toBeDefined();
		const outerCTn = (node as XmlObject)["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_presetClass"]).toBe("entr");
		expect(effectCTn["@_presetID"]).toBe("10"); // fadeIn preset ID
		expect(effectCTn["@_dur"]).toBe("600");
		// Should have both set and animEffect in childTnLst
		const childTnLst = effectCTn["p:childTnLst"] as XmlObject;
		expect(childTnLst["p:set"]).toBeDefined();
		expect(childTnLst["p:animEffect"]).toBeDefined();
	});

	it("creates an exit node with animEffect and visibility set", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp2",
			durationMs: 400,
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeOut",
			"exit",
			createIdAllocator(),
		);
		expect(node).toBeDefined();
		const outerCTn = (node as XmlObject)["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_presetClass"]).toBe("exit");
		const childTnLst = effectCTn["p:childTnLst"] as XmlObject;
		expect(childTnLst["p:set"]).toBeDefined();
		expect(childTnLst["p:animEffect"]).toBeDefined();
	});

	it("creates emphasis node with animRot for spin preset", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp3",
			durationMs: 1000,
		};
		const node = buildSingleEffectNode(
			anim,
			"spin",
			"emph",
			createIdAllocator(),
		);
		expect(node).toBeDefined();
		const outerCTn = (node as XmlObject)["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_presetClass"]).toBe("emph");
		const childTnLst = effectCTn["p:childTnLst"] as XmlObject;
		expect(childTnLst["p:animRot"]).toBeDefined();
		// Should NOT have p:set for emphasis
		expect(childTnLst["p:set"]).toBeUndefined();
	});

	it("applies repeat count when repeatCount > 1", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 500,
			repeatCount: 3,
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		)!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_repeatCount"]).toBe("3000");
	});

	it("sets indefinite repeat for untilNextClick mode", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 500,
			repeatMode: "untilNextClick",
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		)!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_repeatCount"]).toBe("indefinite");
		expect(effectCTn["@_restart"]).toBe("whenNotActive");
	});

	it("includes sound reference when soundRId is set", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 500,
			soundRId: "rId5",
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		)!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		const stSnd = effectCTn["p:stSnd"] as XmlObject;
		expect(stSnd).toBeDefined();
		const snd = stSnd["p:snd"] as XmlObject;
		expect(snd["@_r:embed"]).toBe("rId5");
	});

	it("includes end sound when stopSound is true", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 500,
			stopSound: true,
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		)!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["p:endSnd"]).toBeDefined();
	});

	it("applies ease-in timing curve as accel attribute", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			durationMs: 500,
			timingCurve: "ease-in",
		};
		const node = buildSingleEffectNode(
			anim,
			"fadeIn",
			"entr",
			createIdAllocator(),
		)!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_accel"]).toBe("100000");
		expect(effectCTn["@_decel"]).toBeUndefined();
	});
});

describe("buildMotionPathNode", () => {
	it("returns undefined when motionPath is not set", () => {
		const anim: PptxElementAnimation = { elementId: "sp1" };
		const result = buildMotionPathNode(anim, createIdAllocator());
		expect(result).toBeUndefined();
	});

	it("creates a motion path node with the path string", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			motionPath: "M 0 0 L 1 1",
			durationMs: 2000,
		};
		const node = buildMotionPathNode(anim, createIdAllocator())!;
		expect(node).toBeDefined();
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_presetClass"]).toBe("path");
		const motionNode = (effectCTn["p:childTnLst"] as XmlObject)[
			"p:animMotion"
		] as XmlObject;
		expect(motionNode["@_path"]).toBe("M 0 0 L 1 1");
		expect(motionNode["@_origin"]).toBe("layout");
	});

	it("uses the correct duration", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			motionPath: "M 0 0 L 1 0",
			durationMs: 3000,
		};
		const node = buildMotionPathNode(anim, createIdAllocator())!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_dur"]).toBe("3000");
	});

	it("targets the correct shape", () => {
		const anim: PptxElementAnimation = {
			elementId: "shapeABC",
			motionPath: "M 0 0 L 0.5 0.5",
		};
		const node = buildMotionPathNode(anim, createIdAllocator())!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		const motionNode = (effectCTn["p:childTnLst"] as XmlObject)[
			"p:animMotion"
		] as XmlObject;
		const cBhvr = motionNode["p:cBhvr"] as XmlObject;
		const tgtEl = cBhvr["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("shapeABC");
	});

	it("applies delay from the animation", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			motionPath: "M 0 0 L 1 0",
			delayMs: 300,
		};
		const node = buildMotionPathNode(anim, createIdAllocator())!;
		const outerCTn = node["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		const stCondLst = effectCTn["p:stCondLst"] as XmlObject;
		const cond = stCondLst["p:cond"] as XmlObject;
		expect(cond["@_delay"]).toBe("300");
	});
});
