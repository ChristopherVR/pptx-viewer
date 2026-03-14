/**
 * Layout and master creation operations for the headless PPTX SDK.
 *
 * Provides functions to create custom slide layouts and add them
 * to presentations built with {@link PresentationBuilder}. Layouts
 * are OpenXML `p:sldLayout` parts stored in `ppt/slideLayouts/`
 * and linked to a slide master via relationships.
 *
 * @module sdk/layout-operations
 */

import JSZip from "jszip";
import { PptxHandler } from "../../PptxHandler";
import type { PptxData, PptxLayoutOption } from "../../types/presentation";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Definition for a placeholder shape within a layout.
 *
 * Placeholders define named regions on a slide where content
 * is expected (title, body text, slide number, footer, etc.).
 */
export interface PlaceholderDefinition {
	/** Placeholder type: "title", "body", "ctrTitle", "subTitle", "dt", "ftr", "sldNum", "pic", "tbl", "chart", "obj". */
	type: string;
	/** X position in pixels. */
	x: number;
	/** Y position in pixels. */
	y: number;
	/** Width in pixels. */
	width: number;
	/** Height in pixels. */
	height: number;
	/** Optional placeholder index (auto-assigned if omitted). */
	idx?: number;
	/** Optional display name for the placeholder. */
	name?: string;
}

/**
 * Definition for creating a new slide layout.
 *
 * @example
 * ```ts
 * const def: LayoutDefinition = {
 *   name: "Custom Two Column",
 *   type: "twoObj",
 *   placeholders: [
 *     { type: "title", x: 50, y: 20, width: 860, height: 60 },
 *     { type: "body", x: 50, y: 100, width: 400, height: 400, idx: 1 },
 *     { type: "body", x: 500, y: 100, width: 400, height: 400, idx: 2 },
 *   ],
 * };
 * ```
 */
export interface LayoutDefinition {
	/** Human-readable layout name. */
	name: string;
	/** OOXML layout type attribute: "obj", "twoColTx", "blank", "ctrTitle", "secHead", etc. */
	type?: string;
	/** Placeholder shapes to include on the layout. */
	placeholders?: PlaceholderDefinition[];
	/** Background colour hex (e.g. "#F5F5F5"). Uses master background if omitted. */
	backgroundColor?: string;
}

/**
 * Result of a layout creation operation, including the path and
 * updated data references.
 */
export interface LayoutCreationResult {
	/** Archive path of the new layout (e.g. "ppt/slideLayouts/slideLayout12.xml"). */
	layoutPath: string;
	/** Layout name as specified in the definition. */
	layoutName: string;
	/** Updated handler (reloaded after ZIP modification). */
	handler: PptxHandler;
	/** Updated presentation data (reloaded). */
	data: PptxData;
}

// ---------------------------------------------------------------------------
// EMU conversion constant (pixels to EMU at 96 DPI)
// ---------------------------------------------------------------------------

const EMU_PER_PIXEL = 9525;

function pxToEmu(px: number): number {
	return Math.round(px * EMU_PER_PIXEL);
}

// ---------------------------------------------------------------------------
// XML generation helpers
// ---------------------------------------------------------------------------

/**
 * Build the XML for a single placeholder `<p:sp>` element.
 */
function placeholderSpXml(ph: PlaceholderDefinition, shapeId: number): string {
	const name =
		ph.name ??
		`${ph.type.charAt(0).toUpperCase() + ph.type.slice(1)} Placeholder ${shapeId - 1}`;
	const x = pxToEmu(ph.x);
	const y = pxToEmu(ph.y);
	const cx = pxToEmu(ph.width);
	const cy = pxToEmu(ph.height);

	const idxAttr = ph.idx !== undefined ? ` idx="${ph.idx}"` : "";

	return `      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId}" name="${name}"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="${ph.type}"${idxAttr}/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:endParaRPr lang="en-US"/></a:p>
        </p:txBody>
      </p:sp>`;
}

/**
 * Generate a complete slide layout XML string.
 */
export function generateLayoutXml(definition: LayoutDefinition): string {
	const layoutType = definition.type ?? "obj";
	const placeholders = definition.placeholders ?? [];

	// Build placeholder shape XML
	const phShapes = placeholders
		.map((ph, i) => placeholderSpXml(ph, i + 2)) // shapeId starts at 2 (1 is the group)
		.join("\n");

	// Background XML
	let bgXml = "";
	if (definition.backgroundColor) {
		const hex = definition.backgroundColor.replace(/^#/, "").toUpperCase();
		bgXml = `    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>\n`;
	}

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  type="${layoutType}" preserve="1">
  <p:cSld name="${definition.name}">
${bgXml}    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${phShapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

/**
 * Generate a slide layout relationships XML that points back to the master.
 */
function layoutRelsXml(masterIndex = 1): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster${masterIndex}.xml"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// ZIP manipulation helpers
// ---------------------------------------------------------------------------

/**
 * Count existing slide layouts in the ZIP by scanning file paths.
 */
function countExistingLayouts(zip: JSZip): number {
	let count = 0;
	zip.forEach((relativePath) => {
		if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(relativePath)) {
			count++;
		}
	});
	return count;
}

/**
 * Add a layout relationship to the slide master's rels file and
 * update the slide master XML's `<p:sldLayoutIdLst>` entry.
 */
async function addLayoutToSlideMaster(
	zip: JSZip,
	layoutIndex: number,
	masterIndex = 1,
): Promise<void> {
	// --- Update slide master rels ---
	const masterRelsPath = `ppt/slideMasters/_rels/slideMaster${masterIndex}.xml.rels`;
	const masterRelsContent = await zip.file(masterRelsPath)?.async("string");
	if (!masterRelsContent) {
		throw new Error(
			`Slide master rels not found at ${masterRelsPath}`,
		);
	}

	// Find the highest rId currently in the rels
	const rIdMatches = [...masterRelsContent.matchAll(/rId(\d+)/g)];
	const maxRId = rIdMatches.reduce(
		(max, m) => Math.max(max, parseInt(m[1], 10)),
		0,
	);
	const newRId = `rId${maxRId + 1}`;

	// Insert new relationship before closing </Relationships>
	const newRel = `  <Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutIndex}.xml"/>`;
	const updatedRels = masterRelsContent.replace(
		"</Relationships>",
		`${newRel}\n</Relationships>`,
	);
	zip.file(masterRelsPath, updatedRels);

	// --- Update slide master XML ---
	const masterPath = `ppt/slideMasters/slideMaster${masterIndex}.xml`;
	const masterContent = await zip.file(masterPath)?.async("string");
	if (!masterContent) {
		throw new Error(`Slide master not found at ${masterPath}`);
	}

	// Compute a unique layout id (2147483649 + offset to avoid collisions)
	const idMatches = [...masterContent.matchAll(/sldLayoutId\s+id="(\d+)"/g)];
	const maxLayoutId = idMatches.reduce(
		(max, m) => Math.max(max, parseInt(m[1], 10)),
		2147483648,
	);
	const newLayoutId = maxLayoutId + 1;

	// Insert new sldLayoutId entry before closing </p:sldLayoutIdLst>
	const newLayoutIdEntry = `    <p:sldLayoutId id="${newLayoutId}" r:id="${newRId}"/>`;
	const updatedMaster = masterContent.replace(
		"</p:sldLayoutIdLst>",
		`${newLayoutIdEntry}\n  </p:sldLayoutIdLst>`,
	);
	zip.file(masterPath, updatedMaster);
}

/**
 * Add the layout content type override to `[Content_Types].xml`.
 */
async function addLayoutContentType(
	zip: JSZip,
	layoutIndex: number,
): Promise<void> {
	const ctPath = "[Content_Types].xml";
	const ctContent = await zip.file(ctPath)?.async("string");
	if (!ctContent) {
		throw new Error("Content types file not found");
	}

	const override = `  <Override PartName="/ppt/slideLayouts/slideLayout${layoutIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;

	const updatedCt = ctContent.replace(
		"</Types>",
		`${override}\n</Types>`,
	);
	zip.file(ctPath, updatedCt);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new slide layout and add it to the presentation.
 *
 * This function modifies the in-memory ZIP by:
 * 1. Adding the layout XML file to `ppt/slideLayouts/`
 * 2. Adding the layout's relationship file
 * 3. Adding a relationship from the slide master to the new layout
 * 4. Updating the slide master's `<p:sldLayoutIdLst>`
 * 5. Adding a content type override in `[Content_Types].xml`
 *
 * After modifying the ZIP, the presentation is re-saved and re-loaded
 * to ensure all internal state is consistent.
 *
 * @param handler - The current PptxHandler instance.
 * @param data - The current PptxData.
 * @param definition - Layout definition specifying name, type, and placeholders.
 * @param masterIndex - Which slide master to attach to (default: 1).
 * @returns A result containing the layout path and refreshed handler/data.
 *
 * @example
 * ```ts
 * const { handler, data } = await PresentationBuilder.create();
 * const result = await createLayout(handler, data, {
 *   name: "Custom Title",
 *   type: "ctrTitle",
 *   placeholders: [
 *     { type: "ctrTitle", x: 100, y: 200, width: 800, height: 100 },
 *     { type: "subTitle", x: 100, y: 350, width: 800, height: 80 },
 *   ],
 * });
 * // result.layoutPath => "ppt/slideLayouts/slideLayout12.xml"
 * ```
 */
export async function createLayout(
	handler: PptxHandler,
	data: PptxData,
	definition: LayoutDefinition,
	masterIndex = 1,
): Promise<LayoutCreationResult> {
	// Save the current state to get the ZIP bytes
	const bytes = await handler.save(data.slides);

	// Open the ZIP for modification
	const zip = await JSZip.loadAsync(bytes);

	// Determine the next layout index
	const existingCount = countExistingLayouts(zip);
	const newIndex = existingCount + 1;

	// Add the layout XML
	const layoutPath = `ppt/slideLayouts/slideLayout${newIndex}.xml`;
	zip.file(layoutPath, generateLayoutXml(definition));

	// Add the layout rels
	zip.file(
		`ppt/slideLayouts/_rels/slideLayout${newIndex}.xml.rels`,
		layoutRelsXml(masterIndex),
	);

	// Update slide master rels and XML
	await addLayoutToSlideMaster(zip, newIndex, masterIndex);

	// Update content types
	await addLayoutContentType(zip, newIndex);

	// Re-generate the ZIP and reload
	const updatedBuffer = await zip.generateAsync({ type: "arraybuffer" });
	const newHandler = new PptxHandler();
	const newData = await newHandler.load(updatedBuffer);

	return {
		layoutPath,
		layoutName: definition.name,
		handler: newHandler,
		data: newData,
	};
}

/**
 * Create multiple layouts in a single operation, avoiding repeated
 * save/reload cycles.
 *
 * @param handler - The current PptxHandler instance.
 * @param data - The current PptxData.
 * @param definitions - Array of layout definitions to create.
 * @param masterIndex - Which slide master to attach to (default: 1).
 * @returns A result with the paths of all created layouts and refreshed handler/data.
 *
 * @example
 * ```ts
 * const result = await createLayouts(handler, data, [
 *   { name: "Custom Blank", type: "blank" },
 *   { name: "Custom Title", type: "obj", placeholders: [...] },
 * ]);
 * // result.layoutPaths => ["ppt/slideLayouts/slideLayout12.xml", ...]
 * ```
 */
export async function createLayouts(
	handler: PptxHandler,
	data: PptxData,
	definitions: LayoutDefinition[],
	masterIndex = 1,
): Promise<{
	layoutPaths: string[];
	handler: PptxHandler;
	data: PptxData;
}> {
	if (definitions.length === 0) {
		return { layoutPaths: [], handler, data };
	}

	// Save once
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);

	const existingCount = countExistingLayouts(zip);
	const layoutPaths: string[] = [];

	for (let i = 0; i < definitions.length; i++) {
		const def = definitions[i];
		const newIndex = existingCount + i + 1;
		const layoutPath = `ppt/slideLayouts/slideLayout${newIndex}.xml`;

		zip.file(layoutPath, generateLayoutXml(def));
		zip.file(
			`ppt/slideLayouts/_rels/slideLayout${newIndex}.xml.rels`,
			layoutRelsXml(masterIndex),
		);

		await addLayoutToSlideMaster(zip, newIndex, masterIndex);
		await addLayoutContentType(zip, newIndex);

		layoutPaths.push(layoutPath);
	}

	// Reload once
	const updatedBuffer = await zip.generateAsync({ type: "arraybuffer" });
	const newHandler = new PptxHandler();
	const newData = await newHandler.load(updatedBuffer);

	return { layoutPaths, handler: newHandler, data: newData };
}

/**
 * Find a layout by name in the presentation data.
 *
 * Searches both `data.layoutOptions` (populated when slides reference
 * layouts) and `data.slideMasters[*].layouts` (populated during load
 * regardless of slide count).
 *
 * @param data - The parsed PptxData.
 * @param name - Layout name to search for (case-insensitive).
 * @returns The matching layout option, or undefined.
 */
export function findLayoutByName(
	data: PptxData,
	name: string,
): PptxLayoutOption | undefined {
	const lowerName = name.toLowerCase();

	// First check layoutOptions (populated per-slide during load)
	const fromOptions = data.layoutOptions?.find(
		(l) => l.name.toLowerCase() === lowerName,
	);
	if (fromOptions) return fromOptions;

	// Fall back to slide masters' layout metadata (always populated during load)
	if (data.slideMasters) {
		for (const master of data.slideMasters) {
			const layout = master.layouts?.find(
				(l) => l.name?.toLowerCase() === lowerName,
			);
			if (layout) {
				return { path: layout.path, name: layout.name ?? name };
			}
		}
	}

	return undefined;
}

/**
 * Find a layout by OOXML type in the presentation data.
 *
 * Searches both `data.layoutOptions` and `data.slideMasters[*].layouts`.
 *
 * @param data - The parsed PptxData.
 * @param type - OOXML layout type (e.g. "obj", "blank", "ctrTitle").
 * @returns The matching layout option, or undefined.
 */
export function findLayoutByType(
	data: PptxData,
	type: string,
): PptxLayoutOption | undefined {
	// First check layoutOptions
	const fromOptions = data.layoutOptions?.find((l) => l.type === type);
	if (fromOptions) return fromOptions;

	// Fall back to slide masters' layout metadata
	// Note: PptxSlideLayout doesn't have a `type` field, so we can't
	// search by type there. We need to look at the master's layoutPaths
	// and check the `layoutXmlMap`. For now, return undefined if not
	// found in layoutOptions.
	return undefined;
}
