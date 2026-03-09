import { describe, it, expect } from "vitest";
import type { PptxElementAnimation, XmlObject } from "../types";
import {
	buildEffectNodesForAnimation,
	buildBuildListXml,
	buildInteractiveSequences,
} from "./animation-write-sequence-builders";

/** Simple incrementing ID allocator for tests. */
function createIdAllocator(start = 100): () => number {
	let id = start;
	return () => id++;
}

describe("buildEffectNodesForAnimation", () => {
	it("returns empty array when no entrance/exit/emphasis/motionPath", () => {
		const anim: PptxElementAnimation = { elementId: "sp1" };
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toEqual([]);
	});

	it("returns empty array when all presets are 'none'", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			entrance: "none",
			exit: "none",
			emphasis: "none",
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toEqual([]);
	});

	it("produces one node for entrance-only animation", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			entrance: "fadeIn",
			durationMs: 500,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(1);
		const outerCTn = nodes[0]["p:cTn"] as XmlObject;
		const innerPar = (outerCTn["p:childTnLst"] as XmlObject)[
			"p:par"
		] as XmlObject;
		const effectCTn = innerPar["p:cTn"] as XmlObject;
		expect(effectCTn["@_presetClass"]).toBe("entr");
	});

	it("produces one node for exit-only animation", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			exit: "fadeOut",
			durationMs: 500,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(1);
	});

	it("produces two nodes for entrance + emphasis", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			entrance: "fadeIn",
			emphasis: "pulse",
			durationMs: 500,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(2);
	});

	it("produces three nodes for entrance + emphasis + exit", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			entrance: "fadeIn",
			emphasis: "pulse",
			exit: "fadeOut",
			durationMs: 500,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(3);
	});

	it("produces a motion path node alongside other effects", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			entrance: "fadeIn",
			motionPath: "M 0 0 L 1 1",
			durationMs: 500,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(2);
	});

	it("produces only a motion path node when no other effects", () => {
		const anim: PptxElementAnimation = {
			elementId: "sp1",
			motionPath: "M 0 0 L 1 0",
			durationMs: 1000,
		};
		const nodes = buildEffectNodesForAnimation(anim, createIdAllocator());
		expect(nodes).toHaveLength(1);
	});
});

describe("buildBuildListXml", () => {
	it("returns undefined when no animations have sequence", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1", entrance: "fadeIn" },
		];
		expect(buildBuildListXml(animations)).toBeUndefined();
	});

	it("returns undefined when all animations have asOne sequence", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1", sequence: "asOne" },
			{ elementId: "sp2", sequence: "asOne" },
		];
		expect(buildBuildListXml(animations)).toBeUndefined();
	});

	it("builds a single bldP entry for byParagraph", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1", sequence: "byParagraph" },
		];
		const result = buildBuildListXml(animations)!;
		expect(result).toBeDefined();
		const bldP = result["p:bldP"] as XmlObject;
		expect(bldP["@_spid"]).toBe("sp1");
		expect(bldP["@_build"]).toBe("p");
		expect(bldP["@_grpId"]).toBe("0");
	});

	it("builds bldP entry with 'word' type for byWord", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp2", sequence: "byWord" },
		];
		const result = buildBuildListXml(animations)!;
		const bldP = result["p:bldP"] as XmlObject;
		expect(bldP["@_build"]).toBe("word");
	});

	it("builds bldP entry with 'char' type for byLetter", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp3", sequence: "byLetter" },
		];
		const result = buildBuildListXml(animations)!;
		const bldP = result["p:bldP"] as XmlObject;
		expect(bldP["@_build"]).toBe("char");
	});

	it("returns array for multiple bldP entries", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1", sequence: "byParagraph" },
			{ elementId: "sp2", sequence: "byWord" },
		];
		const result = buildBuildListXml(animations)!;
		const bldP = result["p:bldP"] as XmlObject[];
		expect(Array.isArray(bldP)).toBe(true);
		expect(bldP).toHaveLength(2);
		expect((bldP[0] as XmlObject)["@_build"]).toBe("p");
		expect((bldP[1] as XmlObject)["@_build"]).toBe("word");
	});

	it("skips animations without a sequence property", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1" },
			{ elementId: "sp2", sequence: "byParagraph" },
		];
		const result = buildBuildListXml(animations)!;
		const bldP = result["p:bldP"] as XmlObject;
		expect(bldP["@_spid"]).toBe("sp2");
	});

	it("returns undefined for an empty animations array", () => {
		expect(buildBuildListXml([])).toBeUndefined();
	});
});

describe("buildInteractiveSequences", () => {
	it("returns empty array for empty animations list", () => {
		expect(buildInteractiveSequences([], createIdAllocator())).toEqual([]);
	});

	it("returns empty array when no animations have triggerShapeId", () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: "sp1", entrance: "fadeIn", durationMs: 500 },
		];
		expect(
			buildInteractiveSequences(animations, createIdAllocator()),
		).toEqual([]);
	});

	it("creates a single interactive sequence for one trigger shape", () => {
		const animations: PptxElementAnimation[] = [
			{
				elementId: "sp1",
				entrance: "fadeIn",
				durationMs: 500,
				triggerShapeId: "trigger1",
			},
		];
		const seqs = buildInteractiveSequences(animations, createIdAllocator());
		expect(seqs).toHaveLength(1);
		const seqCTn = seqs[0]["p:cTn"] as XmlObject;
		expect(seqCTn["@_nodeType"]).toBe("interactiveSeq");
		// Check that trigger shape is referenced in start condition
		const stCondLst = seqCTn["p:stCondLst"] as XmlObject;
		const cond = stCondLst["p:cond"] as XmlObject;
		expect(cond["@_evt"]).toBe("onClick");
		const tgtEl = cond["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("trigger1");
	});

	it("creates separate sequences for different trigger shapes", () => {
		const animations: PptxElementAnimation[] = [
			{
				elementId: "sp1",
				entrance: "fadeIn",
				durationMs: 500,
				triggerShapeId: "trigger1",
			},
			{
				elementId: "sp2",
				entrance: "fadeIn",
				durationMs: 500,
				triggerShapeId: "trigger2",
			},
		];
		const seqs = buildInteractiveSequences(animations, createIdAllocator());
		expect(seqs).toHaveLength(2);
	});

	it("groups animations with the same triggerShapeId together", () => {
		const animations: PptxElementAnimation[] = [
			{
				elementId: "sp1",
				entrance: "fadeIn",
				durationMs: 500,
				triggerShapeId: "trigger1",
			},
			{
				elementId: "sp2",
				entrance: "appear",
				durationMs: 500,
				triggerShapeId: "trigger1",
			},
		];
		const seqs = buildInteractiveSequences(animations, createIdAllocator());
		expect(seqs).toHaveLength(1);
	});

	it("includes nextCondLst with the trigger shape reference", () => {
		const animations: PptxElementAnimation[] = [
			{
				elementId: "sp1",
				entrance: "fadeIn",
				durationMs: 500,
				triggerShapeId: "trigger1",
			},
		];
		const seqs = buildInteractiveSequences(animations, createIdAllocator());
		const nextCondLst = seqs[0]["p:nextCondLst"] as XmlObject;
		expect(nextCondLst).toBeDefined();
		const cond = nextCondLst["p:cond"] as XmlObject;
		expect(cond["@_evt"]).toBe("onClick");
		const tgtEl = cond["p:tgtEl"] as XmlObject;
		const spTgt = tgtEl["p:spTgt"] as XmlObject;
		expect(spTgt["@_spid"]).toBe("trigger1");
	});
});
