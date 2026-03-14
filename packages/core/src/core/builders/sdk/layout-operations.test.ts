import { describe, it, expect, beforeEach } from "vitest";
import { PresentationBuilder } from "./PresentationBuilder";
import { SlideBuilder } from "./SlideBuilder";
import { PptxHandler } from "../../PptxHandler";
import {
	createLayout,
	createLayouts,
	findLayoutByName,
	findLayoutByType,
	generateLayoutXml,
} from "./layout-operations";
import type { LayoutDefinition } from "./layout-operations";
import type { PptxData } from "../../types/presentation";

describe("layout-operations", () => {
	// -----------------------------------------------------------------------
	// generateLayoutXml — pure XML generation tests (no handler needed)
	// -----------------------------------------------------------------------

	describe("generateLayoutXml", () => {
		it("generates valid XML with name and type", () => {
			const xml = generateLayoutXml({ name: "My Layout", type: "obj" });
			expect(xml).toContain('type="obj"');
			expect(xml).toContain('name="My Layout"');
			expect(xml).toContain("p:sldLayout");
			expect(xml).toContain('preserve="1"');
		});

		it("defaults type to 'obj' when omitted", () => {
			const xml = generateLayoutXml({ name: "Default Type" });
			expect(xml).toContain('type="obj"');
		});

		it("generates XML without placeholders for a blank layout", () => {
			const xml = generateLayoutXml({ name: "Blank", type: "blank" });
			expect(xml).toContain('type="blank"');
			expect(xml).not.toContain("<p:sp>");
		});

		it("generates placeholder shapes with correct EMU positions", () => {
			const xml = generateLayoutXml({
				name: "Title Layout",
				type: "ctrTitle",
				placeholders: [
					{ type: "ctrTitle", x: 100, y: 200, width: 800, height: 100 },
				],
			});
			expect(xml).toContain('<p:ph type="ctrTitle"/>');
			// Check EMU conversion: 100 * 9525 = 952500
			expect(xml).toContain('x="952500"');
			expect(xml).toContain('y="1905000"');
			expect(xml).toContain('cx="7620000"');
			expect(xml).toContain('cy="952500"');
		});

		it("generates placeholder with idx attribute when specified", () => {
			const xml = generateLayoutXml({
				name: "Indexed",
				placeholders: [
					{ type: "body", x: 0, y: 0, width: 100, height: 50, idx: 3 },
				],
			});
			expect(xml).toContain('idx="3"');
		});

		it("generates placeholder without idx attribute when not specified", () => {
			const xml = generateLayoutXml({
				name: "No Idx",
				placeholders: [
					{ type: "title", x: 0, y: 0, width: 100, height: 50 },
				],
			});
			expect(xml).not.toMatch(/idx="\d+"/);
		});

		it("generates multiple placeholder shapes", () => {
			const xml = generateLayoutXml({
				name: "Multi",
				placeholders: [
					{ type: "title", x: 50, y: 20, width: 860, height: 60 },
					{ type: "body", x: 50, y: 100, width: 860, height: 400, idx: 1 },
					{ type: "ftr", x: 50, y: 520, width: 300, height: 30, idx: 10 },
				],
			});
			const phMatches = xml.match(/<p:sp>/g);
			expect(phMatches?.length).toBe(3);
			expect(xml).toContain('type="title"');
			expect(xml).toContain('type="body"');
			expect(xml).toContain('type="ftr"');
		});

		it("includes background color when specified", () => {
			const xml = generateLayoutXml({
				name: "Colored",
				backgroundColor: "#FF6B6B",
			});
			expect(xml).toContain('<a:srgbClr val="FF6B6B"/>');
			expect(xml).toContain("<p:bg>");
		});

		it("omits background when not specified", () => {
			const xml = generateLayoutXml({ name: "No BG" });
			expect(xml).not.toContain("<p:bg>");
		});

		it("strips leading # from background color", () => {
			const xml = generateLayoutXml({
				name: "Hash Strip",
				backgroundColor: "#AABBCC",
			});
			expect(xml).toContain('val="AABBCC"');
			expect(xml).not.toContain('val="#AABBCC"');
		});

		it("includes clrMapOvr element", () => {
			const xml = generateLayoutXml({ name: "CLR" });
			expect(xml).toContain("<p:clrMapOvr>");
			expect(xml).toContain("<a:masterClrMapping/>");
		});

		it("generates correct XML namespace declarations", () => {
			const xml = generateLayoutXml({ name: "NS Check" });
			expect(xml).toContain(
				'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
			);
			expect(xml).toContain(
				'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
			);
			expect(xml).toContain(
				'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
			);
		});

		it("uses custom placeholder name when provided", () => {
			const xml = generateLayoutXml({
				name: "Named PH",
				placeholders: [
					{
						type: "title",
						x: 0,
						y: 0,
						width: 100,
						height: 50,
						name: "Custom Title PH",
					},
				],
			});
			expect(xml).toContain('name="Custom Title PH"');
		});

		it("uppercases background color hex", () => {
			const xml = generateLayoutXml({
				name: "Upper",
				backgroundColor: "#aabbcc",
			});
			expect(xml).toContain('val="AABBCC"');
		});
	});

	// -----------------------------------------------------------------------
	// createLayout — integration tests that create layouts on a presentation
	// -----------------------------------------------------------------------

	describe("createLayout", () => {
		let handler: PptxHandler;
		let data: PptxData;

		beforeEach(async () => {
			const result = await PresentationBuilder.create();
			handler = result.handler;
			data = result.data;
		});

		it("creates a layout and returns a valid path", async () => {
			const result = await createLayout(handler, data, {
				name: "Custom Blank",
				type: "blank",
			});
			expect(result.layoutPath).toMatch(
				/^ppt\/slideLayouts\/slideLayout\d+\.xml$/,
			);
			expect(result.layoutName).toBe("Custom Blank");
		});

		it("creates a layout discoverable in slide masters", async () => {
			const result = await createLayout(handler, data, {
				name: "My Custom Layout",
				type: "obj",
			});
			// slideMasters[0].layouts should contain our new layout
			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			expect(masterLayouts).toBeDefined();
			const found = masterLayouts?.find(
				(l) => l.name === "My Custom Layout",
			);
			expect(found).toBeDefined();
			expect(found!.path).toBe(result.layoutPath);
		});

		it("creates a layout with placeholders that roundtrips", async () => {
			const result = await createLayout(handler, data, {
				name: "Title + Body",
				type: "obj",
				placeholders: [
					{ type: "title", x: 50, y: 20, width: 860, height: 60 },
					{ type: "body", x: 50, y: 100, width: 860, height: 400, idx: 1 },
				],
			});

			// The new handler/data should be usable
			expect(result.handler).toBeInstanceOf(PptxHandler);
			expect(result.data.slides).toBeDefined();

			// Save and reload to verify round-trip
			const bytes = await result.handler.save(result.data.slides);
			const handler2 = new PptxHandler();
			const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
			const masterLayouts = data2.slideMasters?.[0]?.layouts;
			const layout = masterLayouts?.find(
				(l) => l.name === "Title + Body",
			);
			expect(layout).toBeDefined();
		});

		it("creates a layout with background color", async () => {
			const result = await createLayout(handler, data, {
				name: "Colored Layout",
				type: "blank",
				backgroundColor: "#F0F0F0",
			});
			expect(result.layoutPath).toBeDefined();
			// The layout should appear in the master's layouts
			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			const found = masterLayouts?.find(
				(l) => l.name === "Colored Layout",
			);
			expect(found).toBeDefined();
		});

		it("can create a slide using the new layout", async () => {
			const result = await createLayout(handler, data, {
				name: "Slide-Ready Layout",
				type: "obj",
			});

			// Build a slide using the custom layout
			const slideNum = result.data.slides.length + 1;
			const slide = new SlideBuilder(
				slideNum,
				result.layoutPath,
				"Slide-Ready Layout",
			)
				.addText("Hello from custom layout", {
					x: 100,
					y: 100,
					width: 600,
					height: 50,
				})
				.build();

			result.data.slides.push(slide);

			// Save and verify
			const bytes = await result.handler.save(result.data.slides);
			expect(bytes.length).toBeGreaterThan(0);

			const handler2 = new PptxHandler();
			const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
			expect(data2.slides.length).toBe(1);
		});

		it("increments layout index correctly", async () => {
			// Standard layouts are 11, so first custom should be 12
			const result = await createLayout(handler, data, {
				name: "Layout 12",
				type: "blank",
			});
			expect(result.layoutPath).toBe(
				"ppt/slideLayouts/slideLayout12.xml",
			);
		});

		it("handles layout with all placeholder types", async () => {
			const result = await createLayout(handler, data, {
				name: "Full Layout",
				type: "obj",
				placeholders: [
					{ type: "title", x: 50, y: 20, width: 860, height: 60 },
					{ type: "body", x: 50, y: 100, width: 860, height: 350, idx: 1 },
					{ type: "dt", x: 50, y: 480, width: 200, height: 30, idx: 10 },
					{ type: "ftr", x: 350, y: 480, width: 260, height: 30, idx: 11 },
					{
						type: "sldNum",
						x: 700,
						y: 480,
						width: 200,
						height: 30,
						idx: 12,
					},
				],
			});

			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			const found = masterLayouts?.find(
				(l) => l.name === "Full Layout",
			);
			expect(found).toBeDefined();
			// Verify placeholders were parsed
			expect(found!.placeholders).toBeDefined();
			expect(found!.placeholders!.length).toBe(5);
		});

		it("returns a handler that can save and reload", async () => {
			const result = await createLayout(handler, data, {
				name: "Saveable",
				type: "blank",
			});

			const bytes = await result.handler.save(result.data.slides);
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(bytes.length).toBeGreaterThan(0);

			const handler2 = new PptxHandler();
			const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
			expect(data2.slides).toBeDefined();
		});

		it("preserves existing standard layouts after adding custom one", async () => {
			const result = await createLayout(handler, data, {
				name: "Custom Extra",
				type: "obj",
			});

			// Standard layouts should still be present
			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			expect(masterLayouts).toBeDefined();
			// 11 standard + 1 custom = 12
			expect(masterLayouts!.length).toBe(12);
		});
	});

	// -----------------------------------------------------------------------
	// createLayouts — batch creation tests
	// -----------------------------------------------------------------------

	describe("createLayouts", () => {
		let handler: PptxHandler;
		let data: PptxData;

		beforeEach(async () => {
			const result = await PresentationBuilder.create();
			handler = result.handler;
			data = result.data;
		});

		it("creates multiple layouts in one operation", async () => {
			const result = await createLayouts(handler, data, [
				{ name: "Batch Layout 1", type: "blank" },
				{ name: "Batch Layout 2", type: "obj" },
				{
					name: "Batch Layout 3",
					type: "twoObj",
					placeholders: [
						{ type: "title", x: 50, y: 20, width: 860, height: 60 },
						{ type: "body", x: 50, y: 100, width: 400, height: 400, idx: 1 },
						{
							type: "body",
							x: 500,
							y: 100,
							width: 400,
							height: 400,
							idx: 2,
						},
					],
				},
			]);

			expect(result.layoutPaths.length).toBe(3);
			expect(result.layoutPaths[0]).toMatch(/slideLayout12\.xml$/);
			expect(result.layoutPaths[1]).toMatch(/slideLayout13\.xml$/);
			expect(result.layoutPaths[2]).toMatch(/slideLayout14\.xml$/);

			// All layouts should appear in the master's layouts
			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			expect(masterLayouts).toBeDefined();
			for (const name of [
				"Batch Layout 1",
				"Batch Layout 2",
				"Batch Layout 3",
			]) {
				const found = masterLayouts?.find(
					(l) => l.name === name,
				);
				expect(found).toBeDefined();
			}
		});

		it("returns original handler/data when given empty definitions", async () => {
			const result = await createLayouts(handler, data, []);
			expect(result.layoutPaths).toEqual([]);
			expect(result.handler).toBe(handler);
			expect(result.data).toBe(data);
		});

		it("batch-created layouts are usable for slides", async () => {
			const result = await createLayouts(handler, data, [
				{ name: "Slide Layout A", type: "blank" },
				{ name: "Slide Layout B", type: "obj" },
			]);

			// Create slides using both new layouts
			result.data.slides.push(
				new SlideBuilder(1, result.layoutPaths[0], "Slide Layout A")
					.addText("Slide on Layout A", {
						x: 100,
						y: 100,
						width: 600,
						height: 50,
					})
					.build(),
			);
			result.data.slides.push(
				new SlideBuilder(2, result.layoutPaths[1], "Slide Layout B")
					.addText("Slide on Layout B", {
						x: 100,
						y: 100,
						width: 600,
						height: 50,
					})
					.build(),
			);

			const bytes = await result.handler.save(result.data.slides);
			const h2 = new PptxHandler();
			const d2 = await h2.load(bytes.buffer as ArrayBuffer);
			expect(d2.slides.length).toBe(2);
		});

		it("preserves all standard layouts plus adds batch layouts", async () => {
			const result = await createLayouts(handler, data, [
				{ name: "Extra 1", type: "blank" },
				{ name: "Extra 2", type: "blank" },
			]);

			const masterLayouts = result.data.slideMasters?.[0]?.layouts;
			expect(masterLayouts).toBeDefined();
			// 11 standard + 2 custom = 13
			expect(masterLayouts!.length).toBe(13);
		});
	});

	// -----------------------------------------------------------------------
	// findLayoutByName — utility function tests
	// -----------------------------------------------------------------------

	describe("findLayoutByName", () => {
		it("finds an existing standard layout by name via slideMasters", async () => {
			const { data } = await PresentationBuilder.create();
			const found = findLayoutByName(data, "Blank");
			expect(found).toBeDefined();
			expect(found!.name.toLowerCase()).toBe("blank");
		});

		it("performs case-insensitive search", async () => {
			const { data } = await PresentationBuilder.create();
			const found = findLayoutByName(data, "BLANK");
			expect(found).toBeDefined();
		});

		it("returns undefined for non-existent layout", async () => {
			const { data } = await PresentationBuilder.create();
			const found = findLayoutByName(data, "NonExistentLayout");
			expect(found).toBeUndefined();
		});

		it("finds a custom layout after creation", async () => {
			const { handler, data } = await PresentationBuilder.create();
			const result = await createLayout(handler, data, {
				name: "Findable Layout",
				type: "blank",
			});
			const found = findLayoutByName(result.data, "Findable Layout");
			expect(found).toBeDefined();
			expect(found!.path).toBe(result.layoutPath);
		});

		it("finds Title Slide layout", async () => {
			const { data } = await PresentationBuilder.create();
			const found = findLayoutByName(data, "Title Slide");
			expect(found).toBeDefined();
		});
	});

	describe("findLayoutByType", () => {
		it("finds a layout by OOXML type when layoutOptions populated", async () => {
			// To populate layoutOptions, we need a slide that references the layout.
			// The save pipeline defaults new slides to slideLayout1.xml which
			// is "ctrTitle" type, so we search for that type after round-trip.
			const { handler, data, createSlide } =
				await PresentationBuilder.create();
			data.slides.push(createSlide("Title Slide").build());

			// Save and reload to populate layoutOptions
			const bytes = await handler.save(data.slides);
			const h2 = new PptxHandler();
			const d2 = await h2.load(bytes.buffer as ArrayBuffer);

			const found = findLayoutByType(d2, "ctrTitle");
			expect(found).toBeDefined();
		});

		it("returns undefined for non-existent type", async () => {
			const { data } = await PresentationBuilder.create();
			const found = findLayoutByType(data, "nonExistentType");
			expect(found).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Sequential layout creation (adding one after another)
	// -----------------------------------------------------------------------

	describe("sequential creation", () => {
		it("creates layouts sequentially with correct incrementing indices", async () => {
			const { handler, data } = await PresentationBuilder.create();

			// First custom layout
			const r1 = await createLayout(handler, data, {
				name: "Sequential 1",
				type: "blank",
			});
			expect(r1.layoutPath).toMatch(/slideLayout12\.xml$/);

			// Second custom layout (on the reloaded handler/data)
			const r2 = await createLayout(r1.handler, r1.data, {
				name: "Sequential 2",
				type: "obj",
			});
			expect(r2.layoutPath).toMatch(/slideLayout13\.xml$/);

			// Both should be findable via slideMasters
			expect(
				findLayoutByName(r2.data, "Sequential 1"),
			).toBeDefined();
			expect(
				findLayoutByName(r2.data, "Sequential 2"),
			).toBeDefined();
		});

		it("sequentially created layouts can all be used for slides", async () => {
			const { handler, data } = await PresentationBuilder.create();

			const r1 = await createLayout(handler, data, {
				name: "Seq A",
				type: "blank",
			});
			const r2 = await createLayout(r1.handler, r1.data, {
				name: "Seq B",
				type: "obj",
			});

			// Add slides with each layout
			r2.data.slides.push(
				new SlideBuilder(1, r1.layoutPath, "Seq A")
					.addText("On Seq A", {
						x: 100,
						y: 100,
						width: 500,
						height: 50,
					})
					.build(),
			);
			r2.data.slides.push(
				new SlideBuilder(2, r2.layoutPath, "Seq B")
					.addText("On Seq B", {
						x: 100,
						y: 100,
						width: 500,
						height: 50,
					})
					.build(),
			);

			const bytes = await r2.handler.save(r2.data.slides);
			const h3 = new PptxHandler();
			const d3 = await h3.load(bytes.buffer as ArrayBuffer);
			expect(d3.slides.length).toBe(2);
		});
	});
});
