/**
 * Generates two single-slide fixture decks used by `ole-and-ink.spec.ts`:
 *
 *   - `ole-embed.pptx`: one slide with a real OLE (Object Linking and
 *     Embedding) `p:graphicFrame`, embedding a real, byte-valid one-page PDF
 *     as a plain (non-OLE2-wrapped) embedding - the "plain modern file" shape
 *     `unwrapOleEmbedding`'s own module doc describes as one of the two real-
 *     world forms PowerPoint stores ("a plain modern file...saved straight
 *     into `ppt/embeddings/`") - plus a genuine preview PNG wired up exactly
 *     like a normal picture's `blipFill`.
 *   - `ink-annotation.pptx`: one slide with a real ink `p:graphicFrame`
 *     (`aink:ink`, Office 2010+ ink Extension) carrying several multi-point
 *     `aink:trace` strokes.
 *
 * Neither fixture existed anywhere in the repo (checked `e2e/fixtures/`,
 * `.github/assets/`, and `packages/core/src/__tests__/fixtures/` - none of
 * the existing sample decks contain `p:oleObj` or `aink:` markup), and no
 * fixture-authoring tool (Word/Excel/Acrobat, or PowerPoint itself via COM
 * automation) was available in the sandbox to author one via a real Office
 * app, so this generator follows the exact precedent already established by
 * `generate-chart-fixture.ts` for the same problem (the SDK has no from-
 * scratch authoring path for this element kind): build a valid base deck via
 * `PptxHandler.createBlank`, then post-process the saved zip to inject a
 * real graphic frame + relationships + parts + content-type overrides,
 * reusing the exact OOXML shapes the project's own maintainers already
 * verified round-trip correctly in `ole-save-roundtrip.test.ts` and
 * `ink-save-roundtrip.test.ts`.
 *
 * Every binary payload here is a real, spec-valid file built by small local
 * encoders (a hand-rolled but byte-accurate PDF writer with a real xref
 * table, and a real PNG via zlib deflate + CRC32) - not arbitrary/garbage
 * bytes - so the fixture exercises the real production decode paths
 * (`unwrapOleEmbedding`, `decodeAinkInk`) faithfully.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

// JSZip is a dependency of `pptx-viewer-core` (bundled but not re-exported).
// Resolve it from the core package's own resolution scope (same trick as
// `generate-chart-fixture.ts`), rather than adding a direct e2e dependency.
const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

// ---------------------------------------------------------------------------
// Minimal real-file encoders (PDF / PNG) - small, byte-accurate, spec-valid.
// ---------------------------------------------------------------------------

/** Build a real, byte-valid one-page PDF with an accurate xref table. */
function buildMinimalPdf(title: string): Uint8Array {
	const enc = new TextEncoder();
	const safeTitle = title.replace(/[()\\]/gu, '');
	const objects = [
		'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
		'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
		'3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] ' +
			'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
		'4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
	];
	const streamContent = `BT /F1 12 Tf 20 50 Td (${safeTitle}) Tj ET`;
	const streamLen = enc.encode(streamContent).length;
	objects.push(
		`5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
	);

	let body = '%PDF-1.4\n';
	const offsets: number[] = [0]; // object 0 is the free-list head
	for (const obj of objects) {
		offsets.push(enc.encode(body).length);
		body += obj;
	}
	const xrefStart = enc.encode(body).length;
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let i = 1; i <= objects.length; i++) {
		xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
	}
	const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
	return enc.encode(body + xref + trailer);
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new TextEncoder().encode(type);
	const out = new Uint8Array(4 + 4 + data.length + 4);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length, false);
	out.set(typeBytes, 4);
	out.set(data, 8);
	const crcInput = new Uint8Array(4 + data.length);
	crcInput.set(typeBytes, 0);
	crcInput.set(data, 4);
	view.setUint32(8 + data.length, crc32(crcInput), false);
	return out;
}

/** Build a real, valid solid-colour RGB PNG (8-bit, no interlace). */
function buildMinimalPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
	const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = new Uint8Array(13);
	const ihdrView = new DataView(ihdr.buffer);
	ihdrView.setUint32(0, width, false);
	ihdrView.setUint32(4, height, false);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: truecolor (RGB)
	ihdr[10] = 0; // compression method
	ihdr[11] = 0; // filter method
	ihdr[12] = 0; // interlace method

	const stride = width * 3;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		const rowStart = y * (stride + 1);
		raw[rowStart] = 0; // per-scanline filter type: none
		for (let x = 0; x < width; x++) {
			const off = rowStart + 1 + x * 3;
			raw[off] = rgb[0];
			raw[off + 1] = rgb[1];
			raw[off + 2] = rgb[2];
		}
	}
	const idat = deflateSync(raw);

	const parts = [
		signature,
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', idat),
		pngChunk('IEND', new Uint8Array(0)),
	];
	const total = parts.reduce((sum, p) => sum + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Zip / OOXML helpers (mirrors generate-chart-fixture.ts's approach).
// ---------------------------------------------------------------------------

/** Insert XML immediately before `</p:spTree>`. */
function injectIntoSpTree(slideXml: string, xml: string): string {
	const marker = '</p:spTree>';
	const at = slideXml.lastIndexOf(marker);
	if (at < 0) {
		throw new Error('slide XML missing </p:spTree>');
	}
	return slideXml.slice(0, at) + xml + slideXml.slice(at);
}

/** Add extra `xmlns:*` declarations to the `<p:sld ...>` root open tag. */
function addNamespaceDecls(slideXml: string, decls: Record<string, string>): string {
	const openTagEnd = slideXml.indexOf('>');
	if (openTagEnd < 0) {
		throw new Error('slide XML missing root open tag');
	}
	const extra = Object.entries(decls)
		.map(([prefix, uri]) => ` xmlns:${prefix}="${uri}"`)
		.join('');
	return slideXml.slice(0, openTagEnd) + extra + slideXml.slice(openTagEnd);
}

/** Add a relationship to a slide `.rels` document, returning the new rId. */
function addRelationship(
	relsXml: string,
	type: string,
	target: string,
): { xml: string; rId: string } {
	const ids = [...relsXml.matchAll(/Id="rId(?<n>\d+)"/gu)].map((m) =>
		Number.parseInt(m.groups?.n ?? '0', 10),
	);
	const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
	const rId = `rId${next}`;
	const rel = `<Relationship Id="${rId}" Type="${type}" Target="${target}"/>`;
	return { xml: relsXml.replace('</Relationships>', `${rel}</Relationships>`), rId };
}

/** Ensure `[Content_Types].xml` has a `Default` entry for `extension`. */
function ensureDefaultExtension(ctXml: string, extension: string, contentType: string): string {
	if (ctXml.includes(`Extension="${extension}"`)) {
		return ctXml;
	}
	const entry = `<Default Extension="${extension}" ContentType="${contentType}"/>`;
	return ctXml.replace('</Types>', `${entry}</Types>`);
}

const OLE_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';
const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

// ---------------------------------------------------------------------------
// OLE fixture
// ---------------------------------------------------------------------------

/**
 * Build `ole-embed.pptx`: a single slide with one embedded (non-linked) OLE
 * object, progId `AcroExch.Document.11` (Adobe Acrobat's real-world progId
 * for an embedded PDF, matched by `detectOleObjectType`'s `/^AcroExch\./`
 * pattern -> `oleObjectType: 'pdf'`, `oleFileExtension: 'pdf'`), so:
 *   - `mimeTypeForOleFile` resolves the synthesised `${oleName}.pdf` file
 *     name to `application/pdf`, which `isBrowserOpenableMime` allows, so
 *     the viewer's "Open" action renders (in addition to "Download").
 *   - The embedding binary is the real PDF bytes stored directly (not OLE2-
 *     wrapped): `unwrapOleEmbedding` passes plain, non-compound-file bytes
 *     through unchanged, which is exactly this shape.
 *   - A real preview PNG is wired up via `p:oleObj/p:pic/p:blipFill/a:blip`,
 *     exactly like a normal picture element's blip fill.
 */
export async function generateOleFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'OLE Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);

	// 1. Build the embedding: a real, valid one-page PDF, stored as a plain
	//    (non-OLE2-wrapped) file - the "plain modern file" shape
	//    `unwrapOleEmbedding` passes straight through.
	const pdfBytes = buildMinimalPdf('OLE e2e fixture');

	// 2. Build the preview image: a real, valid small PNG (steel-blue fill).
	const previewPng = buildMinimalPng(160, 100, [70, 130, 180]);

	zip.file('ppt/embeddings/oleObject1.pdf', pdfBytes);
	zip.file('ppt/media/image1.png', previewPng);

	const slidePath = 'ppt/slides/slide1.xml';
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';

	let relsXml = await zip.file(relsPath)!.async('string');
	const oleRel = addRelationship(relsXml, OLE_REL_TYPE, '../embeddings/oleObject1.pdf');
	relsXml = oleRel.xml;
	const picRel = addRelationship(relsXml, IMAGE_REL_TYPE, '../media/image1.png');
	relsXml = picRel.xml;
	zip.file(relsPath, relsXml);

	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 320 * 9525;
	const cy = 200 * 9525;
	const graphicFrame =
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="10" name="Report"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">` +
		`<p:oleObj progId="AcroExch.Document.11" name="Report" showAsIcon="0" r:id="${oleRel.rId}" imgW="${cx}" imgH="${cy}">` +
		`<p:embed/>` +
		`<p:pic><p:nvPicPr><p:cNvPr id="0" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
		`<p:blipFill><a:blip r:embed="${picRel.rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
		`</p:oleObj></a:graphicData></a:graphic></p:graphicFrame>`;

	let slideXml = await zip.file(slidePath)!.async('string');
	slideXml = injectIntoSpTree(slideXml, graphicFrame);
	zip.file(slidePath, slideXml);

	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	contentTypes = ensureDefaultExtension(contentTypes, 'pdf', 'application/pdf');
	contentTypes = ensureDefaultExtension(contentTypes, 'png', 'image/png');
	zip.file('[Content_Types].xml', contentTypes);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'ole-embed.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, bytes);
	return outPath;
}

// ---------------------------------------------------------------------------
// Ink fixture
// ---------------------------------------------------------------------------

/** Sample a smooth wavy stroke as an `aink:trace` "x,y x,y ..." point list. */
function wavyTrace(
	startX: number,
	width: number,
	midY: number,
	amplitude: number,
	points: number,
): string {
	const coords: string[] = [];
	for (let i = 0; i <= points; i++) {
		const t = i / points;
		const x = Math.round(startX + t * width);
		const y = Math.round(midY + amplitude * Math.sin(t * Math.PI * 2.5));
		coords.push(`${x},${y}`);
	}
	return coords.join(' ');
}

/** Sample a short checkmark-shaped stroke as an `aink:trace` point list. */
function checkmarkTrace(originX: number, originY: number, scale: number): string {
	const raw: Array<[number, number]> = [
		[0, 8],
		[1, 9],
		[2, 10],
		[3.5, 13],
		[5, 9],
		[7, 5],
		[9, 1],
		[10, 0],
	];
	return raw
		.map(([dx, dy]) => `${Math.round(originX + dx * scale)},${Math.round(originY - dy * scale)}`)
		.join(' ');
}

/**
 * Build `ink-annotation.pptx`: a single slide with one real ink
 * `p:graphicFrame` (`aink:ink`, Office 2010+ ink extension), carrying two
 * multi-point strokes (a 26-sample wavy underline-style squiggle and an
 * 8-point checkmark), each a genuine polyline (not a 2-3 point stub) so the
 * rendered SVG `<path>` carries meaningful `d` geometry. Uses the same
 * `mc:AlternateContent > mc:Choice[Requires="aink"] > aink:ink` envelope (plus
 * an `mc:Fallback`) that `ink-save-roundtrip.test.ts` already verified
 * round-trips through `decodeAinkInk` without being downgraded to a plain
 * `custGeom` shape.
 */
export async function generateInkFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Ink Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);

	const x = 60 * 9525;
	const y = 60 * 9525;
	const cx = 320 * 9525;
	const cy = 200 * 9525;

	const trace1 = wavyTrace(10, 280, 60, 35, 24);
	const trace2 = checkmarkTrace(40, 160, 8);

	const graphicFrame =
		`<p:graphicFrame><p:nvGraphicFramePr>` +
		`<p:cNvPr id="10" name="Ink 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/drawing/2010/ink">` +
		`<mc:AlternateContent>` +
		`<mc:Choice xmlns:aink="http://schemas.microsoft.com/office/drawing/2010/ink" Requires="aink">` +
		`<aink:ink><aink:inkBrush brushColor="E91E63" brushSize="3"/>` +
		`<aink:trace>${trace1}</aink:trace>` +
		`<aink:trace>${trace2}</aink:trace>` +
		`</aink:ink>` +
		`</mc:Choice>` +
		`<mc:Fallback>` +
		`<p:sp><p:nvSpPr><p:cNvPr id="11" name="Ink fallback"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>` +
		`</mc:Fallback>` +
		`</mc:AlternateContent>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`;

	const slidePath = 'ppt/slides/slide1.xml';
	let slideXml = await zip.file(slidePath)!.async('string');
	slideXml = addNamespaceDecls(slideXml, {
		mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
		aink: 'http://schemas.microsoft.com/office/drawing/2010/ink',
	});
	slideXml = injectIntoSpTree(slideXml, graphicFrame);
	zip.file(slidePath, slideXml);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'ink-annotation.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the chart fixture generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-ole-ink-fixtures.ts');
if (invokedDirectly) {
	Promise.all([generateOleFixture(), generateInkFixture()])
		.then((paths) => paths.forEach((p) => console.log(`Wrote ${p}`)))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
