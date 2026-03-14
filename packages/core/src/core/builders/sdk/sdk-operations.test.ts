import { describe, it, expect, beforeEach } from "vitest";

import type { PptxSlide } from "../../types/presentation";
import type { PptxData, PptxSection } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import type { TextSegment } from "../../types/text";

import {
	duplicateSlide,
	duplicateElement,
	resetCloneIdCounter,
} from "./slide-operations";

import {
	findText,
	replaceText,
	replaceTextInSlide,
} from "./text-operations";
import type { FindResult } from "./text-operations";

import {
	addSection,
	removeSection,
	reorderSections,
	getSectionForSlide,
	moveSlidesToSection,
	resetSectionIdCounter,
} from "./section-operations";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTextElement(
	id: string,
	text: string,
	segments?: TextSegment[],
): PptxElement {
	return {
		type: "text",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
		textSegments: segments ?? [{ text, style: {} }],
	} as PptxElement;
}

function makeShapeElement(
	id: string,
	text?: string,
	segments?: TextSegment[],
): PptxElement {
	const el: Record<string, unknown> = {
		type: "shape",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: "rect",
	};
	if (text !== undefined) {
		el.text = text;
		el.textSegments = segments ?? [{ text, style: {} }];
	}
	return el as PptxElement;
}

function makeGroupElement(
	id: string,
	children: PptxElement[],
): PptxElement {
	return {
		type: "group",
		id,
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		children,
	} as PptxElement;
}

function makeSlide(
	slideNumber: number,
	elements: PptxElement[],
	extra?: Partial<PptxSlide>,
): PptxSlide {
	return {
		id: `slide${slideNumber}`,
		rId: `rId${slideNumber + 1}`,
		slideNumber,
		elements,
		...extra,
	};
}

function makePptxData(
	slides: PptxSlide[],
	sections?: PptxSection[],
): PptxData {
	return {
		slides,
		width: 960,
		height: 540,
		sections,
	};
}

// ==========================================================================
// SLIDE CLONING TESTS
// ==========================================================================

describe("duplicateSlide", () => {
	beforeEach(() => {
		resetCloneIdCounter();
	});

	it("creates a deep copy with new slide number", () => {
		const original = makeSlide(1, [makeTextElement("txt_1", "Hello")]);
		const cloned = duplicateSlide(original, 2);

		expect(cloned.slideNumber).toBe(2);
		expect(cloned.id).toBe("slide2");
		expect(cloned.rId).toBe("rId3");
	});

	it("does not share element references with the original", () => {
		const original = makeSlide(1, [makeTextElement("txt_1", "Hello")]);
		const cloned = duplicateSlide(original, 2);

		expect(cloned.elements[0]).not.toBe(original.elements[0]);
		expect(cloned.elements.length).toBe(1);
	});

	it("assigns new unique IDs to all elements", () => {
		const original = makeSlide(1, [
			makeTextElement("txt_1", "Hello"),
			makeShapeElement("shp_1"),
		]);
		const cloned = duplicateSlide(original, 2);

		expect(cloned.elements[0].id).not.toBe("txt_1");
		expect(cloned.elements[1].id).not.toBe("shp_1");
		// New IDs should contain "clone"
		expect(cloned.elements[0].id).toContain("clone");
		expect(cloned.elements[1].id).toContain("clone");
	});

	it("preserves element types", () => {
		const original = makeSlide(1, [
			makeTextElement("txt_1", "Hello"),
			makeShapeElement("shp_1"),
		]);
		const cloned = duplicateSlide(original, 2);

		expect(cloned.elements[0].type).toBe("text");
		expect(cloned.elements[1].type).toBe("shape");
	});

	it("preserves text content in cloned elements", () => {
		const original = makeSlide(1, [makeTextElement("txt_1", "Hello World")]);
		const cloned = duplicateSlide(original, 2);

		const el = cloned.elements[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.text).toBe("Hello World");
		expect(el.textSegments[0].text).toBe("Hello World");
	});

	it("deep-clones text segments so mutations do not leak", () => {
		const original = makeSlide(1, [
			makeTextElement("txt_1", "Hello", [
				{ text: "Hel", style: { bold: true } },
				{ text: "lo", style: {} },
			]),
		]);
		const cloned = duplicateSlide(original, 2);

		// Mutate cloned segment
		const clonedEl = cloned.elements[0] as PptxElement & { textSegments: TextSegment[] };
		clonedEl.textSegments[0].text = "CHANGED";

		// Original should be unaffected
		const originalEl = original.elements[0] as PptxElement & { textSegments: TextSegment[] };
		expect(originalEl.textSegments[0].text).toBe("Hel");
	});

	it("handles group elements - assigns new IDs to children", () => {
		const child1 = makeTextElement("txt_child", "Child text");
		const child2 = makeShapeElement("shp_child");
		const group = makeGroupElement("grp_1", [child1, child2]);
		const original = makeSlide(1, [group]);
		const cloned = duplicateSlide(original, 2);

		const clonedGroup = cloned.elements[0] as PptxElement & { children: PptxElement[] };
		expect(clonedGroup.type).toBe("group");
		expect(clonedGroup.id).not.toBe("grp_1");
		expect(clonedGroup.children[0].id).not.toBe("txt_child");
		expect(clonedGroup.children[1].id).not.toBe("shp_child");
	});

	it("preserves slide background properties", () => {
		const original = makeSlide(1, [], {
			backgroundColor: "#FF0000",
			backgroundGradient: "linear-gradient(180deg, #000, #FFF)",
		});
		const cloned = duplicateSlide(original, 2);

		expect(cloned.backgroundColor).toBe("#FF0000");
		expect(cloned.backgroundGradient).toBe("linear-gradient(180deg, #000, #FFF)");
	});

	it("preserves notes", () => {
		const original = makeSlide(1, [], { notes: "Speaker notes here" });
		const cloned = duplicateSlide(original, 2);

		expect(cloned.notes).toBe("Speaker notes here");
	});

	it("preserves transition settings", () => {
		const original = makeSlide(1, [], {
			transition: { type: "fade", durationMs: 500 },
		});
		const cloned = duplicateSlide(original, 2);

		expect(cloned.transition?.type).toBe("fade");
		expect(cloned.transition?.durationMs).toBe(500);
	});

	it("updates animation element references to match new IDs", () => {
		const el = makeTextElement("txt_1", "Animated");
		const original = makeSlide(1, [el], {
			animations: [
				{
					elementId: "txt_1",
					entrance: "fadeIn",
					trigger: "onClick",
					durationMs: 500,
					delayMs: 0,
				},
			],
		});
		const cloned = duplicateSlide(original, 2);

		expect(cloned.animations).toBeDefined();
		expect(cloned.animations![0].elementId).toBe(cloned.elements[0].id);
		expect(cloned.animations![0].elementId).not.toBe("txt_1");
	});

	it("preserves hidden flag", () => {
		const original = makeSlide(1, [], { hidden: true });
		const cloned = duplicateSlide(original, 2);

		expect(cloned.hidden).toBe(true);
	});

	it("clones an empty slide", () => {
		const original = makeSlide(1, []);
		const cloned = duplicateSlide(original, 5);

		expect(cloned.slideNumber).toBe(5);
		expect(cloned.elements).toEqual([]);
	});

	it("preserves layout information", () => {
		const original = makeSlide(1, [], {
			layoutPath: "ppt/slideLayouts/slideLayout2.xml",
			layoutName: "Title and Content",
		});
		const cloned = duplicateSlide(original, 2);

		expect(cloned.layoutPath).toBe("ppt/slideLayouts/slideLayout2.xml");
		expect(cloned.layoutName).toBe("Title and Content");
	});
});

describe("duplicateElement", () => {
	beforeEach(() => {
		resetCloneIdCounter();
	});

	it("clones a text element with a new ID", () => {
		const original = makeTextElement("txt_1", "Hello");
		const cloned = duplicateElement(original);

		expect(cloned.id).not.toBe("txt_1");
		expect(cloned.type).toBe("text");
		expect((cloned as PptxElement & { text: string }).text).toBe("Hello");
	});

	it("clones a shape element with a new ID", () => {
		const original = makeShapeElement("shp_1");
		const cloned = duplicateElement(original);

		expect(cloned.id).not.toBe("shp_1");
		expect(cloned.type).toBe("shape");
	});

	it("recursively clones group children with new IDs", () => {
		const child = makeTextElement("txt_child", "Child");
		const group = makeGroupElement("grp_1", [child]);
		const cloned = duplicateElement(group) as PptxElement & { children: PptxElement[] };

		expect(cloned.id).not.toBe("grp_1");
		expect(cloned.children[0].id).not.toBe("txt_child");
		expect(cloned.children[0].type).toBe("text");
	});
});

// ==========================================================================
// FIND TEXT TESTS
// ==========================================================================

describe("findText", () => {
	it("returns empty array for empty search string", () => {
		const slides = [makeSlide(1, [makeTextElement("txt_1", "Hello")])];
		expect(findText(slides, "")).toEqual([]);
	});

	it("finds text in a single slide", () => {
		const slides = [makeSlide(1, [makeTextElement("txt_1", "Hello World")])];
		const results = findText(slides, "Hello");

		expect(results.length).toBe(1);
		expect(results[0].slideIndex).toBe(0);
		expect(results[0].elementId).toBe("txt_1");
		expect(results[0].segmentIndex).toBe(0);
		expect(results[0].text).toBe("Hello");
		expect(results[0].matchIndex).toBe(0);
	});

	it("finds text across multiple slides", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Hello World")]),
			makeSlide(2, [makeTextElement("txt_2", "Hello Again")]),
		];
		const results = findText(slides, "Hello");

		expect(results.length).toBe(2);
		expect(results[0].slideIndex).toBe(0);
		expect(results[1].slideIndex).toBe(1);
	});

	it("finds multiple matches in one segment", () => {
		const slides = [makeSlide(1, [makeTextElement("txt_1", "ha ha ha")])];
		const results = findText(slides, "ha");

		expect(results.length).toBe(3);
		expect(results[0].matchIndex).toBe(0);
		expect(results[1].matchIndex).toBe(3);
		expect(results[2].matchIndex).toBe(6);
	});

	it("finds text in shapes with text", () => {
		const slides = [
			makeSlide(1, [makeShapeElement("shp_1", "Shape Text")]),
		];
		const results = findText(slides, "Shape");

		expect(results.length).toBe(1);
		expect(results[0].elementId).toBe("shp_1");
	});

	it("finds text in group children", () => {
		const child = makeTextElement("txt_child", "Hidden in group");
		const group = makeGroupElement("grp_1", [child]);
		const slides = [makeSlide(1, [group])];
		const results = findText(slides, "Hidden");

		expect(results.length).toBe(1);
		expect(results[0].elementId).toBe("txt_child");
	});

	it("finds text across multiple segments in one element", () => {
		const segments: TextSegment[] = [
			{ text: "Hello ", style: {} },
			{ text: "World", style: { bold: true } },
		];
		const el = makeTextElement("txt_1", "Hello World", segments);
		const slides = [makeSlide(1, [el])];

		const results = findText(slides, "Hello");
		expect(results.length).toBe(1);
		expect(results[0].segmentIndex).toBe(0);

		const results2 = findText(slides, "World");
		expect(results2.length).toBe(1);
		expect(results2[0].segmentIndex).toBe(1);
	});

	it("supports regex search", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Q1 2025, Q2 2025")]),
		];
		const results = findText(slides, /Q\d/);

		expect(results.length).toBe(2);
		expect(results[0].text).toBe("Q1");
		expect(results[1].text).toBe("Q2");
	});

	it("supports case-insensitive regex", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Hello HELLO hello")]),
		];
		const results = findText(slides, /hello/i);

		expect(results.length).toBe(3);
	});

	it("is case-sensitive for plain strings by default", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Hello hello HELLO")]),
		];
		const results = findText(slides, "Hello");

		expect(results.length).toBe(1);
		expect(results[0].matchIndex).toBe(0);
	});

	it("returns empty for no matches", () => {
		const slides = [makeSlide(1, [makeTextElement("txt_1", "Hello")])];
		const results = findText(slides, "Goodbye");

		expect(results).toEqual([]);
	});

	it("skips elements without text properties", () => {
		const image: PptxElement = {
			type: "image",
			id: "img_1",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const slides = [makeSlide(1, [image])];
		const results = findText(slides, "anything");

		expect(results).toEqual([]);
	});

	it("handles empty slides", () => {
		const slides = [makeSlide(1, [])];
		const results = findText(slides, "test");
		expect(results).toEqual([]);
	});

	it("handles regex with special characters in string search", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Price: $100.00 (USD)")]),
		];
		const results = findText(slides, "$100.00");

		expect(results.length).toBe(1);
		expect(results[0].text).toBe("$100.00");
	});

	it("finds deeply nested group children", () => {
		const innerChild = makeTextElement("txt_deep", "Deep text");
		const innerGroup = makeGroupElement("grp_inner", [innerChild]);
		const outerGroup = makeGroupElement("grp_outer", [innerGroup]);
		const slides = [makeSlide(1, [outerGroup])];

		const results = findText(slides, "Deep");
		expect(results.length).toBe(1);
		expect(results[0].elementId).toBe("txt_deep");
	});
});

// ==========================================================================
// REPLACE TEXT TESTS
// ==========================================================================

describe("replaceTextInSlide", () => {
	it("replaces a simple string match", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "Hello World")]);
		const count = replaceTextInSlide(slide, "Hello", "Goodbye");

		expect(count).toBe(1);
		const el = slide.elements[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.textSegments[0].text).toBe("Goodbye World");
		expect(el.text).toBe("Goodbye World");
	});

	it("replaces multiple occurrences in one element", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "ha ha ha")]);
		const count = replaceTextInSlide(slide, "ha", "ho");

		expect(count).toBe(3);
		const el = slide.elements[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.textSegments[0].text).toBe("ho ho ho");
	});

	it("replaces across multiple elements", () => {
		const slide = makeSlide(1, [
			makeTextElement("txt_1", "Foo bar"),
			makeTextElement("txt_2", "Foo baz"),
		]);
		const count = replaceTextInSlide(slide, "Foo", "Bar");

		expect(count).toBe(2);
	});

	it("replaces in shape text", () => {
		const slide = makeSlide(1, [makeShapeElement("shp_1", "Old text")]);
		const count = replaceTextInSlide(slide, "Old", "New");

		expect(count).toBe(1);
		const el = slide.elements[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.text).toBe("New text");
	});

	it("replaces in group children", () => {
		const child = makeTextElement("txt_child", "Replace me");
		const group = makeGroupElement("grp_1", [child]);
		const slide = makeSlide(1, [group]);
		const count = replaceTextInSlide(slide, "Replace", "Changed");

		expect(count).toBe(1);
		const grp = slide.elements[0] as PptxElement & { children: PptxElement[] };
		const el = grp.children[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.text).toBe("Changed me");
	});

	it("supports regex replacement", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "Q1 2025, Q2 2025")]);
		const count = replaceTextInSlide(slide, /Q(\d)/, "Quarter $1");

		expect(count).toBe(2);
		const el = slide.elements[0] as PptxElement & { text: string };
		expect(el.text).toBe("Quarter 1 2025, Quarter 2 2025");
	});

	it("returns 0 for no matches", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "Hello")]);
		const count = replaceTextInSlide(slide, "Goodbye", "Hi");

		expect(count).toBe(0);
	});

	it("returns 0 for empty search string", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "Hello")]);
		const count = replaceTextInSlide(slide, "", "Hi");

		expect(count).toBe(0);
	});

	it("handles replacing with empty string (deletion)", () => {
		const slide = makeSlide(1, [makeTextElement("txt_1", "Hello World")]);
		const count = replaceTextInSlide(slide, "World", "");

		expect(count).toBe(1);
		const el = slide.elements[0] as PptxElement & { text: string };
		expect(el.text).toBe("Hello ");
	});

	it("keeps element text property in sync with segments", () => {
		const segments: TextSegment[] = [
			{ text: "Hello ", style: {} },
			{ text: "World", style: { bold: true } },
		];
		const slide = makeSlide(1, [makeTextElement("txt_1", "Hello World", segments)]);
		replaceTextInSlide(slide, "World", "Earth");

		const el = slide.elements[0] as PptxElement & { text: string; textSegments: TextSegment[] };
		expect(el.textSegments[1].text).toBe("Earth");
		expect(el.text).toBe("Hello Earth");
	});
});

describe("replaceText (multi-slide)", () => {
	it("replaces across all slides", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "2025 report")]),
			makeSlide(2, [makeTextElement("txt_2", "FY 2025")]),
			makeSlide(3, [makeTextElement("txt_3", "No match here")]),
		];
		const count = replaceText(slides, "2025", "2026");

		expect(count).toBe(2);
		expect(
			(slides[0].elements[0] as PptxElement & { text: string }).text,
		).toBe("2026 report");
		expect(
			(slides[1].elements[0] as PptxElement & { text: string }).text,
		).toBe("FY 2026");
		expect(
			(slides[2].elements[0] as PptxElement & { text: string }).text,
		).toBe("No match here");
	});

	it("handles regex across slides", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Acme Corp")]),
			makeSlide(2, [makeTextElement("txt_2", "Acme Corp is great")]),
		];
		const count = replaceText(slides, /Acme Corp/g, "NewCo Inc");

		expect(count).toBe(2);
	});

	it("returns 0 for empty slides array", () => {
		const count = replaceText([], "foo", "bar");
		expect(count).toBe(0);
	});

	it("handles case-insensitive regex replacement across slides", () => {
		const slides = [
			makeSlide(1, [makeTextElement("txt_1", "Hello hello HELLO")]),
		];
		const count = replaceText(slides, /hello/gi, "hi");

		expect(count).toBe(3);
		const el = slides[0].elements[0] as PptxElement & { text: string };
		expect(el.text).toBe("hi hi hi");
	});
});

// ==========================================================================
// SECTION OPERATIONS TESTS
// ==========================================================================

describe("addSection", () => {
	beforeEach(() => {
		resetSectionIdCounter();
	});

	it("creates a section with slide references", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);
		const section = addSection(data, "Introduction", [0, 1]);

		expect(section.name).toBe("Introduction");
		expect(section.slideIds).toEqual(["slide1", "slide2"]);
		expect(data.sections?.length).toBe(1);
	});

	it("sets section references on slides", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
		]);
		const section = addSection(data, "Intro", [0]);

		expect(data.slides[0].sectionName).toBe("Intro");
		expect(data.slides[0].sectionId).toBe(section.id);
		expect(data.slides[1].sectionName).toBeUndefined();
	});

	it("initializes sections array if not present", () => {
		const data = makePptxData([makeSlide(1, [])]);
		expect(data.sections).toBeUndefined();

		addSection(data, "Test", [0]);
		expect(data.sections).toBeDefined();
		expect(data.sections!.length).toBe(1);
	});

	it("ignores out-of-range slide indices", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const section = addSection(data, "Test", [-1, 0, 5]);

		expect(section.slideIds).toEqual(["slide1"]);
	});

	it("adds multiple sections", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);

		addSection(data, "Part 1", [0]);
		addSection(data, "Part 2", [1, 2]);

		expect(data.sections!.length).toBe(2);
		expect(data.sections![0].name).toBe("Part 1");
		expect(data.sections![1].name).toBe("Part 2");
	});

	it("generates unique section IDs", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
		]);

		const sec1 = addSection(data, "A", [0]);
		const sec2 = addSection(data, "B", [1]);

		expect(sec1.id).not.toBe(sec2.id);
	});
});

describe("removeSection", () => {
	beforeEach(() => {
		resetSectionIdCounter();
	});

	it("removes a section by ID", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const section = addSection(data, "ToRemove", [0]);

		const removed = removeSection(data, section.id);
		expect(removed).toBe(true);
		expect(data.sections!.length).toBe(0);
	});

	it("clears section references on affected slides", () => {
		const data = makePptxData([makeSlide(1, []), makeSlide(2, [])]);
		const section = addSection(data, "ToRemove", [0, 1]);

		removeSection(data, section.id);
		expect(data.slides[0].sectionName).toBeUndefined();
		expect(data.slides[0].sectionId).toBeUndefined();
		expect(data.slides[1].sectionName).toBeUndefined();
	});

	it("returns false for non-existent section ID", () => {
		const data = makePptxData([makeSlide(1, [])]);
		addSection(data, "Existing", [0]);

		const removed = removeSection(data, "non_existent_id");
		expect(removed).toBe(false);
		expect(data.sections!.length).toBe(1);
	});

	it("returns false when sections array is undefined", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const removed = removeSection(data, "any_id");
		expect(removed).toBe(false);
	});

	it("only removes the targeted section, leaving others intact", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);
		const sec1 = addSection(data, "Keep", [0]);
		const sec2 = addSection(data, "Remove", [1]);
		addSection(data, "AlsoKeep", [2]);

		removeSection(data, sec2.id);
		expect(data.sections!.length).toBe(2);
		expect(data.sections![0].name).toBe("Keep");
		expect(data.sections![1].name).toBe("AlsoKeep");
	});
});

describe("reorderSections", () => {
	beforeEach(() => {
		resetSectionIdCounter();
	});

	it("reorders sections according to the provided ID array", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);
		const sec1 = addSection(data, "A", [0]);
		const sec2 = addSection(data, "B", [1]);
		const sec3 = addSection(data, "C", [2]);

		reorderSections(data, [sec3.id, sec1.id, sec2.id]);

		expect(data.sections!.map((s) => s.name)).toEqual(["C", "A", "B"]);
	});

	it("drops sections not in the new order array", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);
		const sec1 = addSection(data, "Keep1", [0]);
		addSection(data, "Drop", [1]);
		const sec3 = addSection(data, "Keep2", [2]);

		reorderSections(data, [sec3.id, sec1.id]);

		expect(data.sections!.length).toBe(2);
		expect(data.sections!.map((s) => s.name)).toEqual(["Keep2", "Keep1"]);
	});

	it("silently ignores non-existent IDs", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const sec1 = addSection(data, "A", [0]);

		reorderSections(data, ["non_existent", sec1.id]);

		expect(data.sections!.length).toBe(1);
		expect(data.sections![0].name).toBe("A");
	});

	it("does nothing when sections is undefined", () => {
		const data = makePptxData([makeSlide(1, [])]);
		reorderSections(data, ["id1", "id2"]);
		expect(data.sections).toBeUndefined();
	});

	it("can reverse section order", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
		]);
		const sec1 = addSection(data, "First", [0]);
		const sec2 = addSection(data, "Second", [1]);

		reorderSections(data, [sec2.id, sec1.id]);

		expect(data.sections![0].name).toBe("Second");
		expect(data.sections![1].name).toBe("First");
	});
});

describe("getSectionForSlide", () => {
	beforeEach(() => {
		resetSectionIdCounter();
	});

	it("returns the section for a slide that belongs to one", () => {
		const data = makePptxData([makeSlide(1, []), makeSlide(2, [])]);
		const section = addSection(data, "Intro", [0]);

		const found = getSectionForSlide(data, 0);
		expect(found).toBeDefined();
		expect(found!.id).toBe(section.id);
		expect(found!.name).toBe("Intro");
	});

	it("returns undefined for a slide not in any section", () => {
		const data = makePptxData([makeSlide(1, []), makeSlide(2, [])]);
		addSection(data, "Intro", [0]);

		const found = getSectionForSlide(data, 1);
		expect(found).toBeUndefined();
	});

	it("returns undefined for out-of-range index", () => {
		const data = makePptxData([makeSlide(1, [])]);
		expect(getSectionForSlide(data, -1)).toBeUndefined();
		expect(getSectionForSlide(data, 10)).toBeUndefined();
	});

	it("returns undefined when no sections exist", () => {
		const data = makePptxData([makeSlide(1, [])]);
		expect(getSectionForSlide(data, 0)).toBeUndefined();
	});
});

describe("moveSlidesToSection", () => {
	beforeEach(() => {
		resetSectionIdCounter();
	});

	it("moves slides from one section to another", () => {
		const data = makePptxData([
			makeSlide(1, []),
			makeSlide(2, []),
			makeSlide(3, []),
		]);
		const sec1 = addSection(data, "Source", [0, 1]);
		const sec2 = addSection(data, "Target", [2]);

		const moved = moveSlidesToSection(data, [0], sec2.id);
		expect(moved).toBe(true);

		// Slide 0 should now be in sec2
		expect(data.slides[0].sectionId).toBe(sec2.id);
		expect(data.slides[0].sectionName).toBe("Target");

		// sec1 should no longer contain slide1
		expect(sec1.slideIds).not.toContain("slide1");
		// sec2 should now contain slide1
		expect(sec2.slideIds).toContain("slide1");
	});

	it("returns false for non-existent target section", () => {
		const data = makePptxData([makeSlide(1, [])]);
		addSection(data, "Source", [0]);

		const moved = moveSlidesToSection(data, [0], "non_existent");
		expect(moved).toBe(false);
	});

	it("returns false when sections is undefined", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const moved = moveSlidesToSection(data, [0], "any_id");
		expect(moved).toBe(false);
	});

	it("skips out-of-range slide indices", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const sec = addSection(data, "Target", []);

		moveSlidesToSection(data, [-1, 5], sec.id);
		expect(sec.slideIds.length).toBe(0);
	});

	it("does not duplicate slide IDs in target section", () => {
		const data = makePptxData([makeSlide(1, [])]);
		const sec = addSection(data, "Target", [0]);

		// Slide is already in this section, moving again should not duplicate
		moveSlidesToSection(data, [0], sec.id);
		const idCount = sec.slideIds.filter((id) => id === "slide1").length;
		expect(idCount).toBe(1);
	});
});
