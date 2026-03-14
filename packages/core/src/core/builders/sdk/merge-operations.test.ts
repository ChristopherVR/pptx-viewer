import { describe, it, expect, beforeEach } from "vitest";
import { mergePresentation, type MergeOptions } from "./merge-operations";
import type { PptxData, PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import type {
	TextPptxElement,
	ShapePptxElement,
	ConnectorPptxElement,
	ImagePptxElement,
	GroupPptxElement,
} from "../../types/elements";
import type { ShapeStyle } from "../../types/shape-style";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSlide(
	id: string,
	slideNumber: number,
	elements: PptxElement[] = [],
): PptxSlide {
	return {
		id,
		rId: `rId${slideNumber + 1}`,
		slideNumber,
		elements,
	};
}

function makeTextElement(id: string, text = "Hello"): TextPptxElement {
	return {
		type: "text",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
	};
}

function makeShapeElement(id: string): ShapePptxElement {
	return {
		type: "shape",
		id,
		x: 10,
		y: 10,
		width: 200,
		height: 100,
		shapeType: "rect",
	};
}

function makeImageElement(id: string, dataUrl?: string): ImagePptxElement {
	return {
		type: "image",
		id,
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		imageData: dataUrl ?? "data:image/png;base64,fakedata",
	};
}

function makeConnectorElement(
	id: string,
	startShapeId?: string,
	endShapeId?: string,
): ConnectorPptxElement {
	const style: ShapeStyle = {} as ShapeStyle;
	if (startShapeId) {
		style.connectorStartConnection = {
			shapeId: startShapeId,
			connectionSiteIndex: 0,
		};
	}
	if (endShapeId) {
		style.connectorEndConnection = {
			shapeId: endShapeId,
			connectionSiteIndex: 2,
		};
	}
	return {
		type: "connector",
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 0,
		shapeType: "straightConnector1",
		shapeStyle: style,
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

function makePptxData(slides: PptxSlide[], extras?: Partial<PptxData>): PptxData {
	return {
		slides,
		width: 960,
		height: 540,
		...extras,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergePresentation", () => {
	let target: PptxData;
	let source: PptxData;

	beforeEach(() => {
		target = makePptxData([
			makeSlide("slide1", 1, [makeTextElement("t1", "Target Slide 1")]),
			makeSlide("slide2", 2, [makeTextElement("t2", "Target Slide 2")]),
		]);

		source = makePptxData([
			makeSlide("slide1", 1, [makeTextElement("s1", "Source Slide 1")]),
			makeSlide("slide2", 2, [makeTextElement("s2", "Source Slide 2")]),
			makeSlide("slide3", 3, [makeTextElement("s3", "Source Slide 3")]),
		]);
	});

	// -----------------------------------------------------------------------
	// Basic merge
	// -----------------------------------------------------------------------

	it("merges all slides from source when no options given", () => {
		const count = mergePresentation(target, source);
		expect(count).toBe(3);
		expect(target.slides.length).toBe(5);
	});

	it("returns 0 when source has no slides", () => {
		const emptySource = makePptxData([]);
		const count = mergePresentation(target, emptySource);
		expect(count).toBe(0);
		expect(target.slides.length).toBe(2);
	});

	it("appends to end by default", () => {
		mergePresentation(target, source);
		// Original target slides should still be at the beginning
		expect(target.slides[0].elements[0]).toBeDefined();
		expect((target.slides[0].elements[0] as TextPptxElement).text).toBe("Target Slide 1");
		expect((target.slides[1].elements[0] as TextPptxElement).text).toBe("Target Slide 2");
		// Source slides appended after
		expect(target.slides.length).toBe(5);
	});

	it("merges into an empty target", () => {
		const emptyTarget = makePptxData([]);
		const count = mergePresentation(emptyTarget, source);
		expect(count).toBe(3);
		expect(emptyTarget.slides.length).toBe(3);
	});

	// -----------------------------------------------------------------------
	// Slide selection
	// -----------------------------------------------------------------------

	it("merges only selected slides by index", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [0, 2],
		});
		expect(count).toBe(2);
		expect(target.slides.length).toBe(4);
	});

	it("ignores out-of-range indices", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [0, 10, -1, 100],
		});
		expect(count).toBe(1); // Only index 0 is valid
		expect(target.slides.length).toBe(3);
	});

	it("returns 0 when all indices are out of range", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [10, 20, 30],
		});
		expect(count).toBe(0);
		expect(target.slides.length).toBe(2);
	});

	it("handles empty slideIndices array", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [],
		});
		expect(count).toBe(0);
		expect(target.slides.length).toBe(2);
	});

	it("merges a single slide", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [1],
		});
		expect(count).toBe(1);
		expect(target.slides.length).toBe(3);
	});

	// -----------------------------------------------------------------------
	// Insertion position
	// -----------------------------------------------------------------------

	it("inserts at the beginning with insertAt: 0", () => {
		mergePresentation(target, source, {
			slideIndices: [0],
			insertAt: 0,
		});
		expect(target.slides.length).toBe(3);
		// First slide should now be the merged one
		expect(target.slides[0].elements[0]).toBeDefined();
		// Original slide1 is now second
		expect((target.slides[1].elements[0] as TextPptxElement).text).toBe("Target Slide 1");
	});

	it("inserts at a middle position", () => {
		mergePresentation(target, source, {
			slideIndices: [0],
			insertAt: 1,
		});
		expect(target.slides.length).toBe(3);
		// Original first slide is at index 0
		expect((target.slides[0].elements[0] as TextPptxElement).text).toBe("Target Slide 1");
		// Merged slide at index 1
		// Original second slide pushed to index 2
		expect((target.slides[2].elements[0] as TextPptxElement).text).toBe("Target Slide 2");
	});

	it("clamps insertAt to end if beyond length", () => {
		mergePresentation(target, source, {
			slideIndices: [0],
			insertAt: 999,
		});
		expect(target.slides.length).toBe(3);
		// Merged slide should be at the end
		expect((target.slides[0].elements[0] as TextPptxElement).text).toBe("Target Slide 1");
		expect((target.slides[1].elements[0] as TextPptxElement).text).toBe("Target Slide 2");
	});

	it("clamps negative insertAt to 0", () => {
		mergePresentation(target, source, {
			slideIndices: [0],
			insertAt: -5,
		});
		expect(target.slides.length).toBe(3);
		// Merged slide should be at the start
		expect((target.slides[1].elements[0] as TextPptxElement).text).toBe("Target Slide 1");
	});

	// -----------------------------------------------------------------------
	// Slide ID conflict resolution
	// -----------------------------------------------------------------------

	it("resolves conflicting slide IDs", () => {
		// Source and target both have "slide1" and "slide2"
		mergePresentation(target, source);
		const ids = target.slides.map((s) => s.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length); // All IDs must be unique
	});

	it("resolves conflicting relationship IDs", () => {
		mergePresentation(target, source);
		const rIds = target.slides.map((s) => s.rId);
		const uniqueRIds = new Set(rIds);
		expect(uniqueRIds.size).toBe(rIds.length); // All rIds must be unique
	});

	it("re-numbers slideNumber sequentially after merge", () => {
		mergePresentation(target, source, { insertAt: 1 });
		for (let i = 0; i < target.slides.length; i++) {
			expect(target.slides[i].slideNumber).toBe(i + 1);
		}
	});

	// -----------------------------------------------------------------------
	// Element ID conflict resolution
	// -----------------------------------------------------------------------

	it("resolves conflicting element IDs", () => {
		// Both target and source have elements with same IDs
		const src = makePptxData([
			makeSlide("srcSlide", 1, [
				makeTextElement("t1", "Conflict element"),
			]),
		]);
		mergePresentation(target, src);
		const allElementIds: string[] = [];
		for (const slide of target.slides) {
			for (const el of slide.elements) {
				allElementIds.push(el.id);
			}
		}
		const uniqueIds = new Set(allElementIds);
		expect(uniqueIds.size).toBe(allElementIds.length);
	});

	it("resolves deeply nested element IDs in groups", () => {
		const nestedChild = makeTextElement("t1", "Deep child");
		const groupEl = makeGroupElement("grp1", [nestedChild]);
		const src = makePptxData([
			makeSlide("srcSlide", 1, [groupEl]),
		]);
		// Target also has "t1"
		mergePresentation(target, src);
		// Find the merged group
		const mergedSlide = target.slides[target.slides.length - 1];
		const group = mergedSlide.elements[0] as GroupPptxElement;
		expect(group.type).toBe("group");
		// The child's ID should be different from target's "t1"
		expect(group.children[0].id).not.toBe("t1");
	});

	// -----------------------------------------------------------------------
	// Deep cloning
	// -----------------------------------------------------------------------

	it("does not mutate source slides", () => {
		const originalSourceText = (source.slides[0].elements[0] as TextPptxElement).text;
		const originalSourceId = source.slides[0].id;
		mergePresentation(target, source);
		expect(source.slides[0].id).toBe(originalSourceId);
		expect((source.slides[0].elements[0] as TextPptxElement).text).toBe(originalSourceText);
	});

	it("cloned slides are independent copies", () => {
		mergePresentation(target, source);
		// Modify a merged slide and verify source is unaffected
		const mergedSlide = target.slides[target.slides.length - 1];
		const el = mergedSlide.elements[0] as TextPptxElement;
		el.text = "MODIFIED";
		expect((source.slides[2].elements[0] as TextPptxElement).text).toBe("Source Slide 3");
	});

	// -----------------------------------------------------------------------
	// Media references
	// -----------------------------------------------------------------------

	it("carries over image data URLs with cloned elements", () => {
		const imgData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg";
		const src = makePptxData([
			makeSlide("imgSlide", 1, [makeImageElement("img1", imgData)]),
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		const img = mergedSlide.elements[0] as ImagePptxElement;
		expect(img.imageData).toBe(imgData);
	});

	it("carries over background image with cloned slide", () => {
		const bgImg = "data:image/jpeg;base64,/9j/4AAQ";
		const src = makePptxData([
			{
				...makeSlide("bgSlide", 1),
				backgroundImage: bgImg,
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.backgroundImage).toBe(bgImg);
	});

	it("carries over background color", () => {
		const src = makePptxData([
			{
				...makeSlide("bgSlide", 1),
				backgroundColor: "#FF0000",
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.backgroundColor).toBe("#FF0000");
	});

	// -----------------------------------------------------------------------
	// Connector reference updates
	// -----------------------------------------------------------------------

	it("updates connector shape references after element ID remapping", () => {
		const shape1 = makeShapeElement("shp1");
		const shape2 = makeShapeElement("shp2");
		const connector = makeConnectorElement("cxn1", "shp1", "shp2");

		// Target also has shp1 and shp2 so remapping will occur
		const targetWithShapes = makePptxData([
			makeSlide("slide1", 1, [
				makeShapeElement("shp1"),
				makeShapeElement("shp2"),
			]),
		]);
		const src = makePptxData([
			makeSlide("srcSlide", 1, [shape1, shape2, connector]),
		]);

		mergePresentation(targetWithShapes, src);

		const mergedSlide = targetWithShapes.slides[targetWithShapes.slides.length - 1];
		const mergedConnector = mergedSlide.elements[2] as ConnectorPptxElement;
		const mergedShape1 = mergedSlide.elements[0] as ShapePptxElement;
		const mergedShape2 = mergedSlide.elements[1] as ShapePptxElement;

		// Connector references should point to the remapped shape IDs
		expect(mergedConnector.shapeStyle?.connectorStartConnection?.shapeId).toBe(mergedShape1.id);
		expect(mergedConnector.shapeStyle?.connectorEndConnection?.shapeId).toBe(mergedShape2.id);
	});

	// -----------------------------------------------------------------------
	// Animation reference updates
	// -----------------------------------------------------------------------

	it("updates animation elementId references after remapping", () => {
		const src = makePptxData([
			{
				...makeSlide("animSlide", 1, [makeTextElement("t1", "Animated")]),
				animations: [
					{
						elementId: "t1",
						entrance: "fadeIn" as const,
						trigger: "onClick" as const,
						durationMs: 500,
						delayMs: 0,
					},
				],
			},
		]);

		// Target has "t1" so it will be remapped
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		const mergedElementId = mergedSlide.elements[0].id;
		expect(mergedSlide.animations?.[0].elementId).toBe(mergedElementId);
		expect(mergedElementId).not.toBe("t1"); // It was remapped
	});

	// -----------------------------------------------------------------------
	// Merge with self
	// -----------------------------------------------------------------------

	it("can merge a presentation with itself", () => {
		const original = makePptxData([
			makeSlide("slide1", 1, [makeTextElement("el1")]),
		]);
		const count = mergePresentation(original, original);
		expect(count).toBe(1);
		expect(original.slides.length).toBe(2);
		// IDs should all be unique
		const ids = original.slides.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// -----------------------------------------------------------------------
	// Theme merging
	// -----------------------------------------------------------------------

	it("does not overwrite target theme by default", () => {
		const targetThemeMap = { accent1: "#111111" };
		target.themeColorMap = targetThemeMap;
		source.themeColorMap = { accent1: "#999999" };

		mergePresentation(target, source);
		expect(target.themeColorMap).toBe(targetThemeMap);
	});

	it("overwrites target theme when keepSourceTheme is true", () => {
		target.themeColorMap = { accent1: "#111111" };
		source.themeColorMap = { accent1: "#999999" };
		source.theme = {
			name: "Source Theme",
			colorScheme: {
				accent1: "#999999",
			},
		};

		mergePresentation(target, source, { keepSourceTheme: true });
		expect(target.themeColorMap?.accent1).toBe("#999999");
		expect(target.theme?.name).toBe("Source Theme");
	});

	it("does nothing with keepSourceTheme when source has no theme", () => {
		target.themeColorMap = { accent1: "#111111" };
		const src = makePptxData([makeSlide("s1", 1)]);
		mergePresentation(target, src, { keepSourceTheme: true });
		expect(target.themeColorMap?.accent1).toBe("#111111");
	});

	// -----------------------------------------------------------------------
	// isDirty flag
	// -----------------------------------------------------------------------

	it("marks merged slides as dirty", () => {
		mergePresentation(target, source);
		// The merged slides (last 3) should be marked dirty
		for (let i = 2; i < target.slides.length; i++) {
			expect(target.slides[i].isDirty).toBe(true);
		}
	});

	// -----------------------------------------------------------------------
	// Slide metadata
	// -----------------------------------------------------------------------

	it("preserves notes on merged slides", () => {
		const src = makePptxData([
			{
				...makeSlide("notesSlide", 1),
				notes: "These are speaker notes",
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.notes).toBe("These are speaker notes");
	});

	it("preserves transition on merged slides", () => {
		const src = makePptxData([
			{
				...makeSlide("transSlide", 1),
				transition: { type: "fade", durationMs: 1000 },
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.transition?.type).toBe("fade");
		expect(mergedSlide.transition?.durationMs).toBe(1000);
	});

	it("preserves hidden flag on merged slides", () => {
		const src = makePptxData([
			{
				...makeSlide("hiddenSlide", 1),
				hidden: true,
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.hidden).toBe(true);
	});

	it("preserves layoutPath and layoutName", () => {
		const src = makePptxData([
			{
				...makeSlide("layoutSlide", 1),
				layoutPath: "ppt/slideLayouts/slideLayout7.xml",
				layoutName: "Blank",
			},
		]);
		mergePresentation(target, src);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.layoutPath).toBe("ppt/slideLayouts/slideLayout7.xml");
		expect(mergedSlide.layoutName).toBe("Blank");
	});

	// -----------------------------------------------------------------------
	// Multiple merges
	// -----------------------------------------------------------------------

	it("handles multiple sequential merges without ID conflicts", () => {
		const src1 = makePptxData([
			makeSlide("slide1", 1, [makeTextElement("el1")]),
		]);
		const src2 = makePptxData([
			makeSlide("slide1", 1, [makeTextElement("el1")]),
		]);

		mergePresentation(target, src1);
		mergePresentation(target, src2);

		expect(target.slides.length).toBe(4);
		const allSlideIds = target.slides.map((s) => s.id);
		expect(new Set(allSlideIds).size).toBe(allSlideIds.length);

		const allElementIds: string[] = [];
		for (const slide of target.slides) {
			for (const el of slide.elements) {
				allElementIds.push(el.id);
			}
		}
		expect(new Set(allElementIds).size).toBe(allElementIds.length);
	});

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------

	it("handles slides with no elements", () => {
		const src = makePptxData([
			makeSlide("emptySlide", 1, []),
		]);
		const count = mergePresentation(target, src);
		expect(count).toBe(1);
		const mergedSlide = target.slides[target.slides.length - 1];
		expect(mergedSlide.elements).toEqual([]);
	});

	it("handles duplicate indices in slideIndices", () => {
		const count = mergePresentation(target, source, {
			slideIndices: [0, 0, 0],
		});
		// Each index produces a separate cloned slide
		expect(count).toBe(3);
		expect(target.slides.length).toBe(5);
		// All must have unique IDs
		const ids = target.slides.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
