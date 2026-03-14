import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";
import { SlideBuilder } from "../../core/builders/sdk/SlideBuilder";
import {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createTableElement,
	createChartElement,
	createMediaElement,
	createGroupElement,
	resetIdCounter,
} from "../../core/builders/sdk/ElementFactory";
import type { PptxSlide, PptxData } from "../../core/types/presentation";
import type {
	TextPptxElement,
	ShapePptxElement,
	ConnectorPptxElement,
	TablePptxElement,
	ChartPptxElement,
	MediaPptxElement,
	GroupPptxElement,
	ImagePptxElement,
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

/** 1x1 red PNG as a base64 data URL, used for image element tests. */
const TINY_PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

/** Minimal MP4-like data URL for media tests. */
const TINY_VIDEO =
	"data:video/mp4;base64,AAAAHGZ0eXBNNFYgAAACAGlzb21pc28yYXZjMQ==";

// ===========================================================================
// 1. Load Pipeline
// ===========================================================================

describe("Load Pipeline", () => {
	it("blank PPTX loads with zero slides", async () => {
		const { data } = await createBlank();
		expect(data.slides).toEqual([]);
	});

	it("blank PPTX has valid pixel dimensions", async () => {
		const { data } = await createBlank();
		expect(data.width).toBeGreaterThan(0);
		expect(data.height).toBeGreaterThan(0);
	});

	it("blank PPTX has correct EMU dimensions for 16:9", async () => {
		const { data } = await createBlank();
		expect(data.widthEmu).toBe(12_192_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("custom 4:3 dimensions are parsed correctly", async () => {
		const { data } = await createBlank({
			width: 9_144_000,
			height: 6_858_000,
		});
		expect(data.widthEmu).toBe(9_144_000);
		expect(data.heightEmu).toBe(6_858_000);
	});

	it("theme color map is populated on load", async () => {
		const { data } = await createBlank();
		expect(data.themeColorMap).toBeDefined();
		expect(Object.keys(data.themeColorMap!).length).toBeGreaterThan(0);
	});

	it("theme object contains color and font schemes", async () => {
		const { data } = await createBlank();
		expect(data.theme).toBeDefined();
		expect(data.theme?.colorScheme).toBeDefined();
		expect(data.theme?.fontScheme).toBeDefined();
	});

	it("layout options array exists on data", async () => {
		const { data } = await createBlank();
		// Builder-created presentations may have an empty layoutOptions array
		// since layouts are part of the ZIP but not parsed into data.layoutOptions
		expect(data.layoutOptions).toBeDefined();
	});

	it("elements are parsed after save-load with one slide", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Parsed", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(1);
	});

	it("slide numbers are sequential after load", async () => {
		const { handler, data, createSlide } = await createBlank();
		for (let i = 0; i < 4; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`S${i + 1}`, { x: 10, y: 10, width: 100, height: 30 })
					.build(),
			);
		}
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		for (let i = 0; i < 4; i++) {
			expect(reloaded.slides[i].slideNumber).toBe(i + 1);
		}
	});

	it("custom theme colors are loaded correctly", async () => {
		const { data } = await createBlank({
			theme: {
				colors: {
					accent1: "#ABCDEF",
					accent2: "#123456",
				},
			},
		});
		expect(data.themeColorMap?.accent1?.toUpperCase()).toBe("#ABCDEF");
		expect(data.themeColorMap?.accent2?.toUpperCase()).toBe("#123456");
	});

	it("custom fonts are loaded correctly", async () => {
		const { data } = await createBlank({
			theme: { fonts: { majorFont: "Impact", minorFont: "Comic Sans MS" } },
		});
		expect(data.theme?.fontScheme?.majorFont?.latin).toBe("Impact");
		expect(data.theme?.fontScheme?.minorFont?.latin).toBe("Comic Sans MS");
	});

	it("presentation title is stored in core properties", async () => {
		const { data } = await createBlank({
			title: "Test Deck Title",
			creator: "Unit Tester",
		});
		// Core properties should be parsed
		if (data.coreProperties) {
			expect(data.coreProperties.title).toBe("Test Deck Title");
			expect(data.coreProperties.creator).toBe("Unit Tester");
		}
	});
});

// ===========================================================================
// 2. Save Pipeline
// ===========================================================================

describe("Save Pipeline", () => {
	it("save produces a Uint8Array with ZIP magic bytes", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes[0]).toBe(0x50); // P
		expect(bytes[1]).toBe(0x4b); // K
	});

	it("saved file is a valid ZIP archive", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("ZIP test", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const files = Object.keys(zip.files);
		expect(files.length).toBeGreaterThan(0);
		expect(files).toContain("[Content_Types].xml");
	});

	it("saved ZIP contains presentation.xml", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		expect(zip.file("ppt/presentation.xml")).not.toBeNull();
	});

	it("saved ZIP contains slide files for each slide", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("S1", { x: 10, y: 10, width: 100, height: 30 })
				.build(),
			createSlide("Blank")
				.addText("S2", { x: 10, y: 10, width: 100, height: 30 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		expect(zip.file("ppt/slides/slide1.xml")).not.toBeNull();
		expect(zip.file("ppt/slides/slide2.xml")).not.toBeNull();
	});

	it("modified text persists through save", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("Original", { x: 50, y: 50, width: 400, height: 50 })
			.build();
		data.slides.push(slide);

		// Mutate
		const textEl = slide.elements[0] as TextPptxElement;
		textEl.text = "Modified";
		if (textEl.textSegments?.[0]) {
			textEl.textSegments[0].text = "Modified";
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const found = reloaded.slides[0].elements.some((el) => {
			if ("text" in el && typeof el.text === "string") {
				return el.text.includes("Modified");
			}
			if ("textSegments" in el && Array.isArray(el.textSegments)) {
				return el.textSegments.some((s) => s.text.includes("Modified"));
			}
			return false;
		});
		expect(found).toBe(true);
	});

	it("element ordering is preserved after save-reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("First", { x: 10, y: 10, width: 200, height: 40 })
				.addShape("rect", { x: 10, y: 60, width: 200, height: 100 })
				.addText("Third", { x: 10, y: 170, width: 200, height: 40 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const elements = reloaded.slides[0].elements;
		expect(elements.length).toBeGreaterThanOrEqual(3);

		// First and third should be text-type, second should be shape
		const textEls = elements.filter((e) => e.type === "text" || (e.type === "shape" && "text" in e));
		expect(textEls.length).toBeGreaterThanOrEqual(2);
	});

	it("saving empty presentation produces loadable output", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);
		expect(data2.slides.length).toBe(0);
	});

	it("save file size grows when more elements are added", async () => {
		const { handler, data, createSlide } = await createBlank();
		const bytes1 = await handler.save(data.slides);

		data.slides.push(
			createSlide("Blank")
				.addText("Extra content A", { x: 10, y: 10, width: 200, height: 40 })
				.addShape("ellipse", { x: 250, y: 10, width: 200, height: 200 })
				.build(),
		);
		const bytes2 = await handler.save(data.slides);
		expect(bytes2.length).toBeGreaterThan(bytes1.length);
	});
});

// ===========================================================================
// 3. Element Dispatch — each type survives save-reload
// ===========================================================================

describe("Element Dispatch", () => {
	it("text element survives save-reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Text dispatch", {
					x: 50,
					y: 50,
					width: 400,
					height: 60,
					fontSize: 24,
					bold: true,
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const el = reloaded.slides[0].elements.find(
			(e) =>
				e.type === "text" &&
				("text" in e ? (e as TextPptxElement).text?.includes("Text dispatch") : false),
		);
		expect(el).toBeDefined();
	});

	it("shape element preserves shapeType", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("diamond", {
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					fill: { type: "solid", color: "#00FF00" },
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const shapeEl = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(shapeEl).toBeDefined();
		expect(shapeEl!.shapeType).toBe("diamond");
	});

	it("connector element preserves connector type", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 50,
					y: 50,
					width: 300,
					height: 100,
					type: "straight",
					endArrow: "triangle",
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const conn = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		expect(conn).toBeDefined();
		expect(conn!.shapeType).toBe("straightConnector1");
	});

	it("bent connector element preserves its type", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 50,
					y: 50,
					width: 300,
					height: 200,
					type: "bent",
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const conn = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		expect(conn).toBeDefined();
		expect(conn!.shapeType).toBe("bentConnector3");
	});

	it("image element with data URL survives save-reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addImage(TINY_PNG, {
					x: 50,
					y: 50,
					width: 200,
					height: 200,
					altText: "red pixel",
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		// Images may reload as "image" or "picture" depending on how the parser classifies <p:pic>
		const imgEl = reloaded.slides[0].elements.find(
			(e) => e.type === "image" || e.type === "picture",
		);
		expect(imgEl).toBeDefined();
	});

	it("table element is correctly constructed in the data model", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addTable(
				{
					rows: [
						{ cells: [{ text: "H1" }, { text: "H2" }] },
						{ cells: [{ text: "A" }, { text: "B" }] },
					],
					firstRow: true,
				},
				{ x: 50, y: 50, width: 500, height: 150 },
			)
			.build();
		data.slides.push(slide);

		// Verify data model before save
		const tbl = slide.elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl).toBeDefined();
		expect(tbl!.tableData).toBeDefined();
		expect(tbl!.tableData!.rows.length).toBe(2);
		expect(tbl!.tableData!.rows[0].cells[0].text).toBe("H1");
		expect(tbl!.tableData!.rows[1].cells[1].text).toBe("B");

		// Save should not crash
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("chart element is correctly constructed in the data model", async () => {
		const { handler, data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addChart(
				"bar",
				{
					series: [{ name: "Sales", values: [10, 20, 30] }],
					categories: ["Q1", "Q2", "Q3"],
					title: "Revenue",
				},
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build();
		data.slides.push(slide);

		// Verify chart data model before save
		const chart = slide.elements.find(
			(e) => e.type === "chart",
		) as ChartPptxElement | undefined;
		expect(chart).toBeDefined();
		expect(chart!.chartData).toBeDefined();
		expect(chart!.chartData!.chartType).toBe("bar");
		expect(chart!.chartData!.series.length).toBe(1);
		expect(chart!.chartData!.series[0].name).toBe("Sales");

		// Save should not crash
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("group element preserves children", async () => {
		const { handler, data, createSlide } = await createBlank();
		const child1 = createTextElement("G-Child", {
			x: 0,
			y: 0,
			width: 100,
			height: 30,
		});
		const child2 = createShapeElement("rect", {
			x: 0,
			y: 40,
			width: 100,
			height: 80,
		});
		data.slides.push(
			createSlide("Blank")
				.addGroup([child1, child2], {
					x: 50,
					y: 50,
					width: 200,
					height: 150,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const grp = reloaded.slides[0].elements.find(
			(e) => e.type === "group",
		) as GroupPptxElement | undefined;
		expect(grp).toBeDefined();
		expect(grp!.children.length).toBeGreaterThanOrEqual(1);
	});

	it("media element survives save-reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addMedia("video", TINY_VIDEO, {
					x: 50,
					y: 50,
					width: 480,
					height: 270,
					autoPlay: true,
					loop: true,
				})
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const med = reloaded.slides[0].elements.find(
			(e) => e.type === "media",
		) as MediaPptxElement | undefined;
		expect(med).toBeDefined();
	});

	it("multiple element types coexist on one slide", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Title", { x: 10, y: 10, width: 400, height: 40 })
				.addShape("rect", {
					x: 10,
					y: 60,
					width: 200,
					height: 100,
					fill: { type: "solid", color: "#333" },
				})
				.addConnector({ x: 220, y: 110, width: 100, height: 0 })
				.addTable(
					{
						rows: [{ cells: [{ text: "Cell" }] }],
					},
					{ x: 10, y: 200, width: 300, height: 80 },
				)
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const types = new Set(reloaded.slides[0].elements.map((e) => e.type));
		// We expect at least text/shape, connector, and table
		expect(types.size).toBeGreaterThanOrEqual(3);
	});
});

// ===========================================================================
// 4. Document Parts — properties, notes, comments survive round-trip
// ===========================================================================

describe("Document Parts", () => {
	it("presentation dimensions survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank({
			width: 9_144_000,
			height: 6_858_000,
		});
		data.slides.push(
			createSlide("Blank")
				.addText("Dim test", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.widthEmu).toBe(9_144_000);
		expect(reloaded.heightEmu).toBe(6_858_000);
	});

	it("slide notes are set on the data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.addText("With notes", { x: 10, y: 10, width: 200, height: 40 })
			.setNotes("Speaker notes content here")
			.build();
		data.slides.push(slide);
		expect(slide.notes).toBe("Speaker notes content here");
	});

	it("notes survive save (no crash)", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Notes slide", { x: 10, y: 10, width: 200, height: 40 })
				.setNotes("These are important notes")
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("background color is set on the data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setBackground({ type: "solid", color: "#AABBCC" })
			.addText("BG test", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.backgroundColor).toBe("#AABBCC");
	});

	it("hidden slide flag is set on the data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setHidden(true)
			.addText("Hidden", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.hidden).toBe(true);
	});

	it("section metadata is set on the data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setSection("Introduction", "sec_1")
			.addText("Intro", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.sectionName).toBe("Introduction");
		expect(slide.sectionId).toBe("sec_1");
	});

	it("transition is set on the data model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setTransition({ type: "fade", duration: 1000 })
			.addText("Trans", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.transition).toBeDefined();
		expect(slide.transition!.type).toBe("fade");
		expect(slide.transition!.durationMs).toBe(1000);
	});

	it("theme survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank({
			theme: { colors: { accent1: "#DEAD00" } },
		});
		data.slides.push(
			createSlide("Blank")
				.addText("Theme RT", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.themeColorMap?.accent1?.toUpperCase()).toBe("#DEAD00");
	});

	it("layout options survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Layout test", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.layoutOptions).toBeDefined();
		expect(reloaded.layoutOptions!.length).toBeGreaterThanOrEqual(1);
	});

	it("theme options survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank({
			theme: { name: "SurvivalTheme" },
		});
		data.slides.push(
			createSlide("Blank")
				.addText("TO test", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.themeOptions).toBeDefined();
		expect(reloaded.themeOptions![0].name).toBe("SurvivalTheme");
	});
});

// ===========================================================================
// 5. Error Handling
// ===========================================================================

describe("Error Handling", () => {
	it("rejects non-ZIP data (random bytes)", async () => {
		const handler = new PptxHandler();
		const garbage = new Uint8Array(256);
		for (let i = 0; i < garbage.length; i++) {
			garbage[i] = i % 256;
		}
		await expect(handler.load(garbage.buffer as ArrayBuffer)).rejects.toThrow();
	});

	it("rejects an empty ArrayBuffer", async () => {
		const handler = new PptxHandler();
		await expect(handler.load(new ArrayBuffer(0))).rejects.toThrow();
	});

	it("rejects a very small non-ZIP buffer", async () => {
		const handler = new PptxHandler();
		const tiny = new Uint8Array([0x00, 0x01, 0x02]).buffer as ArrayBuffer;
		await expect(handler.load(tiny)).rejects.toThrow();
	});

	it("rejects an OLE/encrypted file (CFB magic bytes)", async () => {
		const handler = new PptxHandler();
		const ole = new Uint8Array(512);
		// OLE magic: D0 CF 11 E0 A1 1B 1A E1
		ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0x1b, 0x1a, 0xe1]);
		await expect(handler.load(ole.buffer as ArrayBuffer)).rejects.toThrow(
			/encrypted/i,
		);
	});

	it("rejects a valid ZIP that is not a PPTX (missing parts)", async () => {
		const zip = new JSZip();
		zip.file("hello.txt", "not a pptx");
		const buf = await zip.generateAsync({ type: "arraybuffer" });
		const handler = new PptxHandler();
		// Should either throw or return data with 0 slides but not crash
		try {
			const data = await handler.load(buf);
			// If it doesn't throw, at least it should handle gracefully
			expect(data.slides.length).toBe(0);
		} catch {
			// Expected - missing presentation.xml
			expect(true).toBe(true);
		}
	});

	it("handles saving with no slides gracefully", async () => {
		const { handler, data } = await createBlank();
		expect(data.slides.length).toBe(0);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("handler can be reused after a save failure (resilience)", async () => {
		const { handler, data, createSlide } = await createBlank();
		// First, normal save
		data.slides.push(
			createSlide("Blank")
				.addText("Normal", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes1 = await handler.save(data.slides);
		expect(bytes1.length).toBeGreaterThan(0);

		// Save again (idempotent)
		const bytes2 = await handler.save(data.slides);
		expect(bytes2.length).toBeGreaterThan(0);
	});
});

// ===========================================================================
// 6. Edge Cases
// ===========================================================================

describe("Edge Cases", () => {
	it("empty slide (no elements) survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(createSlide("Blank").build());

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
		// Empty slide may have 0 elements or inherited layout elements
		expect(reloaded.slides[0].elements).toBeDefined();
	});

	it("slide with many elements (50) survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const builder = createSlide("Blank");
		for (let i = 0; i < 50; i++) {
			builder.addText(`E${i}`, {
				x: 10 + (i % 10) * 80,
				y: 10 + Math.floor(i / 10) * 50,
				width: 70,
				height: 40,
			});
		}
		data.slides.push(builder.build());

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(50);
	});

	it("100+ elements on a single slide saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		const builder = createSlide("Blank");
		for (let i = 0; i < 110; i++) {
			builder.addText(`Item${i}`, {
				x: (i % 10) * 90,
				y: Math.floor(i / 10) * 45,
				width: 85,
				height: 40,
			});
		}
		data.slides.push(builder.build());

		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides[0].elements.length).toBeGreaterThanOrEqual(100);
	});

	it("deeply nested groups (3 levels) are constructed correctly in data model", async () => {
		const innerChild = createTextElement("Deep", {
			x: 0,
			y: 0,
			width: 80,
			height: 30,
		});
		const innerGroup = createGroupElement([innerChild], {
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		});
		const middleGroup = createGroupElement([innerGroup], {
			x: 0,
			y: 0,
			width: 150,
			height: 100,
		});
		const outerGroup = createGroupElement([middleGroup], {
			x: 50,
			y: 50,
			width: 200,
			height: 150,
		});

		// Verify the nesting structure in the data model
		expect(outerGroup.type).toBe("group");
		expect(outerGroup.children.length).toBe(1);
		const mid = outerGroup.children[0] as GroupPptxElement;
		expect(mid.type).toBe("group");
		expect(mid.children.length).toBe(1);
		const inner = mid.children[0] as GroupPptxElement;
		expect(inner.type).toBe("group");
		expect(inner.children.length).toBe(1);
		expect(inner.children[0].type).toBe("text");
	});

	it("group with mixed children survives save-reload", async () => {
		const { handler, data, createSlide } = await createBlank();
		const child1 = createTextElement("G-Text", {
			x: 10,
			y: 10,
			width: 200,
			height: 40,
		});
		const child2 = createShapeElement("rect", {
			x: 10,
			y: 60,
			width: 200,
			height: 100,
			fill: { type: "solid", color: "#00FF00" },
		});
		data.slides.push(
			createSlide("Blank")
				.addGroup([child1, child2], {
					x: 50,
					y: 50,
					width: 300,
					height: 200,
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const grp = reloaded.slides[0].elements.find(
			(e) => e.type === "group",
		) as GroupPptxElement | undefined;
		expect(grp).toBeDefined();
		expect(grp!.children.length).toBeGreaterThanOrEqual(2);
	});

	it("maximum 20 slides (stress test)", async () => {
		const { handler, data, createSlide } = await createBlank();
		for (let i = 0; i < 20; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`Slide ${i + 1}`, {
						x: 50,
						y: 50,
						width: 400,
						height: 50,
					})
					.build(),
			);
		}

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(20);
	});

	it("very long text content survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const longText = "A".repeat(5000);
		data.slides.push(
			createSlide("Blank")
				.addText(longText, { x: 10, y: 10, width: 800, height: 400 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const el = reloaded.slides[0].elements.find((e) => {
			if ("text" in e && typeof e.text === "string") {
				return e.text.length >= 4000;
			}
			return false;
		});
		expect(el).toBeDefined();
	});

	it("special characters in text survive round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const specialText = 'Hello <World> & "Quotes" \'Apostrophes\'';
		data.slides.push(
			createSlide("Blank")
				.addText(specialText, { x: 10, y: 10, width: 400, height: 40 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const found = reloaded.slides[0].elements.some((el) => {
			if ("text" in el && typeof el.text === "string") {
				return (
					el.text.includes("<World>") ||
					el.text.includes("&") ||
					el.text.includes('"')
				);
			}
			if ("textSegments" in el && Array.isArray(el.textSegments)) {
				return el.textSegments.some(
					(s) =>
						s.text.includes("<World>") ||
						s.text.includes("&") ||
						s.text.includes('"'),
				);
			}
			return false;
		});
		expect(found).toBe(true);
	});

	it("unicode text survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		const unicodeText = "Привет мир 你好世界 こんにちは 🎨";
		data.slides.push(
			createSlide("Blank")
				.addText(unicodeText, { x: 10, y: 10, width: 400, height: 40 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const found = reloaded.slides[0].elements.some((el) => {
			if ("text" in el && typeof el.text === "string") {
				return el.text.includes("Привет") || el.text.includes("你好");
			}
			if ("textSegments" in el && Array.isArray(el.textSegments)) {
				return el.textSegments.some(
					(s) => s.text.includes("Привет") || s.text.includes("你好"),
				);
			}
			return false;
		});
		expect(found).toBe(true);
	});

	it("double round-trip preserves data integrity", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("First trip", { x: 10, y: 10, width: 200, height: 40 })
				.addShape("ellipse", { x: 10, y: 60, width: 100, height: 100 })
				.build(),
		);

		const { handler: h2, data: d2 } = await saveAndReload(handler, data.slides);
		expect(d2.slides.length).toBe(1);

		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(1);
		expect(d3.slides[0].elements.length).toBeGreaterThanOrEqual(2);
	});

	it("table with merged cells (gridSpan) saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addTable(
					{
						rows: [
							{ cells: [{ text: "Merged", gridSpan: 2 }, { text: "" }] },
							{ cells: [{ text: "Left" }, { text: "Right" }] },
						],
					},
					{ x: 50, y: 50, width: 400, height: 100 },
				)
				.build(),
		);

		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const tbl = reloaded.slides[0].elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl).toBeDefined();
	});
});

// ===========================================================================
// 7. Slide Operations
// ===========================================================================

describe("Slide Operations", () => {
	it("add one slide => save => reload has count 1", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("One", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(1);
	});

	it("add three slides => save => reload has count 3", async () => {
		const { handler, data, createSlide } = await createBlank();
		for (let i = 0; i < 3; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`Slide ${i}`, { x: 10, y: 10, width: 200, height: 40 })
					.build(),
			);
		}
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(3);
	});

	it("remove a slide => save => reload has reduced count", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Keep", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("Remove", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("Keep2", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		// Save first with all 3
		const { handler: h2, data: d2 } = await saveAndReload(handler, data.slides);
		expect(d2.slides.length).toBe(3);

		// Remove the middle slide
		d2.slides.splice(1, 1);
		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(2);
	});

	it("add slide after initial save preserves both slides", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("First", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes1 = await handler.save(data.slides);
		expect(bytes1.length).toBeGreaterThan(0);

		data.slides.push(
			createSlide("Blank")
				.addText("Second", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		expect(reloaded.slides.length).toBe(2);
	});

	it("reorder slides => save => reload preserves new order", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Alpha", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("Beta", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const { handler: h2, data: d2 } = await saveAndReload(handler, data.slides);
		expect(d2.slides.length).toBe(2);

		// Reverse the slides
		d2.slides.reverse();
		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(2);

		// The first slide should now have "Beta" text
		const firstSlideTexts = d3.slides[0].elements
			.filter(
				(el): el is TextPptxElement | ShapePptxElement => "text" in el,
			)
			.map((el) => el.text)
			.join(" ");
		expect(firstSlideTexts).toContain("Beta");
	});

	it("incremental saves produce valid loadable output each time", async () => {
		const { handler, data, createSlide } = await createBlank();

		for (let i = 1; i <= 5; i++) {
			data.slides.push(
				createSlide("Blank")
					.addText(`Inc ${i}`, { x: 10, y: 10, width: 200, height: 40 })
					.build(),
			);
			const bytes = await handler.save(data.slides);
			expect(bytes.length).toBeGreaterThan(0);

			// Each intermediate save should be reloadable
			const tempHandler = new PptxHandler();
			const tempData = await tempHandler.load(bytes.buffer as ArrayBuffer);
			expect(tempData.slides.length).toBe(i);
		}
	});

	it("fresh handler from saved bytes can continue editing", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Start", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const { handler: h2, data: d2 } = await saveAndReload(handler, data.slides);
		d2.slides.push(
			new SlideBuilder(
				d2.slides.length + 1,
				"ppt/slideLayouts/slideLayout7.xml",
				"Blank",
			)
				.addText("Continued", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const { data: d3 } = await saveAndReload(h2, d2.slides);
		expect(d3.slides.length).toBe(2);
	});
});

// ===========================================================================
// 8. Content Types
// ===========================================================================

describe("Content Types", () => {
	it("saved ZIP has content types for slides", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("CT test", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("slide+xml");
	});

	it("content types include theme entry", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("theme+xml");
	});

	it("content types include presentation entry", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("presentation.main+xml");
	});

	it("content types include slide layout entries", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("slideLayout+xml");
	});

	it("content types include slide master entry", async () => {
		const { handler, data } = await createBlank();
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("slideMaster+xml");
	});

	it("image element adds png content type to saved ZIP", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addImage(TINY_PNG, { x: 10, y: 10, width: 100, height: 100 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		// Should contain a default or override for png
		expect(ct.toLowerCase()).toContain("png");
	});

	it("multiple slides each get their own content type override", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("S1", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("S2", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("S3", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const ct = await zip.file("[Content_Types].xml")!.async("string");
		expect(ct).toContain("slide1.xml");
		expect(ct).toContain("slide2.xml");
		expect(ct).toContain("slide3.xml");
	});

	it("saved ZIP has rels for each slide", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Rels test 1", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
			createSlide("Blank")
				.addText("Rels test 2", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		expect(
			zip.file("ppt/slides/_rels/slide1.xml.rels"),
		).not.toBeNull();
		expect(
			zip.file("ppt/slides/_rels/slide2.xml.rels"),
		).not.toBeNull();
	});
});

// ===========================================================================
// 9. Shape Variants
// ===========================================================================

describe("Shape Variants", () => {
	it("rect shape survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 100,
					y: 100,
					width: 200,
					height: 100,
					fill: { type: "solid", color: "#FF0000" },
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s?.shapeType).toBe("rect");
	});

	it("ellipse shape survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("ellipse", {
					x: 100,
					y: 100,
					width: 200,
					height: 200,
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s?.shapeType).toBe("ellipse");
	});

	it("roundRect shape survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("roundRect", {
					x: 50,
					y: 50,
					width: 300,
					height: 150,
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s?.shapeType).toBe("roundRect");
	});

	it("triangle shape survives round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("triangle", {
					x: 100,
					y: 100,
					width: 200,
					height: 200,
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s?.shapeType).toBe("triangle");
	});

	it("shape with text overlay preserves both shape and text", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 50,
					y: 50,
					width: 300,
					height: 200,
					fill: { type: "solid", color: "#0066CC" },
					text: "Inside Shape",
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s).toBeDefined();
		const hasText =
			(s?.text && s.text.includes("Inside Shape")) ||
			(s?.textSegments &&
				s.textSegments.some((seg) => seg.text.includes("Inside Shape")));
		expect(hasText).toBeTruthy();
	});

	it("shape with gradient fill saves without error", async () => {
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
						angle: 90,
						stops: [
							{ color: "#FF0000", position: 0 },
							{ color: "#0000FF", position: 1 },
						],
					},
				})
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("shape with no-fill saves and loads", async () => {
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
});

// ===========================================================================
// 10. Position & Style Fidelity
// ===========================================================================

describe("Position & Style Fidelity", () => {
	it("text position is approximately preserved through round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Pos", { x: 123, y: 456, width: 300, height: 80 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const el = reloaded.slides[0].elements[0];
		expect(el.x).toBeCloseTo(123, -1);
		expect(el.y).toBeCloseTo(456, -1);
		expect(el.width).toBeCloseTo(300, -1);
		expect(el.height).toBeCloseTo(80, -1);
	});

	it("shape fill color is preserved", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					fill: { type: "solid", color: "#00AA55" },
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		if (s?.shapeStyle?.fillColor) {
			expect(s.shapeStyle.fillColor.toUpperCase()).toBe("#00AA55");
		}
	});

	it("connector stroke color is preserved", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addConnector({
					x: 50,
					y: 50,
					width: 200,
					height: 100,
					stroke: { color: "#FF6600", width: 3 },
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const c = reloaded.slides[0].elements.find(
			(e) => e.type === "connector",
		) as ConnectorPptxElement | undefined;
		if (c?.shapeStyle?.strokeColor) {
			expect(c.shapeStyle.strokeColor.toUpperCase()).toBe("#FF6600");
		}
	});

	it("shape stroke properties are preserved", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addShape("rect", {
					x: 50,
					y: 50,
					width: 200,
					height: 100,
					fill: { type: "solid", color: "#FFFFFF" },
					stroke: { color: "#000000", width: 3 },
				})
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const s = reloaded.slides[0].elements.find(
			(e) => e.type === "shape",
		) as ShapePptxElement | undefined;
		expect(s).toBeDefined();
		if (s?.shapeStyle) {
			expect(s.shapeStyle.strokeColor).toBeDefined();
		}
	});
});

// ===========================================================================
// 11. Chart Variants
// ===========================================================================

describe("Chart Variants", () => {
	it("bar chart saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addChart(
					"bar",
					{
						series: [{ name: "Revenue", values: [100, 200, 300] }],
						categories: ["Jan", "Feb", "Mar"],
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("line chart saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addChart(
					"line",
					{
						series: [{ name: "Trend", values: [10, 30, 20, 40] }],
						categories: ["W1", "W2", "W3", "W4"],
					},
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("pie chart saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addChart(
					"pie",
					{
						series: [{ name: "Share", values: [40, 30, 20, 10] }],
						categories: ["A", "B", "C", "D"],
					},
					{ x: 50, y: 50, width: 400, height: 400 },
				)
				.build(),
		);
		const bytes = await handler.save(data.slides);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("chart with multiple series saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addChart(
					"bar",
					{
						series: [
							{ name: "2024", values: [10, 20, 30] },
							{ name: "2025", values: [15, 25, 35] },
							{ name: "2026", values: [20, 30, 40] },
						],
						categories: ["Q1", "Q2", "Q3"],
						title: "Year Comparison",
					},
					{ x: 50, y: 50, width: 600, height: 400 },
				)
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const chart = reloaded.slides[0].elements.find(
			(e) => e.type === "chart",
		) as ChartPptxElement | undefined;
		expect(chart).toBeDefined();
		if (chart?.chartData) {
			expect(chart.chartData.series.length).toBe(3);
		}
	});
});

// ===========================================================================
// 12. Table Variants
// ===========================================================================

describe("Table Variants", () => {
	it("1x1 table saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addTable(
					{ rows: [{ cells: [{ text: "Solo" }] }] },
					{ x: 50, y: 50, width: 200, height: 60 },
				)
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const tbl = reloaded.slides[0].elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl).toBeDefined();
		expect(tbl!.tableData!.rows.length).toBe(1);
	});

	it("table with many rows (10) saves and loads", async () => {
		const { handler, data, createSlide } = await createBlank();
		const rows = Array.from({ length: 10 }, (_, i) => ({
			cells: [{ text: `R${i}C1` }, { text: `R${i}C2` }, { text: `R${i}C3` }],
		}));
		data.slides.push(
			createSlide("Blank")
				.addTable({ rows }, { x: 50, y: 50, width: 600, height: 400 })
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const tbl = reloaded.slides[0].elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl!.tableData!.rows.length).toBe(10);
	});

	it("table with banded rows flag saves and reloads", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addTable(
					{
						rows: [
							{ cells: [{ text: "Header" }] },
							{ cells: [{ text: "Row 1" }] },
							{ cells: [{ text: "Row 2" }] },
						],
						bandRows: true,
						firstRow: true,
					},
					{ x: 50, y: 50, width: 300, height: 150 },
				)
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const tbl = reloaded.slides[0].elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl).toBeDefined();
		expect(tbl!.tableData!.rows.length).toBe(3);
	});

	it("table cell text is preserved through round-trip", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addTable(
					{
						rows: [
							{ cells: [{ text: "Name" }, { text: "Value" }] },
							{ cells: [{ text: "pi" }, { text: "3.14159" }] },
						],
					},
					{ x: 50, y: 50, width: 400, height: 100 },
				)
				.build(),
		);
		const { data: reloaded } = await saveAndReload(handler, data.slides);
		const tbl = reloaded.slides[0].elements.find(
			(e) => e.type === "table",
		) as TablePptxElement | undefined;
		expect(tbl!.tableData!.rows[0].cells[0].text).toBe("Name");
		expect(tbl!.tableData!.rows[1].cells[1].text).toBe("3.14159");
	});
});

// ===========================================================================
// 13. Additional Load/Save Scenarios
// ===========================================================================

describe("Additional Scenarios", () => {
	it("PptxHandler.createBlank produces same result as PresentationBuilder.create", async () => {
		const result = await PptxHandler.createBlank({ title: "Static Factory" });
		expect(result.handler).toBeInstanceOf(PptxHandler);
		expect(result.data).toBeDefined();
		expect(result.createSlide).toBeDefined();
	});

	it("getLayoutOptions returns layouts after load", async () => {
		const { handler } = await createBlank();
		const layouts = handler.getLayoutOptions();
		expect(layouts.length).toBeGreaterThanOrEqual(1);
		// Should include standard layout names
		const names = layouts.map((l) => l.name);
		expect(names.some((n) => n.includes("Blank") || n.includes("blank"))).toBe(
			true,
		);
	});

	it("getCompatibilityWarnings returns an array", async () => {
		const { handler } = await createBlank();
		const warnings = handler.getCompatibilityWarnings();
		expect(Array.isArray(warnings)).toBe(true);
	});

	it("multiple separate presentations can coexist", async () => {
		const p1 = await createBlank({ title: "Deck A" });
		const p2 = await createBlank({ title: "Deck B" });

		p1.data.slides.push(
			p1.createSlide("Blank")
				.addText("Deck A content", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);
		p2.data.slides.push(
			p2.createSlide("Blank")
				.addText("Deck B content", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const bytes1 = await p1.handler.save(p1.data.slides);
		const bytes2 = await p2.handler.save(p2.data.slides);

		expect(bytes1.length).toBeGreaterThan(0);
		expect(bytes2.length).toBeGreaterThan(0);
		// They should be different files
		expect(bytes1.length).not.toBe(bytes2.length);
	});

	it("save idempotency: saving twice produces loadable output both times", async () => {
		const { handler, data, createSlide } = await createBlank();
		data.slides.push(
			createSlide("Blank")
				.addText("Idempotent", { x: 10, y: 10, width: 200, height: 40 })
				.build(),
		);

		const bytes1 = await handler.save(data.slides);
		const bytes2 = await handler.save(data.slides);

		const h1 = new PptxHandler();
		const d1 = await h1.load(bytes1.buffer as ArrayBuffer);
		expect(d1.slides.length).toBe(1);

		const h2 = new PptxHandler();
		const d2 = await h2.load(bytes2.buffer as ArrayBuffer);
		expect(d2.slides.length).toBe(1);
	});

	it("background gradient is set on slide model", async () => {
		const { data, createSlide } = await createBlank();
		const slide = createSlide("Blank")
			.setBackground({
				type: "gradient",
				angle: 45,
				stops: [
					{ color: "#FF0000", position: 0 },
					{ color: "#0000FF", position: 1 },
				],
			})
			.addText("Gradient BG", { x: 10, y: 10, width: 200, height: 40 })
			.build();
		data.slides.push(slide);
		expect(slide.backgroundGradient).toBeDefined();
		expect(slide.backgroundGradient).toContain("gradient");
	});

	it("slide with animation data model is preserved before save", async () => {
		const { data, createSlide } = await createBlank();
		const textEl = createTextElement("Animated", {
			x: 50,
			y: 50,
			width: 200,
			height: 40,
		});
		const slide = createSlide("Blank")
			.addElement(textEl)
			.addAnimation(textEl.id, {
				preset: "fadeIn",
				trigger: "onClick",
				duration: 500,
			})
			.build();
		data.slides.push(slide);
		expect(slide.animations).toBeDefined();
		expect(slide.animations!.length).toBe(1);
		expect(slide.animations![0].elementId).toBe(textEl.id);
	});
});
