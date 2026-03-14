import { describe, it, expect, beforeEach } from "vitest";
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
} from "./ElementFactory";

beforeEach(() => {
	resetIdCounter();
});

describe("createTextElement", () => {
	it("creates a text element with string input", () => {
		const el = createTextElement("Hello World");
		expect(el.type).toBe("text");
		expect(el.text).toBe("Hello World");
		expect(el.id).toBeTruthy();
		expect(el.x).toBe(100);
		expect(el.y).toBe(100);
		expect(el.width).toBe(600);
		expect(el.height).toBe(50);
		expect(el.textSegments).toBeDefined();
		expect(el.textSegments?.length).toBe(1);
		expect(el.textSegments?.[0].text).toBe("Hello World");
	});

	it("applies text styling from options", () => {
		const el = createTextElement("Styled", {
			fontSize: 36,
			bold: true,
			color: "#FF0000",
			alignment: "center",
		});
		expect(el.textStyle?.fontSize).toBe(36);
		expect(el.textStyle?.bold).toBe(true);
		expect(el.textStyle?.color).toBe("#FF0000");
		expect(el.textStyle?.align).toBe("center");
	});

	it("applies position overrides", () => {
		const el = createTextElement("Pos", {
			x: 50,
			y: 25,
			width: 400,
			height: 80,
		});
		expect(el.x).toBe(50);
		expect(el.y).toBe(25);
		expect(el.width).toBe(400);
		expect(el.height).toBe(80);
	});

	it("creates segments from rich text input", () => {
		const el = createTextElement([
			{ text: "Bold ", style: { bold: true } },
			{ text: "normal" },
		]);
		expect(el.textSegments?.length).toBe(2);
		expect(el.textSegments?.[0].text).toBe("Bold ");
		expect(el.textSegments?.[0].style.bold).toBe(true);
		expect(el.textSegments?.[1].text).toBe("normal");
	});

	it("handles multiline text with paragraph breaks", () => {
		const el = createTextElement("Line 1\nLine 2");
		expect(el.textSegments?.length).toBe(3); // "Line 1", "\n" (break), "Line 2"
		expect(el.textSegments?.[1].isParagraphBreak).toBe(true);
	});

	it("applies fill and stroke", () => {
		const el = createTextElement("Filled", {
			fill: { type: "solid", color: "#CCCCCC" },
			stroke: { color: "#000000", width: 2 },
		});
		expect(el.shapeStyle?.fillMode).toBe("solid");
		expect(el.shapeStyle?.fillColor).toBe("#CCCCCC");
		expect(el.shapeStyle?.strokeColor).toBe("#000000");
		expect(el.shapeStyle?.strokeWidth).toBe(2);
	});

	it("generates unique IDs", () => {
		const el1 = createTextElement("A");
		const el2 = createTextElement("B");
		expect(el1.id).not.toBe(el2.id);
	});
});

describe("createShapeElement", () => {
	it("creates a shape with default fill", () => {
		const el = createShapeElement("rect");
		expect(el.type).toBe("shape");
		expect(el.shapeType).toBe("rect");
		expect(el.shapeStyle?.fillMode).toBe("solid");
		expect(el.shapeStyle?.fillColor).toBe("#4472C4");
	});

	it("creates a shape with custom fill", () => {
		const el = createShapeElement("ellipse", {
			fill: { type: "solid", color: "#FF0000" },
		});
		expect(el.shapeStyle?.fillColor).toBe("#FF0000");
	});

	it("creates a shape with gradient fill", () => {
		const el = createShapeElement("roundRect", {
			fill: {
				type: "gradient",
				angle: 90,
				stops: [
					{ color: "#FF0000", position: 0 },
					{ color: "#0000FF", position: 1 },
				],
			},
		});
		expect(el.shapeStyle?.fillMode).toBe("gradient");
		expect(el.shapeStyle?.fillGradientStops?.length).toBe(2);
	});

	it("creates a shape with text overlay", () => {
		const el = createShapeElement("rect", { text: "Click me" });
		expect(el.text).toBe("Click me");
		expect(el.textSegments?.length).toBe(1);
	});

	it("applies shape adjustments", () => {
		const el = createShapeElement("roundRect", {
			adjustments: { adj: 16667 },
		});
		expect(el.shapeAdjustments?.adj).toBe(16667);
	});

	it("applies no fill", () => {
		const el = createShapeElement("rect", {
			fill: { type: "none" },
		});
		expect(el.shapeStyle?.fillMode).toBe("none");
	});
});

describe("createConnectorElement", () => {
	it("creates a straight connector by default", () => {
		const el = createConnectorElement();
		expect(el.type).toBe("connector");
		expect(el.shapeType).toBe("straightConnector1");
	});

	it("creates a bent connector", () => {
		const el = createConnectorElement({ type: "bent" });
		expect(el.shapeType).toBe("bentConnector3");
	});

	it("creates a curved connector", () => {
		const el = createConnectorElement({ type: "curved" });
		expect(el.shapeType).toBe("curvedConnector3");
	});

	it("applies arrows", () => {
		const el = createConnectorElement({
			startArrow: "diamond",
			endArrow: "triangle",
		});
		expect(el.shapeStyle?.connectorStartArrow).toBe("diamond");
		expect(el.shapeStyle?.connectorEndArrow).toBe("triangle");
	});

	it("applies connection points", () => {
		const el = createConnectorElement({
			from: { elementId: "shape1", site: 2 },
			to: { elementId: "shape2", site: 0 },
		});
		expect(el.shapeStyle?.connectorStartConnection?.shapeId).toBe("shape1");
		expect(el.shapeStyle?.connectorEndConnection?.shapeId).toBe("shape2");
	});
});

describe("createImageElement", () => {
	it("creates an image from data URL", () => {
		const el = createImageElement("data:image/png;base64,iVBOR...");
		expect(el.type).toBe("image");
		expect(el.imageData).toBe("data:image/png;base64,iVBOR...");
		expect(el.imagePath).toBeUndefined();
	});

	it("creates an image from path", () => {
		const el = createImageElement("ppt/media/image1.png");
		expect(el.imagePath).toBe("ppt/media/image1.png");
		expect(el.imageData).toBeUndefined();
	});

	it("applies alt text and crop", () => {
		const el = createImageElement("data:image/png;base64,abc", {
			altText: "Logo",
			cropLeft: 0.1,
			cropTop: 0.2,
		});
		expect(el.altText).toBe("Logo");
		expect(el.cropLeft).toBe(0.1);
		expect(el.cropTop).toBe(0.2);
	});
});

describe("createTableElement", () => {
	it("creates a table with rows and cells", () => {
		const el = createTableElement({
			rows: [
				{ cells: [{ text: "A" }, { text: "B" }] },
				{ cells: [{ text: "C" }, { text: "D" }] },
			],
		});
		expect(el.type).toBe("table");
		expect(el.tableData?.rows.length).toBe(2);
		expect(el.tableData?.rows[0].cells[0].text).toBe("A");
		expect(el.tableData?.columnWidths).toEqual([0.5, 0.5]);
	});

	it("normalizes column widths", () => {
		const el = createTableElement({
			rows: [{ cells: [{ text: "A" }, { text: "B" }, { text: "C" }] }],
			columnWidths: [1, 2, 1],
		});
		expect(el.tableData?.columnWidths).toEqual([0.25, 0.5, 0.25]);
	});

	it("applies banding options", () => {
		const el = createTableElement({
			rows: [{ cells: [{ text: "H" }] }],
			firstRow: true,
			bandRows: true,
		});
		expect(el.tableData?.firstRowHeader).toBe(true);
		expect(el.tableData?.bandedRows).toBe(true);
	});

	it("handles merge spans", () => {
		const el = createTableElement({
			rows: [
				{ cells: [{ text: "Merged", gridSpan: 2 }, { text: "" }] },
			],
		});
		expect(el.tableData?.rows[0].cells[0].gridSpan).toBe(2);
	});
});

describe("createChartElement", () => {
	it("creates a bar chart", () => {
		const el = createChartElement("bar", {
			series: [{ name: "Q1", values: [10, 20, 30] }],
			categories: ["A", "B", "C"],
			title: "Sales",
		});
		expect(el.type).toBe("chart");
		expect(el.chartData?.chartType).toBe("bar");
		expect(el.chartData?.title).toBe("Sales");
		expect(el.chartData?.series.length).toBe(1);
		expect(el.chartData?.categories).toEqual(["A", "B", "C"]);
	});

	it("applies grouping", () => {
		const el = createChartElement("bar", {
			series: [{ name: "S", values: [1] }],
			categories: ["X"],
			grouping: "stacked",
		});
		expect(el.chartData?.grouping).toBe("stacked");
	});
});

describe("createMediaElement", () => {
	it("creates a video element", () => {
		const el = createMediaElement("video", "data:video/mp4;base64,abc", {
			autoPlay: true,
			loop: true,
		});
		expect(el.type).toBe("media");
		expect(el.mediaType).toBe("video");
		expect(el.autoPlay).toBe(true);
		expect(el.loop).toBe(true);
	});

	it("creates an audio element", () => {
		const el = createMediaElement("audio", "ppt/media/audio1.mp3");
		expect(el.mediaType).toBe("audio");
		expect(el.mediaPath).toBe("ppt/media/audio1.mp3");
	});
});

describe("createGroupElement", () => {
	it("creates a group with children", () => {
		const child1 = createTextElement("A");
		const child2 = createShapeElement("rect");
		const el = createGroupElement([child1, child2]);
		expect(el.type).toBe("group");
		expect(el.children.length).toBe(2);
		expect(el.children[0].type).toBe("text");
		expect(el.children[1].type).toBe("shape");
	});
});
