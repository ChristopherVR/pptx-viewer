import { describe, it, expect } from "vitest";
import type { XmlObject } from "../types";
import type { IPptxXmlLookupService } from "./PptxXmlLookupService";
import {
	P14_TRANSITION_TYPES,
	parseP14FromExtLst,
	buildP14ExtLst,
} from "./p14-transition-parser";

/**
 * Minimal mock of IPptxXmlLookupService that handles namespace-prefixed keys.
 */
function createMockXmlLookupService(): IPptxXmlLookupService {
	return {
		getChildByLocalName(
			parent: XmlObject | undefined,
			localName: string,
		): XmlObject | undefined {
			if (!parent) return undefined;
			const direct = parent[localName];
			if (direct && typeof direct === "object" && !Array.isArray(direct)) {
				return direct as XmlObject;
			}
			const suffix = `:${localName}`;
			for (const key of Object.keys(parent)) {
				if (key.endsWith(suffix)) {
					const val = parent[key];
					if (val && typeof val === "object" && !Array.isArray(val)) {
						return val as XmlObject;
					}
				}
			}
			return undefined;
		},
		getChildrenArrayByLocalName(
			parent: XmlObject | undefined,
			localName: string,
		): XmlObject[] {
			if (!parent) return [];
			const direct = parent[localName];
			if (direct !== undefined) {
				if (Array.isArray(direct)) {
					return direct.filter(
						(e: unknown): e is XmlObject =>
							typeof e === "object" && e !== null && !Array.isArray(e),
					);
				}
				if (typeof direct === "object" && direct !== null) {
					return [direct as XmlObject];
				}
				return [];
			}
			const suffix = `:${localName}`;
			for (const key of Object.keys(parent)) {
				if (key.endsWith(suffix)) {
					const val = parent[key];
					if (Array.isArray(val)) {
						return val.filter(
							(e: unknown): e is XmlObject =>
								typeof e === "object" && e !== null && !Array.isArray(e),
						);
					}
					if (val && typeof val === "object") {
						return [val as XmlObject];
					}
				}
			}
			return [];
		},
		getScalarChildByLocalName(): string | undefined {
			return undefined;
		},
	};
}

/** Simple getXmlLocalName that strips namespace prefix. */
function getXmlLocalName(xmlKey: string): string {
	if (!xmlKey) return "";
	const withoutAttr = xmlKey.startsWith("@_") ? xmlKey.slice(2) : xmlKey;
	const idx = withoutAttr.lastIndexOf(":");
	return idx < 0 ? withoutAttr : withoutAttr.slice(idx + 1);
}

describe("P14_TRANSITION_TYPES", () => {
	it("contains expected transition types", () => {
		expect(P14_TRANSITION_TYPES.has("conveyor")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("doors")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("flash")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("honeycomb")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("vortex")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("ripple")).toBe(true);
		expect(P14_TRANSITION_TYPES.has("wheelReverse")).toBe(true);
	});

	it("does not contain non-p14 transition types", () => {
		expect(P14_TRANSITION_TYPES.has("fade")).toBe(false);
		expect(P14_TRANSITION_TYPES.has("push")).toBe(false);
		expect(P14_TRANSITION_TYPES.has("wipe")).toBe(false);
	});

	it("has 18 entries", () => {
		expect(P14_TRANSITION_TYPES.size).toBe(18);
	});
});

describe("parseP14FromExtLst", () => {
	const lookup = createMockXmlLookupService();

	it("returns undefined when extLst has no ext children", () => {
		const result = parseP14FromExtLst({}, lookup, getXmlLocalName);
		expect(result).toBeUndefined();
	});

	it("parses a simple p14 transition with no attributes", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:vortex": {},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.type).toBe("vortex");
		expect(result!.direction).toBeUndefined();
		expect(result!.orient).toBeUndefined();
		expect(result!.pattern).toBeUndefined();
	});

	it("parses direction attribute from p14 transition", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:pan": {
					"@_dir": "l",
				},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.type).toBe("pan");
		expect(result!.direction).toBe("l");
	});

	it("parses orient attribute from p14 transition", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:doors": {
					"@_orient": "horz",
				},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.orient).toBe("horz");
	});

	it("parses pattern attribute from p14 transition", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:glitter": {
					"@_dir": "l",
					"@_pattern": "hexagon",
				},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.type).toBe("glitter");
		expect(result!.pattern).toBe("hexagon");
	});

	it("returns undefined when ext has no recognized p14 element", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{SOME-OTHER-URI}",
				"p14:unknownTransition": {},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeUndefined();
	});

	it("skips ext entries that are attribute-only keys", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeUndefined();
	});

	it("ignores orient values that are not horz or vert", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:doors": {
					"@_orient": "diagonal",
				},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.orient).toBeUndefined();
	});

	it("handles vert orient", () => {
		const extLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:doors": {
					"@_orient": "vert",
				},
			},
		};
		const result = parseP14FromExtLst(extLst, lookup, getXmlLocalName);
		expect(result).toBeDefined();
		expect(result!.orient).toBe("vert");
	});
});

describe("buildP14ExtLst", () => {
	const lookup = createMockXmlLookupService();

	it("builds extLst with a single p14 transition element", () => {
		const result = buildP14ExtLst(
			"vortex",
			undefined,
			undefined,
			undefined,
			undefined,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		expect(ext["@_uri"]).toBe("{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}");
		expect(ext["p14:vortex"]).toBeDefined();
	});

	it("includes direction attribute in the p14 element", () => {
		const result = buildP14ExtLst(
			"pan",
			"l",
			undefined,
			undefined,
			undefined,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		const panNode = ext["p14:pan"] as XmlObject;
		expect(panNode["@_dir"]).toBe("l");
	});

	it("includes orient attribute in the p14 element", () => {
		const result = buildP14ExtLst(
			"doors",
			undefined,
			"horz",
			undefined,
			undefined,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		const doorsNode = ext["p14:doors"] as XmlObject;
		expect(doorsNode["@_orient"]).toBe("horz");
	});

	it("includes pattern attribute in the p14 element", () => {
		const result = buildP14ExtLst(
			"glitter",
			undefined,
			undefined,
			"hexagon",
			undefined,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		const glitterNode = ext["p14:glitter"] as XmlObject;
		expect(glitterNode["@_pattern"]).toBe("hexagon");
	});

	it("omits empty direction", () => {
		const result = buildP14ExtLst(
			"vortex",
			"",
			undefined,
			undefined,
			undefined,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		const vortexNode = ext["p14:vortex"] as XmlObject;
		expect(vortexNode["@_dir"]).toBeUndefined();
	});

	it("preserves non-p14 ext entries from rawExtLst", () => {
		const rawExtLst: XmlObject = {
			"p:ext": {
				"@_uri": "{OTHER-URI}",
				"mc:AlternateContent": { value: "test" },
			},
		};
		const result = buildP14ExtLst(
			"vortex",
			undefined,
			undefined,
			undefined,
			rawExtLst,
			lookup,
			getXmlLocalName,
		);
		const exts = result["p:ext"] as XmlObject[];
		expect(Array.isArray(exts)).toBe(true);
		expect(exts).toHaveLength(2);
		// First should be the new p14 transition ext
		expect(exts[0]["p14:vortex"]).toBeDefined();
		// Second should be the preserved non-p14 ext
		expect(exts[1]["mc:AlternateContent"]).toBeDefined();
	});

	it("filters out old p14 ext entries from rawExtLst", () => {
		const rawExtLst: XmlObject = {
			"p:ext": [
				{
					"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
					"p14:flash": {},
				},
				{
					"@_uri": "{OTHER-URI}",
					"mc:AlternateContent": {},
				},
			],
		};
		const result = buildP14ExtLst(
			"vortex",
			undefined,
			undefined,
			undefined,
			rawExtLst,
			lookup,
			getXmlLocalName,
		);
		const exts = result["p:ext"] as XmlObject[];
		expect(Array.isArray(exts)).toBe(true);
		expect(exts).toHaveLength(2);
		// Old p14:flash should be gone, replaced by p14:vortex
		expect(exts[0]["p14:vortex"]).toBeDefined();
		expect(exts[0]["p14:flash"]).toBeUndefined();
	});

	it("returns single ext object when rawExtLst has only p14 entries", () => {
		const rawExtLst: XmlObject = {
			"p:ext": {
				"@_uri": "{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}",
				"p14:flash": {},
			},
		};
		const result = buildP14ExtLst(
			"vortex",
			undefined,
			undefined,
			undefined,
			rawExtLst,
			lookup,
			getXmlLocalName,
		);
		const ext = result["p:ext"] as XmlObject;
		// Should be a single object (not array) since the old p14 was filtered out
		expect(ext["p14:vortex"]).toBeDefined();
	});
});
