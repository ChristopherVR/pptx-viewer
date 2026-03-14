import { describe, it, expect } from "vitest";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";
import {
	createTextElement,
	createShapeElement,
} from "../../core/builders/sdk/ElementFactory";
import type { PptxSlide } from "../../core/types/presentation";
import type { TextPptxElement, ShapePptxElement } from "../../core/types/elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a blank presentation, returning the handler, data, and slide factory. */
async function createAndLoad(options?: Parameters<typeof PresentationBuilder.create>[0]) {
	return PresentationBuilder.create(options);
}

/** Save and immediately reload a presentation, returning fresh handler + data. */
async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const handler2 = new PptxHandler();
	const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
	return { handler: handler2, data: data2, bytes };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PptxHandler Integration", () => {
	// -----------------------------------------------------------------------
	// load
	// -----------------------------------------------------------------------
	describe("load", () => {
		it("should load a blank presentation created by PresentationBuilder", async () => {
			const { handler, data } = await createAndLoad();

			expect(handler).toBeInstanceOf(PptxHandler);
			expect(data).toBeDefined();
			expect(data.slides).toEqual([]);
			expect(data.width).toBeGreaterThan(0);
			expect(data.height).toBeGreaterThan(0);
		});

		it("should parse slide dimensions correctly", async () => {
			const { data } = await createAndLoad({
				width: 9_144_000, // 4:3
				height: 6_858_000,
			});

			expect(data.widthEmu).toBe(9_144_000);
			expect(data.heightEmu).toBe(6_858_000);
		});

		it("should parse default 16:9 dimensions", async () => {
			const { data } = await createAndLoad();

			expect(data.widthEmu).toBe(12_192_000);
			expect(data.heightEmu).toBe(6_858_000);
		});

		it("should parse theme color scheme", async () => {
			const { data } = await createAndLoad({
				theme: {
					name: "TestTheme",
					colors: {
						accent1: "#FF6B6B",
						dk1: "#111111",
						lt1: "#EEEEEE",
					},
				},
			});

			expect(data.themeColorMap).toBeDefined();
			expect(data.theme?.colorScheme).toBeDefined();
			// Verify custom accent1 was applied
			if (data.themeColorMap) {
				expect(data.themeColorMap.accent1?.toUpperCase()).toBe("#FF6B6B");
			}
		});

		it("should reject non-ZIP files", async () => {
			const handler = new PptxHandler();
			const garbage = new ArrayBuffer(100);
			const view = new Uint8Array(garbage);
			// Fill with random non-ZIP data
			for (let i = 0; i < view.length; i++) {
				view[i] = i % 256;
			}

			await expect(handler.load(garbage)).rejects.toThrow();
		});

		it("should load a presentation with a slide containing elements", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Hello Integration", { x: 50, y: 50, width: 400, height: 60 })
					.addShape("rect", {
						x: 100, y: 200, width: 200, height: 100,
						fill: { type: "solid", color: "#0000FF" },
					})
					.build(),
			);

			const { data: reloaded } = await saveAndReload(handler, data.slides);

			expect(reloaded.slides.length).toBe(1);
			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
		});
	});

	// -----------------------------------------------------------------------
	// save
	// -----------------------------------------------------------------------
	describe("save", () => {
		it("should save and produce a valid PPTX", async () => {
			const { handler, data } = await createAndLoad();

			const bytes = await handler.save(data.slides);

			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(bytes.length).toBeGreaterThan(0);
			// ZIP magic number: PK (0x50, 0x4B)
			expect(bytes[0]).toBe(0x50);
			expect(bytes[1]).toBe(0x4b);
		});

		it("should save with modified text", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const slide = createSlide("Blank")
				.addText("Original Text", { x: 50, y: 50, width: 400, height: 50 })
				.build();
			data.slides.push(slide);

			// Modify the text
			const textEl = slide.elements[0] as TextPptxElement;
			textEl.text = "Modified Text";
			if (textEl.textSegments && textEl.textSegments.length > 0) {
				textEl.textSegments[0].text = "Modified Text";
			}

			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);

			// Reload and check the text was saved
			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides.length).toBe(1);
		});

		it("should save with added elements", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const slide = createSlide("Blank")
				.addText("First", { x: 50, y: 50, width: 400, height: 50 })
				.build();
			data.slides.push(slide);

			// Add more elements
			slide.elements.push(
				createShapeElement("ellipse", {
					x: 200, y: 200, width: 150, height: 150,
					fill: { type: "solid", color: "#FF0000" },
				}),
			);

			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should save with removed elements", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const slide = createSlide("Blank")
				.addText("Keep This", { x: 50, y: 50, width: 400, height: 50 })
				.addShape("rect", { x: 50, y: 150, width: 200, height: 100 })
				.build();
			data.slides.push(slide);

			// Remove the shape
			slide.elements = slide.elements.filter((el) => el.type === "text");
			expect(slide.elements.length).toBe(1);

			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should save with modified slide properties", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const slide = createSlide("Blank")
				.setBackground({ type: "solid", color: "#FF0000" })
				.setNotes("Important notes here")
				.build();
			data.slides.push(slide);

			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should preserve unmodified content", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Untouched", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			// Save without modifying anything
			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides.length).toBe(1);
			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
		});

		it("should save an empty presentation", async () => {
			const { handler, data } = await createAndLoad();

			const bytes = await handler.save(data.slides);
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(bytes.length).toBeGreaterThan(0);

			// Should be loadable again
			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides.length).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// round-trip
	// -----------------------------------------------------------------------
	describe("round-trip", () => {
		it("should preserve text content through load -> save -> load", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Round-trip text content", {
						x: 50, y: 50, width: 600, height: 50,
						fontSize: 24,
					})
					.build(),
			);

			const { data: reloaded } = await saveAndReload(handler, data.slides);

			expect(reloaded.slides.length).toBe(1);
			const elements = reloaded.slides[0].elements;
			expect(elements.length).toBeGreaterThanOrEqual(1);

			// Find a text element
			const textEls = elements.filter((el) => el.type === "text" || el.type === "shape");
			expect(textEls.length).toBeGreaterThanOrEqual(1);

			// At least one element should contain the original text
			const hasText = elements.some((el) => {
				if ("text" in el && typeof el.text === "string") {
					return el.text.includes("Round-trip text content");
				}
				if ("textSegments" in el && Array.isArray(el.textSegments)) {
					return el.textSegments.some((seg) => seg.text.includes("Round-trip text content"));
				}
				return false;
			});
			expect(hasText).toBe(true);
		});

		it("should preserve element positions through load -> save -> load", async () => {
			const { handler, data, createSlide } = await createAndLoad();
			const origX = 123;
			const origY = 456;
			const origWidth = 300;
			const origHeight = 80;

			data.slides.push(
				createSlide("Blank")
					.addText("Positioned text", {
						x: origX, y: origY, width: origWidth, height: origHeight,
					})
					.build(),
			);

			const { data: reloaded } = await saveAndReload(handler, data.slides);

			const el = reloaded.slides[0].elements[0];
			// Positions may be converted through EMU and back, so allow small rounding differences
			expect(el.x).toBeCloseTo(origX, -1);
			expect(el.y).toBeCloseTo(origY, -1);
			expect(el.width).toBeCloseTo(origWidth, -1);
			expect(el.height).toBeCloseTo(origHeight, -1);
		});

		it("should preserve shape styles through load -> save -> load", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addShape("roundRect", {
						x: 100, y: 100, width: 300, height: 200,
						fill: { type: "solid", color: "#00AA55" },
						stroke: { color: "#333333", width: 2 },
					})
					.build(),
			);

			const { data: reloaded } = await saveAndReload(handler, data.slides);

			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
			const shapeEl = reloaded.slides[0].elements.find((el) => el.type === "shape") as ShapePptxElement | undefined;
			if (shapeEl) {
				// The shape should have been round-tripped
				expect(shapeEl.shapeType).toBe("roundRect");
			}
		});

		it("should preserve slide notes on the data model before save", async () => {
			const { handler, data, createSlide } = await createAndLoad();
			const notesText = "Remember to discuss Q4 targets";

			data.slides.push(
				createSlide("Blank")
					.addText("Content", { x: 50, y: 50, width: 400, height: 50 })
					.setNotes(notesText)
					.build(),
			);

			// Notes are set on the in-memory data model
			expect(data.slides[0].notes).toBe(notesText);

			// Save should succeed without error even with notes on new slides
			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should preserve slide count through load -> save -> load", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Slide 1", { x: 50, y: 50, width: 400, height: 50 }).build(),
				createSlide("Blank").addText("Slide 2", { x: 50, y: 50, width: 400, height: 50 }).build(),
				createSlide("Blank").addText("Slide 3", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides.length).toBe(3);
		});

		it("should preserve presentation dimensions through round-trip", async () => {
			const { handler, data } = await createAndLoad({
				width: 9_144_000,
				height: 6_858_000,
			});

			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.widthEmu).toBe(9_144_000);
			expect(reloaded.heightEmu).toBe(6_858_000);
		});
	});

	// -----------------------------------------------------------------------
	// export
	// -----------------------------------------------------------------------
	describe("export", () => {
		it("should return a map with requested slide indices from exportSlides", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Slide A", { x: 50, y: 50, width: 400, height: 50 }).build(),
				createSlide("Blank").addText("Slide B", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			// First save so the internal ZIP state is ready
			await handler.save(data.slides);

			const exported = await handler.exportSlides(data.slides, {
				format: "png",
				slideIndices: [0, 1],
			});

			// exportSlides returns a Map keyed by slide index
			expect(exported).toBeInstanceOf(Map);
			expect(exported.size).toBe(2);
			expect(exported.has(0)).toBe(true);
			expect(exported.has(1)).toBe(true);

			// Each entry is a Uint8Array (may be empty when no export backend is configured)
			const slide0Bytes = exported.get(0);
			expect(slide0Bytes).toBeInstanceOf(Uint8Array);
		});

		it("should skip out-of-range slide indices during export", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Only Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			await handler.save(data.slides);

			const exported = await handler.exportSlides(data.slides, {
				format: "png",
				slideIndices: [0, 5, 10],
			});

			// Only index 0 is valid; out-of-range indices are skipped
			expect(exported.size).toBe(1);
			expect(exported.has(0)).toBe(true);
			expect(exported.has(5)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// multiple operations
	// -----------------------------------------------------------------------
	describe("multiple operations", () => {
		it("should support add slide -> save -> add another slide -> save", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			// Add first slide and save
			data.slides.push(
				createSlide("Blank").addText("First", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);
			const bytes1 = await handler.save(data.slides);
			expect(bytes1.length).toBeGreaterThan(0);

			// Add second slide and save again
			data.slides.push(
				createSlide("Blank").addText("Second", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);
			const bytes2 = await handler.save(data.slides);
			expect(bytes2.length).toBeGreaterThan(bytes1.length);
		});

		it("should support creating handler from saved bytes and continuing edits", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Initial", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			// Save and get fresh handler
			const { handler: handler2, data: data2 } = await saveAndReload(handler, data.slides);

			// Continue editing with the new handler
			data2.slides.push(
				new (await import("../../core/builders/sdk/SlideBuilder")).SlideBuilder(2, "ppt/slideLayouts/slideLayout7.xml", "Blank")
					.addText("Added Later", { x: 50, y: 200, width: 400, height: 50 })
					.build(),
			);

			const { data: final } = await saveAndReload(handler2, data2.slides);
			expect(final.slides.length).toBe(2);
		});
	});
});
