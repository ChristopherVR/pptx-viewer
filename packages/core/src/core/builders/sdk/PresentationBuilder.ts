/**
 * Factory for creating PPTX presentations from scratch.
 *
 * Generates a minimal valid OpenXML package (ZIP) containing all
 * required parts (presentation.xml, theme, slide master, layouts,
 * content types, relationships, and document properties). The
 * generated package is then loaded by {@link PptxHandler} so that
 * all existing editing and save operations work transparently.
 *
 * @module sdk/PresentationBuilder
 */

import JSZip from "jszip";
import { PptxHandler } from "../../PptxHandler";
import type { PptxData } from "../../types/presentation";
import type { PresentationOptions } from "./types";
import { SlideBuilder } from "./SlideBuilder";

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 12_192_000; // 16:9 widescreen (10 in)
const DEFAULT_HEIGHT = 6_858_000; // 16:9 widescreen (7.5 in)

const DEFAULT_COLORS = {
	dk1: "#000000",
	lt1: "#FFFFFF",
	dk2: "#44546A",
	lt2: "#E7E6E6",
	accent1: "#4472C4",
	accent2: "#ED7D31",
	accent3: "#A5A5A5",
	accent4: "#FFC000",
	accent5: "#5B9BD5",
	accent6: "#70AD47",
	hlink: "#0563C1",
	folHlink: "#954F72",
};

const DEFAULT_MAJOR_FONT = "Calibri Light";
const DEFAULT_MINOR_FONT = "Calibri";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** Result returned by {@link PresentationBuilder.create}. */
export interface PresentationBuilderResult {
	/** Initialized handler ready for editing and saving. */
	handler: PptxHandler;
	/** Parsed presentation data. */
	data: PptxData;
	/** Convenience slide builder factory. */
	createSlide: (layoutName?: string) => SlideBuilder;
}

// ---------------------------------------------------------------------------
// XML template helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): string {
	return hex.replace(/^#/, "").toUpperCase();
}

function isoNow(): string {
	return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

// Standard layout definitions
const STANDARD_LAYOUTS = [
	{ name: "Title Slide", type: "ctrTitle" },
	{ name: "Title and Content", type: "obj" },
	{ name: "Section Header", type: "secHead" },
	{ name: "Two Content", type: "twoObj" },
	{ name: "Comparison", type: "twoTxTwoObj" },
	{ name: "Title Only", type: "titleOnly" },
	{ name: "Blank", type: "blank" },
	{ name: "Content with Caption", type: "objTx" },
	{ name: "Picture with Caption", type: "picTx" },
	{ name: "Title and Vertical Text", type: "vertTx" },
	{ name: "Vertical Title and Text", type: "vertTitleAndTx" },
];

// ---------------------------------------------------------------------------
// XML generation
// ---------------------------------------------------------------------------

function contentTypesXml(layoutCount: number, slideCount: number): string {
	const layoutOverrides = Array.from(
		{ length: layoutCount },
		(_, i) =>
			`  <Override PartName="/ppt/slideLayouts/slideLayout${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
	).join("\n");

	const slideOverrides = Array.from(
		{ length: slideCount },
		(_, i) =>
			`  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
	).join("\n");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
${layoutOverrides}
${slideOverrides}
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.ms-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelsXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function presentationXml(
	width: number,
	height: number,
	slideCount: number,
): string {
	// Slide rIds start after the fixed relationships:
	// rId1 = slideMaster, rId2 = theme, rId3 = presProps, rId4 = viewProps, rId5 = tableStyles
	const slideIdBase = 256; // slide IDs (distinct from rIds)
	const slideRIdBase = 6; // rIds for slides start at rId6

	const sldIdLst =
		slideCount > 0
			? `  <p:sldIdLst>\n${Array.from(
					{ length: slideCount },
					(_, i) =>
						`    <p:sldId id="${slideIdBase + i}" r:id="rId${slideRIdBase + i}"/>`,
				).join("\n")}\n  </p:sldIdLst>`
			: "";

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
${sldIdLst}
  <p:sldSz cx="${width}" cy="${height}"/>
  <p:notesSz cx="${height}" cy="${width}"/>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="en-US"/></a:defPPr>
    <a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">
      <a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr>
    </a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`;
}

function presentationRelsXml(
	_layoutCount: number,
	slideCount: number,
): string {
	// rId1 = slideMaster, rId2 = theme, rId3 = presProps, rId4 = viewProps, rId5 = tableStyles
	// rId6+ = slides
	const slideRIdBase = 6;
	const slideRels = Array.from(
		{ length: slideCount },
		(_, i) =>
			`  <Relationship Id="rId${slideRIdBase + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
	).join("\n");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
${slideRels}
</Relationships>`;
}

function slideMasterXml(layoutCount: number): string {
	const layoutRefs = Array.from(
		{ length: layoutCount },
		(_, i) => `    <p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`,
	).join("\n");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
${layoutRefs}
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle>
      <a:lvl1pPr algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">
        <a:spcBef><a:spcPct val="0"/></a:spcBef>
        <a:defRPr sz="4400" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr>
      </a:lvl1pPr>
    </p:titleStyle>
    <p:bodyStyle>
      <a:lvl1pPr marL="228600" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">
        <a:spcBef><a:spcPct val="20000"/></a:spcBef>
        <a:buFont typeface="Arial" panose="020B0604020202020204" pitchFamily="34" charset="0"/>
        <a:buChar char="&#x2022;"/>
        <a:defRPr sz="3200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr>
      </a:lvl1pPr>
    </p:bodyStyle>
    <p:otherStyle>
      <a:defPPr><a:defRPr lang="en-US"/></a:defPPr>
    </p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;
}

function slideMasterRelsXml(layoutCount: number): string {
	const layoutRels = Array.from(
		{ length: layoutCount },
		(_, i) =>
			`  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${i + 1}.xml"/>`,
	).join("\n");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${layoutRels}
  <Relationship Id="rId${layoutCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function slideLayoutXml(name: string, layoutType: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  type="${layoutType}" preserve="1">
  <p:cSld name="${name}">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function slideLayoutRelsXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function slideXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRelsXml(layoutIndex: number): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutIndex}.xml"/>
</Relationships>`;
}

function themeXml(
	themeName: string,
	colors: Record<string, string>,
	majorFont: string,
	minorFont: string,
): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${themeName}">
  <a:themeElements>
    <a:clrScheme name="${themeName}">
      <a:dk1><a:srgbClr val="${hexToRgb(colors.dk1)}"/></a:dk1>
      <a:lt1><a:srgbClr val="${hexToRgb(colors.lt1)}"/></a:lt1>
      <a:dk2><a:srgbClr val="${hexToRgb(colors.dk2)}"/></a:dk2>
      <a:lt2><a:srgbClr val="${hexToRgb(colors.lt2)}"/></a:lt2>
      <a:accent1><a:srgbClr val="${hexToRgb(colors.accent1)}"/></a:accent1>
      <a:accent2><a:srgbClr val="${hexToRgb(colors.accent2)}"/></a:accent2>
      <a:accent3><a:srgbClr val="${hexToRgb(colors.accent3)}"/></a:accent3>
      <a:accent4><a:srgbClr val="${hexToRgb(colors.accent4)}"/></a:accent4>
      <a:accent5><a:srgbClr val="${hexToRgb(colors.accent5)}"/></a:accent5>
      <a:accent6><a:srgbClr val="${hexToRgb(colors.accent6)}"/></a:accent6>
      <a:hlink><a:srgbClr val="${hexToRgb(colors.hlink)}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${hexToRgb(colors.folHlink)}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="${themeName}">
      <a:majorFont><a:latin typeface="${majorFont}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="${minorFont}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="${themeName}">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill>
        <a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`;
}

function presPropsXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
}

function viewPropsXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr horzBarState="maximized"><p:restoredLeft sz="15611"/><p:restoredTop sz="94610"/></p:normalViewPr>
  <p:slideViewPr><p:cSldViewPr snapToGrid="0"><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:cSldViewPr></p:slideViewPr>
</p:viewPr>`;
}

function tableStylesXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
}

function corePropsXml(title?: string, creator?: string): string {
	const now = isoNow();
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${title ?? ""}</dc:title>
  <dc:creator>${creator ?? "pptx-viewer-sdk"}</dc:creator>
  <cp:lastModifiedBy>${creator ?? "pptx-viewer-sdk"}</cp:lastModifiedBy>
  <cp:revision>1</cp:revision>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appPropsXml(slideCount: number): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>pptx-viewer-sdk</Application>
  <Slides>${slideCount}</Slides>
  <ScaleCrop>false</ScaleCrop>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0000</AppVersion>
</Properties>`;
}

// ---------------------------------------------------------------------------
// PresentationBuilder
// ---------------------------------------------------------------------------

/**
 * Create PPTX presentations from scratch.
 *
 * @example
 * ```ts
 * const { handler, data, createSlide } = await PresentationBuilder.create({
 *   title: "My Deck",
 *   theme: {
 *     name: "Corporate",
 *     colors: { accent1: "#FF6B6B", accent2: "#556270" },
 *     fonts: { majorFont: "Inter", minorFont: "Inter" },
 *   },
 * });
 *
 * // Add a slide using the builder
 * const slide = createSlide("Blank")
 *   .addText("Hello World", { fontSize: 36, x: 100, y: 100, width: 800, height: 60 })
 *   .build();
 * data.slides.push(slide);
 *
 * // Save
 * const bytes = await handler.save(data.slides);
 * ```
 */
export class PresentationBuilder {
	private constructor() {
		// Use static factory
	}

	/**
	 * Create a new blank PPTX presentation.
	 *
	 * Generates a valid OpenXML package with a theme, slide master,
	 * 11 standard layouts, and all required relationships. The returned
	 * handler is ready for editing, adding slides, and saving.
	 *
	 * @param options - Optional slide dimensions, theme, and metadata.
	 * @returns Handler, parsed data, and a slide builder factory.
	 */
	static async create(
		options?: PresentationOptions,
	): Promise<PresentationBuilderResult> {
		const width = options?.width ?? DEFAULT_WIDTH;
		const height = options?.height ?? DEFAULT_HEIGHT;
		const themeName = options?.theme?.name ?? "Office Theme";
		const colors = { ...DEFAULT_COLORS, ...options?.theme?.colors };
		const majorFont = options?.theme?.fonts?.majorFont ?? DEFAULT_MAJOR_FONT;
		const minorFont = options?.theme?.fonts?.minorFont ?? DEFAULT_MINOR_FONT;
		const layoutCount = STANDARD_LAYOUTS.length;
		const initialSlideCount = Math.max(0, options?.initialSlideCount ?? 0);

		// The "Blank" layout is index 7 (1-based) in STANDARD_LAYOUTS
		const blankLayoutIdx =
			STANDARD_LAYOUTS.findIndex((l) => l.type === "blank") + 1 || 7;

		// Build the ZIP
		const zip = new JSZip();

		zip.file(
			"[Content_Types].xml",
			contentTypesXml(layoutCount, initialSlideCount),
		);
		zip.file("_rels/.rels", rootRelsXml());
		zip.file(
			"ppt/presentation.xml",
			presentationXml(width, height, initialSlideCount),
		);
		zip.file(
			"ppt/_rels/presentation.xml.rels",
			presentationRelsXml(layoutCount, initialSlideCount),
		);
		zip.file("ppt/slideMasters/slideMaster1.xml", slideMasterXml(layoutCount));
		zip.file(
			"ppt/slideMasters/_rels/slideMaster1.xml.rels",
			slideMasterRelsXml(layoutCount),
		);

		for (let i = 0; i < layoutCount; i++) {
			const layout = STANDARD_LAYOUTS[i];
			zip.file(
				`ppt/slideLayouts/slideLayout${i + 1}.xml`,
				slideLayoutXml(layout.name, layout.type),
			);
			zip.file(
				`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`,
				slideLayoutRelsXml(),
			);
		}

		// Add initial slides (all use the "Blank" layout)
		for (let i = 0; i < initialSlideCount; i++) {
			zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml());
			zip.file(
				`ppt/slides/_rels/slide${i + 1}.xml.rels`,
				slideRelsXml(blankLayoutIdx),
			);
		}

		zip.file(
			"ppt/theme/theme1.xml",
			themeXml(themeName, colors, majorFont, minorFont),
		);
		zip.file("ppt/presProps.xml", presPropsXml());
		zip.file("ppt/viewProps.xml", viewPropsXml());
		zip.file("ppt/tableStyles.xml", tableStylesXml());
		zip.file(
			"docProps/core.xml",
			corePropsXml(options?.title, options?.creator),
		);
		zip.file("docProps/app.xml", appPropsXml(initialSlideCount));

		// Generate the buffer and load it
		const buffer = await zip.generateAsync({ type: "arraybuffer" });
		const handler = new PptxHandler();
		const data = await handler.load(buffer);

		// Slide builder factory
		const createSlide = (layoutName?: string): SlideBuilder => {
			const slideNum = data.slides.length + 1;
			const layoutIdx =
				STANDARD_LAYOUTS.findIndex((l) => l.name === layoutName) + 1 || 7; // default: Blank
			const layoutPath = `ppt/slideLayouts/slideLayout${layoutIdx}.xml`;
			const resolvedName =
				layoutName ?? STANDARD_LAYOUTS[layoutIdx - 1]?.name ?? "Blank";
			return new SlideBuilder(slideNum, layoutPath, resolvedName);
		};

		return { handler, data, createSlide };
	}
}
