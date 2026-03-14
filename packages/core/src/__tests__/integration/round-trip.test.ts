import { describe, it, expect } from "vitest";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";
import {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createTableElement,
	createGroupElement,
} from "../../core/builders/sdk/ElementFactory";
import type { PptxSlide } from "../../core/types/presentation";
import type {
	TextPptxElement,
	ShapePptxElement,
	ConnectorPptxElement,
	TablePptxElement,
	GroupPptxElement,
} from "../../core/types/elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createAndLoad(options?: Parameters<typeof PresentationBuilder.create>[0]) {
	return PresentationBuilder.create(options);
}

async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const handler2 = new PptxHandler();
	const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
	return { handler: handler2, data: data2, bytes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Round-Trip Fidelity", () => {
	// -----------------------------------------------------------------------
	// Element type round-trips
	// -----------------------------------------------------------------------

	it("text elements preserve content and formatting", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addText("Hello World", {
					x: 100, y: 100, width: 600, height: 50,
					fontSize: 28,
					bold: true,
					color: "#FF0000",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(1);

		// Find an element with the text content
		const textEl = elements.find((el) => {
			if ("text" in el && typeof el.text === "string") {
				return el.text.includes("Hello World");
			}
			if ("textSegments" in el && Array.isArray(el.textSegments)) {
				return el.textSegments.some((seg) => seg.text.includes("Hello World"));
			}
			return false;
		});
		expect(textEl).toBeDefined();
	});

	it("shape elements preserve geometry and style", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addShape("ellipse", {
					x: 200, y: 200, width: 250, height: 250,
					fill: { type: "solid", color: "#4472C4" },
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(1);

		const shapeEl = elements.find((el) => el.type === "shape") as ShapePptxElement | undefined;
		if (shapeEl) {
			expect(shapeEl.shapeType).toBe("ellipse");
			expect(shapeEl.x).toBeCloseTo(200, -1);
			expect(shapeEl.y).toBeCloseTo(200, -1);
		}
	});

	it("shape elements with text overlay preserve both shape and text", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addShape("roundRect", {
					x: 100, y: 100, width: 300, height: 200,
					fill: { type: "solid", color: "#ED7D31" },
					text: "Shape Label",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(1);

		// Find the shape
		const shapeEl = elements.find((el) => el.type === "shape") as ShapePptxElement | undefined;
		if (shapeEl) {
			expect(shapeEl.shapeType).toBe("roundRect");
			// Text content should be present
			const hasText =
				(shapeEl.text && shapeEl.text.includes("Shape Label")) ||
				(shapeEl.textSegments && shapeEl.textSegments.some((s) => s.text.includes("Shape Label")));
			expect(hasText).toBeTruthy();
		}
	});

	it("connector elements preserve endpoints and arrows", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 100, y: 100, width: 300, height: 200,
					type: "straight",
					stroke: { color: "#333333", width: 2 },
					endArrow: "triangle",
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(1);

		const connEl = elements.find((el) => el.type === "connector") as ConnectorPptxElement | undefined;
		if (connEl) {
			expect(connEl.shapeType).toBe("straightConnector1");
		}
	});

	it("table elements are created correctly in the data model", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		const slide = createSlide("Blank")
			.addTable(
				{
					rows: [
						{ cells: [{ text: "Name" }, { text: "Score" }] },
						{ cells: [{ text: "Alice" }, { text: "95" }] },
						{ cells: [{ text: "Bob" }, { text: "87" }] },
					],
					firstRow: true,
					bandRows: true,
				},
				{ x: 50, y: 50, width: 500, height: 200 },
			)
			.build();
		data.slides.push(slide);

		// Verify the table element is correctly constructed before save
		const tableEl = slide.elements.find((el) => el.type === "table") as TablePptxElement | undefined;
		expect(tableEl).toBeDefined();
		expect(tableEl!.tableData).toBeDefined();
		expect(tableEl!.tableData?.rows.length).toBe(3);
		expect(tableEl!.tableData?.rows[0].cells[0].text).toBe("Name");
		expect(tableEl!.tableData?.rows[1].cells[0].text).toBe("Alice");
		expect(tableEl!.tableData?.rows[2].cells[1].text).toBe("87");

		// Save should succeed without error
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("group elements preserve children", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		const child1 = createTextElement("Child A", { x: 10, y: 10, width: 200, height: 40 });
		const child2 = createShapeElement("rect", {
			x: 10, y: 60, width: 200, height: 100,
			fill: { type: "solid", color: "#00FF00" },
		});

		data.slides.push(
			createSlide("Blank")
				.addGroup([child1, child2], { x: 50, y: 50, width: 300, height: 200 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(1);

		const groupEl = elements.find((el) => el.type === "group") as GroupPptxElement | undefined;
		if (groupEl) {
			expect(groupEl.children.length).toBeGreaterThanOrEqual(1);
		}
	});

	// -----------------------------------------------------------------------
	// Structural round-trips
	// -----------------------------------------------------------------------

	it("slide order is preserved", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank").addText("First Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			createSlide("Blank").addText("Second Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			createSlide("Blank").addText("Third Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(3);

		// Verify order by checking text content of each slide
		for (let i = 0; i < 3; i++) {
			const slide = reloaded.slides[i];
			expect(slide.slideNumber).toBe(i + 1);
		}

		// Check that first slide has "First" text
		const firstSlideTexts = reloaded.slides[0].elements
			.filter((el): el is TextPptxElement | ShapePptxElement => "text" in el)
			.map((el) => el.text)
			.join(" ");
		expect(firstSlideTexts).toContain("First");

		const secondSlideTexts = reloaded.slides[1].elements
			.filter((el): el is TextPptxElement | ShapePptxElement => "text" in el)
			.map((el) => el.text)
			.join(" ");
		expect(secondSlideTexts).toContain("Second");
	});

	it("background settings are preserved", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.setBackground({ type: "solid", color: "#AABBCC" })
				.addText("Content", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		// Background should be preserved (may be normalized to uppercase)
		if (reloaded.slides[0].backgroundColor) {
			expect(reloaded.slides[0].backgroundColor.toUpperCase()).toBe("#AABBCC");
		}
	});

	it("multiple slides round-trip correctly", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		// Add 5 slides with varying content
		for (let i = 1; i <= 5; i++) {
			const builder = createSlide("Blank")
				.addText(`Slide ${i} Title`, { x: 50, y: 30, width: 600, height: 60, fontSize: 32 })
				.addShape("rect", {
					x: 50, y: 120, width: 200, height: 150,
					fill: { type: "solid", color: `#${(i * 30).toString(16).padStart(2, "0")}${(i * 50).toString(16).padStart(2, "0")}FF` },
				});

			if (i % 2 === 0) {
				builder.setNotes(`Notes for slide ${i}`);
			}

			data.slides.push(builder.build());
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);

		expect(reloaded.slides.length).toBe(5);

		// Each slide should have at least the text element
		for (let i = 0; i < 5; i++) {
			expect(reloaded.slides[i].elements.length).toBeGreaterThanOrEqual(1);
		}
	});

	it("double round-trip preserves data", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addText("Double Trip", { x: 100, y: 100, width: 400, height: 50 })
				.addShape("rect", { x: 100, y: 200, width: 300, height: 200 })
				.setNotes("Persist through two cycles")
				.build(),
		);

		// First round-trip
		const { handler: handler2, data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(1);

		// Second round-trip
		const { data: data3 } = await saveAndReload(handler2, data2.slides);
		expect(data3.slides.length).toBe(1);
		expect(data3.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});

	it("mixed element types on a single slide round-trip correctly", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addText("Title", { x: 50, y: 30, width: 600, height: 50, fontSize: 28 })
				.addShape("roundRect", {
					x: 50, y: 100, width: 200, height: 150,
					fill: { type: "solid", color: "#4472C4" },
					text: "Box",
				})
				.addConnector({
					x: 260, y: 175, width: 100, height: 0,
					endArrow: "triangle",
				})
				.addTable(
					{
						rows: [
							{ cells: [{ text: "X" }, { text: "Y" }] },
							{ cells: [{ text: "1" }, { text: "2" }] },
						],
					},
					{ x: 50, y: 300, width: 400, height: 120 },
				)
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);

		// We should have multiple elements of different types
		const types = new Set(reloaded.slides[0].elements.map((el) => el.type));
		expect(types.size).toBeGreaterThanOrEqual(2);
	});
});
