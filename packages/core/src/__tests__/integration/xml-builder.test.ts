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

describe("PptxXmlBuilder Integration", () => {
	// -----------------------------------------------------------------------
	// Navigation
	// -----------------------------------------------------------------------
	describe("navigation", () => {
		it("should navigate to slides by index", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Slide 1", { x: 50, y: 50, width: 400, height: 50 }).build(),
				createSlide("Blank").addText("Slide 2", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			// Should be able to navigate to both slides
			const slide0 = builder.slide(0);
			expect(slide0).toBeDefined();
			expect(slide0.project().elements.length).toBeGreaterThanOrEqual(1);

			const slide1 = builder.slide(1);
			expect(slide1).toBeDefined();
			expect(slide1.project().elements.length).toBeGreaterThanOrEqual(1);
		});

		it("should throw on out-of-range slide index", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Only Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			expect(() => builder.slide(-1)).toThrow();
			expect(() => builder.slide(1)).toThrow();
			expect(() => builder.slide(100)).toThrow();
		});

		it("should throw on non-integer slide index", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			expect(() => builder.slide(0.5)).toThrow();
			expect(() => builder.slide(NaN)).toThrow();
		});

		it("should support Pascal-case Slides() alias", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Hello", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			const slideFromSlides = builder.Slides(0);
			const slideFromSlide = builder.slide(0);

			expect(slideFromSlides.project()).toBe(slideFromSlide.project());
		});

		it("should return the underlying PptxData via project()", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Test", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);
			const projectData = builder.project();

			expect(projectData).toBe(data);
			expect(projectData.slides.length).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// Element operations
	// -----------------------------------------------------------------------
	describe("elements", () => {
		it("should add elements via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Original", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const newElement = createShapeElement("ellipse", {
				x: 200, y: 200, width: 150, height: 150,
				fill: { type: "solid", color: "#FF0000" },
			});

			builder.slide(0).elements().add(newElement);

			const elements = builder.slide(0).elements().project();
			expect(elements.length).toBe(2);
			expect(elements[1].type).toBe("shape");
		});

		it("should remove elements by ID via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const textEl = createTextElement("To Remove", { x: 50, y: 50, width: 400, height: 50 });
			const shapeEl = createShapeElement("rect", { x: 50, y: 150, width: 200, height: 100 });

			data.slides.push(
				createSlide("Blank")
					.addElement(textEl)
					.addElement(shapeEl)
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const beforeCount = builder.slide(0).elements().project().length;
			expect(beforeCount).toBe(2);

			builder.slide(0).elements().removeById(textEl.id);

			const afterElements = builder.slide(0).elements().project();
			expect(afterElements.length).toBe(1);
			expect(afterElements[0].type).toBe("shape");
		});

		it("should handle removing non-existent element ID gracefully", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Keep", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const beforeCount = builder.slide(0).elements().project().length;

			builder.slide(0).elements().removeById("nonexistent_id_12345");

			const afterCount = builder.slide(0).elements().project().length;
			expect(afterCount).toBe(beforeCount);
		});

		it("should handle removing with empty ID gracefully", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Keep", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const beforeCount = builder.slide(0).elements().project().length;

			builder.slide(0).elements().removeById("");
			builder.slide(0).elements().removeById("  ");

			const afterCount = builder.slide(0).elements().project().length;
			expect(afterCount).toBe(beforeCount);
		});

		it("should update elements by ID via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const textEl = createTextElement("Before Update", { x: 50, y: 50, width: 400, height: 50 });

			data.slides.push(
				createSlide("Blank").addElement(textEl).build(),
			);

			const builder = handler.createXmlBuilder(data);

			builder.slide(0).elements().updateById(textEl.id, (current) => {
				if (current.type === "text") {
					return {
						...current,
						text: "After Update",
						x: 200,
					};
				}
				return current;
			});

			const updated = builder.slide(0).elements().project();
			expect(updated.length).toBe(1);
			const updatedEl = updated[0] as TextPptxElement;
			expect(updatedEl.text).toBe("After Update");
			expect(updatedEl.x).toBe(200);
		});

		it("should preserve other elements when updating one", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const text1 = createTextElement("First", { x: 50, y: 50, width: 200, height: 40 });
			const text2 = createTextElement("Second", { x: 50, y: 100, width: 200, height: 40 });
			const shape = createShapeElement("rect", { x: 50, y: 150, width: 200, height: 100 });

			data.slides.push(
				createSlide("Blank")
					.addElement(text1)
					.addElement(text2)
					.addElement(shape)
					.build(),
			);

			const builder = handler.createXmlBuilder(data);

			// Update only the second text element
			builder.slide(0).elements().updateById(text2.id, (current) => ({
				...current,
				text: "Updated Second",
			} as TextPptxElement));

			const elements = builder.slide(0).elements().project();
			expect(elements.length).toBe(3);

			// First and third should be unchanged
			expect((elements[0] as TextPptxElement).text).toBe("First");
			expect(elements[2].type).toBe("shape");

			// Second should be updated
			expect((elements[1] as TextPptxElement).text).toBe("Updated Second");
		});

		it("added elements should persist through save", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Original", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).elements().add(
				createShapeElement("rect", {
					x: 300, y: 300, width: 100, height: 100,
					fill: { type: "solid", color: "#00FF00" },
				}),
			);

			// Save and reload
			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(2);
		});

		it("removed elements should not appear after save", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const el1 = createTextElement("Keep", { x: 50, y: 50, width: 200, height: 40 });
			const el2 = createTextElement("Remove", { x: 50, y: 100, width: 200, height: 40 });

			data.slides.push(
				createSlide("Blank").addElement(el1).addElement(el2).build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).elements().removeById(el2.id);

			// After removal, only 1 element should remain
			expect(data.slides[0].elements.length).toBe(1);

			const { data: reloaded } = await saveAndReload(handler, data.slides);
			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
		});
	});

	// -----------------------------------------------------------------------
	// Notes operations
	// -----------------------------------------------------------------------
	describe("notes", () => {
		it("should set notes via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).notes().set("Speaker notes via builder");

			expect(data.slides[0].notes).toBe("Speaker notes via builder");
		});

		it("should add notes (append) via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.setNotes("Line 1")
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).notes().add("Line 2");

			expect(data.slides[0].notes).toBe("Line 1\nLine 2");
		});

		it("should clear notes via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.setNotes("Notes to clear")
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).notes().clear();

			expect(data.slides[0].notes).toBeUndefined();
			expect(data.slides[0].notesSegments).toBeUndefined();
		});

		it("should get notes via builder", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.setNotes("Readable notes")
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const notesText = builder.slide(0).notes().get();

			expect(notesText).toBe("Readable notes");
		});

		it("should return undefined for slides without notes", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("No notes", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			const notesText = builder.slide(0).notes().get();

			expect(notesText).toBeUndefined();
		});

		it("notes modifications should persist on the data model", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).notes().set("Persistent notes via builder");

			// The notes are set on the in-memory data model
			expect(data.slides[0].notes).toBe("Persistent notes via builder");

			// Save should succeed without error even though new slides
			// don't have notesSlide parts in the ZIP
			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);
		});

		it("should sync notesSegments when setting notes", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Slide", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);
			builder.slide(0).notes().set("Line A\nLine B\nLine C");

			expect(data.slides[0].notes).toBe("Line A\nLine B\nLine C");
			expect(data.slides[0].notesSegments).toBeDefined();
			// Should have text segments + paragraph break segments
			const segments = data.slides[0].notesSegments!;
			expect(segments.length).toBe(5); // "Line A", \n, "Line B", \n, "Line C"
			expect(segments[0].text).toBe("Line A");
			expect(segments[1].isParagraphBreak).toBe(true);
			expect(segments[2].text).toBe("Line B");
		});
	});

	// -----------------------------------------------------------------------
	// Chaining
	// -----------------------------------------------------------------------
	describe("chaining", () => {
		it("should support fluent method chaining", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank")
					.addText("Chainable", { x: 50, y: 50, width: 400, height: 50 })
					.build(),
			);

			const builder = handler.createXmlBuilder(data);

			// Chain: navigate to slide -> elements -> add -> done -> notes -> set -> done -> done
			builder
				.slide(0)
				.elements()
				.add(createShapeElement("rect", { x: 50, y: 150, width: 200, height: 100 }))
				.done()
				.notes()
				.set("Chained notes")
				.done()
				.done();

			expect(data.slides[0].elements.length).toBe(2);
			expect(data.slides[0].notes).toBe("Chained notes");
		});

		it("should support navigating between slides", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			data.slides.push(
				createSlide("Blank").addText("Slide 1", { x: 50, y: 50, width: 400, height: 50 }).build(),
				createSlide("Blank").addText("Slide 2", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			// Modify slide 0
			builder.slide(0).notes().set("Notes for slide 1");

			// Modify slide 1
			builder.slide(1).notes().set("Notes for slide 2");

			expect(data.slides[0].notes).toBe("Notes for slide 1");
			expect(data.slides[1].notes).toBe("Notes for slide 2");
		});

		it("should support multiple operations on the same slide", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const text1 = createTextElement("A", { x: 10, y: 10, width: 200, height: 40 });
			const text2 = createTextElement("B", { x: 10, y: 60, width: 200, height: 40 });

			data.slides.push(
				createSlide("Blank").addElement(text1).addElement(text2).build(),
			);

			const builder = handler.createXmlBuilder(data);
			const slideBuilder = builder.slide(0);

			// Remove one element, add another, set notes
			slideBuilder.elements().removeById(text2.id);
			slideBuilder.elements().add(
				createShapeElement("ellipse", { x: 300, y: 100, width: 100, height: 100 }),
			);
			slideBuilder.notes().set("After operations");

			// Should have 2 elements (original text1 + new shape, text2 removed)
			expect(data.slides[0].elements.length).toBe(2);
			expect(data.slides[0].elements[0].id).toBe(text1.id);
			expect(data.slides[0].elements[1].type).toBe("shape");
			expect(data.slides[0].notes).toBe("After operations");
		});

		it("complex builder operations should survive save and reload", async () => {
			const { handler, data, createSlide } = await createAndLoad();

			const keepEl = createTextElement("Keep Me", { x: 50, y: 50, width: 300, height: 40 });
			const removeEl = createTextElement("Remove Me", { x: 50, y: 100, width: 300, height: 40 });

			data.slides.push(
				createSlide("Blank").addElement(keepEl).addElement(removeEl).build(),
				createSlide("Blank").addText("Second Slide", { x: 50, y: 50, width: 400, height: 50 }).build(),
			);

			const builder = handler.createXmlBuilder(data);

			// Complex operations: remove element and add new one
			builder.slide(0).elements().removeById(removeEl.id);
			builder.slide(0).elements().add(
				createShapeElement("rect", { x: 400, y: 50, width: 150, height: 150, fill: { type: "solid", color: "#CCDDEE" } }),
			);

			// Verify in-memory changes before save
			expect(data.slides[0].elements.length).toBe(2); // keep + new shape
			expect(data.slides[0].elements[0].id).toBe(keepEl.id);
			expect(data.slides[0].elements[1].type).toBe("shape");

			// Save and reload
			const { data: reloaded } = await saveAndReload(handler, data.slides);

			expect(reloaded.slides.length).toBe(2);
			// Elements on each slide should be present after reload
			expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
			expect(reloaded.slides[1].elements.length).toBeGreaterThanOrEqual(1);
		});
	});
});
