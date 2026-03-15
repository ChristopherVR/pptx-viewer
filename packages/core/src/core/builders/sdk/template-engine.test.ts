import { describe, it, expect, vi, beforeEach } from "vitest";

import type { PptxSlide, PptxData } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import type { TextSegment } from "../../types/text";

import {
	applyTemplate,
	findPlaceholders,
	mailMerge,
	type TemplateData,
} from "./template-engine";

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
	text: string,
	segments?: TextSegment[],
): PptxElement {
	return {
		type: "shape",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: "rect",
		text,
		textSegments: segments ?? [{ text, style: {} }],
	} as PptxElement;
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

function makeTableElement(
	id: string,
	rows: Array<Array<string>>,
): PptxElement {
	return {
		type: "table",
		id,
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			rows: rows.map((cells) => ({
				cells: cells.map((text) => ({ text })),
			})),
		},
	} as PptxElement;
}

function makeSlide(
	id: string,
	elements: PptxElement[],
	slideNumber = 1,
): PptxSlide {
	return {
		id,
		rId: `rId${slideNumber + 1}`,
		slideNumber,
		elements,
	};
}

function makeData(slides: PptxSlide[]): PptxData {
	return {
		slides,
		width: 960,
		height: 540,
	};
}

// ---------------------------------------------------------------------------
// findPlaceholders
// ---------------------------------------------------------------------------

describe("findPlaceholders", () => {
	it("should find simple placeholders", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Hello {{name}}")]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("name");
	});

	it("should find multiple placeholders in one element", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{first}} and {{last}}"),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("first");
		expect(result).toContain("last");
	});

	it("should find dot-notation placeholders", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Company: {{company.name}}"),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("company.name");
	});

	it("should find placeholders across multiple slides", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "{{slide1Var}}")]),
			makeSlide("s2", [makeTextElement("t2", "{{slide2Var}}")], 2),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("slide1Var");
		expect(result).toContain("slide2Var");
	});

	it("should return unique placeholders only", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{name}} is {{name}}"),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result.filter((k) => k === "name")).toHaveLength(1);
	});

	it("should find placeholders in shape elements", () => {
		const data = makeData([
			makeSlide("s1", [makeShapeElement("s1", "{{shapeVar}}")]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("shapeVar");
	});

	it("should find placeholders in group children", () => {
		const data = makeData([
			makeSlide("s1", [
				makeGroupElement("g1", [
					makeTextElement("t1", "{{nestedVar}}"),
				]),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("nestedVar");
	});

	it("should find placeholders in table cells", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTableElement("tbl1", [
					["Name", "{{name}}"],
					["Score", "{{score}}"],
				]),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("name");
		expect(result).toContain("score");
	});

	it("should find block tags (#if, /if, #each, /each)", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#if show}}visible{{/if}} {{#each items}}item{{/each}}",
				),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("#if show");
		expect(result).toContain("/if");
		expect(result).toContain("#each items");
		expect(result).toContain("/each");
	});

	it("should find placeholders split across segments", () => {
		const segments: TextSegment[] = [
			{ text: "Hello {{", style: {} },
			{ text: "name", style: { bold: true } },
			{ text: "}}", style: {} },
		];
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Hello {{name}}", segments),
			]),
		]);
		const result = findPlaceholders(data);
		expect(result).toContain("name");
	});

	it("should return empty array for presentation with no placeholders", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Plain text")]),
		]);
		const result = findPlaceholders(data);
		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — simple substitution
// ---------------------------------------------------------------------------

describe("applyTemplate — simple substitution", () => {
	it("should replace a simple placeholder", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Hello {{name}}")]),
		]);
		applyTemplate(data, { name: "Alice" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
			textSegments?: TextSegment[];
		};
		expect(el.textSegments![0].text).toBe("Hello Alice");
		expect(el.text).toBe("Hello Alice");
	});

	it("should replace multiple placeholders", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{first}} {{last}}"),
			]),
		]);
		applyTemplate(data, { first: "John", last: "Doe" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("John Doe");
	});

	it("should handle number values", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Total: {{count}}"),
			]),
		]);
		applyTemplate(data, { count: 42 });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Total: 42");
	});

	it("should handle boolean values", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Active: {{active}}"),
			]),
		]);
		applyTemplate(data, { active: true });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Active: true");
	});

	it("should leave unresolved placeholders intact", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Hello {{unknown}}"),
			]),
		]);
		applyTemplate(data, { name: "Alice" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Hello {{unknown}}");
	});

	it("should replace placeholders in shape elements", () => {
		const data = makeData([
			makeSlide("s1", [makeShapeElement("s1", "{{label}}")]),
		]);
		applyTemplate(data, { label: "Box 1" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Box 1");
	});

	it("should replace placeholders in group children", () => {
		const data = makeData([
			makeSlide("s1", [
				makeGroupElement("g1", [
					makeTextElement("t1", "{{nested}}"),
				]),
			]),
		]);
		applyTemplate(data, { nested: "found it" });
		const group = data.slides[0].elements[0] as PptxElement & {
			children: PptxElement[];
		};
		const child = group.children[0] as PptxElement & { text?: string };
		expect(child.text).toBe("found it");
	});

	it("should replace placeholders in table cells", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTableElement("tbl1", [
					["Name", "{{name}}"],
					["City", "{{city}}"],
				]),
			]),
		]);
		applyTemplate(data, { name: "Alice", city: "NYC" });
		const table = data.slides[0].elements[0] as PptxElement & {
			tableData: { rows: Array<{ cells: Array<{ text: string }> }> };
		};
		expect(table.tableData.rows[0].cells[1].text).toBe("Alice");
		expect(table.tableData.rows[1].cells[1].text).toBe("NYC");
	});

	it("should replace across multiple slides", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "{{greeting}}")]),
			makeSlide("s2", [makeTextElement("t2", "{{farewell}}")], 2),
		]);
		applyTemplate(data, { greeting: "Hi", farewell: "Bye" });
		expect(
			(data.slides[0].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("Hi");
		expect(
			(data.slides[1].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("Bye");
	});

	it("should handle empty string values", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Value: {{val}}"),
			]),
		]);
		applyTemplate(data, { val: "" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Value: ");
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — nested/dot-notation
// ---------------------------------------------------------------------------

describe("applyTemplate — nested/dot-notation", () => {
	it("should resolve dot-notation paths", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{company.name}}"),
			]),
		]);
		applyTemplate(data, { company: { name: "Acme Corp" } });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Acme Corp");
	});

	it("should resolve deeply nested paths", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{a.b.c.d}}"),
			]),
		]);
		applyTemplate(data, {
			a: { b: { c: { d: "deep" } } },
		});
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("deep");
	});

	it("should leave unresolved nested paths intact", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{company.ceo}}"),
			]),
		]);
		applyTemplate(data, { company: { name: "Acme" } });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("{{company.ceo}}");
	});

	it("should leave path intact if intermediate is not an object", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{company.name.first}}"),
			]),
		]);
		applyTemplate(data, { company: { name: "Acme" } });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("{{company.name.first}}");
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — conditionals
// ---------------------------------------------------------------------------

describe("applyTemplate — conditionals", () => {
	it("should show content when condition is true", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#if showName}}Name: Alice{{/if}}",
				),
			]),
		]);
		applyTemplate(data, { showName: true });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Name: Alice");
	});

	it("should hide content when condition is false", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"Before{{#if showName}}Name: Alice{{/if}}After",
				),
			]),
		]);
		applyTemplate(data, { showName: false });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("BeforeAfter");
	});

	it("should treat truthy values as true (non-empty string)", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{#if name}}Hi {{name}}{{/if}}"),
			]),
		]);
		applyTemplate(data, { name: "Bob" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Hi Bob");
	});

	it("should treat empty string as false", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "X{{#if name}}Hi{{/if}}Y"),
			]),
		]);
		applyTemplate(data, { name: "" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("XY");
	});

	it("should treat undefined key as false", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "X{{#if missing}}Hi{{/if}}Y"),
			]),
		]);
		applyTemplate(data, {});
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("XY");
	});

	it("should support negated conditions with !", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#if !hideFooter}}Footer visible{{/if}}",
				),
			]),
		]);
		applyTemplate(data, { hideFooter: false });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Footer visible");
	});

	it("should support nested dot-notation in conditions", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#if config.showChart}}Chart here{{/if}}",
				),
			]),
		]);
		applyTemplate(data, { config: { showChart: true } });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Chart here");
	});

	it("should treat non-zero number as true", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{#if count}}Has items{{/if}}"),
			]),
		]);
		applyTemplate(data, { count: 5 });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Has items");
	});

	it("should treat zero as false", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "X{{#if count}}Has items{{/if}}Y"),
			]),
		]);
		applyTemplate(data, { count: 0 });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("XY");
	});

	it("should treat non-empty array as true", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{#if items}}Has items{{/if}}"),
			]),
		]);
		applyTemplate(data, { items: [{ x: 1 }] });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Has items");
	});

	it("should treat empty array as false", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "X{{#if items}}Has items{{/if}}Y"),
			]),
		]);
		applyTemplate(data, { items: [] as TemplateData[] });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("XY");
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — cross-run token handling
// ---------------------------------------------------------------------------

describe("applyTemplate — cross-run tokens", () => {
	it("should handle token split across two segments", () => {
		const segments: TextSegment[] = [
			{ text: "Hello {{na", style: {} },
			{ text: "me}}", style: { bold: true } },
		];
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Hello {{name}}", segments),
			]),
		]);
		applyTemplate(data, { name: "World" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
			textSegments?: TextSegment[];
		};
		// The first segment should contain the replacement
		expect(el.textSegments![0].text).toContain("Hello World");
		expect(el.text).toContain("Hello World");
	});

	it("should handle token split across three segments", () => {
		const segments: TextSegment[] = [
			{ text: "X{{", style: {} },
			{ text: "val", style: { bold: true } },
			{ text: "}}Y", style: {} },
		];
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "X{{val}}Y", segments),
			]),
		]);
		applyTemplate(data, { val: "Z" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("XZY");
	});

	it("should handle multiple tokens split across segments", () => {
		const segments: TextSegment[] = [
			{ text: "{{fir", style: {} },
			{ text: "st}} {{la", style: {} },
			{ text: "st}}", style: {} },
		];
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "{{first}} {{last}}", segments),
			]),
		]);
		applyTemplate(data, { first: "A", last: "B" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("A B");
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — {{#each}} loops
// ---------------------------------------------------------------------------

describe("applyTemplate — loops", () => {
	it("should duplicate slide for each item in array", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each items}}Slide: {{title}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, {
			items: [{ title: "A" }, { title: "B" }, { title: "C" }],
		});
		expect(data.slides).toHaveLength(3);
	});

	it("should substitute item data in each duplicated slide", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each items}}Title: {{title}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, {
			items: [{ title: "Slide A" }, { title: "Slide B" }],
		});
		const getText = (i: number) =>
			(data.slides[i].elements[0] as PptxElement & { text?: string })
				.text;
		expect(getText(0)).toBe("Title: Slide A");
		expect(getText(1)).toBe("Title: Slide B");
	});

	it("should merge parent data with each item data", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each items}}{{company}} - {{title}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, {
			company: "Acme",
			items: [{ title: "Overview" }, { title: "Details" }],
		});
		const getText = (i: number) =>
			(data.slides[i].elements[0] as PptxElement & { text?: string })
				.text;
		expect(getText(0)).toBe("Acme - Overview");
		expect(getText(1)).toBe("Acme - Details");
	});

	it("should produce zero slides for empty array", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each items}}{{title}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, { items: [] as TemplateData[] });
		expect(data.slides).toHaveLength(0);
	});

	it("should strip #each and /each tags from duplicated slides", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each items}}Hello {{name}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, {
			items: [{ name: "Alice" }],
		});
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).not.toContain("{{#each");
		expect(el.text).not.toContain("{{/each");
		expect(el.text).toBe("Hello Alice");
	});

	it("should handle non-loop slides alongside loop slides", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Intro: {{company}}"),
			]),
			makeSlide("s2", [
				makeTextElement(
					"t2",
					"{{#each items}}{{title}}{{/each}}",
				),
			], 2),
			makeSlide("s3", [
				makeTextElement("t3", "End: {{company}}"),
			], 3),
		]);
		applyTemplate(data, {
			company: "Acme",
			items: [{ title: "A" }, { title: "B" }],
		});
		expect(data.slides).toHaveLength(4); // intro + 2 loop + end
		expect(
			(data.slides[0].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("Intro: Acme");
		expect(
			(data.slides[1].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("A");
		expect(
			(data.slides[2].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("B");
		expect(
			(data.slides[3].elements[0] as PptxElement & { text?: string })
				.text,
		).toBe("End: Acme");
	});

	it("should handle undefined array key by producing zero loop slides", () => {
		const data = makeData([
			makeSlide("s1", [
				makeTextElement(
					"t1",
					"{{#each missing}}{{x}}{{/each}}",
				),
			]),
		]);
		applyTemplate(data, {});
		expect(data.slides).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — notes
// ---------------------------------------------------------------------------

describe("applyTemplate — notes", () => {
	it("should replace placeholders in slide notes", () => {
		const slide = makeSlide("s1", []);
		slide.notes = "Speaker: {{speaker}}";
		const data = makeData([slide]);
		applyTemplate(data, { speaker: "Dr. Smith" });
		expect(data.slides[0].notes).toBe("Speaker: Dr. Smith");
	});
});

// ---------------------------------------------------------------------------
// applyTemplate — edge cases
// ---------------------------------------------------------------------------

describe("applyTemplate — edge cases", () => {
	it("should handle elements with no text", () => {
		const el: PptxElement = {
			type: "image",
			id: "img1",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		const data = makeData([makeSlide("s1", [el])]);
		// Should not throw
		applyTemplate(data, { name: "test" });
	});

	it("should handle empty presentation", () => {
		const data = makeData([]);
		applyTemplate(data, { name: "test" });
		expect(data.slides).toHaveLength(0);
	});

	it("should handle slide with no elements", () => {
		const data = makeData([makeSlide("s1", [])]);
		applyTemplate(data, { name: "test" });
		expect(data.slides).toHaveLength(1);
	});

	it("should handle placeholder with whitespace in key", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "{{ name }}")]),
		]);
		applyTemplate(data, { name: "Alice" });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Alice");
	});

	it("should handle text element with text but no segments", () => {
		const el = {
			type: "text" as const,
			id: "t1",
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: "Hello {{name}}",
		} as PptxElement;
		const data = makeData([makeSlide("s1", [el])]);
		applyTemplate(data, { name: "Alice" });
		const updated = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(updated.text).toBe("Hello Alice");
	});

	it("should not substitute objects/arrays into text placeholders", () => {
		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Val: {{obj}}")]),
		]);
		applyTemplate(data, { obj: { nested: "value" } });
		const el = data.slides[0].elements[0] as PptxElement & {
			text?: string;
		};
		expect(el.text).toBe("Val: {{obj}}");
	});

	it("should handle paragraph break segments correctly", () => {
		const segments: TextSegment[] = [
			{ text: "Line 1 {{a}}", style: {} },
			{ text: "", style: {}, isParagraphBreak: true },
			{ text: "Line 2 {{b}}", style: {} },
		];
		const data = makeData([
			makeSlide("s1", [
				makeTextElement("t1", "Line 1 {{a}}Line 2 {{b}}", segments),
			]),
		]);
		applyTemplate(data, { a: "X", b: "Y" });
		expect(segments[0].text).toBe("Line 1 X");
		expect(segments[2].text).toBe("Line 2 Y");
	});
});

// ---------------------------------------------------------------------------
// mailMerge
// ---------------------------------------------------------------------------

describe("mailMerge", () => {
	it("should generate one presentation per record", async () => {
		const mockHandler = {
			save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		} as unknown as import("../../PptxHandler").PptxHandler;

		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Hello {{name}}")]),
		]);

		const results = await mailMerge(mockHandler, data, [
			{ name: "Alice" },
			{ name: "Bob" },
			{ name: "Charlie" },
		]);

		expect(results).toHaveLength(3);
		expect(mockHandler.save).toHaveBeenCalledTimes(3);
	});

	it("should not mutate the original data", async () => {
		const mockHandler = {
			save: vi.fn().mockResolvedValue(new Uint8Array([0])),
		} as unknown as import("../../PptxHandler").PptxHandler;

		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Hello {{name}}")]),
		]);

		await mailMerge(mockHandler, data, [{ name: "Alice" }]);

		// Original should be unchanged
		const el = data.slides[0].elements[0] as PptxElement & {
			textSegments?: TextSegment[];
		};
		expect(el.textSegments![0].text).toBe("Hello {{name}}");
	});

	it("should return empty array for empty records", async () => {
		const mockHandler = {
			save: vi.fn(),
		} as unknown as import("../../PptxHandler").PptxHandler;

		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "{{name}}")]),
		]);

		const results = await mailMerge(mockHandler, data, []);
		expect(results).toHaveLength(0);
		expect(mockHandler.save).not.toHaveBeenCalled();
	});

	it("should pass replaced slides to handler.save", async () => {
		let capturedSlides: PptxSlide[] | null = null;
		const mockHandler = {
			save: vi.fn().mockImplementation((slides: PptxSlide[]) => {
				capturedSlides = slides;
				return Promise.resolve(new Uint8Array([0]));
			}),
		} as unknown as import("../../PptxHandler").PptxHandler;

		const data = makeData([
			makeSlide("s1", [makeTextElement("t1", "Hello {{name}}")]),
		]);

		await mailMerge(mockHandler, data, [{ name: "Alice" }]);

		expect(capturedSlides).not.toBeNull();
		const el = capturedSlides![0].elements[0] as PptxElement & {
			textSegments?: TextSegment[];
		};
		expect(el.textSegments![0].text).toBe("Hello Alice");
	});
});
