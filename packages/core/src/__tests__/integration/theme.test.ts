import { describe, it, expect } from "vitest";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";
import type { PptxSlide } from "../../core/types/presentation";
import type { PptxThemeColorScheme, PptxThemeFontScheme } from "../../core/types/theme";

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

describe("Theme Operations", () => {
	it("should create a presentation with custom theme colors", async () => {
		const customColors = {
			dk1: "#1A1A2E",
			lt1: "#FFFFFF",
			dk2: "#16213E",
			lt2: "#E8E8E8",
			accent1: "#0F3460",
			accent2: "#533483",
			accent3: "#E94560",
			accent4: "#F0A500",
			accent5: "#59C1BD",
			accent6: "#85C88A",
			hlink: "#0066CC",
			folHlink: "#800080",
		};

		const { data } = await createAndLoad({
			theme: { name: "Custom Corporate", colors: customColors },
		});

		expect(data.themeColorMap).toBeDefined();
		expect(data.theme?.colorScheme).toBeDefined();

		// Verify each custom color was applied
		if (data.themeColorMap) {
			expect(data.themeColorMap.accent1?.toUpperCase()).toBe("#0F3460");
			expect(data.themeColorMap.accent2?.toUpperCase()).toBe("#533483");
			expect(data.themeColorMap.accent3?.toUpperCase()).toBe("#E94560");
			expect(data.themeColorMap.accent4?.toUpperCase()).toBe("#F0A500");
		}
	});

	it("should create a presentation with custom theme fonts", async () => {
		const { data } = await createAndLoad({
			theme: {
				fonts: { majorFont: "Georgia", minorFont: "Verdana" },
			},
		});

		expect(data.theme?.fontScheme).toBeDefined();
		if (data.theme?.fontScheme?.majorFont) {
			expect(data.theme.fontScheme.majorFont.latin).toBe("Georgia");
		}
		if (data.theme?.fontScheme?.minorFont) {
			expect(data.theme.fontScheme.minorFont.latin).toBe("Verdana");
		}
	});

	it("should create a presentation with named theme", async () => {
		const { data } = await createAndLoad({
			theme: { name: "My Custom Theme" },
		});

		// The theme name is stored in the theme XML and exposed via themeOptions
		expect(data.themeOptions).toBeDefined();
		expect(data.themeOptions!.length).toBeGreaterThanOrEqual(1);
		expect(data.themeOptions![0].name).toBe("My Custom Theme");
	});

	it("should preserve theme through round-trip", async () => {
		const { handler, data, createSlide } = await createAndLoad({
			theme: {
				name: "Preserved Theme",
				colors: {
					accent1: "#FF1234",
					accent2: "#00ABCD",
				},
				fonts: { majorFont: "Arial Black", minorFont: "Tahoma" },
			},
		});

		// Add a slide so the presentation is not empty
		data.slides.push(
			createSlide("Blank")
				.addText("Theme test", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		const { data: reloaded } = await saveAndReload(handler, data.slides);

		// Theme name is exposed via themeOptions
		expect(reloaded.themeOptions).toBeDefined();
		expect(reloaded.themeOptions!.length).toBeGreaterThanOrEqual(1);
		expect(reloaded.themeOptions![0].name).toBe("Preserved Theme");

		// Colors should survive
		if (reloaded.themeColorMap) {
			expect(reloaded.themeColorMap.accent1?.toUpperCase()).toBe("#FF1234");
			expect(reloaded.themeColorMap.accent2?.toUpperCase()).toBe("#00ABCD");
		}

		// Fonts should survive
		if (reloaded.theme?.fontScheme?.majorFont) {
			expect(reloaded.theme.fontScheme.majorFont.latin).toBe("Arial Black");
		}
	});

	it("should apply a new color scheme via handler", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		// Add a slide
		data.slides.push(
			createSlide("Blank")
				.addText("Before color change", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		// Save once to establish the ZIP state
		await handler.save(data.slides);

		const newColorScheme: PptxThemeColorScheme = {
			dk1: "#000000",
			lt1: "#FFFFFF",
			dk2: "#222222",
			lt2: "#DDDDDD",
			accent1: "#AA0000",
			accent2: "#00AA00",
			accent3: "#0000AA",
			accent4: "#AAAA00",
			accent5: "#AA00AA",
			accent6: "#00AAAA",
			hlink: "#0000FF",
			folHlink: "#800080",
		};

		await handler.updateThemeColorScheme(newColorScheme);

		// Save and reload to verify the color scheme was applied
		const { data: reloaded } = await saveAndReload(handler, data.slides);

		expect(reloaded.themeColorMap).toBeDefined();
		if (reloaded.themeColorMap) {
			expect(reloaded.themeColorMap.accent1?.toUpperCase()).toBe("#AA0000");
			expect(reloaded.themeColorMap.accent2?.toUpperCase()).toBe("#00AA00");
			expect(reloaded.themeColorMap.accent3?.toUpperCase()).toBe("#0000AA");
		}
	});

	it("should apply a new font scheme via handler", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addText("Font test", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		// Save once to establish the ZIP state
		await handler.save(data.slides);

		const newFontScheme: PptxThemeFontScheme = {
			majorFont: { latin: "Montserrat" },
			minorFont: { latin: "Open Sans" },
		};

		await handler.updateThemeFontScheme(newFontScheme);

		const { data: reloaded } = await saveAndReload(handler, data.slides);

		expect(reloaded.theme?.fontScheme).toBeDefined();
		if (reloaded.theme?.fontScheme?.majorFont) {
			expect(reloaded.theme.fontScheme.majorFont.latin).toBe("Montserrat");
		}
		if (reloaded.theme?.fontScheme?.minorFont) {
			expect(reloaded.theme.fontScheme.minorFont.latin).toBe("Open Sans");
		}
	});

	it("should apply a complete theme via applyTheme", async () => {
		const { handler, data, createSlide } = await createAndLoad();

		data.slides.push(
			createSlide("Blank")
				.addText("Full theme test", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		await handler.save(data.slides);

		const colorScheme: PptxThemeColorScheme = {
			dk1: "#111111",
			lt1: "#FEFEFE",
			dk2: "#333333",
			lt2: "#CCCCCC",
			accent1: "#FF5500",
			accent2: "#00FF55",
			accent3: "#5500FF",
			accent4: "#FFFF00",
			accent5: "#FF00FF",
			accent6: "#00FFFF",
			hlink: "#1155CC",
			folHlink: "#990099",
		};

		const fontScheme: PptxThemeFontScheme = {
			majorFont: { latin: "Palatino" },
			minorFont: { latin: "Optima" },
		};

		await handler.applyTheme(colorScheme, fontScheme, "Corporate 2026");

		const { data: reloaded } = await saveAndReload(handler, data.slides);

		// Theme name is exposed via themeOptions
		expect(reloaded.themeOptions).toBeDefined();
		expect(reloaded.themeOptions!.length).toBeGreaterThanOrEqual(1);
		expect(reloaded.themeOptions![0].name).toBe("Corporate 2026");

		// Colors should be updated
		if (reloaded.themeColorMap) {
			expect(reloaded.themeColorMap.accent1?.toUpperCase()).toBe("#FF5500");
		}

		// Fonts should be updated
		if (reloaded.theme?.fontScheme?.majorFont) {
			expect(reloaded.theme.fontScheme.majorFont.latin).toBe("Palatino");
		}
	});

	it("should use default theme when no custom theme is provided", async () => {
		const { data } = await createAndLoad();

		// Default theme name is "Office Theme", exposed via themeOptions
		expect(data.themeOptions).toBeDefined();
		expect(data.themeOptions!.length).toBeGreaterThanOrEqual(1);
		expect(data.themeOptions![0].name).toBe("Office Theme");

		// Default colors should be present
		expect(data.themeColorMap).toBeDefined();
		if (data.themeColorMap) {
			// Default accent1 is #4472C4
			expect(data.themeColorMap.accent1?.toUpperCase()).toBe("#4472C4");
		}
	});

	it("should preserve theme color scheme through double round-trip", async () => {
		const { handler, data, createSlide } = await createAndLoad({
			theme: {
				colors: {
					accent1: "#DEAD00",
					accent2: "#BEEF00",
				},
			},
		});

		data.slides.push(
			createSlide("Blank")
				.addText("Double theme trip", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		// First round-trip
		const { handler: handler2, data: data2 } = await saveAndReload(handler, data.slides);
		expect(data2.themeColorMap?.accent1?.toUpperCase()).toBe("#DEAD00");

		// Second round-trip
		const { data: data3 } = await saveAndReload(handler2, data2.slides);
		expect(data3.themeColorMap?.accent1?.toUpperCase()).toBe("#DEAD00");
		expect(data3.themeColorMap?.accent2?.toUpperCase()).toBe("#BEEF00");
	});
});
