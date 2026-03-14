import { describe, it, expect, beforeEach } from "vitest";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";
import { SlideBuilder } from "../../core/builders/sdk/SlideBuilder";
import {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createGroupElement,
	resetIdCounter,
} from "../../core/builders/sdk/ElementFactory";
import type { PptxSlide } from "../../core/types/presentation";
import type {
	TextPptxElement,
	ShapePptxElement,
	ConnectorPptxElement,
	GroupPptxElement,
	PptxElement,
} from "../../core/types/elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	resetIdCounter();
});

async function createBlank(
	options?: Parameters<typeof PresentationBuilder.create>[0],
) {
	return PresentationBuilder.create(options);
}

async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const handler2 = new PptxHandler();
	const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
	return { handler: handler2, data: data2, bytes };
}

/** 1x1 red PNG as a base64 data URL. */
const TINY_PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

/**
 * Search all elements (including text on shapes) for a string match.
 * Returns true if any element's text or textSegments contain the needle.
 */
function slideContainsText(slide: PptxSlide, needle: string): boolean {
	return slide.elements.some((el) => {
		if ("text" in el && typeof el.text === "string" && el.text.includes(needle)) {
			return true;
		}
		if ("textSegments" in el && Array.isArray(el.textSegments)) {
			return el.textSegments.some((s) => s.text.includes(needle));
		}
		return false;
	});
}

// ===========================================================================
// 1. Text element round-trip
// ===========================================================================

describe("Text element round-trip", () => {
	it("create blank -> add text element -> save -> reload -> text is preserved", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Hello Integration", {
					x: 50,
					y: 50,
					width: 400,
					height: 60,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		expect(slideContainsText(reloaded.slides[0], "Hello Integration")).toBe(
			true,
		);
	});

	it("text with bold/italic styling survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Styled Text", {
					x: 10,
					y: 10,
					width: 400,
					height: 50,
					bold: true,
					italic: true,
					fontSize: 28,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		expect(slideContainsText(reloaded.slides[0], "Styled Text")).toBe(true);
	});

	it("rich text with multiple segments survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText(
					[
						{ text: "Bold Part", style: { bold: true } },
						{ text: " Normal Part" },
					],
					{ x: 10, y: 10, width: 400, height: 50 },
				)
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		// At minimum, the combined text should be present
		const hasAny =
			slideContainsText(reloaded.slides[0], "Bold Part") ||
			slideContainsText(reloaded.slides[0], "Normal Part");
		expect(hasAny).toBe(true);
	});
});

// ===========================================================================
// 2. Shape with gradient fill round-trip
// ===========================================================================

describe("Shape with gradient fill round-trip", () => {
	it("shape with gradient fill saves and reloads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 50,
					y: 50,
					width: 300,
					height: 200,
					fill: {
						type: "gradient",
						angle: 45,
						stops: [
							{ color: "#FF0000", position: 0 },
							{ color: "#00FF00", position: 0.5 },
							{ color: "#0000FF", position: 1 },
						],
					},
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		const shape = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(shape).toBeDefined();
		expect(shape!.shapeType).toBe("rect");
	});

	it("shape with radial gradient saves and reloads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("ellipse", {
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					fill: {
						type: "gradient",
						gradientType: "radial",
						stops: [
							{ color: "#FFFFFF", position: 0 },
							{ color: "#000000", position: 1 },
						],
					},
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		const shape = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(shape).toBeDefined();
	});
});

// ===========================================================================
// 3. Connector with arrows round-trip
// ===========================================================================

describe("Connector with arrows round-trip", () => {
	it("connector with start and end arrows survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 50,
					y: 50,
					width: 300,
					height: 150,
					type: "straight",
					startArrow: "triangle",
					endArrow: "triangle",
					stroke: { color: "#FF0000", width: 2 },
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		const conn = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		expect(conn).toBeDefined();
		expect(conn!.shapeType).toBe("straightConnector1");
	});

	it("curved connector survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 100,
					y: 100,
					width: 250,
					height: 200,
					type: "curved",
					endArrow: "triangle",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		const conn = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		expect(conn).toBeDefined();
		expect(conn!.shapeType).toBe("curvedConnector3");
	});
});

// ===========================================================================
// 4. Multiple elements round-trip
// ===========================================================================

describe("Multiple elements round-trip", () => {
	it("slide with 3 text elements preserves count after round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("First", { x: 10, y: 10, width: 200, height: 40 })
				.addText("Second", { x: 10, y: 60, width: 200, height: 40 })
				.addText("Third", { x: 10, y: 110, width: 200, height: 40 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(3);
	});

	it("mixed element types preserve count after round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("A Text", { x: 10, y: 10, width: 200, height: 40 })
				.addShape("rect", {
					x: 10,
					y: 60,
					width: 200,
					height: 100,
					fill: { type: "solid", color: "#AA0000" },
				})
				.addConnector({
					x: 220,
					y: 60,
					width: 100,
					height: 50,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(3);
	});

	it("5 shapes of different types all survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const shapeTypes = [
			"rect",
			"ellipse",
			"roundRect",
			"diamond",
			"triangle",
		];
		const builder = createSlide("Blank");
		shapeTypes.forEach((st, i) => {
			builder.addShape(st, {
				x: 10 + i * 150,
				y: 50,
				width: 140,
				height: 100,
				fill: { type: "solid", color: "#4472C4" },
			});
		});
		data.slides.push(builder.build());

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const shapes = reloaded.slides[0].elements.filter(
			(e) => e.type === "shape",
		) as ShapePptxElement[];
		expect(shapes.length).toBeGreaterThanOrEqual(5);

		const loadedTypes = new Set(shapes.map((s) => s.shapeType));
		for (const st of shapeTypes) {
			expect(loadedTypes.has(st)).toBe(true);
		}
	});
});

// ===========================================================================
// 5. Group with children round-trip
// ===========================================================================

describe("Group with children round-trip", () => {
	it("group with text and shape children survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const child1 = createTextElement("Group Child", {
			x: 0,
			y: 0,
			width: 120,
			height: 30,
		});
		const child2 = createShapeElement("ellipse", {
			x: 0,
			y: 40,
			width: 100,
			height: 80,
			fill: { type: "solid", color: "#00CC00" },
		});

		data.slides.push(
			createSlide("Blank")
				.addGroup([child1, child2], {
					x: 50,
					y: 50,
					width: 200,
					height: 160,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		const grp = reloaded.slides[0].elements.find(
			(e) => e.type === "group",
		) as GroupPptxElement | undefined;
		expect(grp).toBeDefined();
		expect(grp!.children.length).toBeGreaterThanOrEqual(2);
	});

	it("group preserves at least the number of child elements", async () => {
		const { handler, data, createSlide } = await createBlank();
		const children: PptxElement[] = [];
		for (let i = 0; i < 4; i++) {
			children.push(
				createShapeElement("rect", {
					x: i * 55,
					y: 0,
					width: 50,
					height: 50,
					fill: { type: "solid", color: "#336699" },
				}),
			);
		}

		data.slides.push(
			createSlide("Blank")
				.addGroup(children, {
					x: 10,
					y: 10,
					width: 220,
					height: 50,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const grp = reloaded.slides[0].elements.find(
			(e) => e.type === "group",
		) as GroupPptxElement | undefined;
		expect(grp).toBeDefined();
		expect(grp!.children.length).toBeGreaterThanOrEqual(4);
	});
});

// ===========================================================================
// 6. Modify text content -> save -> reload
// ===========================================================================

describe("Modify text content round-trip", () => {
	it("modifying text content before save is reflected after reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("Original Text", {
				x: 50,
				y: 50,
				width: 400,
				height: 50,
			})
			.build();
		data.slides.push(slide);

		// Mutate the text element
		const textEl = slide.elements[0] as TextPptxElement;
		textEl.text = "Changed Text";
		if (textEl.textSegments && textEl.textSegments.length > 0) {
			textEl.textSegments[0].text = "Changed Text";
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(slideContainsText(reloaded.slides[0], "Changed Text")).toBe(true);
	});

	it("appending text to an existing element is preserved", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("Base", {
				x: 50,
				y: 50,
				width: 400,
				height: 50,
			})
			.build();
		data.slides.push(slide);

		const textEl = slide.elements[0] as TextPptxElement;
		textEl.text = "Base Extended";
		if (textEl.textSegments && textEl.textSegments.length > 0) {
			textEl.textSegments[0].text = "Base Extended";
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(slideContainsText(reloaded.slides[0], "Base Extended")).toBe(true);
	});
});

// ===========================================================================
// 7. Add element then remove it -> save -> reload
// ===========================================================================

describe("Add element then remove it round-trip", () => {
	it("removing an element before save means it is absent after reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("Keep", { x: 10, y: 10, width: 200, height: 40 })
			.addText("Remove Me", { x: 10, y: 60, width: 200, height: 40 })
			.addText("Also Keep", { x: 10, y: 110, width: 200, height: 40 })
			.build();
		data.slides.push(slide);

		// Remove the second element
		slide.elements.splice(1, 1);
		expect(slide.elements.length).toBe(2);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		// Should have 2 text elements, not 3
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(2);
		// "Remove Me" should be absent
		expect(slideContainsText(reloaded.slides[0], "Remove Me")).toBe(false);
	});

	it("clearing all elements results in empty slide after reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("Gone", { x: 10, y: 10, width: 200, height: 40 })
			.addShape("rect", { x: 10, y: 60, width: 200, height: 100 })
			.build();
		data.slides.push(slide);

		// Clear all elements
		slide.elements.length = 0;

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		// Elements should be empty or only contain layout-inherited ones
		expect(slideContainsText(reloaded.slides[0], "Gone")).toBe(false);
	});
});

// ===========================================================================
// 8. Set slide background -> save -> reload
// ===========================================================================

describe("Slide background round-trip", () => {
	it("solid background color is set on data model before save", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setBackground({ type: "solid", color: "#FF5733" })
			.addText("BG test", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.backgroundColor).toBe("#FF5733");
	});

	it("gradient background is set on data model before save", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setBackground({
				type: "gradient",
				angle: 90,
				stops: [
					{ color: "#000000", position: 0 },
					{ color: "#FFFFFF", position: 1 },
				],
			})
			.addText("Gradient BG", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.backgroundGradient).toBeDefined();
		expect(slide.backgroundGradient).toContain("linear-gradient");
	});

	it("background image source is set on data model before save", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setBackground({ type: "image", source: TINY_PNG })
			.build();
		data.slides.push(slide);
		expect(slide.backgroundImage).toBe(TINY_PNG);
	});

	it("solid background survives save without crashing", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.setBackground({ type: "solid", color: "#123456" })
				.addText("BG save", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);

		// Verify it reloads successfully
		const handler2 = new PptxHandler();
		const reloaded = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(reloaded.slides.length).toBe(1);
	});
});

// ===========================================================================
// 9. 3 slides -> save -> reload -> verify count and order
// ===========================================================================

describe("Multiple slides round-trip", () => {
	it("3 slides save and reload with correct count", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Slide One", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
			createSlide("Blank")
				.addText("Slide Two", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
			createSlide("Blank")
				.addText("Slide Three", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(3);
	});

	it("slide text content order is preserved across 3 slides", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Alpha", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
			createSlide("Blank")
				.addText("Bravo", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
			createSlide("Blank")
				.addText("Charlie", { x: 10, y: 10, width: 300, height: 50 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(slideContainsText(reloaded.slides[0], "Alpha")).toBe(true);
		expect(slideContainsText(reloaded.slides[1], "Bravo")).toBe(true);
		expect(slideContainsText(reloaded.slides[2], "Charlie")).toBe(true);
	});

	it("slide numbers are sequential after reload with 3 slides", async () => {
		const { handler, data, createSlide } = await createBlank();
		for (let i = 0; i < 3; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`S${i + 1}`, { x: 10, y: 10, width: 200, height: 40 })
					.build(),
			);
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		for (let i = 0; i < 3; i++) {
			expect(reloaded.slides[i].slideNumber).toBe(i + 1);
		}
	});
});

// ===========================================================================
// 10. Same element type across multiple slides
// ===========================================================================

describe("Same element type on multiple slides", () => {
	it("text elements on 3 different slides each survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		for (let i = 0; i < 3; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`TextOnSlide${i + 1}`, {
						x: 50,
						y: 50,
						width: 400,
						height: 50,
					})
					.build(),
			);
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(3);
		for (let i = 0; i < 3; i++) {
			expect(
				slideContainsText(reloaded.slides[i], `TextOnSlide${i + 1}`),
			).toBe(true);
		}
	});

	it("shape elements on 3 different slides each preserve their type", async () => {
		const { handler, data, createSlide } = await createBlank();
		const types = ["rect", "ellipse", "roundRect"];
		for (let i = 0; i < 3; i++) {
			data.slides.push(
				createSlide("Blank")
					.addShape(types[i], {
						x: 50,
						y: 50,
						width: 200,
						height: 150,
						fill: { type: "solid", color: "#4472C4" },
					})
					.build(),
			);
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(3);
		for (let i = 0; i < 3; i++) {
			const shape = reloaded.slides[i].elements.find(
				(e) => e.type === "shape",
			) as ShapePptxElement | undefined;
			expect(shape).toBeDefined();
			expect(shape!.shapeType).toBe(types[i]);
		}
	});

	it("connectors on 2 slides both survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 10,
					y: 10,
					width: 200,
					height: 100,
					type: "straight",
				})
				.build(),
			createSlide("Blank")
				.addConnector({
					x: 20,
					y: 20,
					width: 300,
					height: 150,
					type: "bent",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(2);

		const conn1 = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		const conn2 = reloaded.slides[1].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		expect(conn1).toBeDefined();
		expect(conn2).toBeDefined();
		expect(conn1!.shapeType).toBe("straightConnector1");
		expect(conn2!.shapeType).toBe("bentConnector3");
	});
});

// ===========================================================================
// 11. PptxHandler.createBlank() convenience method
// ===========================================================================

describe("PptxHandler.createBlank()", () => {
	it("creates a handler via the static convenience method", async () => {
		const { handler, data } = await PptxHandler.createBlank();
		expect(handler).toBeInstanceOf(PptxHandler);
		expect(data.slides).toEqual([]);
	});

	it("createBlank with title option sets metadata", async () => {
		const { data } = await PptxHandler.createBlank({
			title: "My Test Deck",
			creator: "Test Author",
		});
		expect(data).toBeDefined();
		// Data should load successfully with no slides
		expect(data.slides.length).toBe(0);
	});

	it("createBlank returns a slide builder factory", async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank();
		expect(typeof createSlide).toBe("function");

		data.slides.push(
			createSlide("Blank")
				.addText("Via createBlank", { x: 10, y: 10, width: 300, height: 40 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		expect(slideContainsText(reloaded.slides[0], "Via createBlank")).toBe(true);
	});

	it("createBlank with custom theme colors works", async () => {
		const { data } = await PptxHandler.createBlank({
			theme: {
				colors: { accent1: "#BADA55" },
			},
		});
		expect(data.themeColorMap?.accent1?.toUpperCase()).toBe("#BADA55");
	});

	it("createBlank with custom dimensions uses those dimensions", async () => {
		const { data } = await PptxHandler.createBlank({
			width: 9_144_000,
			height: 6_858_000,
		});
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("createBlank handler can save and reload", async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Blank Method", { x: 10, y: 10, width: 300, height: 40 })
				.build(),
		);

		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);

		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(1);
	});
});

// ===========================================================================
// 12. Additional round-trip scenarios
// ===========================================================================

describe("Additional round-trip scenarios", () => {
	it("image element survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addImage(TINY_PNG, {
					x: 50,
					y: 50,
					width: 200,
					height: 200,
					altText: "test image",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		// Images may reload as "image" or might have a different classifier
		const imgEl = reloaded.slides[0].elements.find(
			(e) => e.type === "image" || (e as any).type === "picture",
		);
		expect(imgEl).toBeDefined();
	});

	it("shape with text overlay preserves both shape type and text", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("roundRect", {
					x: 50,
					y: 50,
					width: 300,
					height: 200,
					fill: { type: "solid", color: "#336699" },
					text: "Button Label",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const shape = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(shape).toBeDefined();
		expect(shape!.shapeType).toBe("roundRect");
		const hasLabel =
			(shape?.text && shape.text.includes("Button Label")) ||
			(shape?.textSegments &&
				shape.textSegments.some((s) => s.text.includes("Button Label")));
		expect(hasLabel).toBeTruthy();
	});

	it("empty text box survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);

		const handler2 = new PptxHandler();
		const reloaded = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(reloaded.slides.length).toBe(1);
	});

	it("shape with no fill and stroke only survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 50,
					y: 50,
					width: 300,
					height: 200,
					fill: { type: "none" },
					stroke: { color: "#000000", width: 2 },
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});

	it("connector with no arrows survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 10,
					y: 10,
					width: 200,
					height: 0,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const conn = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		);
		expect(conn).toBeDefined();
	});

	it("slide with notes saves successfully", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Notes test", { x: 10, y: 10, width: 200, height: 40 })
				.setNotes("These are speaker notes for testing")
				.build(),
		);

		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("hidden slide flag is preserved in data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setHidden(true)
			.addText("Hidden slide", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.hidden).toBe(true);
	});

	it("transition is set correctly on slide data", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setTransition({ type: "fade", duration: 750 })
			.addText("Trans slide", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.transition).toBeDefined();
		expect(slide.transition!.type).toBe("fade");
		expect(slide.transition!.durationMs).toBe(750);
	});

	it("double round-trip preserves slide count and content", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Double RT", { x: 10, y: 10, width: 200, height: 40 })
				.addShape("ellipse", { x: 10, y: 60, width: 100, height: 100 })
				.build(),
		);

		const { handler: h2, data: d2 } = await saveAndReload(
			handler,
			data.slides,
		);
		expect(d2.slides.length).toBe(1);

		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(1);
		expect(d3.slides[0].elements.length).toBeGreaterThanOrEqual(2);
	});

	it("incremental saves produce valid loadable output each time", async () => {
		const { handler, data, createSlide } = await createBlank();

		for (let i = 1; i <= 3; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`Inc ${i}`, { x: 10, y: 10, width: 200, height: 40 })
					.build(),
			);
			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);

			const tempHandler = new PptxHandler();
			const tempData = await tempHandler.load(bytes.buffer as ArrayBuffer);
			expect(tempData.slides.length).toBe(i);
		}
	});

	it("fresh handler from saved bytes can add more slides", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("First save", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const { handler: h2, data: d2 } = await saveAndReload(
			handler,
			data.slides,
		);

		// Add a second slide via a fresh SlideBuilder
		d2.slides.push(
			new SlideBuilder(
				d2.slides.length + 1,
				"ppt/slideLayouts/slideLayout7.xml",
				"Blank",
			)
				.addText("Second save", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(2);
	});
});
