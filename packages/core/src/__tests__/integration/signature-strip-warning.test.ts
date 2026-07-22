import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Editing any part of a signed OOXML package invalidates every XML-DSig
 * signature, so `stripDigitalSignatures` removes the `_xmlsignatures/` parts
 * on save. This used to happen silently; it must now surface a typed
 * `SAVE_SIGNATURES_STRIPPED` compatibility warning (scope `save`) so callers
 * can prompt the user or re-sign, and the signature parts must actually be
 * gone from the saved package.
 */
describe('digital signature stripping visibility', () => {
	async function buildSignedPptx(): Promise<Uint8Array> {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const baseBytes = await handler.save(data.slides);

		const zip = await JSZip.loadAsync(baseBytes);
		// Inject minimal digital-signature parts so load-time detection fires.
		zip.file(
			'_xmlsignatures/origin.sigs',
			'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
		);
		zip.file(
			'_xmlsignatures/sig1.xml',
			'<?xml version="1.0"?><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/>',
		);

		// Add the digital-signature-origin relationship to the package rels.
		const relsXml = await zip.file('_rels/.rels')!.async('string');
		const patchedRels = relsXml.replace(
			'</Relationships>',
			'<Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin" Target="_xmlsignatures/origin.sigs"/></Relationships>',
		);
		zip.file('_rels/.rels', patchedRels);

		return zip.generateAsync({ type: 'uint8array' });
	}

	it('emits SAVE_SIGNATURES_STRIPPED and removes the signature parts on save', async () => {
		const signedBytes = await buildSignedPptx();

		const handler = new PptxHandler();
		const data = await handler.load(signedBytes.buffer as ArrayBuffer);

		const saved = await handler.save(data.slides);

		const warnings = handler.getCompatibilityWarnings();
		const stripped = warnings.find((w) => w.code === 'SAVE_SIGNATURES_STRIPPED');
		expect(stripped).toBeDefined();
		expect(stripped?.scope).toBe('save');
		expect(stripped?.severity).toBe('warning');

		// The signature parts must be gone from the saved package.
		const savedZip = await JSZip.loadAsync(saved);
		const remainingSigParts = Object.keys(savedZip.files).filter((p) =>
			p.startsWith('_xmlsignatures/'),
		);
		expect(remainingSigParts).toStrictEqual([]);
	});

	it('does not emit the warning for an unsigned presentation', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const baseBytes = await handler.save(data.slides);

		const reload = new PptxHandler();
		const reloaded = await reload.load(baseBytes.buffer as ArrayBuffer);
		await reload.save(reloaded.slides);

		const codes = reload.getCompatibilityWarnings().map((w) => w.code);
		expect(codes).not.toContain('SAVE_SIGNATURES_STRIPPED');
	});
});
