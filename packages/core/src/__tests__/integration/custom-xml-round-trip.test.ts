import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { PptxHandler } from "../../core/PptxHandler";
import { PresentationBuilder } from "../../core/builders/sdk/PresentationBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal PPTX buffer with custom XML parts injected. */
async function createPptxWithCustomXml(parts: {
	id: string;
	data: string;
	properties?: string;
	rels?: string;
}[]): Promise<ArrayBuffer> {
	// Build a minimal presentation first
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide("Blank")
			.addText("Test slide", { x: 50, y: 50, width: 400, height: 50 })
			.build(),
	);
	const bytes = await handler.save(data.slides);

	// Inject customXml parts into the ZIP
	const zip = await JSZip.loadAsync(bytes);
	for (const part of parts) {
		zip.file(`customXml/item${part.id}.xml`, part.data);
		if (part.properties) {
			zip.file(`customXml/itemProps${part.id}.xml`, part.properties);
		}
		if (part.rels) {
			zip.file(`customXml/_rels/item${part.id}.xml.rels`, part.rels);
		}
	}

	// Also add content type overrides for the itemProps parts
	const ctXml = await zip.file("[Content_Types].xml")!.async("string");
	let updated = ctXml;
	for (const part of parts) {
		if (!part.properties) continue;
		const override = `<Override PartName="/customXml/itemProps${part.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/>`;
		// Insert before closing </Types>
		updated = updated.replace("</Types>", `${override}</Types>`);
	}
	zip.file("[Content_Types].xml", updated);

	const buf = await zip.generateAsync({ type: "arraybuffer" });
	return buf;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Custom XML Parts Round-Trip (GAP-S5)", () => {
	it("preserves custom XML item data on save round-trip", async () => {
		const customData = `<?xml version="1.0" encoding="UTF-8"?><customData xmlns="urn:test:custom"><field1>value1</field1></customData>`;
		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		// Verify the custom XML part was loaded
		expect(data.customXmlParts).toBeDefined();
		expect(data.customXmlParts!.length).toBe(1);
		expect(data.customXmlParts![0].id).toBe("1");
		expect(data.customXmlParts![0].data).toContain("<field1>value1</field1>");

		// Save and reload
		const savedBytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		// Verify preservation
		expect(data2.customXmlParts).toBeDefined();
		expect(data2.customXmlParts!.length).toBe(1);
		expect(data2.customXmlParts![0].id).toBe("1");
		expect(data2.customXmlParts![0].data).toContain("<field1>value1</field1>");
	});

	it("preserves custom XML properties (itemProps) on round-trip", async () => {
		const customData = `<?xml version="1.0" encoding="UTF-8"?><root/>`;
		const propsData = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><ds:datastoreItem ds:itemID="{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="urn:test:schema"/></ds:schemaRefs></ds:datastoreItem>`;
		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData, properties: propsData },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		expect(data.customXmlParts![0].properties).toBeDefined();
		expect(data.customXmlParts![0].schemaUri).toBe("urn:test:schema");

		// Save and reload
		const savedBytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		expect(data2.customXmlParts![0].properties).toBeDefined();
		expect(data2.customXmlParts![0].properties).toContain("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE");
		expect(data2.customXmlParts![0].schemaUri).toBe("urn:test:schema");
	});

	it("preserves custom XML relationship files on round-trip", async () => {
		const customData = `<?xml version="1.0" encoding="UTF-8"?><root/>`;
		const propsData = `<?xml version="1.0" encoding="UTF-8"?><ds:datastoreItem ds:itemID="{11111111-2222-3333-4444-555555555555}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs/></ds:datastoreItem>`;
		const relsData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/></Relationships>`;

		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData, properties: propsData, rels: relsData },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		expect(data.customXmlParts![0].rels).toBeDefined();
		expect(data.customXmlParts![0].rels).toContain("customXmlProps");

		// Save and reload
		const savedBytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		expect(data2.customXmlParts![0].rels).toBeDefined();
		expect(data2.customXmlParts![0].rels).toContain("customXmlProps");
	});

	it("preserves multiple custom XML parts on round-trip", async () => {
		const buf = await createPptxWithCustomXml([
			{ id: "1", data: `<part1><a>1</a></part1>` },
			{ id: "2", data: `<part2><b>2</b></part2>` },
			{ id: "3", data: `<part3><c>3</c></part3>` },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		expect(data.customXmlParts!.length).toBe(3);

		// Save and reload
		const savedBytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(savedBytes.buffer as ArrayBuffer);

		expect(data2.customXmlParts!.length).toBe(3);
		const ids = data2.customXmlParts!.map((p) => p.id).sort();
		expect(ids).toEqual(["1", "2", "3"]);
		expect(data2.customXmlParts!.find((p) => p.id === "1")!.data).toContain("<a>1</a>");
		expect(data2.customXmlParts!.find((p) => p.id === "2")!.data).toContain("<b>2</b>");
		expect(data2.customXmlParts!.find((p) => p.id === "3")!.data).toContain("<c>3</c>");
	});

	it("preserves customXml content type overrides in [Content_Types].xml", async () => {
		const customData = `<root/>`;
		const propsData = `<?xml version="1.0" encoding="UTF-8"?><ds:datastoreItem ds:itemID="{00000000-0000-0000-0000-000000000000}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs/></ds:datastoreItem>`;

		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData, properties: propsData },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);

		// Save
		const savedBytes = await handler.save(data.slides);

		// Inspect the ZIP directly to verify content types
		const zip = await JSZip.loadAsync(savedBytes);
		const ctXml = await zip.file("[Content_Types].xml")!.async("string");
		expect(ctXml).toContain("customXml/itemProps1.xml");
		expect(ctXml).toContain("customXmlProperties+xml");
	});

	it("preserves custom XML parts through double round-trip", async () => {
		const customData = `<metadata><version>2.0</version></metadata>`;
		const propsData = `<?xml version="1.0" encoding="UTF-8"?><ds:datastoreItem ds:itemID="{DEADBEEF-CAFE-BABE-FACE-AABBCCDDEEFF}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="urn:example:metadata"/></ds:schemaRefs></ds:datastoreItem>`;
		const relsData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/></Relationships>`;

		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData, properties: propsData, rels: relsData },
		]);

		// First round-trip
		const handler1 = new PptxHandler();
		const data1 = await handler1.load(buf);
		const bytes1 = await handler1.save(data1.slides);

		// Second round-trip
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes1.buffer as ArrayBuffer);
		const bytes2 = await handler2.save(data2.slides);

		// Third load to verify
		const handler3 = new PptxHandler();
		const data3 = await handler3.load(bytes2.buffer as ArrayBuffer);

		expect(data3.customXmlParts).toBeDefined();
		expect(data3.customXmlParts!.length).toBe(1);
		expect(data3.customXmlParts![0].data).toContain("<version>2.0</version>");
		expect(data3.customXmlParts![0].schemaUri).toBe("urn:example:metadata");
		expect(data3.customXmlParts![0].properties).toContain("DEADBEEF");
		expect(data3.customXmlParts![0].rels).toContain("customXmlProps");
	});

	it("does not produce custom XML parts when none existed", async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide("Blank")
				.addText("No custom XML", { x: 50, y: 50, width: 400, height: 50 })
				.build(),
		);

		const bytes = await handler.save(data.slides);
		const handler2 = new PptxHandler();
		const data2 = await handler2.load(bytes.buffer as ArrayBuffer);

		// Should be empty or undefined
		expect(
			!data2.customXmlParts || data2.customXmlParts.length === 0,
		).toBe(true);
	});

	it("preserves custom XML files in ZIP output", async () => {
		const customData = `<addin-data><setting key="theme">dark</setting></addin-data>`;
		const buf = await createPptxWithCustomXml([
			{ id: "1", data: customData },
		]);

		const handler = new PptxHandler();
		const data = await handler.load(buf);
		const savedBytes = await handler.save(data.slides);

		// Verify the customXml entries exist in the output ZIP
		const zip = await JSZip.loadAsync(savedBytes);
		const itemFile = zip.file("customXml/item1.xml");
		expect(itemFile).not.toBeNull();

		const itemContent = await itemFile!.async("string");
		expect(itemContent).toContain("dark");
	});
});
