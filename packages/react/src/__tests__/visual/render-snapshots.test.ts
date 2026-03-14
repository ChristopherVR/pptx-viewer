/**
 * Visual regression tests for the React rendering pipeline.
 *
 * Since React testing-library is not available in this project, these tests
 * use the SVG exporter from pptx-viewer-core to verify that the rendering
 * output remains stable. The SVG exporter serves as a proxy for the React
 * rendering pipeline: both consume the same PptxSlide data and produce
 * visual output. Changes that affect element structure in the core data
 * model will be caught by these snapshots.
 *
 * Additionally, CSS style computation helpers from the React rendering
 * utilities are snapshot-tested to ensure consistent style output.
 *
 * To update snapshots after intentional rendering changes:
 *   bun vitest run --update
 *
 * @module __tests__/visual/render-snapshots
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	SvgExporter,
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createTableElement,
	createGroupElement,
	createChartElement,
	resetIdCounter,
} from "pptx-viewer-core";
import type { PptxSlide, PptxElement } from "pptx-viewer-core";
import {
	getElementTransform,
	getTextCompensationTransform,
	getSvgStrokeDasharray,
	getCssBorderDashStyle,
	getCompoundLineBoxShadow,
	getCompoundLineBorderWidth,
} from "../../viewer/utils/style";
import { getContainerStyle } from "../../viewer/components/elements/element-renderer-helpers";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIDTH = 960;
const HEIGHT = 540;

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: "slide1",
		rId: "rId2",
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

function snapshotSlide(slide: PptxSlide): string {
	return SvgExporter.exportSlide(slide, WIDTH, HEIGHT);
}

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: "el-1",
		type: "shape",
		x: 100,
		y: 200,
		width: 300,
		height: 150,
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// Part 1: SVG rendering snapshots (rendering pipeline proxy)
// ---------------------------------------------------------------------------

describe("React Render Snapshots - SVG Proxy", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	it("title slide layout", () => {
		const title = createTextElement("Presentation Title", {
			x: 80,
			y: 180,
			width: 800,
			height: 80,
			fontSize: 44,
			bold: true,
			color: "#1A1A2E",
			alignment: "center",
		});
		const subtitle = createTextElement("Subtitle goes here", {
			x: 160,
			y: 280,
			width: 640,
			height: 50,
			fontSize: 24,
			color: "#666666",
			alignment: "center",
		});
		const slide = makeSlide({
			backgroundColor: "#FFFFFF",
			elements: [title, subtitle],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("content slide with bullet points and image", () => {
		const heading = createTextElement("Key Findings", {
			x: 50,
			y: 30,
			width: 860,
			height: 60,
			fontSize: 32,
			bold: true,
			color: "#2B2D42",
		});
		const bullets = createTextElement(
			"First finding\nSecond finding\nThird finding",
			{
				x: 50,
				y: 110,
				width: 450,
				height: 300,
				fontSize: 18,
				color: "#333333",
			},
		);
		const image = createImageElement(
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
			{
				x: 520,
				y: 110,
				width: 380,
				height: 300,
			},
		);
		const slide = makeSlide({
			elements: [heading, bullets, image],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("comparison layout with two columns", () => {
		const leftTitle = createTextElement("Option A", {
			x: 30,
			y: 30,
			width: 430,
			height: 50,
			fontSize: 28,
			bold: true,
			color: "#4472C4",
			alignment: "center",
		});
		const rightTitle = createTextElement("Option B", {
			x: 500,
			y: 30,
			width: 430,
			height: 50,
			fontSize: 28,
			bold: true,
			color: "#ED7D31",
			alignment: "center",
		});
		const leftBox = createShapeElement("roundRect", {
			x: 30,
			y: 90,
			width: 430,
			height: 380,
			fill: { type: "solid", color: "#E8F0FE" },
			stroke: { color: "#4472C4", width: 2 },
		});
		const rightBox = createShapeElement("roundRect", {
			x: 500,
			y: 90,
			width: 430,
			height: 380,
			fill: { type: "solid", color: "#FFF3E0" },
			stroke: { color: "#ED7D31", width: 2 },
		});
		const divider = createConnectorElement({
			x: 475,
			y: 30,
			width: 0,
			height: 480,
			stroke: { color: "#CCCCCC", width: 1 },
		});
		const slide = makeSlide({
			elements: [leftBox, rightBox, leftTitle, rightTitle, divider],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("dashboard slide with shapes, table, and chart", () => {
		const title = createTextElement("Dashboard", {
			x: 30,
			y: 10,
			width: 900,
			height: 50,
			fontSize: 30,
			bold: true,
			alignment: "center",
		});

		const kpi1 = createShapeElement("roundRect", {
			x: 30,
			y: 70,
			width: 200,
			height: 100,
			fill: { type: "solid", color: "#4472C4" },
			text: "Users\n1,234",
			textStyle: { color: "#FFFFFF", fontSize: 16, bold: true },
		});
		const kpi2 = createShapeElement("roundRect", {
			x: 250,
			y: 70,
			width: 200,
			height: 100,
			fill: { type: "solid", color: "#70AD47" },
			text: "Revenue\n$45K",
			textStyle: { color: "#FFFFFF", fontSize: 16, bold: true },
		});
		const kpi3 = createShapeElement("roundRect", {
			x: 470,
			y: 70,
			width: 200,
			height: 100,
			fill: { type: "solid", color: "#ED7D31" },
			text: "Growth\n+12%",
			textStyle: { color: "#FFFFFF", fontSize: 16, bold: true },
		});
		const kpi4 = createShapeElement("ellipse", {
			x: 710,
			y: 70,
			width: 100,
			height: 100,
			fill: { type: "solid", color: "#FFC000" },
			text: "A+",
			textStyle: { color: "#333333", fontSize: 24, bold: true },
		});

		const table = createTableElement(
			{
				rows: [
					{
						cells: [
							{ text: "Region", style: { bold: true } },
							{ text: "Q3", style: { bold: true } },
							{ text: "Q4", style: { bold: true } },
						],
					},
					{ cells: [{ text: "North" }, { text: "$120K" }, { text: "$145K" }] },
					{ cells: [{ text: "South" }, { text: "$95K" }, { text: "$110K" }] },
					{ cells: [{ text: "East" }, { text: "$80K" }, { text: "$92K" }] },
				],
				firstRow: true,
			},
			{
				x: 30,
				y: 200,
				width: 450,
			},
		);

		const chart = createChartElement(
			"bar",
			{
				series: [{ name: "Revenue", values: [120, 95, 80] }],
				categories: ["North", "South", "East"],
			},
			{
				x: 500,
				y: 200,
				width: 420,
				height: 300,
			},
		);

		const slide = makeSlide({
			backgroundColor: "#F5F5F5",
			elements: [title, kpi1, kpi2, kpi3, kpi4, table, chart],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("slide with grouped elements", () => {
		const bg = createShapeElement("rect", {
			x: 0,
			y: 0,
			width: 250,
			height: 120,
			fill: { type: "solid", color: "#F0F4FF" },
			stroke: { color: "#4472C4", width: 1 },
		});
		const icon = createShapeElement("ellipse", {
			x: 15,
			y: 20,
			width: 60,
			height: 60,
			fill: { type: "solid", color: "#4472C4" },
		});
		const label = createTextElement("Feature Card", {
			x: 85,
			y: 25,
			width: 150,
			height: 30,
			fontSize: 16,
			bold: true,
			color: "#1A1A2E",
		});
		const desc = createTextElement("Short description here", {
			x: 85,
			y: 55,
			width: 150,
			height: 40,
			fontSize: 12,
			color: "#666666",
		});

		const card1 = createGroupElement([bg, icon, label, desc], {
			x: 30,
			y: 100,
			width: 250,
			height: 120,
		});
		const card2 = createGroupElement([bg, icon, label, desc], {
			x: 350,
			y: 100,
			width: 250,
			height: 120,
		});
		const card3 = createGroupElement([bg, icon, label, desc], {
			x: 670,
			y: 100,
			width: 250,
			height: 120,
		});

		const slide = makeSlide({
			elements: [card1, card2, card3],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("slide with rich formatted text", () => {
		const richText = createTextElement(
			[
				{ text: "Important: ", style: { bold: true, color: "#CC0000", fontSize: 20 } },
				{ text: "This is a ", style: { fontSize: 18 } },
				{ text: "critical", style: { italic: true, underline: true, fontSize: 18 } },
				{ text: " update.", style: { fontSize: 18 } },
			],
			{
				x: 50,
				y: 200,
				width: 800,
				height: 60,
				fontSize: 18,
			},
		);
		const slide = makeSlide({ elements: [richText] });
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});

	it("slide with connectors and arrows (process flow)", () => {
		const step1 = createShapeElement("rect", {
			x: 30,
			y: 220,
			width: 150,
			height: 70,
			fill: { type: "solid", color: "#4472C4" },
			text: "Step 1",
			textStyle: { color: "#FFFFFF", fontSize: 14 },
		});
		const step2 = createShapeElement("rect", {
			x: 250,
			y: 220,
			width: 150,
			height: 70,
			fill: { type: "solid", color: "#70AD47" },
			text: "Step 2",
			textStyle: { color: "#FFFFFF", fontSize: 14 },
		});
		const step3 = createShapeElement("rect", {
			x: 470,
			y: 220,
			width: 150,
			height: 70,
			fill: { type: "solid", color: "#ED7D31" },
			text: "Step 3",
			textStyle: { color: "#FFFFFF", fontSize: 14 },
		});
		const step4 = createShapeElement("roundRect", {
			x: 690,
			y: 220,
			width: 150,
			height: 70,
			fill: { type: "solid", color: "#FFC000" },
			text: "Done",
			textStyle: { color: "#333333", fontSize: 14, bold: true },
		});

		const arr1 = createConnectorElement({
			x: 180,
			y: 255,
			width: 70,
			height: 0,
			stroke: { color: "#555555", width: 2 },
			endArrow: "triangle",
		});
		const arr2 = createConnectorElement({
			x: 400,
			y: 255,
			width: 70,
			height: 0,
			stroke: { color: "#555555", width: 2 },
			endArrow: "triangle",
		});
		const arr3 = createConnectorElement({
			x: 620,
			y: 255,
			width: 70,
			height: 0,
			stroke: { color: "#555555", width: 2 },
			endArrow: "triangle",
		});

		const slide = makeSlide({
			elements: [step1, step2, step3, step4, arr1, arr2, arr3],
		});
		expect(snapshotSlide(slide)).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Part 2: CSS style computation snapshots
// ---------------------------------------------------------------------------

describe("CSS Style Computation Snapshots", () => {
	it("getContainerStyle for a basic shape", () => {
		const style = getContainerStyle({
			el: makeElement(),
			isFullscreenMedia: false,
			isImg: false,
			zIndex: 5,
			opacity: 1,
			animationState: undefined,
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle for fullscreen media", () => {
		const style = getContainerStyle({
			el: makeElement({ type: "media" } as Partial<PptxElement>),
			isFullscreenMedia: true,
			isImg: false,
			zIndex: 20,
			opacity: 1,
			animationState: undefined,
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle for an image element", () => {
		const style = getContainerStyle({
			el: makeElement({
				type: "image",
				x: 50,
				y: 75,
				width: 400,
				height: 300,
			} as Partial<PptxElement>),
			isFullscreenMedia: false,
			isImg: true,
			zIndex: 3,
			opacity: 0.9,
			animationState: undefined,
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle with animation state hidden", () => {
		const style = getContainerStyle({
			el: makeElement(),
			isFullscreenMedia: false,
			isImg: false,
			zIndex: 2,
			opacity: 1,
			animationState: { visible: false, cssAnimation: undefined },
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style.visibility).toBe("hidden");
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle with rotation", () => {
		const style = getContainerStyle({
			el: makeElement({
				rotation: 45,
			} as Partial<PptxElement>),
			isFullscreenMedia: false,
			isImg: false,
			zIndex: 1,
			opacity: 1,
			animationState: undefined,
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle with flips", () => {
		const style = getContainerStyle({
			el: makeElement({
				flipHorizontal: true,
				flipVertical: true,
			} as Partial<PptxElement>),
			isFullscreenMedia: false,
			isImg: false,
			zIndex: 1,
			opacity: 1,
			animationState: undefined,
			shapeVisualStyle: {} as CSSProperties,
		});
		expect(style).toMatchSnapshot();
	});

	it("getContainerStyle with visual style overrides", () => {
		const style = getContainerStyle({
			el: makeElement(),
			isFullscreenMedia: false,
			isImg: false,
			zIndex: 3,
			opacity: 1,
			animationState: undefined,
			shapeVisualStyle: {
				border: "2px solid #4472C4",
				borderRadius: "8px",
				background: "linear-gradient(to bottom, #fff, #eee)",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
			},
		});
		expect(style).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Part 3: Element transform snapshots
// ---------------------------------------------------------------------------

describe("Element Transform Snapshots", () => {
	it("no transform for default element", () => {
		const transform = getElementTransform(makeElement());
		expect(transform).toMatchSnapshot();
	});

	it("rotation transform", () => {
		const transform = getElementTransform(
			makeElement({ rotation: 90 } as Partial<PptxElement>),
		);
		expect(transform).toMatchSnapshot();
	});

	it("flip horizontal", () => {
		const transform = getElementTransform(
			makeElement({ flipHorizontal: true } as Partial<PptxElement>),
		);
		expect(transform).toMatchSnapshot();
	});

	it("flip vertical", () => {
		const transform = getElementTransform(
			makeElement({ flipVertical: true } as Partial<PptxElement>),
		);
		expect(transform).toMatchSnapshot();
	});

	it("rotation with both flips", () => {
		const transform = getElementTransform(
			makeElement({
				rotation: 45,
				flipHorizontal: true,
				flipVertical: true,
			} as Partial<PptxElement>),
		);
		expect(transform).toMatchSnapshot();
	});

	it("text compensation transform with both flips", () => {
		const transform = getTextCompensationTransform(
			makeElement({
				flipHorizontal: true,
				flipVertical: true,
			} as Partial<PptxElement>),
		);
		expect(transform).toMatchSnapshot();
	});

	it("text compensation returns undefined with no flips", () => {
		const transform = getTextCompensationTransform(makeElement());
		expect(transform).toMatchSnapshot();
	});
});

// ---------------------------------------------------------------------------
// Part 4: Stroke style computation snapshots
// ---------------------------------------------------------------------------

describe("Stroke Style Snapshots", () => {
	it("SVG dasharray for solid", () => {
		expect(getSvgStrokeDasharray("solid", 2)).toMatchSnapshot();
	});

	it("SVG dasharray for dot", () => {
		expect(getSvgStrokeDasharray("dot", 2)).toMatchSnapshot();
	});

	it("SVG dasharray for dash", () => {
		expect(getSvgStrokeDasharray("dash", 2)).toMatchSnapshot();
	});

	it("SVG dasharray for lgDash", () => {
		expect(getSvgStrokeDasharray("lgDash", 3)).toMatchSnapshot();
	});

	it("SVG dasharray for dashDot", () => {
		expect(getSvgStrokeDasharray("dashDot", 2)).toMatchSnapshot();
	});

	it("SVG dasharray for sysDot", () => {
		expect(getSvgStrokeDasharray("sysDot", 1)).toMatchSnapshot();
	});

	it("CSS border dash style for solid", () => {
		expect(getCssBorderDashStyle("solid")).toMatchSnapshot();
	});

	it("CSS border dash style for dot", () => {
		expect(getCssBorderDashStyle("dot")).toMatchSnapshot();
	});

	it("CSS border dash style for dash", () => {
		expect(getCssBorderDashStyle("dash")).toMatchSnapshot();
	});

	it("CSS border dash style for compound double line", () => {
		expect(getCssBorderDashStyle("dash", "dbl")).toMatchSnapshot();
	});

	it("compound line box-shadow for double", () => {
		expect(getCompoundLineBoxShadow("dbl", 4, "#000000")).toMatchSnapshot();
	});

	it("compound line box-shadow for thickThin", () => {
		expect(
			getCompoundLineBoxShadow("thickThin", 6, "#333333"),
		).toMatchSnapshot();
	});

	it("compound line box-shadow returns undefined for single", () => {
		expect(
			getCompoundLineBoxShadow("sng", 2, "#000000"),
		).toMatchSnapshot();
	});

	it("compound line border width for double", () => {
		expect(getCompoundLineBorderWidth("dbl", 4)).toMatchSnapshot();
	});

	it("compound line border width for single", () => {
		expect(getCompoundLineBorderWidth("sng", 2)).toMatchSnapshot();
	});
});
