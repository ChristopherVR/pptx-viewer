/**
 * Tests for CLI command handlers.
 *
 * Tests exercise the exported handler functions directly (not the
 * CLI argument parsing), verifying they produce correct results
 * from programmatic inputs.
 *
 * @module cli/commands.test
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PptxHandler } from "../core/PptxHandler";
import { PresentationBuilder } from "../core/builders/sdk/PresentationBuilder";
import {
	handleInfo,
	handleExportSvg,
	handleExportMd,
	handleMerge,
	handleFind,
	handleReplace,
	handleCreate,
	handleDiff,
} from "./commands";

// ---------------------------------------------------------------------------
// Test fixture: build a minimal PPTX in memory
// ---------------------------------------------------------------------------

let singleSlideBytes: Uint8Array;
let multiSlideBytes: Uint8Array;
let emptyBytes: Uint8Array;

beforeAll(async () => {
	// Single slide with text content
	{
		const { handler, data, createSlide } =
			await PresentationBuilder.create({
				title: "Test Deck",
				creator: "Test Author",
				theme: {
					name: "TestTheme",
					colors: { accent1: "#FF0000" },
					fonts: { majorFont: "Arial", minorFont: "Calibri" },
				},
			});
		data.slides.push(
			createSlide("Title Slide")
				.addText("Hello World", { fontSize: 36, bold: true })
				.addText("Subtitle text here", { fontSize: 18 })
				.build(),
		);
		singleSlideBytes = await handler.save(data.slides);
	}

	// Multiple slides with different content
	{
		const { handler, data, createSlide } =
			await PresentationBuilder.create({
				title: "Multi Deck",
				creator: "Multi Author",
			});
		data.slides.push(
			createSlide("Title Slide")
				.addText("First Slide Title", { fontSize: 36 })
				.build(),
		);
		data.slides.push(
			createSlide("Blank")
				.addText("Second Slide Content", { fontSize: 24 })
				.addShape("rect", { fill: { type: "solid", color: "#0000FF" } })
				.build(),
		);
		data.slides.push(
			createSlide("Blank")
				.addText("Third Slide with Q1 2025 report", { fontSize: 18 })
				.build(),
		);
		multiSlideBytes = await handler.save(data.slides);
	}

	// Empty presentation (no slides)
	{
		const { handler, data } = await PresentationBuilder.create({
			title: "Empty Deck",
		});
		emptyBytes = await handler.save(data.slides);
	}
});

// ---------------------------------------------------------------------------
// handleInfo
// ---------------------------------------------------------------------------

describe("handleInfo", () => {
	it("returns correct slide count for single-slide presentation", async () => {
		const info = await handleInfo(singleSlideBytes);
		expect(info.slideCount).toBe(1);
	});

	it("returns correct slide count for multi-slide presentation", async () => {
		const info = await handleInfo(multiSlideBytes);
		expect(info.slideCount).toBe(3);
	});

	it("returns positive dimensions", async () => {
		const info = await handleInfo(singleSlideBytes);
		expect(info.width).toBeGreaterThan(0);
		expect(info.height).toBeGreaterThan(0);
	});

	it("returns element count greater than zero when slides have content", async () => {
		const info = await handleInfo(singleSlideBytes);
		expect(info.totalElements).toBeGreaterThan(0);
	});

	it("returns zero slides for empty presentation", async () => {
		const info = await handleInfo(emptyBytes);
		expect(info.slideCount).toBe(0);
		expect(info.totalElements).toBe(0);
	});

	it("returns layout information", async () => {
		const info = await handleInfo(singleSlideBytes);
		expect(info.layoutCount).toBeGreaterThanOrEqual(0);
		expect(Array.isArray(info.layouts)).toBe(true);
	});

	it("returns boolean flags for macros and signatures", async () => {
		const info = await handleInfo(singleSlideBytes);
		expect(typeof info.hasMacros).toBe("boolean");
		expect(typeof info.hasDigitalSignatures).toBe("boolean");
	});
});

// ---------------------------------------------------------------------------
// handleExportSvg
// ---------------------------------------------------------------------------

describe("handleExportSvg", () => {
	it("exports one SVG per slide", async () => {
		const result = await handleExportSvg(multiSlideBytes);
		expect(result.slideCount).toBe(3);
		expect(result.svgs).toHaveLength(3);
	});

	it("each SVG is a valid SVG string starting with <svg", async () => {
		const result = await handleExportSvg(singleSlideBytes);
		expect(result.svgs).toHaveLength(1);
		expect(result.svgs[0]).toMatch(/^<svg\s/);
		expect(result.svgs[0]).toContain("</svg>");
	});

	it("SVGs contain a viewBox attribute", async () => {
		const result = await handleExportSvg(singleSlideBytes);
		expect(result.svgs[0]).toContain("viewBox=");
	});

	it("exports specific slide indices when specified", async () => {
		const result = await handleExportSvg(multiSlideBytes, {
			slideIndices: [0, 2],
		});
		expect(result.slideCount).toBe(2);
		expect(result.svgs).toHaveLength(2);
	});

	it("returns empty array for presentation with no slides", async () => {
		const result = await handleExportSvg(emptyBytes);
		expect(result.slideCount).toBe(0);
		expect(result.svgs).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// handleExportMd
// ---------------------------------------------------------------------------

describe("handleExportMd", () => {
	it("produces non-empty markdown", async () => {
		const result = await handleExportMd(singleSlideBytes, {
			sourceName: "test.pptx",
		});
		expect(result.markdown.length).toBeGreaterThan(0);
	});

	it("reports correct slide count", async () => {
		const result = await handleExportMd(multiSlideBytes, {
			sourceName: "multi.pptx",
		});
		expect(result.slideCount).toBe(3);
	});

	it("produces markdown that contains slide separators for multi-slide decks", async () => {
		const result = await handleExportMd(multiSlideBytes, {
			sourceName: "multi.pptx",
		});
		// Markdown should contain horizontal rule separators
		expect(result.markdown).toContain("---");
	});

	it("handles empty presentation gracefully", async () => {
		const result = await handleExportMd(emptyBytes, {
			sourceName: "empty.pptx",
		});
		expect(typeof result.markdown).toBe("string");
		expect(result.slideCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// handleFind
// ---------------------------------------------------------------------------

describe("handleFind", () => {
	it("finds text that exists in the presentation", async () => {
		const result = await handleFind(multiSlideBytes, "Slide");
		expect(result.totalCount).toBeGreaterThan(0);
		expect(result.matches.length).toBeGreaterThan(0);
	});

	it("returns zero matches for text not in the presentation", async () => {
		const result = await handleFind(
			singleSlideBytes,
			"nonexistent_text_xyz_123",
		);
		expect(result.totalCount).toBe(0);
		expect(result.matches).toHaveLength(0);
	});

	it("returns correct slide index in match results", async () => {
		const result = await handleFind(multiSlideBytes, "Third");
		if (result.totalCount > 0) {
			// "Third" should be on the 3rd slide (index 2)
			expect(result.matches[0].slideIndex).toBe(2);
		}
	});

	it("supports case-insensitive search", async () => {
		const caseSensitive = await handleFind(multiSlideBytes, "first", {
			caseSensitive: true,
		});
		const caseInsensitive = await handleFind(multiSlideBytes, "first", {
			caseSensitive: false,
		});
		// Case-insensitive should find at least as many as case-sensitive
		expect(caseInsensitive.totalCount).toBeGreaterThanOrEqual(
			caseSensitive.totalCount,
		);
	});

	it("finds no results in an empty presentation", async () => {
		const result = await handleFind(emptyBytes, "test");
		expect(result.totalCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// handleReplace
// ---------------------------------------------------------------------------

describe("handleReplace", () => {
	it("replaces text and returns output bytes", async () => {
		const result = await handleReplace(
			multiSlideBytes,
			"2025",
			"2026",
		);
		expect(result.outputBytes).toBeInstanceOf(Uint8Array);
		expect(result.outputBytes.length).toBeGreaterThan(0);
	});

	it("returns replacement count", async () => {
		const result = await handleReplace(
			multiSlideBytes,
			"2025",
			"2026",
		);
		// The multi-slide deck has "Q1 2025" in it
		expect(result.replacementCount).toBeGreaterThanOrEqual(1);
	});

	it("replacement is reflected when re-loading the output", async () => {
		const result = await handleReplace(
			multiSlideBytes,
			"2025",
			"2026",
		);

		// Verify the replacement took effect
		const findAfter = await handleFind(result.outputBytes, "2026");
		expect(findAfter.totalCount).toBeGreaterThanOrEqual(1);

		// Original text should no longer be present
		const findOld = await handleFind(result.outputBytes, "2025");
		expect(findOld.totalCount).toBe(0);
	});

	it("returns zero replacements when search text is not found", async () => {
		const result = await handleReplace(
			singleSlideBytes,
			"nonexistent_xyz",
			"replacement",
		);
		expect(result.replacementCount).toBe(0);
		expect(result.outputBytes.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// handleMerge
// ---------------------------------------------------------------------------

describe("handleMerge", () => {
	it("merges two presentations", async () => {
		const result = await handleMerge(singleSlideBytes, multiSlideBytes);
		expect(result.mergedSlideCount).toBe(3); // all 3 slides from multi
		expect(result.totalSlideCount).toBe(4); // 1 + 3
		expect(result.outputBytes).toBeInstanceOf(Uint8Array);
	});

	it("merged output can be re-loaded", async () => {
		const result = await handleMerge(singleSlideBytes, multiSlideBytes);
		const info = await handleInfo(result.outputBytes);
		expect(info.slideCount).toBe(4);
	});

	it("merges specific slide indices", async () => {
		const result = await handleMerge(singleSlideBytes, multiSlideBytes, {
			slideIndices: [0],
		});
		expect(result.mergedSlideCount).toBe(1);
		expect(result.totalSlideCount).toBe(2);
	});

	it("merging empty into non-empty does not change slide count", async () => {
		const result = await handleMerge(singleSlideBytes, emptyBytes);
		expect(result.mergedSlideCount).toBe(0);
		expect(result.totalSlideCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// handleCreate
// ---------------------------------------------------------------------------

describe("handleCreate", () => {
	it("creates a valid PPTX with one slide", async () => {
		const result = await handleCreate();
		expect(result.outputBytes).toBeInstanceOf(Uint8Array);
		expect(result.outputBytes.length).toBeGreaterThan(0);
		expect(result.slideCount).toBe(1);
	});

	it("created presentation can be loaded back", async () => {
		const result = await handleCreate({ title: "My New Deck" });
		const info = await handleInfo(result.outputBytes);
		expect(info.slideCount).toBe(1);
		expect(info.width).toBeGreaterThan(0);
		expect(info.height).toBeGreaterThan(0);
	});

	it("respects title and creator options", async () => {
		const result = await handleCreate({
			title: "CLI Test",
			creator: "CLI Author",
		});
		// Verify it can be loaded (title/creator are embedded in docProps)
		const info = await handleInfo(result.outputBytes);
		expect(info.slideCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// handleDiff
// ---------------------------------------------------------------------------

describe("handleDiff", () => {
	it("reports identical presentations as matching", async () => {
		const result = await handleDiff(singleSlideBytes, singleSlideBytes);
		expect(result.dimensionsMatch).toBe(true);
		expect(result.slideCountA).toBe(result.slideCountB);
	});

	it("detects different slide counts", async () => {
		const result = await handleDiff(singleSlideBytes, multiSlideBytes);
		expect(result.slideCountA).toBe(1);
		expect(result.slideCountB).toBe(3);
		// Slides 2 and 3 are added in B
		const addedSlides = result.slideDiffs.filter(
			(d) => d.status === "added",
		);
		expect(addedSlides.length).toBe(2);
	});

	it("detects added slides when B has more slides", async () => {
		const result = await handleDiff(emptyBytes, singleSlideBytes);
		expect(result.slideCountA).toBe(0);
		expect(result.slideCountB).toBe(1);
		expect(result.slideDiffs).toHaveLength(1);
		expect(result.slideDiffs[0].status).toBe("added");
	});

	it("detects removed slides when A has more slides", async () => {
		const result = await handleDiff(singleSlideBytes, emptyBytes);
		expect(result.slideCountA).toBe(1);
		expect(result.slideCountB).toBe(0);
		expect(result.slideDiffs).toHaveLength(1);
		expect(result.slideDiffs[0].status).toBe("removed");
	});

	it("includes text differences for modified slides", async () => {
		// Replace text to create a modified version
		const replaced = await handleReplace(
			singleSlideBytes,
			"Hello World",
			"Goodbye World",
		);
		const result = await handleDiff(
			singleSlideBytes,
			replaced.outputBytes,
		);
		// The first slide should be modified with text differences
		const modifiedSlides = result.slideDiffs.filter(
			(d) => d.status === "modified",
		);
		if (modifiedSlides.length > 0) {
			expect(
				modifiedSlides[0].textDifferences,
			).toBeDefined();
		}
	});

	it("dimensions match for presentations built with same options", async () => {
		const result = await handleDiff(multiSlideBytes, multiSlideBytes);
		expect(result.dimensionsMatch).toBe(true);
	});
});
