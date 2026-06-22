import JSZip from 'jszip';
import { describe, it, expect, beforeEach } from 'vitest';

import { resetIdCounter } from '../../core/builders/sdk/ElementFactory';
import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Strict OOXML conformance, validated against the structure of a REAL
 * "Strict Open XML" package as produced by Office (and accepted by the Open XML
 * SDK / PowerPoint), not just the core markup-language namespace families.
 *
 * The load-bearing distinction these tests lock in:
 *
 *  - Markup-language families (ISO/IEC 29500-1) DO switch to the Strict
 *    `purl.oclc.org/ooxml/...` form: presentationml, drawingml, officeDocument
 *    (including its relationship-type URIs), schemaLibrary, descriptions, etc.
 *
 *  - The Open Packaging Conventions (ISO/IEC 29500-2) and Markup Compatibility
 *    & Extensibility (ISO/IEC 29500-3) are conformance-INDEPENDENT shared specs.
 *    Real Strict packages keep their canonical `schemas.openxmlformats.org`
 *    namespaces and OPC-defined relationship types (e.g. core-properties) even
 *    while the markup inside the parts is Strict. Emitting `purl.oclc.org`
 *    package / markup-compatibility URIs produces a file PowerPoint's OPC loader
 *    rejects with the "needs repair" dialog.
 *
 *  - Part content types are identical across conformance classes.
 *
 * Verified against genuine Strict files in the wild: real `.rels` parts pair the
 * canonical OPC namespace with Strict relationship types, and the purl forms of
 * the package / markup-compatibility namespaces appear only in library mapping
 * code, never in actual packages.
 */

const STRICT_PKG_NS = 'http://purl.oclc.org/ooxml/package';
const STRICT_MCE_NS = 'http://purl.oclc.org/ooxml/markup-compatibility';
const OPC_RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OPC_CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const OFFICE_DOC_REL_STRICT =
	'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument';
const CORE_PROPS_REL_OPC =
	'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties';

beforeEach(() => {
	resetIdCounter();
});

async function buildDeckSavedAs(conformance: 'strict' | 'transitional') {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank').addText('hello strict', { x: 10, y: 10, width: 200, height: 50 }).build(),
	);
	const bytes = await handler.save(data.slides, { conformance });
	return { bytes, zip: await JSZip.loadAsync(bytes) };
}

async function readAllTextParts(zip: JSZip): Promise<Map<string, string>> {
	const parts = new Map<string, string>();
	const paths: string[] = [];
	zip.forEach((p) => {
		if (p.endsWith('.xml') || p.endsWith('.rels')) {
			paths.push(p);
		}
	});
	for (const p of paths) {
		parts.set(p, await zip.file(p)!.async('string'));
	}
	return parts;
}

describe('strict conformance: real package structure', () => {
	it('marks the presentation root as strict with Strict markup namespaces', async () => {
		const { zip } = await buildDeckSavedAs('strict');
		const presXml = await zip.file('ppt/presentation.xml')!.async('string');

		expect(presXml).toMatch(/<p:presentation\b[^>]*\bconformance="strict"/u);
		// Markup-language namespaces switch to the Strict (purl.oclc.org) form.
		expect(presXml).toContain('http://purl.oclc.org/ooxml/presentationml/main');
		expect(presXml).toContain('http://purl.oclc.org/ooxml/drawingml/main');
		expect(presXml).toContain('http://purl.oclc.org/ooxml/officeDocument/relationships');
		// ...and never the Transitional form for those families.
		expect(presXml).not.toContain('http://schemas.openxmlformats.org/presentationml/2006/main');
		expect(presXml).not.toContain('http://schemas.openxmlformats.org/drawingml/2006/main');
	});

	it('keeps OPC relationships parts canonical while using Strict relationship types', async () => {
		const { zip } = await buildDeckSavedAs('strict');
		const parts = await readAllTextParts(zip);

		const relsParts = [...parts].filter(([p]) => p.endsWith('.rels'));
		expect(relsParts.length).toBeGreaterThan(0);

		for (const [path, xml] of relsParts) {
			// The OPC relationships namespace is conformance-independent.
			expect(xml, `${path} must keep the canonical OPC relationships namespace`).toContain(
				`xmlns="${OPC_RELS_NS}"`,
			);
			expect(xml, `${path} must not use a Strict package namespace`).not.toContain(STRICT_PKG_NS);
			// OPC-defined relationship types stay canonical too.
			if (xml.includes('core-properties')) {
				expect(xml).toContain(CORE_PROPS_REL_OPC);
			}
		}

		// The package-level document relationship uses the Strict type URI.
		const rootRels = parts.get('_rels/.rels')!;
		expect(rootRels).toContain(OFFICE_DOC_REL_STRICT);
		// Slide / theme / layout relationship types (officeDocument family) are Strict.
		const presRels = parts.get('ppt/_rels/presentation.xml.rels')!;
		expect(presRels).toContain('http://purl.oclc.org/ooxml/officeDocument/relationships/slide');
		expect(presRels).toContain('http://purl.oclc.org/ooxml/officeDocument/relationships/theme');
		expect(presRels).not.toContain(
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
		);
	});

	it('keeps [Content_Types].xml and content-type strings canonical', async () => {
		const { zip } = await buildDeckSavedAs('strict');
		const ct = await zip.file('[Content_Types].xml')!.async('string');

		expect(ct).toContain(`xmlns="${OPC_CT_NS}"`);
		expect(ct).not.toContain('purl.oclc.org');
		// Content types are conformance-independent media-type strings.
		expect(ct).toContain('application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
		expect(ct).toContain(
			'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
		);
	});

	it('never emits Strict forms of the conformance-independent shared specs', async () => {
		const { zip } = await buildDeckSavedAs('strict');
		const parts = await readAllTextParts(zip);

		for (const [path, xml] of parts) {
			expect(xml, `${path} must not contain a Strict OPC namespace`).not.toContain(STRICT_PKG_NS);
			expect(xml, `${path} must not contain a Strict markup-compatibility namespace`).not.toContain(
				STRICT_MCE_NS,
			);
		}
	});

	it('uses Strict markup namespaces inside slide / layout / master / theme parts', async () => {
		const { zip } = await buildDeckSavedAs('strict');
		const parts = await readAllTextParts(zip);

		const markupParts = [...parts].filter(([p]) =>
			/ppt\/(?:slides|slideLayouts|slideMasters|theme)\/.*\.xml$/u.test(p),
		);
		expect(markupParts.length).toBeGreaterThan(0);
		for (const [path, xml] of markupParts) {
			expect(xml, `${path} should use Strict drawingml`).toContain(
				'http://purl.oclc.org/ooxml/drawingml/main',
			);
			expect(xml, `${path} should not use Transitional drawingml`).not.toContain(
				'http://schemas.openxmlformats.org/drawingml/2006/main',
			);
		}
	});

	it('produces identical content types regardless of conformance class', async () => {
		const strict = await buildDeckSavedAs('strict');
		const transitional = await buildDeckSavedAs('transitional');
		const strictCt = await strict.zip.file('[Content_Types].xml')!.async('string');
		const transitionalCt = await transitional.zip.file('[Content_Types].xml')!.async('string');
		expect(strictCt).toBe(transitionalCt);
	});
});

describe('strict conformance: load and re-save round-trip', () => {
	it('detects Strict on load and preserves it across a re-save (default preserve)', async () => {
		const { bytes } = await buildDeckSavedAs('strict');

		const handler = new PptxHandler();
		const data = await handler.load(bytes.buffer as ArrayBuffer);
		expect(data.slides).toHaveLength(1);

		// Re-save with the default 'preserve' conformance: the detected Strict
		// class must survive without explicitly asking for it again.
		const resaved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(resaved);

		const presXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presXml).toMatch(/conformance="strict"/u);
		expect(presXml).toContain('http://purl.oclc.org/ooxml/presentationml/main');

		const rootRels = await zip.file('_rels/.rels')!.async('string');
		expect(rootRels).toContain(`xmlns="${OPC_RELS_NS}"`);
		expect(rootRels).not.toContain(STRICT_PKG_NS);
	});

	it('can downgrade a Strict file to Transitional on save', async () => {
		const { bytes } = await buildDeckSavedAs('strict');

		const handler = new PptxHandler();
		const data = await handler.load(bytes.buffer as ArrayBuffer);
		const resaved = await handler.save(data.slides, { conformance: 'transitional' });
		const zip = await JSZip.loadAsync(resaved);

		const presXml = await zip.file('ppt/presentation.xml')!.async('string');
		expect(presXml).not.toMatch(/conformance="strict"/u);
		expect(presXml).toContain('http://schemas.openxmlformats.org/presentationml/2006/main');
		expect(presXml).not.toContain('http://purl.oclc.org/ooxml/presentationml/main');
	});
});
