/**
 * Visual regression tests via SVG snapshot matching.
 *
 * The {@link SvgExporter} produces deterministic SVG strings from slide data,
 * making it ideal for snapshot-based visual regression testing. Any change to
 * the rendering pipeline that alters SVG output will cause these snapshots to
 * fail, flagging the change for review.
 *
 * To update snapshots after intentional rendering changes:
 *   bun vitest run --update
 *
 * @module __tests__/visual/svg-snapshots
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SvgExporter } from "../../converter/SvgExporter";
import {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createTableElement,
	createGroupElement,
	createChartElement,
	createMediaElement,
	resetIdCounter,
} from "../../core/builders/sdk/ElementFactory";
import type { PptxSlide } from "../../core/types/presentation";
import type { PptxElement } from "../../core/types/elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard viewport dimensions for all snapshot tests. */
const WIDTH = 960;
const HEIGHT = 540;

/** Create a minimal PptxSlide with the given overrides. */
function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: "slide1",
		rId: "rId2",
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

/** Export a slide to SVG and snapshot it. */
function snapshotSlide(
	slide: PptxSlide,
	width = WIDTH,
	height = HEIGHT,
): string {
	return SvgExporter.exportSlide(slide, width, height);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SVG Visual Snapshots", () => {
	beforeEach(() => {
		// Reset element ID counter so IDs are deterministic across runs
		resetIdCounter();
	});

	// ── 1. Empty slide ──────────────────────────────────────────

	it("empty slide with default white background", () => {
		const slide = makeSlide();
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("empty slide with custom background color", () => {
		const slide = makeSlide({ backgroundColor: "#2B2D42" });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("empty slide with background image", () => {
		const slide = makeSlide({
			backgroundImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 2. Text elements ────────────────────────────────────────

	it("simple text element", () => {
		const text = createTextElement("Hello World", {
			x: 100,
			y: 80,
			width: 600,
			height: 50,
			fontSize: 24,
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("text with bold, italic, and color", () => {
		const text = createTextElement("Styled Text", {
			x: 50,
			y: 50,
			width: 400,
			height: 60,
			fontSize: 32,
			bold: true,
			italic: true,
			color: "#E63946",
			fontFamily: "Georgia",
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("text with center alignment", () => {
		const text = createTextElement("Centered", {
			x: 0,
			y: 200,
			width: 960,
			height: 60,
			fontSize: 36,
			alignment: "center",
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("text with right alignment", () => {
		const text = createTextElement("Right Aligned", {
			x: 0,
			y: 200,
			width: 960,
			height: 60,
			fontSize: 28,
			alignment: "right",
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("multi-line text", () => {
		const text = createTextElement("Line One\nLine Two\nLine Three", {
			x: 50,
			y: 100,
			width: 500,
			height: 120,
			fontSize: 20,
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("rich text with multiple segments", () => {
		const text = createTextElement(
			[
				{ text: "Bold part", style: { bold: true, color: "#FF0000" } },
				{ text: " and ", style: {} },
				{ text: "italic part", style: { italic: true, color: "#0000FF" } },
			],
			{
				x: 80,
				y: 60,
				width: 600,
				height: 50,
				fontSize: 22,
			},
		);
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("text with background fill and stroke", () => {
		const text = createTextElement("Boxed Text", {
			x: 100,
			y: 200,
			width: 300,
			height: 60,
			fontSize: 20,
			fill: { type: "solid", color: "#FFF3E0" },
			stroke: { color: "#E65100", width: 2 },
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 3. Shape elements ───────────────────────────────────────

	it("rectangle shape with solid fill", () => {
		const shape = createShapeElement("rect", {
			x: 100,
			y: 100,
			width: 300,
			height: 200,
			fill: { type: "solid", color: "#4472C4" },
			stroke: { color: "#2B4C7E", width: 2 },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("ellipse shape", () => {
		const shape = createShapeElement("ellipse", {
			x: 200,
			y: 150,
			width: 250,
			height: 180,
			fill: { type: "solid", color: "#ED7D31" },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("roundRect shape", () => {
		const shape = createShapeElement("roundRect", {
			x: 150,
			y: 100,
			width: 400,
			height: 200,
			fill: { type: "solid", color: "#70AD47" },
			stroke: { color: "#3D6B24", width: 1.5 },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("triangle shape", () => {
		const shape = createShapeElement("triangle", {
			x: 300,
			y: 150,
			width: 200,
			height: 180,
			fill: { type: "solid", color: "#FFC000" },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("diamond shape", () => {
		const shape = createShapeElement("diamond", {
			x: 300,
			y: 100,
			width: 200,
			height: 200,
			fill: { type: "solid", color: "#5B9BD5" },
			stroke: { color: "#2E75B6", width: 2 },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("shape with no fill", () => {
		const shape = createShapeElement("rect", {
			x: 100,
			y: 100,
			width: 300,
			height: 200,
			fill: { type: "none" },
			stroke: { color: "#FF0000", width: 3 },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("shape with text overlay", () => {
		const shape = createShapeElement("roundRect", {
			x: 200,
			y: 200,
			width: 300,
			height: 100,
			fill: { type: "solid", color: "#4472C4" },
			text: "Click Me",
			textStyle: { fontSize: 24, bold: true, color: "#FFFFFF" },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 4. Image elements ───────────────────────────────────────

	it("image element with data URL", () => {
		const img = createImageElement(
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
			{
				x: 100,
				y: 100,
				width: 400,
				height: 300,
				altText: "Test image",
			},
		);
		const slide = makeSlide({ elements: [img] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("image element placeholder (no image data)", () => {
		const img = createImageElement("ppt/media/image1.png", {
			x: 200,
			y: 150,
			width: 350,
			height: 250,
		});
		const slide = makeSlide({ elements: [img] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 5. Connector elements ───────────────────────────────────

	it("straight connector", () => {
		const connector = createConnectorElement({
			x: 100,
			y: 200,
			width: 300,
			height: 0,
			stroke: { color: "#333333", width: 2 },
		});
		const slide = makeSlide({ elements: [connector] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("connector with end arrow", () => {
		const connector = createConnectorElement({
			x: 100,
			y: 200,
			width: 300,
			height: 100,
			stroke: { color: "#0000FF", width: 2 },
			endArrow: "triangle",
		});
		const slide = makeSlide({ elements: [connector] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("connector with both arrows", () => {
		const connector = createConnectorElement({
			x: 50,
			y: 50,
			width: 400,
			height: 200,
			stroke: { color: "#CC0000", width: 3 },
			startArrow: "triangle",
			endArrow: "triangle",
		});
		const slide = makeSlide({ elements: [connector] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("diagonal connector (non-zero height)", () => {
		const connector = createConnectorElement({
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			stroke: { color: "#666666", width: 1 },
		});
		const slide = makeSlide({ elements: [connector] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 6. Table elements ───────────────────────────────────────

	it("basic 2x3 table", () => {
		const table = createTableElement(
			{
				rows: [
					{ cells: [{ text: "Name" }, { text: "Score" }] },
					{ cells: [{ text: "Alice" }, { text: "95" }] },
					{ cells: [{ text: "Bob" }, { text: "87" }] },
				],
			},
			{
				x: 100,
				y: 100,
				width: 500,
			},
		);
		const slide = makeSlide({ elements: [table] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("table with header row styling", () => {
		const table = createTableElement(
			{
				rows: [
					{
						cells: [
							{ text: "Header A", style: { bold: true, color: "#FFFFFF" } },
							{ text: "Header B", style: { bold: true, color: "#FFFFFF" } },
							{ text: "Header C", style: { bold: true, color: "#FFFFFF" } },
						],
					},
					{
						cells: [
							{ text: "Cell 1" },
							{ text: "Cell 2" },
							{ text: "Cell 3" },
						],
					},
					{
						cells: [
							{ text: "Cell 4" },
							{ text: "Cell 5" },
							{ text: "Cell 6" },
						],
					},
				],
				firstRow: true,
				bandRows: true,
			},
			{
				x: 80,
				y: 120,
				width: 700,
			},
		);
		const slide = makeSlide({ elements: [table] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("table with merge spans", () => {
		const table = createTableElement(
			{
				rows: [
					{
						cells: [
							{ text: "Merged Header", gridSpan: 3 },
						],
					},
					{
						cells: [
							{ text: "A" },
							{ text: "B" },
							{ text: "C" },
						],
					},
				],
				columnWidths: [1, 1, 1],
			},
			{
				x: 100,
				y: 100,
				width: 600,
			},
		);
		const slide = makeSlide({ elements: [table] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 7. Group elements ───────────────────────────────────────

	it("group with nested shape and text", () => {
		const rect = createShapeElement("rect", {
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			fill: { type: "solid", color: "#AABBCC" },
		});
		const label = createTextElement("Label", {
			x: 10,
			y: 30,
			width: 180,
			height: 40,
			fontSize: 16,
			color: "#333333",
		});
		const group = createGroupElement([rect, label], {
			x: 100,
			y: 100,
			width: 200,
			height: 100,
		});
		const slide = makeSlide({ elements: [group] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("nested groups", () => {
		const innerShape = createShapeElement("ellipse", {
			x: 0,
			y: 0,
			width: 80,
			height: 80,
			fill: { type: "solid", color: "#FF6B6B" },
		});
		const innerGroup = createGroupElement([innerShape], {
			x: 10,
			y: 10,
			width: 80,
			height: 80,
		});
		const outerShape = createShapeElement("rect", {
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			fill: { type: "solid", color: "#E8E8E8" },
			stroke: { color: "#999999", width: 1 },
		});
		const outerGroup = createGroupElement([outerShape, innerGroup], {
			x: 200,
			y: 150,
			width: 200,
			height: 200,
		});
		const slide = makeSlide({ elements: [outerGroup] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 8. Gradient fills ───────────────────────────────────────

	it("shape with gradient fill", () => {
		const shape = createShapeElement("rect", {
			x: 100,
			y: 100,
			width: 400,
			height: 250,
			fill: {
				type: "gradient",
				angle: 90,
				stops: [
					{ color: "#667eea", position: 0 },
					{ color: "#764ba2", position: 1 },
				],
			},
			stroke: { color: "#444444", width: 1 },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 9. Effects (shadow) ─────────────────────────────────────

	it("shape with shadow effect", () => {
		const shape = createShapeElement("roundRect", {
			x: 200,
			y: 150,
			width: 300,
			height: 200,
			fill: { type: "solid", color: "#FFFFFF" },
			stroke: { color: "#CCCCCC", width: 1 },
			shadow: {
				color: "#000000",
				blur: 8,
				offsetX: 4,
				offsetY: 4,
				opacity: 0.3,
			},
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("text with shadow", () => {
		const text = createTextElement("Shadow Text", {
			x: 100,
			y: 200,
			width: 400,
			height: 60,
			fontSize: 36,
			bold: true,
			shadow: {
				color: "#333333",
				blur: 6,
				offsetX: 3,
				offsetY: 3,
				opacity: 0.5,
			},
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 10. Rotation and flip transforms ────────────────────────

	it("shape with rotation", () => {
		const shape = createShapeElement("rect", {
			x: 300,
			y: 150,
			width: 200,
			height: 100,
			rotation: 45,
			fill: { type: "solid", color: "#FF6347" },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("element with flip horizontal", () => {
		const slide = makeSlide({
			elements: [
				{
					type: "shape",
					id: "flipped-h",
					x: 200,
					y: 150,
					width: 200,
					height: 100,
					shapeType: "triangle",
					shapeStyle: { fillColor: "#A5A5A5" },
					flipHorizontal: true,
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("element with flip vertical", () => {
		const slide = makeSlide({
			elements: [
				{
					type: "shape",
					id: "flipped-v",
					x: 200,
					y: 150,
					width: 200,
					height: 100,
					shapeType: "triangle",
					shapeStyle: { fillColor: "#FFC000" },
					flipVertical: true,
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("element with rotation and flip", () => {
		const slide = makeSlide({
			elements: [
				{
					type: "shape",
					id: "rot-flip",
					x: 300,
					y: 200,
					width: 150,
					height: 100,
					rotation: 30,
					shapeType: "rect",
					shapeStyle: {
						fillColor: "#7B68EE",
						strokeColor: "#483D8B",
						strokeWidth: 2,
					},
					flipHorizontal: true,
					flipVertical: true,
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 11. Opacity ─────────────────────────────────────────────

	it("shape with partial opacity", () => {
		const shape = createShapeElement("ellipse", {
			x: 200,
			y: 150,
			width: 300,
			height: 200,
			fill: { type: "solid", color: "#4472C4" },
			opacity: 0.5,
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 12. Complex mixed slide ─────────────────────────────────

	it("complex slide with many element types", () => {
		const title = createTextElement("Quarterly Report", {
			x: 50,
			y: 30,
			width: 860,
			height: 60,
			fontSize: 36,
			bold: true,
			color: "#1A1A2E",
			alignment: "center",
		});

		const subtitle = createTextElement("Q4 2025 Performance Summary", {
			x: 50,
			y: 90,
			width: 860,
			height: 40,
			fontSize: 18,
			italic: true,
			color: "#666666",
			alignment: "center",
		});

		const blueBox = createShapeElement("roundRect", {
			x: 50,
			y: 160,
			width: 280,
			height: 160,
			fill: { type: "solid", color: "#4472C4" },
			text: "Revenue\n$1.2M",
			textStyle: { fontSize: 20, color: "#FFFFFF", bold: true },
		});

		const greenBox = createShapeElement("roundRect", {
			x: 340,
			y: 160,
			width: 280,
			height: 160,
			fill: { type: "solid", color: "#70AD47" },
			text: "Growth\n+15%",
			textStyle: { fontSize: 20, color: "#FFFFFF", bold: true },
		});

		const orangeCircle = createShapeElement("ellipse", {
			x: 650,
			y: 165,
			width: 150,
			height: 150,
			fill: { type: "solid", color: "#ED7D31" },
			text: "95",
			textStyle: { fontSize: 36, color: "#FFFFFF", bold: true },
		});

		const connector = createConnectorElement({
			x: 330,
			y: 240,
			width: 10,
			height: 0,
			stroke: { color: "#CCCCCC", width: 1 },
		});

		const table = createTableElement(
			{
				rows: [
					{
						cells: [
							{ text: "Metric", style: { bold: true } },
							{ text: "Value", style: { bold: true } },
						],
					},
					{ cells: [{ text: "Users" }, { text: "10,432" }] },
					{ cells: [{ text: "Sessions" }, { text: "45,821" }] },
				],
				firstRow: true,
			},
			{
				x: 50,
				y: 360,
				width: 400,
			},
		);

		const slide = makeSlide({
			backgroundColor: "#F8F9FA",
			elements: [title, subtitle, blueBox, greenBox, orangeCircle, connector, table],
		});

		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	it("slide with multiple shapes and connectors (flowchart)", () => {
		const box1 = createShapeElement("roundRect", {
			x: 50,
			y: 200,
			width: 180,
			height: 80,
			fill: { type: "solid", color: "#4472C4" },
			text: "Start",
			textStyle: { color: "#FFFFFF", fontSize: 16 },
		});

		const box2 = createShapeElement("rect", {
			x: 380,
			y: 200,
			width: 180,
			height: 80,
			fill: { type: "solid", color: "#70AD47" },
			text: "Process",
			textStyle: { color: "#FFFFFF", fontSize: 16 },
		});

		const box3 = createShapeElement("diamond", {
			x: 700,
			y: 180,
			width: 120,
			height: 120,
			fill: { type: "solid", color: "#FFC000" },
			text: "?",
			textStyle: { color: "#333333", fontSize: 20 },
		});

		const arrow1 = createConnectorElement({
			x: 230,
			y: 240,
			width: 150,
			height: 0,
			stroke: { color: "#333333", width: 2 },
			endArrow: "triangle",
		});

		const arrow2 = createConnectorElement({
			x: 560,
			y: 240,
			width: 140,
			height: 0,
			stroke: { color: "#333333", width: 2 },
			endArrow: "triangle",
		});

		const slide = makeSlide({
			elements: [box1, box2, box3, arrow1, arrow2],
		});

		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 13. Chart placeholder ───────────────────────────────────

	it("chart element renders as placeholder", () => {
		const chart = createChartElement(
			"bar",
			{
				series: [{ name: "Q1", values: [45, 62, 38] }],
				categories: ["A", "B", "C"],
				title: "Sales",
			},
			{
				x: 100,
				y: 100,
				width: 600,
				height: 400,
			},
		);
		const slide = makeSlide({ elements: [chart] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 14. Media placeholder ───────────────────────────────────

	it("media element renders as placeholder", () => {
		const media = createMediaElement("video", "media/video1.mp4", {
			x: 200,
			y: 100,
			width: 480,
			height: 270,
		});
		const slide = makeSlide({ elements: [media] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 15. Ink element ─────────────────────────────────────────

	it("ink element with paths", () => {
		const slide = makeSlide({
			elements: [
				{
					type: "ink",
					id: "ink1",
					x: 50,
					y: 50,
					width: 400,
					height: 300,
					inkPaths: [
						"M 10 10 C 20 20, 40 20, 50 10",
						"M 70 70 L 80 80 L 90 70",
					],
					inkColors: ["#FF0000", "#0000FF"],
					inkWidths: [2, 3],
					inkOpacities: [1, 0.7],
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 16. Hidden elements are excluded ────────────────────────

	it("hidden elements do not appear in SVG output", () => {
		const visible = createTextElement("Visible", {
			x: 100,
			y: 100,
			width: 200,
			height: 50,
			fontSize: 20,
		});
		const slide = makeSlide({
			elements: [
				visible,
				{
					type: "text",
					id: "hidden-text",
					x: 100,
					y: 200,
					width: 200,
					height: 50,
					text: "HIDDEN",
					hidden: true,
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
		expect(svg).not.toContain("HIDDEN");
	});

	// ── 17. XML escaping in SVG output ──────────────────────────

	it("text with special XML characters is properly escaped", () => {
		const text = createTextElement('Tom & Jerry <"friends"> \'always\'', {
			x: 50,
			y: 50,
			width: 600,
			height: 60,
			fontSize: 20,
		});
		const slide = makeSlide({ elements: [text] });
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
		expect(svg).toContain("&amp;");
		expect(svg).toContain("&lt;");
		expect(svg).toContain("&gt;");
	});

	// ── 18. Stroke dash and opacity ─────────────────────────────

	it("shape with fill and stroke opacity", () => {
		const slide = makeSlide({
			elements: [
				{
					type: "shape",
					id: "semi-opaque",
					x: 100,
					y: 100,
					width: 300,
					height: 200,
					shapeType: "rect",
					shapeStyle: {
						fillColor: "#4472C4",
						fillOpacity: 0.6,
						strokeColor: "#000000",
						strokeWidth: 3,
						strokeOpacity: 0.8,
					},
				} as PptxElement,
			],
		});
		const svg = snapshotSlide(slide);
		expect(svg).toMatchSnapshot();
	});

	// ── 19. Different viewport sizes ────────────────────────────

	it("slide at 4:3 aspect ratio", () => {
		const shape = createShapeElement("rect", {
			x: 50,
			y: 50,
			width: 624,
			height: 418,
			fill: { type: "solid", color: "#E8E8E8" },
		});
		const slide = makeSlide({ elements: [shape] });
		const svg = snapshotSlide(slide, 720, 540);
		expect(svg).toMatchSnapshot();
	});

	// ── 20. exportAll with multiple slides ──────────────────────

	it("exportAll produces consistent snapshots for multiple slides", () => {
		const slide1 = makeSlide({
			id: "s1",
			slideNumber: 1,
			backgroundColor: "#FFFFFF",
			elements: [
				createTextElement("Slide 1", {
					x: 50,
					y: 50,
					width: 400,
					height: 60,
					fontSize: 28,
				}),
			],
		});
		const slide2 = makeSlide({
			id: "s2",
			slideNumber: 2,
			backgroundColor: "#F0F0F0",
			elements: [
				createShapeElement("ellipse", {
					x: 200,
					y: 150,
					width: 300,
					height: 200,
					fill: { type: "solid", color: "#4472C4" },
				}),
			],
		});

		const svgs = SvgExporter.exportAll(
			{ slides: [slide1, slide2], width: WIDTH, height: HEIGHT },
		);

		expect(svgs).toHaveLength(2);
		expect(svgs[0]).toMatchSnapshot();
		expect(svgs[1]).toMatchSnapshot();
	});
});
