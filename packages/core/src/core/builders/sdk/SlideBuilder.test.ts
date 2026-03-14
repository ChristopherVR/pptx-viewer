import { describe, it, expect } from "vitest";
import { SlideBuilder } from "./SlideBuilder";
import { createTextElement, createShapeElement } from "./ElementFactory";

describe("SlideBuilder", () => {
	it("builds a slide with slide number and layout", () => {
		const slide = new SlideBuilder(1, "ppt/slideLayouts/slideLayout7.xml", "Blank").build();
		expect(slide.id).toBe("slide1");
		expect(slide.slideNumber).toBe(1);
		expect(slide.layoutPath).toBe("ppt/slideLayouts/slideLayout7.xml");
		expect(slide.layoutName).toBe("Blank");
		expect(slide.elements).toEqual([]);
	});

	it("chains addText calls", () => {
		const slide = new SlideBuilder(1)
			.addText("Title", { fontSize: 36, x: 100, y: 50, width: 800, height: 60 })
			.addText("Subtitle", { fontSize: 18, x: 100, y: 120, width: 800, height: 40 })
			.build();
		expect(slide.elements.length).toBe(2);
		expect(slide.elements[0].type).toBe("text");
		expect(slide.elements[1].type).toBe("text");
	});

	it("chains addShape", () => {
		const slide = new SlideBuilder(1)
			.addShape("roundRect", {
				fill: { type: "solid", color: "#FF0000" },
				text: "Button",
			})
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("shape");
	});

	it("chains addImage", () => {
		const slide = new SlideBuilder(1)
			.addImage("data:image/png;base64,abc", { altText: "Photo" })
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("image");
	});

	it("chains addTable", () => {
		const slide = new SlideBuilder(1)
			.addTable({
				rows: [{ cells: [{ text: "A" }, { text: "B" }] }],
			})
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("table");
	});

	it("chains addChart", () => {
		const slide = new SlideBuilder(1)
			.addChart("pie", {
				series: [{ name: "S1", values: [30, 70] }],
				categories: ["A", "B"],
			})
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("chart");
	});

	it("chains addConnector", () => {
		const slide = new SlideBuilder(1)
			.addConnector({ endArrow: "triangle" })
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("connector");
	});

	it("chains addMedia", () => {
		const slide = new SlideBuilder(1)
			.addMedia("video", "data:video/mp4;base64,abc")
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("media");
	});

	it("chains addGroup", () => {
		const child = createTextElement("Child");
		const slide = new SlideBuilder(1)
			.addGroup([child])
			.build();
		expect(slide.elements.length).toBe(1);
		expect(slide.elements[0].type).toBe("group");
	});

	it("addElement accepts pre-built elements", () => {
		const el = createShapeElement("diamond");
		const slide = new SlideBuilder(1).addElement(el).build();
		expect(slide.elements[0]).toBe(el);
	});

	it("sets background color", () => {
		const slide = new SlideBuilder(1)
			.setBackground({ type: "solid", color: "#F5F5F5" })
			.build();
		expect(slide.backgroundColor).toBe("#F5F5F5");
	});

	it("sets background gradient", () => {
		const slide = new SlideBuilder(1)
			.setBackground({
				type: "gradient",
				angle: 135,
				stops: [
					{ color: "#000000", position: 0 },
					{ color: "#FFFFFF", position: 1 },
				],
			})
			.build();
		expect(slide.backgroundGradient).toContain("linear-gradient");
	});

	it("sets background image", () => {
		const slide = new SlideBuilder(1)
			.setBackground({ type: "image", source: "data:image/png;base64,..." })
			.build();
		expect(slide.backgroundImage).toBe("data:image/png;base64,...");
	});

	it("sets transition", () => {
		const slide = new SlideBuilder(1)
			.setTransition({ type: "fade", duration: 1000 })
			.build();
		expect(slide.transition?.type).toBe("fade");
		expect(slide.transition?.durationMs).toBe(1000);
	});

	it("sets notes", () => {
		const slide = new SlideBuilder(1)
			.setNotes("Speaker notes")
			.build();
		expect(slide.notes).toBe("Speaker notes");
	});

	it("sets hidden", () => {
		const slide = new SlideBuilder(1).setHidden(true).build();
		expect(slide.hidden).toBe(true);
	});

	it("sets section", () => {
		const slide = new SlideBuilder(1)
			.setSection("Introduction", "sec_1")
			.build();
		expect(slide.sectionName).toBe("Introduction");
		expect(slide.sectionId).toBe("sec_1");
	});

	it("adds animations", () => {
		const slide = new SlideBuilder(1)
			.addText("Animated", { x: 100, y: 100, width: 200, height: 50 })
			.build();

		const elementId = slide.elements[0].id;
		const slide2 = new SlideBuilder(1)
			.addElement(slide.elements[0])
			.addAnimation(elementId, { preset: "fadeIn", duration: 500 })
			.build();

		expect(slide2.animations?.length).toBe(1);
		expect(slide2.animations?.[0].entrance).toBe("fadeIn");
		expect(slide2.animations?.[0].elementId).toBe(elementId);
	});

	it("supports complex chaining", () => {
		const slide = new SlideBuilder(1, undefined, "Blank")
			.addText("Title", { fontSize: 44, bold: true, x: 50, y: 30, width: 860, height: 70 })
			.addShape("roundRect", {
				x: 50, y: 150, width: 400, height: 300,
				fill: { type: "solid", color: "#4472C4" },
				text: "Box 1",
			})
			.addShape("roundRect", {
				x: 500, y: 150, width: 400, height: 300,
				fill: { type: "solid", color: "#ED7D31" },
				text: "Box 2",
			})
			.addConnector({
				x: 450, y: 300, width: 50, height: 0,
				endArrow: "triangle",
			})
			.setBackground({ type: "solid", color: "#F0F0F0" })
			.setTransition({ type: "fade", duration: 500 })
			.setNotes("Discuss comparison between Box 1 and Box 2")
			.build();

		expect(slide.elements.length).toBe(4); // text + 2 shapes + connector
		expect(slide.backgroundColor).toBe("#F0F0F0");
		expect(slide.transition?.type).toBe("fade");
		expect(slide.notes).toContain("comparison");
	});
});
