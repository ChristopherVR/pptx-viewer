import { describe, it, expect } from "vitest";
import {
	diffPresentations,
	diffSlides,
	type PresentationDiff,
	type SlideDiff,
	type ElementDiff,
	type PropertyChange,
} from "./diff-operations";
import type { PptxData, PptxSlide } from "../../types/presentation";
import type {
	PptxElement,
	TextPptxElement,
	ShapePptxElement,
	ImagePptxElement,
	GroupPptxElement,
	TablePptxElement,
	ChartPptxElement,
	ConnectorPptxElement,
	MediaPptxElement,
} from "../../types/elements";
import type { PptxTheme } from "../../types/theme";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSlide(
	id: string,
	slideNumber: number,
	elements: PptxElement[] = [],
	extras?: Partial<PptxSlide>,
): PptxSlide {
	return {
		id,
		rId: `rId${slideNumber + 1}`,
		slideNumber,
		elements,
		...extras,
	};
}

function makeTextElement(
	id: string,
	text = "Hello",
	extras?: Partial<TextPptxElement>,
): TextPptxElement {
	return {
		type: "text",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
		...extras,
	};
}

function makeShapeElement(
	id: string,
	extras?: Partial<ShapePptxElement>,
): ShapePptxElement {
	return {
		type: "shape",
		id,
		x: 10,
		y: 10,
		width: 200,
		height: 100,
		shapeType: "rect",
		...extras,
	};
}

function makeImageElement(
	id: string,
	extras?: Partial<ImagePptxElement>,
): ImagePptxElement {
	return {
		type: "image",
		id,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		imageData: "data:image/png;base64,fakedata",
		...extras,
	};
}

function makeGroupElement(
	id: string,
	children: PptxElement[],
): GroupPptxElement {
	return {
		type: "group",
		id,
		x: 0,
		y: 0,
		width: 500,
		height: 400,
		children,
	};
}

function makeConnectorElement(
	id: string,
	extras?: Partial<ConnectorPptxElement>,
): ConnectorPptxElement {
	return {
		type: "connector",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 0,
		shapeType: "straightConnector1",
		...extras,
	};
}

function makePptxData(
	slides: PptxSlide[],
	extras?: Partial<PptxData>,
): PptxData {
	return {
		slides,
		width: 960,
		height: 540,
		...extras,
	};
}

function makeTheme(overrides?: Partial<PptxTheme>): PptxTheme {
	return {
		name: "Office Theme",
		colorScheme: {
			dk1: "#000000",
			lt1: "#FFFFFF",
			dk2: "#1F497D",
			lt2: "#EEECE1",
			accent1: "#4F81BD",
			accent2: "#C0504D",
			accent3: "#9BBB59",
			accent4: "#8064A2",
			accent5: "#4BACC6",
			accent6: "#F79646",
			hlink: "#0000FF",
			folHlink: "#800080",
		},
		fontScheme: {
			majorFont: { latin: "Calibri Light" },
			minorFont: { latin: "Calibri" },
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests: diffPresentations — identical presentations
// ---------------------------------------------------------------------------

describe("diffPresentations", () => {
	it("returns no changes for identical empty presentations", () => {
		const a = makePptxData([]);
		const b = makePptxData([]);
		const diff = diffPresentations(a, b);

		expect(diff.slideChanges).toEqual([]);
		expect(diff.themeChanged).toBe(false);
		expect(diff.metadataChanges).toEqual([]);
		expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
	});

	it("returns no changes for identical single-slide presentations", () => {
		const slide = makeSlide("s1", 1, [makeTextElement("t1", "Hello")]);
		const a = makePptxData([{ ...slide }]);
		const b = makePptxData([{ ...slide }]);
		const diff = diffPresentations(a, b);

		expect(diff.slideChanges).toEqual([]);
		expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
	});

	it("returns no changes for identical multi-slide presentations", () => {
		const slides = [
			makeSlide("s1", 1, [makeTextElement("t1")]),
			makeSlide("s2", 2, [makeShapeElement("sh1")]),
			makeSlide("s3", 3, [makeImageElement("img1")]),
		];
		const a = makePptxData(slides.map((s) => ({ ...s })));
		const b = makePptxData(slides.map((s) => ({ ...s })));
		const diff = diffPresentations(a, b);

		expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
	});

	// -----------------------------------------------------------------------
	// Slide additions
	// -----------------------------------------------------------------------

	it("detects a slide added at the end", () => {
		const a = makePptxData([makeSlide("s1", 1)]);
		const b = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.added).toBe(1);
		const added = diff.slideChanges.find((sc) => sc.type === "added");
		expect(added).toBeDefined();
		expect(added!.slideId).toBe("s2");
	});

	it("detects multiple slides added", () => {
		const a = makePptxData([makeSlide("s1", 1)]);
		const b = makePptxData([
			makeSlide("s1", 1),
			makeSlide("s2", 2),
			makeSlide("s3", 3),
			makeSlide("s4", 4),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.added).toBe(3);
	});

	it("detects slides added to an initially empty presentation", () => {
		const a = makePptxData([]);
		const b = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.added).toBe(2);
		expect(diff.summary.removed).toBe(0);
	});

	// -----------------------------------------------------------------------
	// Slide removals
	// -----------------------------------------------------------------------

	it("detects a slide removed from the end", () => {
		const a = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const b = makePptxData([makeSlide("s1", 1)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.removed).toBe(1);
		const removed = diff.slideChanges.find((sc) => sc.type === "removed");
		expect(removed).toBeDefined();
		expect(removed!.slideId).toBe("s2");
	});

	it("detects a slide removed from the beginning", () => {
		const a = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const b = makePptxData([makeSlide("s2", 2)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.removed).toBe(1);
		const removed = diff.slideChanges.find((sc) => sc.type === "removed");
		expect(removed!.slideId).toBe("s1");
	});

	it("detects all slides removed", () => {
		const a = makePptxData([
			makeSlide("s1", 1),
			makeSlide("s2", 2),
			makeSlide("s3", 3),
		]);
		const b = makePptxData([]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.removed).toBe(3);
		expect(diff.summary.added).toBe(0);
	});

	// -----------------------------------------------------------------------
	// Slide modifications — element changes
	// -----------------------------------------------------------------------

	it("detects a text change within an element", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "Old text")]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "New text")]),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.modified).toBe(1);
		const modified = diff.slideChanges.find((sc) => sc.type === "modified");
		expect(modified).toBeDefined();
		const elDiff = modified!.changes!.find(
			(c) => c.elementId === "t1" && c.type === "modified",
		);
		expect(elDiff).toBeDefined();
		const textChange = elDiff!.changes!.find((c) => c.property === "text");
		expect(textChange).toBeDefined();
		expect(textChange!.oldValue).toBe("Old text");
		expect(textChange!.newValue).toBe("New text");
	});

	it("detects an element added to a slide", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1")]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1"),
				makeShapeElement("sh1"),
			]),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.modified).toBe(1);
		const modified = diff.slideChanges[0];
		const added = modified.changes!.find(
			(c) => c.elementId === "sh1" && c.type === "added",
		);
		expect(added).toBeDefined();
		expect(added!.elementType).toBe("shape");
	});

	it("detects an element removed from a slide", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1"),
				makeShapeElement("sh1"),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1")]),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.modified).toBe(1);
		const modified = diff.slideChanges[0];
		const removed = modified.changes!.find(
			(c) => c.elementId === "sh1" && c.type === "removed",
		);
		expect(removed).toBeDefined();
		expect(removed!.elementType).toBe("shape");
	});

	it("detects position changes (x, y)", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "Hi", { x: 10, y: 20 })]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "Hi", { x: 50, y: 80 })]),
		]);
		const diff = diffPresentations(a, b);

		const modified = diff.slideChanges[0];
		const elDiff = modified.changes!.find(
			(c) => c.elementId === "t1",
		)!;
		const xChange = elDiff.changes!.find((c) => c.property === "x");
		const yChange = elDiff.changes!.find((c) => c.property === "y");
		expect(xChange).toBeDefined();
		expect(xChange!.oldValue).toBe(10);
		expect(xChange!.newValue).toBe(50);
		expect(yChange).toBeDefined();
	});

	it("detects size changes (width, height)", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", { width: 100, height: 50 }),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", { width: 200, height: 100 }),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "t1",
		)!;
		expect(elDiff.changes!.find((c) => c.property === "width")).toBeDefined();
		expect(elDiff.changes!.find((c) => c.property === "height")).toBeDefined();
	});

	it("detects rotation changes", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", { rotation: 0 }),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", { rotation: 45 }),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "t1",
		)!;
		const rotChange = elDiff.changes!.find(
			(c) => c.property === "rotation",
		);
		expect(rotChange).toBeDefined();
		expect(rotChange!.oldValue).toBe(0);
		expect(rotChange!.newValue).toBe(45);
	});

	it("detects shape type changes", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeShapeElement("sh1", { shapeType: "rect" }),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeShapeElement("sh1", { shapeType: "ellipse" }),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "sh1",
		)!;
		expect(
			elDiff.changes!.find((c) => c.property === "shapeType"),
		).toBeDefined();
	});

	it("detects textStyle changes", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", {
					textStyle: { fontSize: 12, bold: false },
				}),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1", "Hi", {
					textStyle: { fontSize: 24, bold: true },
				}),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "t1",
		)!;
		expect(
			elDiff.changes!.find((c) => c.property === "textStyle"),
		).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Slide-level property changes
	// -----------------------------------------------------------------------

	it("detects background color changes on a slide", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [], { backgroundColor: "#FFFFFF" }),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [], { backgroundColor: "#FF0000" }),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.modified).toBe(1);
		const slideLevelChange = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "__slide__",
		);
		expect(slideLevelChange).toBeDefined();
		const bgChange = slideLevelChange!.changes!.find(
			(c) => c.property === "slide.backgroundColor",
		);
		expect(bgChange).toBeDefined();
		expect(bgChange!.oldValue).toBe("#FFFFFF");
		expect(bgChange!.newValue).toBe("#FF0000");
	});

	it("detects notes changes on a slide", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [], { notes: "Old notes" }),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [], { notes: "New notes" }),
		]);
		const diff = diffPresentations(a, b);

		const slideLevelChange = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "__slide__",
		);
		expect(slideLevelChange).toBeDefined();
		expect(
			slideLevelChange!.changes!.find(
				(c) => c.property === "slide.notes",
			),
		).toBeDefined();
	});

	it("detects hidden flag changes on a slide", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [], { hidden: false }),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [], { hidden: true }),
		]);
		const diff = diffPresentations(a, b);

		const slideLevelChange = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "__slide__",
		);
		expect(slideLevelChange).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Nested group elements
	// -----------------------------------------------------------------------

	it("detects changes in nested group children", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [makeTextElement("t1", "Old")]),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [makeTextElement("t1", "New")]),
			]),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.modified).toBe(1);
		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "t1" && c.type === "modified",
		);
		expect(elDiff).toBeDefined();
		expect(
			elDiff!.changes!.find((c) => c.property === "text"),
		).toBeDefined();
	});

	it("detects child added to a group", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [makeTextElement("t1")]),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [
					makeTextElement("t1"),
					makeShapeElement("sh_new"),
				]),
			]),
		]);
		const diff = diffPresentations(a, b);

		const added = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "sh_new" && c.type === "added",
		);
		expect(added).toBeDefined();
	});

	it("detects child removed from a group", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [
					makeTextElement("t1"),
					makeShapeElement("sh1"),
				]),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeGroupElement("g1", [makeTextElement("t1")]),
			]),
		]);
		const diff = diffPresentations(a, b);

		const removed = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "sh1" && c.type === "removed",
		);
		expect(removed).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Combined add + remove + modify
	// -----------------------------------------------------------------------

	it("handles simultaneous slide additions and removals", () => {
		const a = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const b = makePptxData([makeSlide("s2", 2), makeSlide("s3", 3)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.removed).toBe(1);
		expect(diff.summary.added).toBe(1);
		expect(
			diff.slideChanges.find(
				(sc) => sc.type === "removed" && sc.slideId === "s1",
			),
		).toBeDefined();
		expect(
			diff.slideChanges.find(
				(sc) => sc.type === "added" && sc.slideId === "s3",
			),
		).toBeDefined();
	});

	it("handles additions, removals, and modifications together", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "Old text")]),
			makeSlide("s2", 2),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "New text")]),
			makeSlide("s3", 3),
		]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.added).toBe(1); // s3
		expect(diff.summary.removed).toBe(1); // s2
		expect(diff.summary.modified).toBe(1); // s1 (text changed)
	});

	// -----------------------------------------------------------------------
	// Theme diff
	// -----------------------------------------------------------------------

	it("detects no theme change when both are undefined", () => {
		const a = makePptxData([]);
		const b = makePptxData([]);
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(false);
	});

	it("detects theme added", () => {
		const a = makePptxData([]);
		const b = makePptxData([], { theme: makeTheme() });
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(true);
	});

	it("detects theme removed", () => {
		const a = makePptxData([], { theme: makeTheme() });
		const b = makePptxData([]);
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(true);
	});

	it("detects theme name change", () => {
		const a = makePptxData([], { theme: makeTheme({ name: "Light" }) });
		const b = makePptxData([], { theme: makeTheme({ name: "Dark" }) });
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(true);
		const nameChange = diff.themeChanges!.find(
			(c) => c.property === "theme.name",
		);
		expect(nameChange).toBeDefined();
		expect(nameChange!.oldValue).toBe("Light");
		expect(nameChange!.newValue).toBe("Dark");
	});

	it("detects theme color scheme changes", () => {
		const themeA = makeTheme();
		const themeB = makeTheme();
		themeB.colorScheme!.accent1 = "#FF0000";
		const a = makePptxData([], { theme: themeA });
		const b = makePptxData([], { theme: themeB });
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(true);
		const colorChange = diff.themeChanges!.find(
			(c) => c.property === "theme.colorScheme.accent1",
		);
		expect(colorChange).toBeDefined();
		expect(colorChange!.oldValue).toBe("#4F81BD");
		expect(colorChange!.newValue).toBe("#FF0000");
	});

	it("detects theme font scheme changes", () => {
		const themeA = makeTheme();
		const themeB = makeTheme({
			fontScheme: {
				majorFont: { latin: "Arial Black" },
				minorFont: { latin: "Calibri" },
			},
		});
		const a = makePptxData([], { theme: themeA });
		const b = makePptxData([], { theme: themeB });
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(true);
		const fontChange = diff.themeChanges!.find(
			(c) => c.property === "theme.fontScheme.majorFont",
		);
		expect(fontChange).toBeDefined();
	});

	it("reports no theme change when themes are identical", () => {
		const a = makePptxData([], { theme: makeTheme() });
		const b = makePptxData([], { theme: makeTheme() });
		const diff = diffPresentations(a, b);

		expect(diff.themeChanged).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Metadata diff
	// -----------------------------------------------------------------------

	it("detects core property changes (title)", () => {
		const a = makePptxData([], {
			coreProperties: { title: "Old Title" },
		});
		const b = makePptxData([], {
			coreProperties: { title: "New Title" },
		});
		const diff = diffPresentations(a, b);

		const titleChange = diff.metadataChanges.find(
			(c) => c.property === "coreProperties.title",
		);
		expect(titleChange).toBeDefined();
		expect(titleChange!.oldValue).toBe("Old Title");
		expect(titleChange!.newValue).toBe("New Title");
	});

	it("detects core property changes (creator, modified)", () => {
		const a = makePptxData([], {
			coreProperties: {
				creator: "Alice",
				modified: "2024-01-01T00:00:00Z",
			},
		});
		const b = makePptxData([], {
			coreProperties: {
				creator: "Bob",
				modified: "2024-06-15T12:00:00Z",
			},
		});
		const diff = diffPresentations(a, b);

		expect(
			diff.metadataChanges.find(
				(c) => c.property === "coreProperties.creator",
			),
		).toBeDefined();
		expect(
			diff.metadataChanges.find(
				(c) => c.property === "coreProperties.modified",
			),
		).toBeDefined();
	});

	it("detects app property changes (company)", () => {
		const a = makePptxData([], {
			appProperties: { company: "Acme Corp" },
		});
		const b = makePptxData([], {
			appProperties: { company: "Globex Corp" },
		});
		const diff = diffPresentations(a, b);

		const companyChange = diff.metadataChanges.find(
			(c) => c.property === "appProperties.company",
		);
		expect(companyChange).toBeDefined();
	});

	it("detects slide dimension changes", () => {
		const a = makePptxData([], { width: 960, height: 540 } as Partial<PptxData> as PptxData);
		const b = makePptxData([], { width: 1280, height: 720 } as Partial<PptxData> as PptxData);
		// makePptxData already defaults to 960x540, so only b differs when we override
		const aData = { ...a, width: 960, height: 540 };
		const bData = { ...b, width: 1280, height: 720 };
		const diff = diffPresentations(aData, bData);

		expect(
			diff.metadataChanges.find((c) => c.property === "width"),
		).toBeDefined();
		expect(
			diff.metadataChanges.find((c) => c.property === "height"),
		).toBeDefined();
	});

	it("reports no metadata changes when properties are identical", () => {
		const props = {
			coreProperties: { title: "Same", creator: "Same" },
			appProperties: { company: "Same" },
		};
		const a = makePptxData([], props);
		const b = makePptxData([], props);
		const diff = diffPresentations(a, b);

		expect(diff.metadataChanges).toEqual([]);
	});

	// -----------------------------------------------------------------------
	// Image element diff
	// -----------------------------------------------------------------------

	it("detects image data change", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeImageElement("img1", {
					imageData: "data:image/png;base64,OLD",
				}),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeImageElement("img1", {
					imageData: "data:image/png;base64,NEW",
				}),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "img1",
		)!;
		expect(
			elDiff.changes!.find((c) => c.property === "imageData"),
		).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Connector element diff
	// -----------------------------------------------------------------------

	it("detects connector shapeStyle changes", () => {
		const a = makePptxData([
			makeSlide("s1", 1, [
				makeConnectorElement("cxn1", {
					shapeStyle: { strokeColor: "#000000", strokeWidth: 1 },
				}),
			]),
		]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeConnectorElement("cxn1", {
					shapeStyle: { strokeColor: "#FF0000", strokeWidth: 3 },
				}),
			]),
		]);
		const diff = diffPresentations(a, b);

		const elDiff = diff.slideChanges[0].changes!.find(
			(c) => c.elementId === "cxn1",
		)!;
		expect(
			elDiff.changes!.find((c) => c.property === "shapeStyle"),
		).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// Miscellaneous element types
	// -----------------------------------------------------------------------

	it("detects element type in the diff result", () => {
		const a = makePptxData([makeSlide("s1", 1, [])]);
		const b = makePptxData([
			makeSlide("s1", 1, [
				makeTextElement("t1"),
				makeShapeElement("sh1"),
				makeImageElement("img1"),
			]),
		]);
		const diff = diffPresentations(a, b);

		const changes = diff.slideChanges[0].changes!;
		expect(changes.find((c) => c.elementId === "t1")!.elementType).toBe(
			"text",
		);
		expect(changes.find((c) => c.elementId === "sh1")!.elementType).toBe(
			"shape",
		);
		expect(changes.find((c) => c.elementId === "img1")!.elementType).toBe(
			"image",
		);
	});

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------

	it("handles comparing presentation with itself (reference)", () => {
		const data = makePptxData([
			makeSlide("s1", 1, [makeTextElement("t1", "Hi")]),
		]);
		const diff = diffPresentations(data, data);

		expect(diff.slideChanges).toEqual([]);
		expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
	});

	it("handles slides with empty element arrays", () => {
		const a = makePptxData([makeSlide("s1", 1, [])]);
		const b = makePptxData([makeSlide("s1", 1, [])]);
		const diff = diffPresentations(a, b);

		expect(diff.slideChanges).toEqual([]);
	});

	it("handles completely replaced slide set (all different IDs)", () => {
		const a = makePptxData([makeSlide("s1", 1), makeSlide("s2", 2)]);
		const b = makePptxData([makeSlide("s3", 1), makeSlide("s4", 2)]);
		const diff = diffPresentations(a, b);

		expect(diff.summary.removed).toBe(2);
		expect(diff.summary.added).toBe(2);
		expect(diff.summary.modified).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: diffSlides (standalone)
// ---------------------------------------------------------------------------

describe("diffSlides", () => {
	it("returns type modified with empty changes for identical slides", () => {
		const slide = makeSlide("s1", 1, [makeTextElement("t1", "Hello")]);
		const diff = diffSlides(slide, slide);

		expect(diff.type).toBe("modified");
		expect(diff.changes).toEqual([]);
	});

	it("reports the correct slideIndex", () => {
		const a = makeSlide("s1", 1);
		const b = makeSlide("s1", 1);
		const diff = diffSlides(a, b, 5);

		expect(diff.slideIndex).toBe(5);
	});

	it("detects all elements removed", () => {
		const a = makeSlide("s1", 1, [
			makeTextElement("t1"),
			makeShapeElement("sh1"),
		]);
		const b = makeSlide("s1", 1, []);
		const diff = diffSlides(a, b);

		const removedIds = diff
			.changes!.filter((c) => c.type === "removed")
			.map((c) => c.elementId);
		expect(removedIds).toContain("t1");
		expect(removedIds).toContain("sh1");
	});

	it("detects all elements added", () => {
		const a = makeSlide("s1", 1, []);
		const b = makeSlide("s1", 1, [
			makeTextElement("t1"),
			makeShapeElement("sh1"),
		]);
		const diff = diffSlides(a, b);

		const addedIds = diff
			.changes!.filter((c) => c.type === "added")
			.map((c) => c.elementId);
		expect(addedIds).toContain("t1");
		expect(addedIds).toContain("sh1");
	});

	it("detects mixed add, remove, and modify in same slide", () => {
		const a = makeSlide("s1", 1, [
			makeTextElement("t1", "Original"),
			makeShapeElement("sh_removed"),
		]);
		const b = makeSlide("s1", 1, [
			makeTextElement("t1", "Changed"),
			makeImageElement("img_new"),
		]);
		const diff = diffSlides(a, b);

		expect(
			diff.changes!.find(
				(c) => c.elementId === "t1" && c.type === "modified",
			),
		).toBeDefined();
		expect(
			diff.changes!.find(
				(c) => c.elementId === "sh_removed" && c.type === "removed",
			),
		).toBeDefined();
		expect(
			diff.changes!.find(
				(c) => c.elementId === "img_new" && c.type === "added",
			),
		).toBeDefined();
	});

	it("uses slide A's id in the result", () => {
		const a = makeSlide("original_id", 1);
		const b = makeSlide("original_id", 1);
		const diff = diffSlides(a, b);

		expect(diff.slideId).toBe("original_id");
	});

	it("handles opacity change on element", () => {
		const a = makeSlide("s1", 1, [
			makeTextElement("t1", "Hi", { opacity: 1.0 }),
		]);
		const b = makeSlide("s1", 1, [
			makeTextElement("t1", "Hi", { opacity: 0.5 }),
		]);
		const diff = diffSlides(a, b);

		const elDiff = diff.changes!.find((c) => c.elementId === "t1")!;
		const opacityChange = elDiff.changes!.find(
			(c) => c.property === "opacity",
		);
		expect(opacityChange).toBeDefined();
		expect(opacityChange!.oldValue).toBe(1.0);
		expect(opacityChange!.newValue).toBe(0.5);
	});
});
