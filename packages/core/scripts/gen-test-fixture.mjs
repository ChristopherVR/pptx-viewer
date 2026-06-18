// @ts-nocheck
/**
 * Generate a SMALL, NON-SENSITIVE .pptx integration-test fixture.
 *
 * This fixture is a synthetic, placeholder-only PowerPoint package whose
 * OpenXML structure mirrors the (sensitive, git-ignored) `V8 Updated.pptx`
 * deck closely enough to exercise four core round-trip regressions:
 *
 *   1. docProps/app.xml `<AppVersion>16.0000</AppVersion>` literal round-trip.
 *   2. Embedded EMF metafile bytes survive load -> save (never overwritten
 *      with PNG-conversion output). The EMF is referenced from slide1 as a
 *      `<p:pic>` blipFill so the loader treats it as an image part.
 *   3. rId-referenced `<a:blipFill>` slide backgrounds on slide2 + slide3
 *      survive save (the schema-valid `<p:bg><p:bgPr>` form).
 *   4. Non-GUID `font{1..N}.fntdata` embedded fonts (no `fontKey` attr) are
 *      reused verbatim on save with no orphan rels / duplicate fntdata parts.
 *
 * All binary parts (fonts, EMF, background PNG) are freshly generated synthetic
 * data — none of the real deck's visuals are copied. Run with:
 *
 *   bun packages/core/scripts/gen-test-fixture.mjs
 *
 * Output: packages/core/src/__tests__/fixtures/embedded-assets-sample.pptx
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../src/__tests__/fixtures/embedded-assets-sample.pptx');

/** Number of embedded fonts to generate (non-GUID font1..fontN.fntdata). */
const FONT_COUNT = 3;

const NS = {
	a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
	r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
	ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
	rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
};
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/* ------------------------------------------------------------------ */
/*  Synthetic binary parts                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a minimal-but-valid Enhanced Metafile (EMF): an ENHMETAHEADER record
 * (type 1) carrying the " EMF" signature (0x464D4520) at offset 0x28, followed
 * by an EMR_EOF record (type 14). This is enough for the core EMF handling to
 * treat it as a metafile (and, critically, it does NOT start with the PNG
 * signature, which is what the round-trip regression guards against).
 */
function makeEmf() {
	const headerSize = 88; // a comfortably-sized ENHMETAHEADER
	const eofSize = 20; // EMR_EOF: type + size + nPalEntries + offPalEntries + sizeLast
	const total = headerSize + eofSize;
	const buf = Buffer.alloc(total);
	let o = 0;
	// ENHMETAHEADER
	buf.writeUInt32LE(1, o);
	o += 4; // iType = EMR_HEADER
	buf.writeUInt32LE(headerSize, o);
	o += 4; // nSize
	// rclBounds (4x int32) + rclFrame (4x int32) = 32 bytes, leave as 0
	o = 0x08; // skip into bounds region
	buf.writeInt32LE(0, 0x08); // rclBounds.left
	buf.writeInt32LE(0, 0x0c);
	buf.writeInt32LE(100, 0x10);
	buf.writeInt32LE(100, 0x14);
	buf.writeInt32LE(0, 0x18); // rclFrame.left
	buf.writeInt32LE(0, 0x1c);
	buf.writeInt32LE(2645, 0x20);
	buf.writeInt32LE(2645, 0x24);
	buf.writeUInt32LE(0x464d4520, 0x28); // dSignature = " EMF"
	buf.writeUInt32LE(0x00010000, 0x2c); // nVersion = 0x10000
	buf.writeUInt32LE(total, 0x30); // nBytes (whole metafile)
	buf.writeUInt32LE(2, 0x34); // nRecords (header + eof)
	buf.writeUInt16LE(0, 0x38); // nHandles
	buf.writeUInt16LE(0, 0x3a); // sReserved
	buf.writeUInt32LE(0, 0x3c); // nDescription
	buf.writeUInt32LE(0, 0x40); // offDescription
	buf.writeUInt32LE(0, 0x44); // nPalEntries
	buf.writeInt32LE(1920, 0x48); // szlDevice.cx
	buf.writeInt32LE(1080, 0x4c); // szlDevice.cy
	buf.writeInt32LE(508, 0x50); // szlMillimeters.cx
	// EMR_EOF at offset headerSize
	const e = headerSize;
	buf.writeUInt32LE(14, e); // iType = EMR_EOF
	buf.writeUInt32LE(eofSize, e + 4); // nSize
	buf.writeUInt32LE(0, e + 8); // nPalEntries
	buf.writeUInt32LE(0x10, e + 12); // offPalEntries
	buf.writeUInt32LE(eofSize, e + 16); // nSizeLast == record size
	return new Uint8Array(buf);
}

/**
 * Build a synthetic `.fntdata` payload that looks like a TrueType font header
 * (sfnt version 0x00010000) padded out to a small size. This is NOT a real
 * usable font — it only needs to round-trip as opaque bytes. Names are
 * non-GUID (`font{n}.fntdata`) and carry no `fontKey`, so the core save
 * pipeline must reuse the original bytes verbatim.
 */
function makeFntData(seed) {
	const size = 256;
	const buf = Buffer.alloc(size);
	buf.writeUInt32BE(0x00010000, 0); // sfnt version 1.0 (TrueType)
	buf.writeUInt16BE(1, 4); // numTables
	for (let i = 12; i < size; i++) {
		buf[i] = (i * 31 + seed * 7) & 0xff;
	}
	return new Uint8Array(buf);
}

/**
 * Build a tiny valid PNG (1x1, solid colour) without any image library, by
 * hand-assembling IHDR + IDAT + IEND chunks. Used for the rId-referenced
 * slide backgrounds.
 */
function makePng(r, g, b) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const chunk = (type, data) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length, 0);
		const typeBuf = Buffer.from(type, 'ascii');
		const body = Buffer.concat([typeBuf, data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body) >>> 0, 0);
		return Buffer.concat([len, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(1, 0); // width
	ihdr.writeUInt32BE(1, 4); // height
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace
	// One scanline: filter byte 0 + RGB triple
	const raw = Buffer.from([0, r & 0xff, g & 0xff, b & 0xff]);
	const idat = deflateRawSync(raw);
	// deflateRawSync omits the zlib header; wrap minimally for a valid IDAT.
	const zlibWrapped = Buffer.concat([
		Buffer.from([0x78, 0x01]),
		idat,
		(() => {
			const adler = Buffer.alloc(4);
			adler.writeUInt32BE(adler32(raw) >>> 0, 0);
			return adler;
		})(),
	]);
	return new Uint8Array(
		Buffer.concat([
			sig,
			chunk('IHDR', ihdr),
			chunk('IDAT', zlibWrapped),
			chunk('IEND', Buffer.alloc(0)),
		]),
	);
}

function adler32(buf) {
	let a = 1;
	let b = 0;
	const MOD = 65521;
	for (let i = 0; i < buf.length; i++) {
		a = (a + buf[i]) % MOD;
		b = (b + a) % MOD;
	}
	return ((b << 16) | a) >>> 0;
}

/* ------------------------------------------------------------------ */
/*  XML fragments                                                     */
/* ------------------------------------------------------------------ */

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function relationship(id, type, target, extra = '') {
	return `<Relationship Id="${id}" Type="${type}" Target="${target}"${extra}/>`;
}

function contentTypes() {
	const slideOverrides = [1, 2, 3]
		.map(
			(n) =>
				`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
		)
		.join('');
	return [
		XML_DECL,
		`<Types xmlns="${NS.ct}">`,
		'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
		'<Default Extension="xml" ContentType="application/xml"/>',
		'<Default Extension="png" ContentType="image/png"/>',
		'<Default Extension="emf" ContentType="image/x-emf"/>',
		'<Default Extension="fntdata" ContentType="application/x-fontdata"/>',
		'<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
		'<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
		'<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
		'<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
		slideOverrides,
		'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
		'<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
		'</Types>',
	].join('');
}

function rootRels() {
	return [
		XML_DECL,
		`<Relationships xmlns="${NS.rels}">`,
		relationship('rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'),
		relationship('rId2', `${REL}/metadata/core-properties`, 'docProps/core.xml'),
		relationship('rId3', `${REL}/extended-properties`, 'docProps/app.xml'),
		'</Relationships>',
	].join('');
}

function appXml() {
	return [
		XML_DECL,
		'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ',
		'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
		'<Application>Microsoft Office PowerPoint</Application>',
		'<PresentationFormat>Widescreen</PresentationFormat>',
		'<Slides>3</Slides>',
		'<Company>Sample</Company>',
		'<AppVersion>16.0000</AppVersion>',
		'</Properties>',
	].join('');
}

function coreXml() {
	return [
		XML_DECL,
		'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ',
		'xmlns:dc="http://purl.org/dc/elements/1.1/" ',
		'xmlns:dcterms="http://purl.org/dc/terms/" ',
		'xmlns:dcmitype="http://purl.org/dc/dcmitype/" ',
		'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
		'<dc:title>Sample Title</dc:title>',
		'<dc:creator>Sample Author</dc:creator>',
		'<cp:lastModifiedBy>Sample Author</cp:lastModifiedBy>',
		'</cp:coreProperties>',
	].join('');
}

/** presentation.xml with sldMasterIdLst, sldIdLst (3 slides), sldSz, and an
 *  embeddedFontLst whose regular variants point at font1..fontN rels. */
function presentationXml() {
	const fontEntries = [];
	let fontRId = 100;
	const fontRels = [];
	for (let i = 1; i <= FONT_COUNT; i++) {
		const rid = `rId${fontRId++}`;
		fontRels.push({ rid, target: `fonts/font${i}.fntdata` });
		fontEntries.push(
			`<p:embeddedFont><p:font typeface="Sample Font ${i}" pitchFamily="2" charset="0"/><p:regular r:id="${rid}"/></p:embeddedFont>`,
		);
	}
	const xml = [
		XML_DECL,
		`<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" embedTrueTypeFonts="1" saveSubsetFonts="1">`,
		'<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>',
		'<p:sldIdLst>',
		'<p:sldId id="256" r:id="rId2"/>',
		'<p:sldId id="257" r:id="rId3"/>',
		'<p:sldId id="258" r:id="rId4"/>',
		'</p:sldIdLst>',
		'<p:sldSz cx="12192000" cy="6858000"/>',
		'<p:notesSz cx="6858000" cy="9144000"/>',
		`<p:embeddedFontLst>${fontEntries.join('')}</p:embeddedFontLst>`,
		'</p:presentation>',
	].join('');
	return { xml, fontRels };
}

function presentationRels(fontRels) {
	const rels = [
		relationship('rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'),
		relationship('rId2', `${REL}/slide`, 'slides/slide1.xml'),
		relationship('rId3', `${REL}/slide`, 'slides/slide2.xml'),
		relationship('rId4', `${REL}/slide`, 'slides/slide3.xml'),
		relationship('rId5', `${REL}/theme`, 'theme/theme1.xml'),
	];
	for (const { rid, target } of fontRels) {
		rels.push(relationship(rid, `${REL}/font`, target));
	}
	return `${XML_DECL}<Relationships xmlns="${NS.rels}">${rels.join('')}</Relationships>`;
}

/** A title/body slide. `bgEmbedRId` (optional) emits an rId blipFill background.
 *  `picEmbedRId` (optional) emits a <p:pic> referencing that image (the EMF). */
function slideXml({ title, body, bgEmbedRId, picEmbedRId }) {
	const bg = bgEmbedRId
		? `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${bgEmbedRId}"><a:lum/></a:blip><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`
		: '';
	const pic = picEmbedRId
		? `<p:pic><p:nvPicPr><p:cNvPr id="5" name="Logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${picEmbedRId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="9834833" y="0"/><a:ext cx="2212975" cy="598488"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
		: '';
	return [
		XML_DECL,
		`<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">`,
		`<p:cSld>${bg}<p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		// Title shape
		'<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>',
		'<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="10515600" cy="1325563"/></a:xfrm></p:spPr>',
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>`,
		// Body shape
		'<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>',
		'<p:spPr><a:xfrm><a:off x="838200" y="1825625"/><a:ext cx="10515600" cy="4351338"/></a:xfrm></p:spPr>',
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>`,
		pic,
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

function slideRels({ bgTarget, picTarget }) {
	const rels = [relationship('rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml')];
	let n = 2;
	const ids = {};
	if (picTarget) {
		ids.pic = `rId${n++}`;
		rels.push(relationship(ids.pic, `${REL}/image`, picTarget));
	}
	if (bgTarget) {
		ids.bg = `rId${n++}`;
		rels.push(relationship(ids.bg, `${REL}/image`, bgTarget));
	}
	return {
		xml: `${XML_DECL}<Relationships xmlns="${NS.rels}">${rels.join('')}</Relationships>`,
		ids,
	};
}

/** Minimal slide master with a clrMap, an empty spTree, and the required
 *  sldLayoutIdLst + a minimal txStyles. */
function slideMasterXml() {
	return [
		XML_DECL,
		`<p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">`,
		'<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>',
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		'</p:spTree></p:cSld>',
		'<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>',
		'<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>',
		'<p:txStyles>',
		'<p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>',
		'<p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle>',
		'<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>',
		'</p:txStyles>',
		'</p:sldMaster>',
	].join('');
}

function slideMasterRels() {
	return [
		XML_DECL,
		`<Relationships xmlns="${NS.rels}">`,
		relationship('rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'),
		relationship('rId2', `${REL}/theme`, '../theme/theme1.xml'),
		'</Relationships>',
	].join('');
}

function slideLayoutXml() {
	return [
		XML_DECL,
		`<p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="title" preserve="1">`,
		'<p:cSld name="Title Slide"><p:spTree>',
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		'</p:spTree></p:cSld>',
		'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
		'</p:sldLayout>',
	].join('');
}

function slideLayoutRels() {
	return [
		XML_DECL,
		`<Relationships xmlns="${NS.rels}">`,
		relationship('rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml'),
		'</Relationships>',
	].join('');
}

function themeXml() {
	const dk = (name, val) => `<a:${name}><a:srgbClr val="${val}"/></a:${name}>`;
	return [
		XML_DECL,
		`<a:theme xmlns:a="${NS.a}" name="Sample Theme">`,
		'<a:themeElements>',
		'<a:clrScheme name="Sample">',
		'<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>',
		'<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>',
		dk('dk2', '44546A'),
		dk('lt2', 'E7E6E6'),
		dk('accent1', '4472C4'),
		dk('accent2', 'ED7D31'),
		dk('accent3', 'A5A5A5'),
		dk('accent4', 'FFC000'),
		dk('accent5', '5B9BD5'),
		dk('accent6', '70AD47'),
		dk('hlink', '0563C1'),
		dk('folHlink', '954F72'),
		'</a:clrScheme>',
		'<a:fontScheme name="Sample">',
		'<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>',
		'<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>',
		'</a:fontScheme>',
		'<a:fmtScheme name="Sample">',
		'<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>',
		'<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>',
		'<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>',
		'<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>',
		'</a:fmtScheme>',
		'</a:themeElements>',
		'</a:theme>',
	].join('');
}

/* ------------------------------------------------------------------ */
/*  Assemble the package                                              */
/* ------------------------------------------------------------------ */

async function main() {
	const zip = new JSZip();

	zip.file('[Content_Types].xml', contentTypes());
	zip.file('_rels/.rels', rootRels());
	zip.file('docProps/app.xml', appXml());
	zip.file('docProps/core.xml', coreXml());

	const { xml: presXml, fontRels } = presentationXml();
	zip.file('ppt/presentation.xml', presXml);
	zip.file('ppt/_rels/presentation.xml.rels', presentationRels(fontRels));

	// Theme / master / layout
	zip.file('ppt/theme/theme1.xml', themeXml());
	zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml());
	zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels());
	zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml());
	zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels());

	// Binary media parts
	zip.file('ppt/media/image1.emf', makeEmf());
	zip.file('ppt/media/image2.png', makePng(0x20, 0x40, 0x80));
	zip.file('ppt/media/image3.png', makePng(0x80, 0x20, 0x40));

	// Slide 1: references the EMF as a <p:pic> (image-retention regression).
	{
		const { xml: relsXml, ids } = slideRels({ picTarget: '../media/image1.emf' });
		zip.file(
			'ppt/slides/slide1.xml',
			slideXml({
				title: 'Sample Title',
				body: 'Lorem ipsum dolor sit amet.',
				picEmbedRId: ids.pic,
			}),
		);
		zip.file('ppt/slides/_rels/slide1.xml.rels', relsXml);
	}
	// Slide 2 + 3: rId-referenced blipFill backgrounds (background regression).
	for (const [n, bgImg] of [
		[2, '../media/image2.png'],
		[3, '../media/image3.png'],
	]) {
		const { xml: relsXml, ids } = slideRels({ bgTarget: bgImg });
		zip.file(
			`ppt/slides/slide${n}.xml`,
			slideXml({
				title: `Sample Slide ${n}`,
				body: 'Consectetur adipiscing elit.',
				bgEmbedRId: ids.bg,
			}),
		);
		zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, relsXml);
	}

	// Embedded fonts (non-GUID, no fontKey).
	for (let i = 1; i <= FONT_COUNT; i++) {
		zip.file(`ppt/fonts/font${i}.fntdata`, makeFntData(i));
	}

	const out = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 9 },
	});
	await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
	await fs.writeFile(OUT_PATH, out);
	console.log(`Wrote ${OUT_PATH} (${out.length} bytes, ${FONT_COUNT} embedded fonts)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
