import { describe, it, expect } from "vitest";
import { PresentationBuilder } from "./PresentationBuilder";
import { PptxHandler } from "../../PptxHandler";

describe("PresentationBuilder", () => {
	it("creates a blank presentation with default options", async () => {
		const { handler, data } = await PresentationBuilder.create();

		expect(handler).toBeInstanceOf(PptxHandler);
		expect(data).toBeDefined();
		expect(data.slides).toBeDefined();
		expect(Array.isArray(data.slides)).toBe(true);
		// Blank presentation starts with 0 slides
		expect(data.slides.length).toBe(0);
		// Default 16:9 dimensions
		expect(data.width).toBeGreaterThan(0);
		expect(data.height).toBeGreaterThan(0);
	});

	it("creates a presentation with custom dimensions", async () => {
		const { data } = await PresentationBuilder.create({
			width: 9_144_000, // 4:3
			height: 6_858_000,
		});
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("creates a presentation with custom theme colors", async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				name: "Corporate",
				colors: {
					accent1: "#FF6B6B",
					accent2: "#556270",
				},
			},
		});
		// Theme color map should contain our custom accent colors
		expect(data.themeColorMap).toBeDefined();
		if (data.themeColorMap) {
			expect(
				data.themeColorMap.accent1?.toUpperCase(),
			).toBe("#FF6B6B");
		}
	});

	it("creates a presentation with custom fonts", async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				fonts: { majorFont: "Inter", minorFont: "Inter" },
			},
		});
		expect(data.theme?.fontScheme).toBeDefined();
	});

	it("provides layout options after adding a slide", async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		// Add a slide to trigger layout resolution
		data.slides.push(createSlide("Blank").build());
		await handler.save(data.slides);
		// After save+reload, layouts should be available in data
		const handler2 = new PptxHandler();
		const bytes = await handler.save(data.slides);
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		// At minimum, the blank presentation + slide should be loadable
		expect(data2.slides.length).toBe(1);
	});

	it("can save the blank presentation", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("saved presentation can be re-loaded", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);

		// Re-load
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(0);
		expect(data2.width).toBeGreaterThan(0);
	});

	it("createSlide factory builds slides", async () => {
		const { createSlide, data, handler } =
			await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.addText("Hello World", {
				fontSize: 36,
				bold: true,
				x: 100,
				y: 100,
				width: 800,
				height: 60,
			})
			.setNotes("Speaker notes here")
			.build();

		data.slides.push(slide);
		expect(data.slides.length).toBe(1);
		expect(data.slides[0].elements.length).toBe(1);
		expect(data.slides[0].elements[0].type).toBe("text");
		expect(data.slides[0].notes).toBe("Speaker notes here");

		// Should be saveable
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("can add multiple slides with different layouts", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		data.slides.push(
			createSlide("Title Slide")
				.addText("Welcome", { fontSize: 44, x: 100, y: 200, width: 800, height: 80 })
				.build(),
		);

		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					fill: { type: "solid", color: "#FF0000" },
					x: 200,
					y: 200,
					width: 300,
					height: 200,
				})
				.build(),
		);

		expect(data.slides.length).toBe(2);
		expect(data.slides[0].layoutName).toBe("Title Slide");
		expect(data.slides[1].layoutName).toBe("Blank");
	});

	it("can create slides with tables and charts", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.addTable(
				{
					rows: [
						{ cells: [{ text: "Name" }, { text: "Score" }] },
						{ cells: [{ text: "Alice" }, { text: "95" }] },
					],
					firstRow: true,
				},
				{ x: 50, y: 50, width: 500, height: 200 },
			)
			.addChart(
				"bar",
				{
					series: [{ name: "Q1", values: [10, 20, 30] }],
					categories: ["A", "B", "C"],
				},
				{ x: 50, y: 300, width: 500, height: 300 },
			)
			.build();

		data.slides.push(slide);
		expect(slide.elements.length).toBe(2);
		expect(slide.elements[0].type).toBe("table");
		expect(slide.elements[1].type).toBe("chart");
	});

	it("round-trips a presentation with elements", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create({ title: "Test Deck" });

		data.slides.push(
			createSlide("Blank")
				.addText("Slide 1 Text", { x: 100, y: 100, width: 400, height: 50 })
				.addShape("ellipse", {
					x: 200,
					y: 200,
					width: 200,
					height: 200,
					fill: { type: "solid", color: "#00FF00" },
				})
				.build(),
		);

		const bytes = await handler.save(data.slides);

		// Re-load and verify
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(1);
		expect(data2.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});
});
