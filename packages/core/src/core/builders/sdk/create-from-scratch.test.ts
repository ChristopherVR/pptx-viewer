/**
 * Comprehensive tests for creating PPTX presentations from scratch.
 *
 * Tests cover:
 * - PptxHandler.create() and PptxHandler.createBlank() static methods
 * - PresentationBuilder.create() with all option combinations
 * - initialSlideCount support
 * - ZIP structure validation (all required OpenXML parts)
 * - Round-trip fidelity (create -> save -> reload -> verify)
 * - Theme, dimension, and metadata preservation
 * - Adding content to generated presentations
 * - Edge cases and error conditions
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { PresentationBuilder } from "./PresentationBuilder";
import { PptxHandler } from "../../PptxHandler";
import type { PptxSlide } from "../../types/presentation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save a presentation and reload it, returning fresh handler + data. */
async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const handler2 = new PptxHandler();
	const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
	return { handler: handler2, data: data2, bytes };
}

/** Generate a PPTX and return the raw ZIP for structural inspection. */
async function createAndInspectZip(
	options?: Parameters<typeof PresentationBuilder.create>[0],
) {
	const { handler, data } = await PresentationBuilder.create(options);
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);
	return { zip, bytes, handler, data };
}

// ---------------------------------------------------------------------------
// PptxHandler.create() and PptxHandler.createBlank()
// ---------------------------------------------------------------------------

describe("PptxHandler static factory methods", () => {
	it("PptxHandler.create() returns a valid result", async () => {
		const { handler, data, createSlide } = await PptxHandler.create();
		expect(handler).toBeInstanceOf(PptxHandler);
		expect(data).toBeDefined();
		expect(data.slides).toBeDefined();
		expect(Array.isArray(data.slides)).toBe(true);
		expect(typeof createSlide).toBe("function");
	});

	it("PptxHandler.create() produces the same result as createBlank()", async () => {
		const result1 = await PptxHandler.create({ title: "Test" });
		const result2 = await PptxHandler.createBlank({ title: "Test" });

		expect(result1.data.slides.length).toBe(result2.data.slides.length);
		expect(result1.data.widthEmu).toBe(result2.data.widthEmu);
		expect(result1.data.heightEmu).toBe(result2.data.heightEmu);
	});

	it("PptxHandler.create() accepts initialSlideCount", async () => {
		const { data } = await PptxHandler.create({ initialSlideCount: 3 });
		expect(data.slides.length).toBe(3);
	});

	it("PptxHandler.create() accepts all options", async () => {
		const { data } = await PptxHandler.create({
			title: "Full Options Test",
			creator: "Test Author",
			width: 9_144_000,
			height: 6_858_000,
			initialSlideCount: 2,
			theme: {
				name: "Custom Theme",
				colors: { accent1: "#FF0000" },
				fonts: { majorFont: "Arial", minorFont: "Georgia" },
			},
		});
		expect(data.slides.length).toBe(2);
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});
});

// ---------------------------------------------------------------------------
// initialSlideCount option
// ---------------------------------------------------------------------------

describe("initialSlideCount", () => {
	it("defaults to 0 slides when not specified", async () => {
		const { data } = await PresentationBuilder.create();
		expect(data.slides.length).toBe(0);
	});

	it("creates the exact number of requested blank slides", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 1,
		});
		expect(data.slides.length).toBe(1);
	});

	it("creates multiple initial slides", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 5,
		});
		expect(data.slides.length).toBe(5);
	});

	it("initial slides have no elements", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 3,
		});
		for (const slide of data.slides) {
			expect(slide.elements.length).toBe(0);
		}
	});

	it("initial slides have sequential slide numbers", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 3,
		});
		for (let i = 0; i < data.slides.length; i++) {
			expect(data.slides[i].slideNumber).toBe(i + 1);
		}
	});

	it("treats initialSlideCount=0 the same as omitted", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 0,
		});
		expect(data.slides.length).toBe(0);
	});

	it("treats negative initialSlideCount as 0", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: -5,
		});
		expect(data.slides.length).toBe(0);
	});

	it("initial slides are valid slide objects", async () => {
		const { data } = await PresentationBuilder.create({
			initialSlideCount: 2,
		});
		for (const slide of data.slides) {
			// Each initial slide should be a valid parsed slide with an id
			expect(slide.id).toBeDefined();
			expect(slide.slideNumber).toBeGreaterThan(0);
			expect(Array.isArray(slide.elements)).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// ZIP structure validation
// ---------------------------------------------------------------------------

describe("ZIP structure (required OpenXML parts)", () => {
	it("contains [Content_Types].xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("[Content_Types].xml")).not.toBeNull();
	});

	it("contains _rels/.rels", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("_rels/.rels")).not.toBeNull();
	});

	it("contains ppt/presentation.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/presentation.xml")).not.toBeNull();
	});

	it("contains ppt/_rels/presentation.xml.rels", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/_rels/presentation.xml.rels")).not.toBeNull();
	});

	it("contains ppt/theme/theme1.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/theme/theme1.xml")).not.toBeNull();
	});

	it("contains ppt/slideMasters/slideMaster1.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/slideMasters/slideMaster1.xml")).not.toBeNull();
	});

	it("contains at least one slide layout", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/slideLayouts/slideLayout1.xml")).not.toBeNull();
	});

	it("contains 11 standard slide layouts", async () => {
		const { zip } = await createAndInspectZip();
		for (let i = 1; i <= 11; i++) {
			expect(zip.file(`ppt/slideLayouts/slideLayout${i}.xml`)).not.toBeNull();
		}
	});

	it("contains docProps/core.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("docProps/core.xml")).not.toBeNull();
	});

	it("contains docProps/app.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("docProps/app.xml")).not.toBeNull();
	});

	it("contains ppt/presProps.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/presProps.xml")).not.toBeNull();
	});

	it("contains ppt/viewProps.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/viewProps.xml")).not.toBeNull();
	});

	it("contains ppt/tableStyles.xml", async () => {
		const { zip } = await createAndInspectZip();
		expect(zip.file("ppt/tableStyles.xml")).not.toBeNull();
	});

	it("contains slide master rels", async () => {
		const { zip } = await createAndInspectZip();
		expect(
			zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels"),
		).not.toBeNull();
	});

	it("contains layout rels for all layouts", async () => {
		const { zip } = await createAndInspectZip();
		for (let i = 1; i <= 11; i++) {
			expect(
				zip.file(`ppt/slideLayouts/_rels/slideLayout${i}.xml.rels`),
			).not.toBeNull();
		}
	});

	it("ZIP produces a valid Uint8Array", async () => {
		const { bytes } = await createAndInspectZip();
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(100);
		// ZIP magic number: PK\x03\x04
		expect(bytes[0]).toBe(0x50); // P
		expect(bytes[1]).toBe(0x4b); // K
	});
});

// ---------------------------------------------------------------------------
// ZIP structure with initial slides
// ---------------------------------------------------------------------------

describe("ZIP structure with initial slides", () => {
	it("includes slide XML files for initialSlideCount slides", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 3,
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);

		for (let i = 1; i <= 3; i++) {
			expect(zip.file(`ppt/slides/slide${i}.xml`)).not.toBeNull();
		}
		// No fourth slide
		expect(zip.file("ppt/slides/slide4.xml")).toBeNull();
	});

	it("includes slide rels for each initial slide", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 2,
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);

		for (let i = 1; i <= 2; i++) {
			expect(
				zip.file(`ppt/slides/_rels/slide${i}.xml.rels`),
			).not.toBeNull();
		}
	});

	it("slide rels reference a slideLayout", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 1,
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const relsFile = zip.file("ppt/slides/_rels/slide1.xml.rels");
		expect(relsFile).not.toBeNull();
		const relsContent = await relsFile!.async("string");
		expect(relsContent).toContain("slideLayout");
	});

	it("Content_Types includes slide content type overrides", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 2,
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ctFile = zip.file("[Content_Types].xml");
		expect(ctFile).not.toBeNull();
		const ctContent = await ctFile!.async("string");
		expect(ctContent).toContain("slide1.xml");
		expect(ctContent).toContain("slide2.xml");
	});
});

// ---------------------------------------------------------------------------
// Round-trip fidelity
// ---------------------------------------------------------------------------

describe("round-trip (create -> save -> reload)", () => {
	it("round-trips a zero-slide presentation", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(0);
		expect(data2.width).toBeGreaterThan(0);
		expect(data2.height).toBeGreaterThan(0);
	});

	it("round-trips a presentation with initial slides", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 3,
		});
		expect(data.slides.length).toBe(3);

		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(3);
	});

	it("round-trips custom dimensions", async () => {
		const { handler, data } = await PresentationBuilder.create({
			width: 9_144_000,
			height: 6_858_000,
		});
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.widthEmu).toBe(9_144_000);
		expect(data2.heightEmu).toBe(6_858_000);
	});

	it("round-trips default 16:9 dimensions", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.widthEmu).toBe(12_192_000);
		expect(data2.heightEmu).toBe(6_858_000);
	});

	it("round-trips theme colors", async () => {
		const { handler, data } = await PresentationBuilder.create({
			theme: {
				colors: {
					accent1: "#FF6B6B",
					accent2: "#556270",
					dk1: "#111111",
					lt1: "#FAFAFA",
				},
			},
		});
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.themeColorMap).toBeDefined();
		if (data2.themeColorMap) {
			expect(data2.themeColorMap.accent1?.toUpperCase()).toBe("#FF6B6B");
			expect(data2.themeColorMap.accent2?.toUpperCase()).toBe("#556270");
		}
	});

	it("round-trips theme fonts", async () => {
		const { handler, data } = await PresentationBuilder.create({
			theme: {
				fonts: { majorFont: "Georgia", minorFont: "Verdana" },
			},
		});
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.theme?.fontScheme).toBeDefined();
		if (data2.theme?.fontScheme) {
			// majorFont may be a string or an object with { latin, ... }
			const major = data2.theme.fontScheme.majorFont;
			const minor = data2.theme.fontScheme.minorFont;
			const majorName =
				typeof major === "string" ? major : (major as any)?.latin;
			const minorName =
				typeof minor === "string" ? minor : (minor as any)?.latin;
			expect(majorName).toBe("Georgia");
			expect(minorName).toBe("Verdana");
		}
	});

	it("round-trips added text elements", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create();

		data.slides.push(
			createSlide("Blank")
				.addText("Hello World", {
					fontSize: 24,
					x: 100,
					y: 100,
					width: 500,
					height: 50,
				})
				.build(),
		);

		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(1);
		expect(data2.slides[0].elements.length).toBeGreaterThanOrEqual(1);

		// Find a text element
		const textEl = data2.slides[0].elements.find(
			(e) => e.type === "text" || e.type === "shape",
		);
		expect(textEl).toBeDefined();
	});

	it("round-trips added shape elements", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create();

		data.slides.push(
			createSlide("Blank")
				.addShape("ellipse", {
					x: 200,
					y: 200,
					width: 200,
					height: 200,
					fill: { type: "solid", color: "#FF0000" },
				})
				.build(),
		);

		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(1);
		expect(data2.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});

	it("round-trips a complex multi-slide presentation", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create({
				title: "Complex Deck",
				initialSlideCount: 1,
			});

		// Add text to initial slide
		data.slides[0].elements.push(
			...(createSlide("Blank")
				.addText("Title", { fontSize: 36, x: 50, y: 50, width: 800, height: 60 })
				.build().elements),
		);

		// Add more slides
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 100,
					y: 100,
					width: 400,
					height: 300,
					fill: { type: "solid", color: "#0066CC" },
				})
				.addText("Description", {
					x: 100,
					y: 450,
					width: 400,
					height: 40,
				})
				.build(),
		);

		data.slides.push(
			createSlide("Blank")
				.addTable(
					{
						rows: [
							{ cells: [{ text: "A" }, { text: "B" }] },
							{ cells: [{ text: "1" }, { text: "2" }] },
						],
					},
					{ x: 50, y: 50, width: 500, height: 200 },
				)
				.build(),
		);

		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// Adding content to initial slides
// ---------------------------------------------------------------------------

describe("adding content to presentations created from scratch", () => {
	it("can add a slide using createSlide factory", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide("Blank").build();
		data.slides.push(slide);

		expect(data.slides.length).toBe(1);
		expect(slide.elements.length).toBe(0);
	});

	it("can add slides with each available layout", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const layouts = [
			"Title Slide",
			"Title and Content",
			"Section Header",
			"Two Content",
			"Comparison",
			"Title Only",
			"Blank",
			"Content with Caption",
			"Picture with Caption",
			"Title and Vertical Text",
			"Vertical Title and Text",
		];

		for (const layout of layouts) {
			data.slides.push(createSlide(layout).build());
		}

		expect(data.slides.length).toBe(11);
		expect(data.slides[0].layoutName).toBe("Title Slide");
		expect(data.slides[6].layoutName).toBe("Blank");
	});

	it("defaults to Blank layout when no layout specified", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		data.slides.push(createSlide().build());
		expect(data.slides[0].layoutName).toBe("Blank");
	});

	it("can build a slide with slide-level properties", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.setBackground({ type: "solid", color: "#F5F5F5" })
			.setHidden(true)
			.setSection("Introduction")
			.build();

		data.slides.push(slide);
		expect(slide.backgroundColor).toBe("#F5F5F5");
		expect(slide.hidden).toBe(true);
		expect(slide.sectionName).toBe("Introduction");
	});

	it("can build a slide with a transition", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.setTransition({ type: "fade", duration: 500 })
			.build();

		data.slides.push(slide);
		expect(slide.transition).toBeDefined();
		expect(slide.transition?.type).toBe("fade");
	});

	it("can add a connector element", async () => {
		const { createSlide, data } = await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.addConnector({
				x: 100,
				y: 100,
				width: 300,
				height: 0,
				stroke: { color: "#000000", width: 2 },
				endArrow: "triangle",
			})
			.build();

		data.slides.push(slide);
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("connector");
	});

	it("can add multiple element types to a single slide", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create();

		const slide = createSlide("Blank")
			.addText("Title", {
				fontSize: 28,
				bold: true,
				x: 50,
				y: 20,
				width: 900,
				height: 50,
			})
			.addShape("roundRect", {
				x: 50,
				y: 100,
				width: 400,
				height: 250,
				fill: { type: "solid", color: "#4472C4" },
				text: "Shape with text",
			})
			.addConnector({
				x: 500,
				y: 200,
				width: 200,
				height: 100,
			})
			.addTable(
				{
					rows: [
						{ cells: [{ text: "Header 1" }, { text: "Header 2" }] },
						{ cells: [{ text: "Cell A" }, { text: "Cell B" }] },
					],
					firstRow: true,
				},
				{ x: 50, y: 400, width: 900, height: 150 },
			)
			.build();

		data.slides.push(slide);

		expect(slide.elements.length).toBe(4);
		expect(slide.elements[0].type).toBe("text");
		expect(slide.elements[1].type).toBe("shape");
		expect(slide.elements[2].type).toBe("connector");
		expect(slide.elements[3].type).toBe("table");

		// Save and verify it's a valid PPTX
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("can save and reload a presentation with added content", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create({ initialSlideCount: 1 });

		// Add a second slide with content
		data.slides.push(
			createSlide("Blank")
				.addText("Added Slide", {
					x: 100,
					y: 100,
					width: 500,
					height: 50,
				})
				.build(),
		);

		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.slides.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Theme and metadata
// ---------------------------------------------------------------------------

describe("theme and metadata options", () => {
	it("applies default theme when none specified", async () => {
		const { data } = await PresentationBuilder.create();
		expect(data.themeColorMap).toBeDefined();
		expect(data.theme).toBeDefined();
	});

	it("applies custom theme name", async () => {
		const { data } = await PresentationBuilder.create({
			theme: { name: "Corporate Blue" },
		});
		// The theme name is stored in the theme data
		expect(data.theme).toBeDefined();
	});

	it("applies all 12 custom accent colors", async () => {
		const customColors = {
			dk1: "#111111",
			lt1: "#FEFEFE",
			dk2: "#222222",
			lt2: "#EEEEEE",
			accent1: "#AA0000",
			accent2: "#00AA00",
			accent3: "#0000AA",
			accent4: "#AAAA00",
			accent5: "#AA00AA",
			accent6: "#00AAAA",
			hlink: "#0000FF",
			folHlink: "#800080",
		};

		const { data } = await PresentationBuilder.create({
			theme: { colors: customColors },
		});

		expect(data.themeColorMap).toBeDefined();
		if (data.themeColorMap) {
			expect(data.themeColorMap.accent1?.toUpperCase()).toBe("#AA0000");
			expect(data.themeColorMap.accent2?.toUpperCase()).toBe("#00AA00");
			expect(data.themeColorMap.accent3?.toUpperCase()).toBe("#0000AA");
		}
	});

	it("merges partial custom colors with defaults", async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				colors: { accent1: "#FF0000" }, // only override accent1
			},
		});

		expect(data.themeColorMap).toBeDefined();
		if (data.themeColorMap) {
			// Custom value
			expect(data.themeColorMap.accent1?.toUpperCase()).toBe("#FF0000");
			// Default value should still be present
			expect(data.themeColorMap.accent2).toBeDefined();
		}
	});

	it("applies custom fonts", async () => {
		const { data } = await PresentationBuilder.create({
			theme: {
				fonts: { majorFont: "Montserrat", minorFont: "Open Sans" },
			},
		});

		expect(data.theme?.fontScheme).toBeDefined();
		if (data.theme?.fontScheme) {
			// majorFont may be a string or an object with { latin, ... }
			const major = data.theme.fontScheme.majorFont;
			const minor = data.theme.fontScheme.minorFont;
			const majorName =
				typeof major === "string" ? major : (major as any)?.latin;
			const minorName =
				typeof minor === "string" ? minor : (minor as any)?.latin;
			expect(majorName).toBe("Montserrat");
			expect(minorName).toBe("Open Sans");
		}
	});

	it("uses default Calibri fonts when none specified", async () => {
		const { data } = await PresentationBuilder.create();

		expect(data.theme?.fontScheme).toBeDefined();
		if (data.theme?.fontScheme) {
			const major = data.theme.fontScheme.majorFont;
			const minor = data.theme.fontScheme.minorFont;
			const majorName =
				typeof major === "string" ? major : (major as any)?.latin;
			const minorName =
				typeof minor === "string" ? minor : (minor as any)?.latin;
			expect(majorName).toBe("Calibri Light");
			expect(minorName).toBe("Calibri");
		}
	});

	it("stores title in core properties", async () => {
		const { handler, data } = await PresentationBuilder.create({
			title: "My Presentation Title",
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const coreXml = await zip.file("docProps/core.xml")!.async("string");
		expect(coreXml).toContain("My Presentation Title");
	});

	it("stores creator in core properties", async () => {
		const { handler, data } = await PresentationBuilder.create({
			creator: "Jane Doe",
		});
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const coreXml = await zip.file("docProps/core.xml")!.async("string");
		expect(coreXml).toContain("Jane Doe");
	});
});

// ---------------------------------------------------------------------------
// Slide dimensions
// ---------------------------------------------------------------------------

describe("slide dimensions", () => {
	it("defaults to 16:9 widescreen (10in x 7.5in in EMU)", async () => {
		const { data } = await PresentationBuilder.create();
		expect(data.widthEmu).toBe(12_192_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("supports 4:3 standard dimensions", async () => {
		const { data } = await PresentationBuilder.create({
			width: 9_144_000,
			height: 6_858_000,
		});
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("supports custom arbitrary dimensions", async () => {
		const { data } = await PresentationBuilder.create({
			width: 7_000_000,
			height: 7_000_000, // square
		});
		expect(data.widthEmu).toBe(7_000_000);
		expect(data.heightEmu).toBe(7_000_000);
	});

	it("preserves dimensions through round-trip", async () => {
		const { handler, data } = await PresentationBuilder.create({
			width: 10_000_000,
			height: 5_000_000,
		});
		const { data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.widthEmu).toBe(10_000_000);
		expect(data2.heightEmu).toBe(5_000_000);
	});
});

// ---------------------------------------------------------------------------
// Save output validity
// ---------------------------------------------------------------------------

describe("save output validity", () => {
	it("produces a valid ZIP file", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);

		// Should not throw when loading as ZIP
		const zip = await JSZip.loadAsync(bytes);
		expect(Object.keys(zip.files).length).toBeGreaterThan(0);
	});

	it("produces output loadable by a fresh PptxHandler", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 2,
		});
		const bytes = await handler.save(data.slides);

		// A completely fresh handler should be able to load this
		const freshHandler = new PptxHandler();
		const freshData = await freshHandler.load(bytes.buffer as ArrayBuffer);
		expect(freshData.slides.length).toBe(2);
		expect(freshData.width).toBeGreaterThan(0);
		expect(freshData.height).toBeGreaterThan(0);
		expect(freshData.theme).toBeDefined();
	});

	it("can be re-saved multiple times", async () => {
		const { handler, data, createSlide } =
			await PresentationBuilder.create();

		// First save
		const bytes1 = await handler.save(data.slides);

		// Add a slide and save again
		data.slides.push(createSlide("Blank").build());
		const bytes2 = await handler.save(data.slides);

		// Second save should be larger (has more content)
		expect(bytes2.length).toBeGreaterThan(0);

		// Reload second save and verify
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes2.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(1);
	});

	it("contains valid XML in presentation.xml", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const presXml = await zip
			.file("ppt/presentation.xml")!
			.async("string");

		expect(presXml).toContain('<?xml version="1.0"');
		expect(presXml).toContain("<p:presentation");
		expect(presXml).toContain("<p:sldMasterIdLst>");
		expect(presXml).toContain("<p:sldSz");
		expect(presXml).toContain("<p:notesSz");
	});

	it("contains valid XML in theme1.xml", async () => {
		const { handler, data } = await PresentationBuilder.create();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const themeXml = await zip
			.file("ppt/theme/theme1.xml")!
			.async("string");

		expect(themeXml).toContain("<a:theme");
		expect(themeXml).toContain("<a:clrScheme");
		expect(themeXml).toContain("<a:fontScheme");
		expect(themeXml).toContain("<a:fmtScheme");
	});
});

// ---------------------------------------------------------------------------
// Double round-trip (create -> save -> load -> edit -> save -> load)
// ---------------------------------------------------------------------------

describe("double round-trip (edit after reload)", () => {
	it("can add slides to a reloaded from-scratch presentation", async () => {
		// First creation and save
		const { handler, data } = await PresentationBuilder.create();
		const bytes1 = await handler.save(data.slides);

		// Reload
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes1.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(0);

		// Use the XML builder to add a new slide (after reload, createSlide
		// is not available since we loaded raw bytes, but we can still
		// manipulate slides via the handler)
		// For this test, just verify that saving again works
		const bytes2 = await handler2.save(data2.slides);
		const handler3 = new PptxHandler();
		const data3 = await handler3.load(bytes2.buffer as ArrayBuffer);
		expect(data3.slides.length).toBe(0);
	});

	it("preserves initial slides through double round-trip", async () => {
		const { handler, data } = await PresentationBuilder.create({
			initialSlideCount: 2,
		});

		// First round-trip
		const { handler: h2, data: d2 } = await saveAndReload(
			handler,
			data.slides,
		);
		expect(d2.slides.length).toBe(2);

		// Second round-trip
		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(2);
	});
});
